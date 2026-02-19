create extension if not exists "pgcrypto";

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  slug text not null unique,
  theatre_name text not null,
  show_dates text not null,
  poster_image_url text not null default '',
  director_notes text not null default '',
  dramaturgical_note text not null default '',
  billing_page text not null default '',
  acts_songs text not null default '',
  department_info text not null default '',
  actf_ad_image_url text not null default '',
  acknowledgements text not null default '',
  season_calendar text not null default '',
  performance_schedule jsonb not null default '[]'::jsonb,
  production_photo_urls text[] not null default '{}',
  custom_pages jsonb not null default '[]'::jsonb,
  layout_order text[] not null default '{poster,director_note,dramaturgical_note,billing,acts_songs,cast_bios,team_bios,department_info,actf_ad,acknowledgements,season_calendar,production_photos,custom_pages}'
);

alter table public.programs add column if not exists poster_image_url text not null default '';
alter table public.programs add column if not exists dramaturgical_note text not null default '';
alter table public.programs add column if not exists billing_page text not null default '';
alter table public.programs add column if not exists acts_songs text not null default '';
alter table public.programs add column if not exists department_info text not null default '';
alter table public.programs add column if not exists actf_ad_image_url text not null default '';
alter table public.programs add column if not exists season_calendar text not null default '';
alter table public.programs add column if not exists performance_schedule jsonb not null default '[]'::jsonb;
alter table public.programs add column if not exists production_photo_urls text[] not null default '{}';
alter table public.programs add column if not exists custom_pages jsonb not null default '[]'::jsonb;
alter table public.programs add column if not exists layout_order text[] not null default '{poster,director_note,dramaturgical_note,billing,acts_songs,cast_bios,team_bios,department_info,actf_ad,acknowledgements,season_calendar,production_photos,custom_pages}';

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  program_id uuid not null references public.programs (id) on delete cascade,
  full_name text not null,
  role_title text not null,
  bio text not null,
  team_type text not null default 'cast',
  headshot_url text not null default '',
  email text not null default '',
  submission_status text not null default 'pending',
  submitted_at timestamptz
);

alter table public.people add column if not exists team_type text not null default 'cast';
alter table public.people add column if not exists headshot_url text not null default '';
alter table public.people add column if not exists email text not null default '';
alter table public.people add column if not exists submission_status text not null default 'pending';
alter table public.people add column if not exists submitted_at timestamptz;

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
