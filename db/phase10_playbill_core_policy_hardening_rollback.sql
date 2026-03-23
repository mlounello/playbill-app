begin;

drop policy if exists "departments admin read" on app_playbill.departments;
drop policy if exists "departments admin insert" on app_playbill.departments;
drop policy if exists "departments admin update" on app_playbill.departments;
drop policy if exists "departments admin delete" on app_playbill.departments;
create policy "authenticated manage departments" on app_playbill.departments
for all
to authenticated
using (true)
with check (true);

drop policy if exists "note_templates admin read" on app_playbill.note_templates;
drop policy if exists "note_templates admin insert" on app_playbill.note_templates;
drop policy if exists "note_templates admin update" on app_playbill.note_templates;
drop policy if exists "note_templates admin delete" on app_playbill.note_templates;
create policy "authenticated manage note_templates" on app_playbill.note_templates
for all
to authenticated
using (true)
with check (true);

drop policy if exists "program_modules admin read" on app_playbill.program_modules;
drop policy if exists "program_modules admin insert" on app_playbill.program_modules;
drop policy if exists "program_modules admin update" on app_playbill.program_modules;
drop policy if exists "program_modules admin delete" on app_playbill.program_modules;
create policy "authenticated manage program_modules" on app_playbill.program_modules
for all
to authenticated
using (true)
with check (true);

drop policy if exists "role_templates admin read" on app_playbill.role_templates;
drop policy if exists "role_templates admin insert" on app_playbill.role_templates;
drop policy if exists "role_templates admin update" on app_playbill.role_templates;
drop policy if exists "role_templates admin delete" on app_playbill.role_templates;
create policy "authenticated manage role_templates" on app_playbill.role_templates
for all
to authenticated
using (true)
with check (true);

drop policy if exists "season_events admin read" on app_playbill.season_events;
drop policy if exists "season_events admin insert" on app_playbill.season_events;
drop policy if exists "season_events admin update" on app_playbill.season_events;
drop policy if exists "season_events admin delete" on app_playbill.season_events;
create policy "authenticated manage season_events" on app_playbill.season_events
for all
to authenticated
using (true)
with check (true);

drop policy if exists "seasons admin read" on app_playbill.seasons;
drop policy if exists "seasons admin insert" on app_playbill.seasons;
drop policy if exists "seasons admin update" on app_playbill.seasons;
drop policy if exists "seasons admin delete" on app_playbill.seasons;
create policy "authenticated manage seasons" on app_playbill.seasons
for all
to authenticated
using (true)
with check (true);

drop policy if exists "show_departments admin read" on app_playbill.show_departments;
drop policy if exists "show_departments admin insert" on app_playbill.show_departments;
drop policy if exists "show_departments admin update" on app_playbill.show_departments;
drop policy if exists "show_departments admin delete" on app_playbill.show_departments;
create policy "authenticated manage show_departments" on app_playbill.show_departments
for all
to authenticated
using (true)
with check (true);

drop policy if exists "show_style_settings admin read" on app_playbill.show_style_settings;
drop policy if exists "show_style_settings admin insert" on app_playbill.show_style_settings;
drop policy if exists "show_style_settings admin update" on app_playbill.show_style_settings;
drop policy if exists "show_style_settings admin delete" on app_playbill.show_style_settings;
create policy "authenticated manage show_style_settings" on app_playbill.show_style_settings
for all
to authenticated
using (true)
with check (true);

commit;
