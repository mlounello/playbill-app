-- Phase 13: per-person submission controls.
-- Safe/backward-compatible: existing people keep using the show-level
-- bio_char_limit unless this nullable override is set.

alter table app_playbill.people
  add column if not exists bio_char_limit_override integer;

alter table app_playbill.people
  drop constraint if exists people_bio_char_limit_override_range;

alter table app_playbill.people
  add constraint people_bio_char_limit_override_range
  check (
    bio_char_limit_override is null
    or bio_char_limit_override between 100 and 2000
  );
