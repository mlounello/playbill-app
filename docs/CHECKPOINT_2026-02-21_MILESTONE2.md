# Checkpoint - 2026-02-21

## Current status
- Milestone 1 is working:
  - Supabase magic-link auth (`/app/login`, `/auth/callback`, `/auth/signout`)
  - Role-gated admin and contributor areas
  - Show creation via `/app/shows/new`
- Milestone 2 has started and is partially implemented.

## Milestone 2 implemented so far
- Program Plan tab is live at:
  - `/app/shows/{showId}?tab=program-plan`
- Program modules are loaded from and saved to `program_modules`.
- Current Program Plan controls:
  - Reorder (up/down)
  - Show/hide toggle
  - Filler-eligible toggle
  - Module title edit
  - Module settings JSON edit

## Key files touched recently
- `/Users/mikelounello/playbill-app/lib/shows.ts`
- `/Users/mikelounello/playbill-app/app/app/(protected)/shows/[showId]/page.tsx`
- `/Users/mikelounello/playbill-app/components/program-plan-editor.tsx`
- `/Users/mikelounello/playbill-app/lib/auth.ts`
- `/Users/mikelounello/playbill-app/db/schema.sql`
- `/Users/mikelounello/playbill-app/components/auth/magic-link-form.tsx`

## Important environment/config notes
- `NEXT_PUBLIC_SITE_URL` is used for auth redirect base.
- Supabase Auth URL Configuration must include:
  - `https://playbillapp.mlounello.com/auth/callback`
  - `http://localhost:3000/auth/callback` (dev)

## Required DB step
- Re-run schema after pulls:
  - `/Users/mikelounello/playbill-app/db/schema.sql`

## Next steps when resuming
1. Upgrade Program Plan to drag-and-drop ordering.
2. Replace JSON settings input with module-specific config controls.
3. Bind Program Plan modules directly to reader preview and booklet preview rendering.
4. Start Milestone 3 foundations (people/roles + submission request generation).
