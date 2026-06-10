create extension if not exists pgcrypto;

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trade_name text,
  contact_name text,
  contact_email text,
  contact_phone text,
  city text,
  neighborhood text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete set null,
  company text not null,
  role text not null,
  neighborhood text not null,
  city text not null default 'São Paulo',
  salary text not null,
  shift text not null,
  contact text not null,
  description text not null,
  requirements text,
  benefits text,
  status text not null default 'published' check (status in ('draft', 'published', 'paused', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists resumes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  desired_role text not null,
  neighborhood text not null,
  city text not null default 'São Paulo',
  availability text,
  experience text not null,
  salary_expectation text,
  lgpd_accepted boolean not null default false,
  status text not null default 'new' check (status in ('new', 'screening', 'interview', 'approved', 'rejected', 'hired')),
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  resume_id uuid not null references resumes(id) on delete cascade,
  status text not null default 'applied' check (status in ('applied', 'screening', 'interview', 'approved', 'rejected', 'hired')),
  score numeric(5, 2),
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, resume_id)
);

create table if not exists interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade,
  resume_id uuid references resumes(id) on delete set null,
  job_id uuid references jobs(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  channel text not null default 'online' check (channel in ('online', 'phone', 'onsite')),
  location text,
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'rescheduled', 'attended', 'no_show', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table resumes add column if not exists area text;
alter table resumes add column if not exists resume_file_path text;
alter table resumes add column if not exists resume_file_name text;
alter table resumes add column if not exists resume_file_type text;
alter table resumes add column if not exists resume_file_size integer;
alter table resumes add column if not exists favorite boolean not null default false;
alter table resumes add column if not exists tags text[] not null default '{}';
alter table resumes add column if not exists score_experience smallint;
alter table resumes add column if not exists score_availability smallint;
alter table resumes add column if not exists score_communication smallint;
alter table resumes add column if not exists score_distance smallint;
alter table resumes add column if not exists score_fit smallint;
alter table resumes add column if not exists score_total integer generated always as (
  coalesce(score_experience, 0) +
  coalesce(score_availability, 0) +
  coalesce(score_communication, 0) +
  coalesce(score_distance, 0) +
  coalesce(score_fit, 0)
) stored;

create index if not exists jobs_status_created_at_idx on jobs(status, created_at desc);
create index if not exists jobs_role_idx on jobs(role);
create index if not exists resumes_status_created_at_idx on resumes(status, created_at desc);
create index if not exists resumes_desired_role_idx on resumes(desired_role);
create index if not exists resumes_area_idx on resumes(area);
create index if not exists resumes_city_idx on resumes(city);
create index if not exists resumes_favorite_idx on resumes(favorite);
create index if not exists resumes_tags_idx on resumes using gin(tags);
create index if not exists applications_status_idx on applications(status);
create index if not exists interviews_starts_at_idx on interviews(starts_at);

alter table companies enable row level security;
alter table jobs enable row level security;
alter table resumes enable row level security;
alter table applications enable row level security;
alter table interviews enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select on jobs to anon, authenticated;
grant insert on resumes to anon, authenticated;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-resumes',
  'candidate-resumes',
  false,
  8388608,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read published jobs" on jobs;
create policy "Public can read published jobs"
on jobs for select
using (status = 'published');

drop policy if exists "Public can submit resumes" on resumes;
create policy "Public can submit resumes"
on resumes for insert
with check (lgpd_accepted = true);
