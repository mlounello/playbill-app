-- Emergency functional rollback for Phase 17.
-- Prefer restoring the pre-change catalog backup for an exact policy-name rollback.
-- This script changes permissions only; it never changes Playbill rows or storage.

begin;

grant usage on schema app_playbill to anon, authenticated, service_role;
grant select on all tables in schema app_playbill to anon;
grant select, insert, update, delete on all tables in schema app_playbill to authenticated;

do $block$
declare
  table_name text;
begin
  foreach table_name in array array[
    'assets', 'departments', 'note_templates', 'people', 'program_modules',
    'programs', 'role_templates', 'season_events', 'seasons',
    'show_departments', 'show_roles', 'show_style_settings', 'shows'
  ]
  loop
    execute format(
      'create policy %I on app_playbill.%I for select to anon, authenticated using (true)',
      'phase17 rollback public read',
      table_name
    );
  end loop;

  foreach table_name in array array[
    'assets', 'people', 'programs', 'show_roles', 'shows'
  ]
  loop
    execute format(
      'create policy %I on app_playbill.%I for all to authenticated using (true) with check (true)',
      'phase17 rollback authenticated manage',
      table_name
    );
  end loop;

  foreach table_name in array array[
    'audit_log', 'backup_role_templates_20260224', 'backup_show_roles_20260224',
    'departments', 'exports', 'note_templates', 'program_modules', 'role_templates',
    'season_events', 'seasons', 'show_departments', 'show_style_settings',
    'submission_requests', 'submissions'
  ]
  loop
    execute format(
      'create policy %I on app_playbill.%I for all to authenticated using (app_playbill.get_user_role() in (''owner'', ''admin'', ''editor'')) with check (app_playbill.get_user_role() in (''owner'', ''admin'', ''editor''))',
      'phase17 rollback staff manage',
      table_name
    );
  end loop;
end
$block$;

create policy "phase17 rollback own profile"
on app_playbill.user_profiles
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant execute on function app_playbill.get_user_role() to anon, authenticated, service_role;

commit;
