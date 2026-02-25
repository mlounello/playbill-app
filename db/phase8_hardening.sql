-- Phase 8 hardening migration (safe / non-destructive)
-- Purpose: improve query performance and stability on active tables.
-- This migration does NOT drop tables or columns.

begin;

-- Shows
create index if not exists idx_shows_program_id on public.shows (program_id);
create index if not exists idx_shows_slug on public.shows (slug);
create index if not exists idx_shows_status on public.shows (status);
create index if not exists idx_shows_is_published on public.shows (is_published);

-- Programs
create index if not exists idx_programs_slug on public.programs (slug);

-- People
create index if not exists idx_people_program_id on public.people (program_id);
create index if not exists idx_people_program_submission_status on public.people (program_id, submission_status);
create index if not exists idx_people_program_email on public.people (program_id, email);

-- Show roles
create index if not exists idx_show_roles_show_id on public.show_roles (show_id);
create index if not exists idx_show_roles_person_id on public.show_roles (person_id);
create index if not exists idx_show_roles_show_category on public.show_roles (show_id, category);
create index if not exists idx_show_roles_show_billing_order on public.show_roles (show_id, billing_order);
create index if not exists idx_show_roles_show_bio_order on public.show_roles (show_id, bio_order);

-- Submission requests / submissions
create index if not exists idx_submission_requests_show_role_id on public.submission_requests (show_role_id);
create index if not exists idx_submission_requests_status on public.submission_requests (status);
create index if not exists idx_submission_requests_due_date on public.submission_requests (due_date);

create index if not exists idx_submissions_request_id on public.submissions (request_id);
create index if not exists idx_submissions_status on public.submissions (status);
create index if not exists idx_submissions_updated_at on public.submissions (updated_at);

-- Program modules
create index if not exists idx_program_modules_show_id on public.program_modules (show_id);
create index if not exists idx_program_modules_show_order on public.program_modules (show_id, module_order);
create index if not exists idx_program_modules_show_visible on public.program_modules (show_id, visible);

-- Role templates / note templates
create index if not exists idx_role_templates_scope_show on public.role_templates (scope, show_id);
create index if not exists idx_role_templates_category on public.role_templates (category);
create index if not exists idx_role_templates_hidden on public.role_templates (is_hidden);

create index if not exists idx_note_templates_scope_show on public.note_templates (scope, show_id);
create index if not exists idx_note_templates_type on public.note_templates (request_type);
create index if not exists idx_note_templates_archived on public.note_templates (is_archived);

-- Departments / season content
create index if not exists idx_show_departments_show_sort on public.show_departments (show_id, sort_order);
create index if not exists idx_show_departments_department on public.show_departments (department_id);

create index if not exists idx_season_events_season_start_sort
  on public.season_events (season_id, event_start_date, sort_order);

commit;

-- Optional future (destructive) cleanup should be done in a separate migration:
-- 1) verify no runtime references
-- 2) backup/export
-- 3) run DROP statements with rollback plan
