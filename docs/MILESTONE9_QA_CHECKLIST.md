# Milestone 9 QA Checklist

Use this checklist when running a full real-program import.

## 1) Auth and Roles
- [ ] Magic link login works in production and returns to `/app/shows`.
- [ ] Admin/Editor can access `/app/*`.
- [ ] Contributor can access `/contribute/*` only.
- [ ] Public can access only published `/p/{showSlug}`.

## 2) Show + Program Core
- [ ] Create a new show from `/app/shows/new`.
- [ ] Program Plan reorder/show-hide persists after refresh.
- [ ] Optional modules omitted do not render blank sections.
- [ ] `/programs/{slug}` renders with expected page sequence.

## 3) People + Submissions
- [ ] Manual add person works.
- [ ] Bulk import `Name | Role | cast|production | email` works.
- [ ] Contributor task list shows only assigned records.
- [ ] Contributor save draft + submit updates status correctly.
- [ ] Admin approve/return/lock actions work.
- [ ] Returned message appears for contributor.
- [ ] Locked/approved submissions are read-only across both task flows.

## 4) Headshots + Assets
- [ ] Contributor upload accepts image file and saves preview.
- [ ] Admin upload works in review panel.
- [ ] Upload auto-crops to square and stores optimized image.
- [ ] `people.headshot_url` is updated after upload.
- [ ] `assets` table receives upload metadata row.

## 5) Export and Print
- [ ] Export tab generates proof export job.
- [ ] Export tab generates print export job.
- [ ] Export history records status + timestamps.
- [ ] Proof PDF downloads and opens.
- [ ] Print PDF downloads and opens.
- [ ] Print PDF is 2-up booklet spreads and reads in correct folded order.

## 6) Publish and Public Viewer
- [ ] Publish toggle enables `/p/{showSlug}`.
- [ ] Unpublish returns 404 for `/p/{showSlug}`.
- [ ] Public flip viewer navigation works (buttons + keyboard arrows).
- [ ] Table of contents jumps to the expected section/spread.
- [ ] Scroll view toggle works.
- [ ] Public proof/print PDF links work when published.

## 7) Reminders and Deadlines
- [ ] Overview can set a global due date for submission requests.
- [ ] Send Invites action records audit entries.
- [ ] Send Reminders Now action records audit entries.
- [ ] Cron endpoint `/api/cron/reminders` runs with valid bearer secret.
- [ ] Overdue and due-soon summary numbers look correct.

## 8) Accessibility and Hardening
- [ ] Skip link appears on keyboard focus and jumps to content.
- [ ] Public viewer announces spread changes (`aria-live`).
- [ ] `/api/health` returns `ok: true` in production.
- [ ] Security headers present (`nosniff`, `SAMEORIGIN`, referrer policy).

## 9) Regression Scan
- [ ] Legacy `/programs/{slug}/submit` still works for unlocked records.
- [ ] `/p/{slug}` handles both show slug and legacy program slug.
- [ ] No server-side exception digest appears during core flows.
