-- Phase 12: migrate active Turning of the Tide note slots to flexible Contributor Notes.
-- This is intentionally scoped to the current active show. Older completed shows
-- keep their legacy note records so submitted historical notes are untouched.

begin;

create temporary table tmp_turning_tide_note_modules on commit drop as
select
  pm.id as module_id,
  pm.show_id,
  pm.module_type as legacy_module_type,
  case
    when pm.module_type = 'director_note' then 'Director''s Note'
    when pm.module_type = 'dramaturgical_note' then 'Dramaturgical Note'
    when pm.module_type = 'music_director_note' and lower(trim(pm.display_title)) = 'playwright note' then 'Playwright''s Note'
    when trim(pm.display_title) <> '' then pm.display_title
    else 'Contributor Note'
  end as module_title
from app_playbill.program_modules pm
join app_playbill.shows s on s.id = pm.show_id
where s.title = 'Turning of the Tide'
  and pm.module_type in ('director_note', 'dramaturgical_note', 'music_director_note');

update app_playbill.submission_requests sr
set
  request_type = 'note',
  label = tmp.module_title || ' Submission',
  constraints = coalesce(sr.constraints, '{}'::jsonb)
    || jsonb_build_object(
      'module_id', tmp.module_id::text,
      'module_title', tmp.module_title,
      'maxWords', 400,
      'legacy_request_type', sr.request_type
    ),
  updated_at = now()
from tmp_turning_tide_note_modules tmp
join app_playbill.show_roles role on role.show_id = tmp.show_id
where sr.show_role_id = role.id
  and sr.request_type = tmp.legacy_module_type
  and not exists (
    select 1
    from app_playbill.submissions sub
    where sub.request_id = sr.id
  );

update app_playbill.program_modules pm
set
  module_type = 'contributor_note',
  display_title = tmp.module_title,
  settings = coalesce(pm.settings, '{}'::jsonb)
    || jsonb_build_object('legacy_module_type', tmp.legacy_module_type),
  updated_at = now()
from tmp_turning_tide_note_modules tmp
where pm.id = tmp.module_id;

commit;
