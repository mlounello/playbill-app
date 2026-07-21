\set ON_ERROR_STOP on
\pset pager off

begin transaction read only;

do $block$
declare
  unexpected_count integer;
  owner_user_id uuid;
  contributor_user_id uuid;
begin
  select count(*)
    into unexpected_count
  from pg_policies
  where schemaname = 'app_playbill';
  if unexpected_count <> 0 then
    raise exception 'Expected zero Playbill raw-table policies; found %', unexpected_count;
  end if;

  select count(*)
    into unexpected_count
  from information_schema.role_table_grants
  where table_schema = 'app_playbill'
    and grantee in ('PUBLIC', 'anon', 'authenticated');
  if unexpected_count <> 0 then
    raise exception 'Unexpected browser-role table grants remain: %', unexpected_count;
  end if;

  if has_schema_privilege('anon', 'app_playbill', 'USAGE') then
    raise exception 'anon still has Playbill schema usage';
  end if;
  if not has_schema_privilege('authenticated', 'app_playbill', 'USAGE') then
    raise exception 'authenticated requires schema usage for get_user_role';
  end if;
  if has_function_privilege('anon', 'app_playbill.get_user_role()', 'EXECUTE') then
    raise exception 'anon can still execute get_user_role';
  end if;
  if not has_function_privilege('authenticated', 'app_playbill.get_user_role()', 'EXECUTE') then
    raise exception 'authenticated cannot execute get_user_role';
  end if;

  select user_id into owner_user_id from core.platform_owners limit 1;
  if owner_user_id is null then
    raise exception 'Protected platform owner is missing';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', owner_user_id::text, 'role', 'authenticated')::text,
    true
  );
  if app_playbill.get_user_role() is distinct from 'owner' then
    raise exception 'Protected owner did not resolve to owner';
  end if;

  select up.user_id
    into contributor_user_id
  from app_playbill.user_profiles up
  where up.user_id <> owner_user_id
  order by up.created_at
  limit 1;
  if contributor_user_id is not null then
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', contributor_user_id::text, 'role', 'authenticated')::text,
      true
    );
    if app_playbill.get_user_role() is not null then
      raise exception 'Contributor incorrectly received a staff membership role';
    end if;
  end if;
end
$block$;

select 'row_counts_unchanged_check' as check_name,
       (select count(*) from app_playbill.people) as people,
       (select count(*) from app_playbill.programs) as programs,
       (select count(*) from app_playbill.shows) as shows,
       (select count(*) from app_playbill.submission_requests) as submission_requests,
       (select count(*) from app_playbill.submissions) as submissions,
       (select count(*) from app_playbill.audit_log) as audit_log;

select 'cross_app_trigger_preserved' as check_name,
       exists (
         select 1
         from pg_trigger t
         join pg_class c on c.oid = t.tgrelid
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'app_playbill'
           and c.relname = 'people'
           and t.tgname = 'sync_publicity_to_production_management'
           and not t.tgisinternal
       ) as passed;

rollback;
