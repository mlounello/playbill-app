-- Rollback for phase9_policy_containment.sql

create policy "authenticated manage exports" on app_playbill.exports
for all
to authenticated
using (true)
with check (true);

create policy "authenticated manage submission_requests" on app_playbill.submission_requests
for all
to authenticated
using (true)
with check (true);

create policy "authenticated manage submissions" on app_playbill.submissions
for all
to authenticated
using (true)
with check (true);

