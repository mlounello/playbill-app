-- LEGACY / NON-CANONICAL
-- This file targets the old public-schema Playbill database shape.
-- Do not use this file as the setup or verification path for the current schema-scoped Playbill app.
-- Canonical schema-scoped setup lives in:
--   - playbill_schema_app.sql
--   - playbill_data_app.sql
--
-- Historical note:
-- Phase 8 audit queries (read-only)
-- Run in Supabase SQL editor to inventory current table usage before any destructive cleanup.

select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

select 'programs' as table_name, count(*) as row_count from public.programs
union all select 'shows', count(*) from public.shows
union all select 'people', count(*) from public.people
union all select 'show_roles', count(*) from public.show_roles
union all select 'submission_requests', count(*) from public.submission_requests
union all select 'submissions', count(*) from public.submissions
union all select 'program_modules', count(*) from public.program_modules
union all select 'role_templates', count(*) from public.role_templates
union all select 'note_templates', count(*) from public.note_templates
union all select 'departments', count(*) from public.departments
union all select 'show_departments', count(*) from public.show_departments
union all select 'seasons', count(*) from public.seasons
union all select 'season_events', count(*) from public.season_events;
