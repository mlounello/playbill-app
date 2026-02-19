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

## Current MVP

- `/programs/new` to create a program.
- `/programs/[slug]` as public online layout with:
  - program-order view
  - booklet imposition view (2-up saddle stitch)
- `/programs/[slug]/submit` as a bio intake form for cast/production entries.

## Content model

- Any section can be omitted (director note, dramaturgical note, billing, ACTF ad, etc.).
- Empty sections are skipped automatically.
- Page count is auto-padded to a multiple of 4 for booklet printing.
- Cast and production bios are displayed alphabetically by name.
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
