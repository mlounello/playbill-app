alter table app_playbill.shows
  add column if not exists bio_intake_mode text not null default 'playbill_standalone';

alter table app_playbill.people
  add column if not exists submission_source text not null default 'playbill',
  add column if not exists production_management_person_id uuid,
  add column if not exists production_management_approval_id uuid,
  add column if not exists source_profile_version integer;

alter table app_playbill.submission_requests
  add column if not exists submission_source text not null default 'playbill';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shows_bio_intake_mode_check' and conrelid = 'app_playbill.shows'::regclass) then
    alter table app_playbill.shows add constraint shows_bio_intake_mode_check
      check (bio_intake_mode in ('playbill_standalone', 'production_managed', 'hybrid'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'people_submission_source_check' and conrelid = 'app_playbill.people'::regclass) then
    alter table app_playbill.people add constraint people_submission_source_check
      check (submission_source in ('playbill', 'production_management'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'submission_requests_source_check' and conrelid = 'app_playbill.submission_requests'::regclass) then
    alter table app_playbill.submission_requests add constraint submission_requests_source_check
      check (submission_source in ('playbill', 'production_management'));
  end if;
end $$;

create index if not exists idx_playbill_people_submission_source
  on app_playbill.people (program_id, submission_source);

create index if not exists idx_playbill_requests_submission_source
  on app_playbill.submission_requests (submission_source, status);

comment on column app_playbill.shows.bio_intake_mode is
  'Standalone keeps the existing Playbill contributor flow; production_managed expects PM snapshots; hybrid permits both per person.';
