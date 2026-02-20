# Siena Theatre Program Builder - Implementation Plan

## Current Baseline
- Existing program creation/edit/view flow (`/programs/*`)
- Roster-first bio submission pipeline
- Booklet-imposition preview and print-oriented views

## Platform Foundation (Now)
- Added `/app` admin route scaffolding
- Added `/contribute` contributor route scaffolding
- Added `/p/{showSlug}` public program route scaffolding
- Added Supabase schema foundation tables for shows, style settings, modules, submissions, assets, audit, exports

## Milestone 1: Auth + Roles + Show Workspace
- Supabase magic link auth for Admin/Editor/Contributor
- Role-based route guards on `/app`, `/contribute`
- Replace placeholder workspace tabs with live data actions

## Milestone 2: Program Plan Builder
- Module list with drag/drop, show/hide, filler-eligible
- Module config drawers and per-module settings
- Persist ordered modules in `program_modules`

## Milestone 3: People, Roles, and Submission Tasks
- CSV import for people + roles
- Multi-role assignments per person
- Submission request generation per role
- Contributor dashboard with task states and due dates

## Milestone 4: Review, Approval, Audit
- Admin review panel for submissions
- Approve/return/lock workflow
- Audit log UI and record history

## Milestone 5: Export and Publish
- Proof PDF (5.5x8.5)
- Print-imposed PDF (8.5x11, short-edge saddle stitch)
- Public publish controls and web viewer options

## Milestone 6: Reminder Automation
- Invite emails + reminder cadence
- Due-date warnings in dashboard
- Scheduled reminder jobs

## Notes
- Existing `programs` table remains active during migration.
- New `shows` domain tables are in place for phased transition without downtime.
