-- ============================================================================
-- Gerbtrace Collaborative Teams: Initial Schema
-- ============================================================================
-- Tables: profiles, teams, team_members, team_invitations, projects,
--         project_files, team_packages, built_in_package_names
-- ============================================================================

-- ── profiles (extends auth.users) ──────────────────────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  name        text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Public profile for each authenticated user, auto-created on signup.';

-- ── teams ──────────────────────────────────────────────────────────────────

create table public.teams (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text unique not null
                      constraint teams_slug_format
                      check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  auto_join_domain  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.teams is
  'Team / organisation. The slug is used as the subdomain (e.g. newmatik.gerbtrace.com).';

create index teams_slug_idx on public.teams (slug);

-- ── team_members ───────────────────────────────────────────────────────────

create type public.team_role as enum ('admin', 'editor', 'viewer');
create type public.member_status as enum ('active', 'disabled');

create table public.team_members (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        public.team_role not null default 'viewer',
  status      public.member_status not null default 'active',
  created_at  timestamptz not null default now(),

  unique (team_id, user_id)
);

comment on table public.team_members is
  'Maps users to teams with role and status.';

create index team_members_team_idx on public.team_members (team_id);
create index team_members_user_idx on public.team_members (user_id);

-- ── team_invitations ───────────────────────────────────────────────────────

create table public.team_invitations (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  email       text not null,
  role        public.team_role not null default 'viewer',
  invited_by  uuid references public.profiles(id) on delete set null,
  token       text unique not null,
  accepted_at timestamptz,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

comment on table public.team_invitations is
  'Pending invitations sent to email addresses to join a team.';

create index team_invitations_token_idx on public.team_invitations (token);
create index team_invitations_team_idx  on public.team_invitations (team_id);

-- ── projects ───────────────────────────────────────────────────────────────

create type public.project_status as enum ('draft', 'approved');
create type public.project_mode   as enum ('viewer', 'compare');

create table public.projects (
  id                       uuid primary key default gen_random_uuid(),
  team_id                  uuid not null references public.teams(id) on delete cascade,
  name                     text not null,
  mode                     public.project_mode not null default 'viewer',
  status                   public.project_status not null default 'draft',
  approved_by              uuid references public.profiles(id) on delete set null,
  approved_at              timestamptz,
  created_by               uuid not null references public.profiles(id) on delete set null,
  pnp_origin_x             double precision,
  pnp_origin_y             double precision,
  pnp_convention           text,
  pnp_rotation_overrides   jsonb,
  pnp_dnp_components       jsonb,
  pnp_cad_package_map      jsonb,
  pnp_polarized_overrides  jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

comment on table public.projects is
  'Team projects. When status=approved, PnP data and files are frozen.';

create index projects_team_idx on public.projects (team_id);

-- ── project_files ──────────────────────────────────────────────────────────

create table public.project_files (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  packet        int not null default 0,
  file_name     text not null,
  storage_path  text not null,
  layer_type    text,
  content_hash  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.project_files is
  'Gerber/drill files belonging to a project. Actual content in Supabase Storage.';

create index project_files_project_idx on public.project_files (project_id);

-- ── team_packages ──────────────────────────────────────────────────────────

create table public.team_packages (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  data        jsonb not null,
  created_by  uuid not null references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Prevent duplicate package names within a team (expression index)
create unique index team_packages_team_name_uniq
  on public.team_packages (team_id, ((data ->> 'name')));

comment on table public.team_packages is
  'Custom package definitions shared within a team. data column holds full PackageDefinition JSON.';

create index team_packages_team_idx on public.team_packages (team_id);

-- ── built_in_package_names (for collision prevention) ──────────────────────

create table public.built_in_package_names (
  name_normalised text primary key
);

comment on table public.built_in_package_names is
  'Normalised names/aliases of built-in packages. Used to prevent team packages from shadowing built-ins.';

-- ── Auto-create profile on user signup ─────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', null)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── updated_at auto-touch triggers ─────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger teams_updated_at before update on public.teams
  for each row execute function public.set_updated_at();

create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create trigger project_files_updated_at before update on public.project_files
  for each row execute function public.set_updated_at();

create trigger team_packages_updated_at before update on public.team_packages
  for each row execute function public.set_updated_at();

-- ── Enable Realtime for collaborative tables ───────────────────────────────

alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.project_files;
alter publication supabase_realtime add table public.team_packages;
