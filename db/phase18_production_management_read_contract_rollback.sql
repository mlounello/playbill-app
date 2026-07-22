revoke all on function app_playbill.production_management_shows(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app_playbill.production_management_show_roles(uuid, uuid)
  from public, anon, authenticated, service_role;

drop function if exists app_playbill.production_management_shows(uuid);
drop function if exists app_playbill.production_management_show_roles(uuid, uuid);

