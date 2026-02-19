create extension if not exists "pgcrypto";

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  slug text not null unique,
  theatre_name text not null,
  show_dates text not null,
  director_notes text not null,
  acknowledgements text not null default ''
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  program_id uuid not null references public.programs (id) on delete cascade,
  full_name text not null,
  role_title text not null,
  bio text not null
);

alter table public.programs enable row level security;
alter table public.people enable row level security;

drop policy if exists "public can read programs" on public.programs;
drop policy if exists "public can read people" on public.people;

create policy "public can read programs" on public.programs
  for select
  using (true);

create policy "public can read people" on public.people
  for select
  using (true);
