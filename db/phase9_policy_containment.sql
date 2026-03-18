-- Phase 1 containment: remove redundant blanket authenticated policies on
-- tables that already have narrower admin/editor policies in place.

drop policy if exists "authenticated manage exports" on app_playbill.exports;
drop policy if exists "authenticated manage submission_requests" on app_playbill.submission_requests;
drop policy if exists "authenticated manage submissions" on app_playbill.submissions;

