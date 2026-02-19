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
- `/programs/[slug]` as the public online + print layout.

## Next recommended features

- Auth + role-based editing
- Rich text for sections
- Photo uploads via Supabase Storage
- Per-show templates/themes
- Program export as PDF job
