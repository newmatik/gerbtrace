-- Supabase Security/Performance Advisor fixes:
-- - add missing FK coverage indexes
-- - remove duplicate indexes shadowed by unique indexes
-- - address RLS and function search_path warnings

-- ============================================================================
-- Performance: add covering indexes for foreign keys flagged by advisor
-- ============================================================================

create index if not exists idx_projects_approved_by
  on public.projects (approved_by);

create index if not exists idx_projects_assignee_user_id
  on public.projects (assignee_user_id);

create index if not exists idx_projects_created_by
  on public.projects (created_by);

create index if not exists idx_team_invitations_invited_by
  on public.team_invitations (invited_by);

create index if not exists idx_team_packages_created_by
  on public.team_packages (created_by);

create index if not exists idx_team_tht_packages_created_by
  on public.team_tht_packages (created_by);

-- These are duplicates of existing unique indexes on the same column.
drop index if exists public.team_invitations_token_idx;
drop index if exists public.teams_slug_idx;

-- ============================================================================
-- Security: ensure RLS is enabled for public schema table
-- ============================================================================

alter table public.built_in_package_names enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policy
    where polname = 'built_in_package_names_select_authenticated'
      and polrelid = 'public.built_in_package_names'::regclass
  ) then
    create policy "built_in_package_names_select_authenticated"
      on public.built_in_package_names
      for select
      to authenticated
      using (true);
  end if;
end
$$;

-- Keep same behavior, but avoid advisor warning for WITH CHECK (true).
alter policy "teams_insert"
  on public.teams
  with check ((select auth.uid()) is not null);

-- ============================================================================
-- Performance: avoid per-row auth.uid() re-evaluation in RLS policies
-- ============================================================================

alter policy "profiles_insert"
  on public.profiles
  with check (id = (select auth.uid()));

alter policy "profiles_update"
  on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ============================================================================
-- Security: set immutable function search_path explicitly
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.storage_path_team_id(path text)
returns uuid
language sql
immutable
set search_path = ''
as $function$
  select (string_to_array(path, '/'))[1]::uuid;
$function$;

create or replace function public.storage_path_project_id(path text)
returns uuid
language sql
immutable
set search_path = ''
as $function$
  select (string_to_array(path, '/'))[2]::uuid;
$function$;

create or replace function public.is_slug_reserved(p_slug text)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select p_slug = any(array[
    'www', 'app', 'api', 'admin', 'auth', 'team', 'teams',
    'static', 'assets', 'cdn', 'mail', 'email', 'smtp',
    'ftp', 'ssh', 'git', 'ns1', 'ns2', 'dns',
    'blog', 'docs', 'help', 'support', 'status',
    'billing', 'dashboard', 'console', 'login', 'signup',
    'register', 'account', 'settings', 'profile',
    'gerbtrace'
  ]);
$function$;

create or replace function public.validate_project_assignee()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.assignee_user_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.team_members tm
    where tm.team_id = new.team_id
      and tm.user_id = new.assignee_user_id
      and tm.status = 'active'
      and tm.role in ('admin', 'editor')
  ) then
    raise exception
      'Invalid assignee: must be an active admin/editor team member'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

create or replace function public.check_team_package_name()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_name text;
begin
  v_name := lower(trim(new.data ->> 'name'));

  if v_name is null or v_name = '' then
    raise exception 'Package name is required';
  end if;

  if exists (
    select 1 from public.built_in_package_names
    where name_normalised = v_name
  ) then
    raise exception 'Package name "%" conflicts with a built-in package', (new.data ->> 'name');
  end if;

  return new;
end;
$function$;
