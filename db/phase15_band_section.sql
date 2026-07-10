-- Add a standalone Band list module to every existing show. New shows receive
-- the module from the default module list in lib/shows.ts.
insert into app_playbill.program_modules (
  show_id,
  module_type,
  display_title,
  module_order,
  visible,
  filler_eligible,
  settings
)
select
  shows.id,
  'band',
  'Band',
  coalesce((select max(existing.module_order) + 1 from app_playbill.program_modules existing where existing.show_id = shows.id), 0),
  true,
  false,
  '{"show_header": true, "role_list_grouping_enabled": true, "placement_mode": "flow", "separate_page": false, "keep_together": false}'::jsonb
from app_playbill.shows shows
where not exists (
  select 1
  from app_playbill.program_modules existing
  where existing.show_id = shows.id
    and existing.module_type = 'band'
);
