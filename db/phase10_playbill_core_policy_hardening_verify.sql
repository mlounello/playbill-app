with expected(table_name, blanket_policy, admin_read, admin_insert, admin_update, admin_delete, public_policy) as (
  values
    ('departments', 'authenticated manage departments', 'departments admin read', 'departments admin insert', 'departments admin update', 'departments admin delete', 'public_read_departments'),
    ('note_templates', 'authenticated manage note_templates', 'note_templates admin read', 'note_templates admin insert', 'note_templates admin update', 'note_templates admin delete', 'public_read_note_templates'),
    ('program_modules', 'authenticated manage program_modules', 'program_modules admin read', 'program_modules admin insert', 'program_modules admin update', 'program_modules admin delete', 'public_read_program_modules'),
    ('role_templates', 'authenticated manage role_templates', 'role_templates admin read', 'role_templates admin insert', 'role_templates admin update', 'role_templates admin delete', 'public_read_role_templates'),
    ('season_events', 'authenticated manage season_events', 'season_events admin read', 'season_events admin insert', 'season_events admin update', 'season_events admin delete', 'public_read_season_events'),
    ('seasons', 'authenticated manage seasons', 'seasons admin read', 'seasons admin insert', 'seasons admin update', 'seasons admin delete', 'public_read_seasons'),
    ('show_departments', 'authenticated manage show_departments', 'show_departments admin read', 'show_departments admin insert', 'show_departments admin update', 'show_departments admin delete', 'public_read_show_departments'),
    ('show_style_settings', 'authenticated manage show_style_settings', 'show_style_settings admin read', 'show_style_settings admin insert', 'show_style_settings admin update', 'show_style_settings admin delete', 'public_read_show_style_settings')
)
select
  e.table_name,
  not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'app_playbill'
      and p.tablename = e.table_name
      and p.policyname = e.blanket_policy
  ) as blanket_policy_removed,
  exists (
    select 1
    from pg_policies p
    where p.schemaname = 'app_playbill'
      and p.tablename = e.table_name
      and p.policyname = e.admin_read
      and p.cmd = 'SELECT'
  ) as admin_read_exists,
  exists (
    select 1
    from pg_policies p
    where p.schemaname = 'app_playbill'
      and p.tablename = e.table_name
      and p.policyname = e.admin_insert
      and p.cmd = 'INSERT'
  ) as admin_insert_exists,
  exists (
    select 1
    from pg_policies p
    where p.schemaname = 'app_playbill'
      and p.tablename = e.table_name
      and p.policyname = e.admin_update
      and p.cmd = 'UPDATE'
  ) as admin_update_exists,
  exists (
    select 1
    from pg_policies p
    where p.schemaname = 'app_playbill'
      and p.tablename = e.table_name
      and p.policyname = e.admin_delete
      and p.cmd = 'DELETE'
  ) as admin_delete_exists,
  exists (
    select 1
    from pg_policies p
    where p.schemaname = 'app_playbill'
      and p.tablename = e.table_name
      and p.policyname = e.public_policy
  ) as public_read_policy_present
from expected e
order by e.table_name;
