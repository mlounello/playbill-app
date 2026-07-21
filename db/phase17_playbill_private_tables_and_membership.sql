-- Phase 3 Playbill containment.
-- No rows, tables, columns, storage objects, or cross-app triggers are changed.

begin;

create or replace function app_playbill.get_user_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select case
    when core.is_platform_owner(auth.uid()) then 'owner'
    else (
      select lower(m.role)
      from core.app_memberships m
      where m.user_id = auth.uid()
        and m.app_id = 'playbill'
        and m.is_active = true
      limit 1
    )
  end;
$function$;

-- Remove every historical policy, including overlapping policies whose TRUE
-- clauses currently override the narrower rules.
do $block$
declare
  policy_row record;
begin
  for policy_row in
    select tablename, policyname
    from pg_policies
    where schemaname = 'app_playbill'
  loop
    execute format(
      'drop policy if exists %I on app_playbill.%I',
      policy_row.policyname,
      policy_row.tablename
    );
  end loop;
end
$block$;

-- Playbill's browser clients perform authentication only. All application
-- data access is server-side and separately authorized, so raw tables are
-- deny-by-default for browser roles.
revoke all privileges on all tables in schema app_playbill from public, anon, authenticated;
revoke all privileges on all sequences in schema app_playbill from public, anon, authenticated;
revoke all privileges on all functions in schema app_playbill from public, anon, authenticated;
revoke all on schema app_playbill from public, anon;

grant usage on schema app_playbill to authenticated, service_role;
grant execute on function app_playbill.get_user_role() to authenticated, service_role;

alter default privileges in schema app_playbill revoke all on tables from public, anon, authenticated;
alter default privileges in schema app_playbill revoke all on sequences from public, anon, authenticated;
alter default privileges in schema app_playbill revoke execute on functions from public, anon, authenticated;

commit;
