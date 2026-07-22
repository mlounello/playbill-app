-- Phase 18: narrow, server-only Production Management read contract.
-- These functions keep private Playbill tables private and avoid depending on
-- direct table SELECT grants for the linked-show picker and role reconciliation.

create or replace function app_playbill.production_management_shows(
  p_show_id uuid default null
)
returns table (
  id uuid,
  title text,
  slug text,
  status text,
  is_published boolean,
  start_date date,
  end_date date,
  venue text,
  season_tag text,
  program_id uuid,
  bio_intake_mode text,
  program_title text,
  program_slug text,
  theatre_name text,
  show_dates text
)
language sql
stable
security definer
set search_path = app_playbill, public
as $$
  select
    show_row.id,
    show_row.title::text,
    show_row.slug::text,
    show_row.status::text,
    show_row.is_published,
    show_row.start_date,
    show_row.end_date,
    show_row.venue::text,
    show_row.season_tag::text,
    show_row.program_id,
    coalesce(show_row.bio_intake_mode, 'playbill_standalone')::text,
    program_row.title::text,
    program_row.slug::text,
    program_row.theatre_name::text,
    program_row.show_dates::text
  from app_playbill.shows show_row
  left join app_playbill.programs program_row on program_row.id = show_row.program_id
  where p_show_id is null or show_row.id = p_show_id
  order by show_row.start_date desc nulls last, show_row.title;
$$;

create or replace function app_playbill.production_management_show_roles(
  p_show_id uuid default null,
  p_role_id uuid default null
)
returns table (
  id uuid,
  show_id uuid,
  person_id uuid,
  role_name text,
  category text
)
language sql
stable
security definer
set search_path = app_playbill, public
as $$
  select
    role_row.id,
    role_row.show_id,
    role_row.person_id,
    role_row.role_name::text,
    role_row.category::text
  from app_playbill.show_roles role_row
  where (p_show_id is null or role_row.show_id = p_show_id)
    and (p_role_id is null or role_row.id = p_role_id)
  order by role_row.category, role_row.role_name, role_row.id;
$$;

alter function app_playbill.production_management_shows(uuid) owner to postgres;
alter function app_playbill.production_management_show_roles(uuid, uuid) owner to postgres;

revoke all on function app_playbill.production_management_shows(uuid)
  from public, anon, authenticated;
revoke all on function app_playbill.production_management_show_roles(uuid, uuid)
  from public, anon, authenticated;

grant execute on function app_playbill.production_management_shows(uuid) to service_role;
grant execute on function app_playbill.production_management_show_roles(uuid, uuid) to service_role;
