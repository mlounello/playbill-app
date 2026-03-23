begin;

drop policy if exists "departments admin read" on app_playbill.departments;
create policy "departments admin read" on app_playbill.departments
for select
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "departments admin insert" on app_playbill.departments;
create policy "departments admin insert" on app_playbill.departments
for insert
to authenticated
with check (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "departments admin update" on app_playbill.departments;
create policy "departments admin update" on app_playbill.departments
for update
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'))
with check (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "departments admin delete" on app_playbill.departments;
create policy "departments admin delete" on app_playbill.departments
for delete
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "authenticated manage departments" on app_playbill.departments;

drop policy if exists "note_templates admin read" on app_playbill.note_templates;
create policy "note_templates admin read" on app_playbill.note_templates
for select
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "note_templates admin insert" on app_playbill.note_templates;
create policy "note_templates admin insert" on app_playbill.note_templates
for insert
to authenticated
with check (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "note_templates admin update" on app_playbill.note_templates;
create policy "note_templates admin update" on app_playbill.note_templates
for update
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'))
with check (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "note_templates admin delete" on app_playbill.note_templates;
create policy "note_templates admin delete" on app_playbill.note_templates
for delete
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "authenticated manage note_templates" on app_playbill.note_templates;

drop policy if exists "program_modules admin read" on app_playbill.program_modules;
create policy "program_modules admin read" on app_playbill.program_modules
for select
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "program_modules admin insert" on app_playbill.program_modules;
create policy "program_modules admin insert" on app_playbill.program_modules
for insert
to authenticated
with check (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "program_modules admin update" on app_playbill.program_modules;
create policy "program_modules admin update" on app_playbill.program_modules
for update
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'))
with check (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "program_modules admin delete" on app_playbill.program_modules;
create policy "program_modules admin delete" on app_playbill.program_modules
for delete
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "authenticated manage program_modules" on app_playbill.program_modules;

drop policy if exists "role_templates admin read" on app_playbill.role_templates;
create policy "role_templates admin read" on app_playbill.role_templates
for select
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "role_templates admin insert" on app_playbill.role_templates;
create policy "role_templates admin insert" on app_playbill.role_templates
for insert
to authenticated
with check (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "role_templates admin update" on app_playbill.role_templates;
create policy "role_templates admin update" on app_playbill.role_templates
for update
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'))
with check (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "role_templates admin delete" on app_playbill.role_templates;
create policy "role_templates admin delete" on app_playbill.role_templates
for delete
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "authenticated manage role_templates" on app_playbill.role_templates;

drop policy if exists "season_events admin read" on app_playbill.season_events;
create policy "season_events admin read" on app_playbill.season_events
for select
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "season_events admin insert" on app_playbill.season_events;
create policy "season_events admin insert" on app_playbill.season_events
for insert
to authenticated
with check (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "season_events admin update" on app_playbill.season_events;
create policy "season_events admin update" on app_playbill.season_events
for update
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'))
with check (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "season_events admin delete" on app_playbill.season_events;
create policy "season_events admin delete" on app_playbill.season_events
for delete
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "authenticated manage season_events" on app_playbill.season_events;

drop policy if exists "seasons admin read" on app_playbill.seasons;
create policy "seasons admin read" on app_playbill.seasons
for select
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "seasons admin insert" on app_playbill.seasons;
create policy "seasons admin insert" on app_playbill.seasons
for insert
to authenticated
with check (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "seasons admin update" on app_playbill.seasons;
create policy "seasons admin update" on app_playbill.seasons
for update
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'))
with check (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "seasons admin delete" on app_playbill.seasons;
create policy "seasons admin delete" on app_playbill.seasons
for delete
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "authenticated manage seasons" on app_playbill.seasons;

drop policy if exists "show_departments admin read" on app_playbill.show_departments;
create policy "show_departments admin read" on app_playbill.show_departments
for select
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "show_departments admin insert" on app_playbill.show_departments;
create policy "show_departments admin insert" on app_playbill.show_departments
for insert
to authenticated
with check (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "show_departments admin update" on app_playbill.show_departments;
create policy "show_departments admin update" on app_playbill.show_departments
for update
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'))
with check (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "show_departments admin delete" on app_playbill.show_departments;
create policy "show_departments admin delete" on app_playbill.show_departments
for delete
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "authenticated manage show_departments" on app_playbill.show_departments;

drop policy if exists "show_style_settings admin read" on app_playbill.show_style_settings;
create policy "show_style_settings admin read" on app_playbill.show_style_settings
for select
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "show_style_settings admin insert" on app_playbill.show_style_settings;
create policy "show_style_settings admin insert" on app_playbill.show_style_settings
for insert
to authenticated
with check (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "show_style_settings admin update" on app_playbill.show_style_settings;
create policy "show_style_settings admin update" on app_playbill.show_style_settings
for update
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'))
with check (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "show_style_settings admin delete" on app_playbill.show_style_settings;
create policy "show_style_settings admin delete" on app_playbill.show_style_settings
for delete
to authenticated
using (app_playbill.get_user_role() in ('admin', 'editor'));

drop policy if exists "authenticated manage show_style_settings" on app_playbill.show_style_settings;

commit;
