begin;

-- Preview-only dual path: queue events without removing the existing
-- synchronous trigger. Production cutover will be a separately approved gate.

create index if not exists idx_playbill_audit_entity_changed
  on app_playbill.audit_log (entity, entity_id, changed_at desc);
create index if not exists idx_playbill_audit_changed
  on app_playbill.audit_log (changed_at desc);
create index if not exists idx_playbill_requests_role_status_type
  on app_playbill.submission_requests (show_role_id, status, request_type);
create index if not exists idx_playbill_show_roles_template
  on app_playbill.show_roles (role_template_id)
  where role_template_id is not null;
create index if not exists idx_playbill_assets_show
  on app_playbill.assets (show_id)
  where show_id is not null;
create index if not exists idx_playbill_assets_person
  on app_playbill.assets (person_id)
  where person_id is not null;
create index if not exists idx_playbill_exports_show_created
  on app_playbill.exports (show_id, created_at desc);

create or replace function app_playbill.enqueue_production_management_publicity_change()
returns trigger
language plpgsql
security definer
set search_path = app_playbill, core, public
as $$
declare
  event_payload jsonb;
  event_fingerprint text;
begin
  if new.production_management_approval_id is null then
    return new;
  end if;

  event_payload := jsonb_build_object(
    'playbill_person_id', new.id,
    'production_management_approval_id', new.production_management_approval_id,
    'full_name', new.full_name,
    'bio', new.bio,
    'headshot_url', new.headshot_url,
    'submission_status', new.submission_status,
    'source_profile_version', new.source_profile_version
  );
  event_fingerprint := encode(extensions.digest(event_payload::text, 'sha256'), 'hex');

  perform core.enqueue_integration_event(
    'playbill',
    'production_management',
    'playbill.publicity.changed',
    'person',
    new.id,
    event_payload,
    format('publicity:%s:%s', new.id, event_fingerprint)
  );
  return new;
end;
$$;

alter function app_playbill.enqueue_production_management_publicity_change() owner to postgres;
revoke all on function app_playbill.enqueue_production_management_publicity_change()
  from public, anon, authenticated, service_role;

drop trigger if exists queue_publicity_to_production_management on app_playbill.people;
create trigger queue_publicity_to_production_management
after insert or update of
  full_name,
  bio,
  headshot_url,
  submission_status,
  production_management_approval_id
on app_playbill.people
for each row
execute function app_playbill.enqueue_production_management_publicity_change();

create or replace function app_playbill.process_production_management_publicity_events(
  worker_name text,
  batch_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = app_playbill, core, public
as $$
declare
  event core.integration_outbox;
  processed integer := 0;
  failed integer := 0;
  playbill_show_id uuid;
  playbill_person_id uuid;
  playbill_show_status text;
  playbill_show_is_published boolean;
  request_id text;
  request_count integer;
begin
  for event in
    select * from core.claim_integration_events(
      'playbill',
      'production_management',
      'production_management.publicity.approved',
      worker_name,
      batch_limit
    )
  loop
    begin
      playbill_show_id := nullif(event.payload ->> 'show_id', '')::uuid;
      playbill_person_id := nullif(event.payload ->> 'playbill_person_id', '')::uuid;
      if playbill_show_id is null or playbill_person_id is null then
        raise exception 'Production Management event is missing a Playbill target.';
      end if;

      select show_record.status::text, show_record.is_published
      into playbill_show_status, playbill_show_is_published
      from app_playbill.shows show_record
      where show_record.id = playbill_show_id
      for share;

      if playbill_show_status is null then
        raise exception 'The linked Playbill show was not found.';
      end if;
      if playbill_show_is_published then
        raise exception 'The linked Playbill show is published and read-only.';
      end if;
      if playbill_show_status <> 'draft' then
        raise exception 'The linked Playbill show is not a draft and cannot be changed.';
      end if;

      update app_playbill.people person
      set full_name = left(coalesce(event.payload ->> 'credited_name', person.full_name), 180),
          bio = coalesce(event.payload ->> 'bio', ''),
          headshot_url = coalesce(event.payload ->> 'headshot_url', ''),
          submission_status = 'submitted',
          submitted_at = now(),
          submission_source = 'production_management',
          production_management_person_id = nullif(event.payload ->> 'person_id', '')::uuid,
          production_management_approval_id = nullif(event.payload ->> 'submission_id', '')::uuid,
          source_profile_version = coalesce(
            nullif(event.payload ->> 'source_profile_version', '')::integer,
            person.source_profile_version
          )
      where person.id = playbill_person_id
        and person.submission_status <> 'locked';

      if not found then
        raise exception 'The linked Playbill person was not found or is locked.';
      end if;

      request_count := 0;
      for request_id in
        select value
        from jsonb_array_elements_text(coalesce(event.payload -> 'request_ids', '[]'::jsonb))
      loop
        update app_playbill.submission_requests request
        set status = 'submitted',
            submission_source = 'production_management'
        where request.id = request_id::uuid
          and request.request_type = 'bio'
          and request.status <> 'locked';
        request_count := request_count + 1;
      end loop;

      if request_count = 0 then
        raise exception 'The Production Management event did not include a Playbill bio request.';
      end if;

      insert into app_playbill.audit_log (
        entity,
        entity_id,
        field,
        before_value,
        after_value,
        reason
      )
      values (
        'person',
        playbill_person_id,
        'production_management_outbox',
        null,
        jsonb_build_object('event_id', event.id, 'request_count', request_count),
        'Applied an idempotent Production Management publicity outbox event.'
      );

      perform core.complete_integration_event(
        event.id,
        worker_name,
        true,
        '',
        jsonb_build_object(
          'playbill_person_id', playbill_person_id,
          'request_count', request_count
        )
      );
      processed := processed + 1;
    exception when others then
      perform core.complete_integration_event(event.id, worker_name, false, sqlerrm, '{}'::jsonb);
      failed := failed + 1;
    end;
  end loop;

  return jsonb_build_object('processed', processed, 'failed', failed);
end;
$$;

alter function app_playbill.process_production_management_publicity_events(text, integer)
  owner to postgres;
revoke all on function app_playbill.process_production_management_publicity_events(text, integer)
  from public, anon, authenticated;
grant execute on function app_playbill.process_production_management_publicity_events(text, integer)
  to service_role;

commit;
