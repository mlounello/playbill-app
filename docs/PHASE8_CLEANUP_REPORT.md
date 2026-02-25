# Phase 8 Cleanup Report

## Scope
Phase 8 focuses on repository cleanup and technical-debt reduction without breaking active flows.

## Completed in this pass
- Removed unused component:
  - `components/program-edit-draft-manager.tsx`
- Removed unused helpers from `lib/programs.ts`:
  - `buildRoleListHtml`
  - `splitCreativeAndProductionTeam`
- Updated top-level product docs in `README.md` so routes reflect current architecture (show workspace first, legacy program pages explicitly marked compatibility/debug).

## Rendering/Pagination behavior updates retained
- Role list module grouping is now configurable and backward-compatible:
  - grouping can be enabled/disabled per module
  - legacy `separate_page` records no longer force separation when grouping is enabled
- Billing/list sections can group with billing/list sections, but will not be mixed into regular note text packing pages.

## Intentionally retained (compatibility)
- `/programs/[slug]` and `/programs/[slug]/submit` remain active for export parity and compatibility.
- `/programs/[slug]/edit` remains as a compatibility redirect layer to `/app/shows/{id}?tab=settings`.
- Public viewer supports both modern show slug and legacy program slug links.

## Manual database cleanup checklist (safe-first)
Run these in Supabase SQL Editor before dropping anything:

```sql
-- 1) Inventory all public tables
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- 2) Verify critical tables have data
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
```

If you want to drop legacy columns/tables later, do it as a dedicated migration with:
- backup/export first
- explicit `drop ... if exists`
- rollback SQL in the same PR
- deploy-window validation on a staging copy

## Remaining Phase 8 sweep items
- Optional: generate a schema-diff migration to remove truly obsolete columns after production data audit.
- Optional: consolidate repeated `getTableColumns(...)` probes where schema is now stable.
- Optional: add CI gate for regression routes (`/app/shows/{id}`, `/programs/{slug}`, `/p/{showSlug}`).
