-- Phase 11: UX cleanup settings
-- Safe to run against the existing app_playbill schema. Existing shows keep the
-- current default bio limit unless an admin changes it per show.

alter table app_playbill.shows
  add column if not exists bio_char_limit integer not null default 375;

alter table app_playbill.shows
  drop constraint if exists shows_bio_char_limit_range;

alter table app_playbill.shows
  add constraint shows_bio_char_limit_range
  check (bio_char_limit between 100 and 2000);
