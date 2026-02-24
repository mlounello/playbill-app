# Playbill Builder

Create digital + printable theatre programs from cast bios, director notes, and credits.

## Stack

- Next.js (App Router, TypeScript)
- Supabase (Postgres)
- Vercel (hosting)

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (for auth redirects, e.g. `https://playbillapp.mlounello.com`)

3. In Supabase SQL editor, run:

- `db/schema.sql`

4. Start dev server:

```bash
npm run dev
```

## Vercel deploy

1. Push this repo to GitHub.
2. Import project in Vercel.
3. Add the same env vars in Vercel project settings.
4. Set your custom domain to `playbill.mlounello.com` in Vercel Domains.

## Supabase auth redirect setup (required for magic links)

In Supabase Dashboard:
1. Go to `Authentication` -> `URL Configuration`.
2. Set `Site URL` to your production URL (e.g. `https://playbillapp.mlounello.com`).
3. Add redirect URLs:
   - `https://playbillapp.mlounello.com/auth/callback`
   - `http://localhost:3000/auth/callback` (for local dev)

## Current MVP

- `/programs/new` to create a program.
- `/programs` to view all programs.
- `/programs/[slug]/edit` to edit a program.
- `/programs/[slug]` as public online layout with:
  - program-order view
  - booklet imposition view (2-up saddle stitch)
- `/programs/[slug]/submit` as a bio intake form for cast/production entries.
- Platform route scaffolds:
  - `/app/login` magic-link login
  - `/app/shows` role-gated admin workspace
  - `/contribute` role-gated contributor portal shell
  - `/p/[showSlug]` public viewer shell

## Milestone 1 implemented

- Supabase magic-link auth flow with callback:
  - `/app/login`
  - `/auth/callback`
  - `/auth/signout`
- Role-gated route areas:
  - Admin roles (`owner`, `admin`, `editor`) for `/app/shows*`
  - Contributor access for `/contribute`
- User profile bootstrap:
  - First authenticated user becomes `owner`
  - Later users default to `contributor`
- Show creation now writes to:
  - `shows`
  - `show_style_settings`
  - `program_modules`
  - linked base `programs` record for current editor/viewer compatibility

## Milestone 2 implemented

- Program Plan tab in show workspace:
  - `/app/shows/{showId}?tab=program-plan`
- Persisted module management (table: `program_modules`):
  - reorder modules
  - visibility toggle
  - filler-eligible toggle
  - module display title
  - module settings JSON

## Content model

- Any section can be omitted (director note, dramaturgical note, billing, ACTF ad, etc.).
- Empty sections are skipped automatically.
- Page count is auto-padded to a multiple of 4 for booklet printing.
- Cast and production bios are displayed alphabetically by name.
- Roster-first workflow:
  - upload roster with `Name | Role | cast|production | optional@email`
  - bio submissions must select a roster person and match roster email
  - billing auto-generates from roster role/name if billing page is blank
- Layout ordering is now managed with a reorderable checklist UI (not manual token typing).
- Supports optional:
  - headshots
  - production photo page
  - custom pages (text, image, photo grid)
  - acts and songs page

## Next recommended features

- Auth + role-based editing
- Rich text editor per page
- Direct Google Forms integration (webhook/Sheets sync)
- Photo uploads via Supabase Storage (instead of URLs)
- Program versioning + approval workflow

## Milestone 3 implemented (foundation)

- `/app/shows/{showId}?tab=people-roles`
  - manual person add
  - bulk person import (`Name | Role | cast|production | email`)
  - auto-creates `show_roles` + `submission_requests` records
- `/app/shows/{showId}?tab=submissions`
  - task list + quick actions (`approve`, `return`, `lock`)
  - opens detailed review at `/app/shows/{showId}/submissions/{personId}`
- `/contribute`
  - contributor task dashboard filtered by signed-in email
- `/contribute/shows/{showId}/tasks/{personId}`
  - contributor draft/save + submit flow
  - char-limit enforcement and status transitions
- Audit entries are written to `audit_log` when submissions are edited/status-changed.

## Milestone 6 reminder env vars (optional but recommended)

- `RESEND_API_KEY`
- `REMINDER_FROM_EMAIL` (e.g. `Siena Theatre <noreply@yourdomain.com>`)
- `CRON_SECRET` (used by `/api/cron/reminders`)
- `DISABLE_OUTBOUND_EMAIL` (`true`/`1` to disable all invite/reminder sends for testing)

If these are missing, reminder/invite actions still run but are recorded as non-delivered in audit logs.
If `DISABLE_OUTBOUND_EMAIL=true`, reminder/invite actions still run and audit, but no outbound email is sent.

## Milestone 9 QA

- QA checklist for full-program import runs:
  - `/Users/mikelounello/playbill-app/docs/MILESTONE9_QA_CHECKLIST.md`

## Platform roadmap

- See `/Users/mikelounello/playbill-app/docs/IMPLEMENTATION_PLAN.md`
