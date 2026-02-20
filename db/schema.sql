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

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  platform_role text not null default 'contributor',
  created_at timestamptz not null default now()
);

create table if not exists public.shows (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  slug text not null unique,
  start_date date,
  end_date date,
  venue text not null default '',
  season_tag text not null default '',
  status text not null default 'draft',
  is_published boolean not null default false,
  published_at timestamptz
);

create table if not exists public.show_style_settings (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  title_font text not null default 'Oswald',
  body_font text not null default 'Merriweather',
  section_title_color text not null default '#006b54',
  body_color text not null default '#000000',
  bio_name_color text not null default '#006b54',
  section_title_size_pt integer not null default 14,
  body_size_pt integer not null default 10,
  bio_name_size_pt integer not null default 11,
  safe_margin_in numeric(4,2) not null default 0.5,
  density_mode text not null default 'normal',
  updated_at timestamptz not null default now(),
  unique(show_id)
);

create table if not exists public.program_modules (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  module_type text not null,
  display_title text not null default '',
  module_order integer not null default 0,
  visible boolean not null default true,
  filler_eligible boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.show_roles (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  role_name text not null,
  category text not null default 'production',
  billing_order integer,
  bio_order integer,
  hidden_from_cast_list boolean not null default false,
  hidden_from_bios boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.submission_requests (
  id uuid primary key default gen_random_uuid(),
  show_role_id uuid not null references public.show_roles (id) on delete cascade,
  request_type text not null,
  label text not null default '',
  constraints jsonb not null default '{}'::jsonb,
  due_date timestamptz,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.submission_requests (id) on delete cascade,
  rich_text_json jsonb not null default '{}'::jsonb,
  plain_text text not null default '',
  asset_refs jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  show_id uuid references public.shows (id) on delete cascade,
  person_id uuid references public.people (id) on delete set null,
  asset_type text not null,
  storage_path text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  entity_id uuid not null,
  field text not null,
  before_value jsonb,
  after_value jsonb,
  changed_by uuid references auth.users (id),
  reason text not null default '',
  changed_at timestamptz not null default now()
);

create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  export_type text not null,
  status text not null default 'queued',
  params jsonb not null default '{}'::jsonb,
  file_path text not null default '',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.programs enable row level security;
alter table public.people enable row level security;
alter table public.user_profiles enable row level security;
alter table public.shows enable row level security;
alter table public.show_style_settings enable row level security;
alter table public.program_modules enable row level security;
alter table public.show_roles enable row level security;
alter table public.submission_requests enable row level security;
alter table public.submissions enable row level security;
alter table public.assets enable row level security;
alter table public.audit_log enable row level security;
alter table public.exports enable row level security;

drop policy if exists "public can read programs" on public.programs;
drop policy if exists "public can read people" on public.people;

create policy "public can read programs" on public.programs
  for select
  using (true);

create policy "public can read people" on public.people
  for select
  using (true);

drop policy if exists "public read published shows" on public.shows;
create policy "public read published shows" on public.shows
  for select
  using (is_published = true);
