-- ============================================================================
-- Gerbtrace Collaborative Teams: Row Level Security Policies
-- ============================================================================
-- Every table uses RLS to enforce team data isolation and role-based access.
-- ============================================================================

-- ── Helper: check if the current user is an active member of a team ────────

create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

-- ── Helper: check if the current user has a specific role (or higher) ──────

create or replace function public.has_team_role(p_team_id uuid, p_min_role public.team_role)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id
      and user_id = auth.uid()
      and status = 'active'
      and (
        case p_min_role
          when 'viewer' then role in ('viewer', 'editor', 'admin')
          when 'editor' then role in ('editor', 'admin')
          when 'admin'  then role = 'admin'
        end
      )
  );
$$;

-- ── Helper: get team_id for a project ──────────────────────────────────────

create or replace function public.project_team_id(p_project_id uuid)
returns uuid
language sql
stable
security definer set search_path = ''
as $$
  select team_id from public.projects where id = p_project_id;
$$;

-- ── Helper: check if a project is in draft status ──────────────────────────

create or replace function public.is_project_draft(p_project_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.projects where id = p_project_id and status = 'draft'
  );
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- PROFILES
-- ════════════════════════════════════════════════════════════════════════════

alter table public.profiles enable row level security;

-- Anyone authenticated can read profiles (needed for presence, member lists)
create policy "profiles_select"
  on public.profiles for select
  to authenticated
  using (true);

-- Users can only update their own profile
create policy "profiles_update"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Insert handled by trigger (security definer), but allow service_role
create policy "profiles_insert"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- TEAMS
-- ════════════════════════════════════════════════════════════════════════════

alter table public.teams enable row level security;

-- Members can see their teams
create policy "teams_select"
  on public.teams for select
  to authenticated
  using (public.is_team_member(id));

-- Any authenticated user can create a team
create policy "teams_insert"
  on public.teams for insert
  to authenticated
  with check (true);

-- Only admins can update team settings
create policy "teams_update"
  on public.teams for update
  to authenticated
  using (public.has_team_role(id, 'admin'))
  with check (public.has_team_role(id, 'admin'));

-- Only admins can delete a team
create policy "teams_delete"
  on public.teams for delete
  to authenticated
  using (public.has_team_role(id, 'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- TEAM MEMBERS
-- ════════════════════════════════════════════════════════════════════════════

alter table public.team_members enable row level security;

-- Members can see other members of their teams
create policy "team_members_select"
  on public.team_members for select
  to authenticated
  using (public.is_team_member(team_id));

-- Only admins can add members (or service_role for auto-join)
create policy "team_members_insert"
  on public.team_members for insert
  to authenticated
  with check (public.has_team_role(team_id, 'admin'));

-- Only admins can update member roles/status
create policy "team_members_update"
  on public.team_members for update
  to authenticated
  using (public.has_team_role(team_id, 'admin'))
  with check (public.has_team_role(team_id, 'admin'));

-- Only admins can remove members
create policy "team_members_delete"
  on public.team_members for delete
  to authenticated
  using (public.has_team_role(team_id, 'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- TEAM INVITATIONS
-- ════════════════════════════════════════════════════════════════════════════

alter table public.team_invitations enable row level security;

-- Team members can see invitations for their team
create policy "team_invitations_select"
  on public.team_invitations for select
  to authenticated
  using (public.is_team_member(team_id));

-- Only admins can create invitations
create policy "team_invitations_insert"
  on public.team_invitations for insert
  to authenticated
  with check (public.has_team_role(team_id, 'admin'));

-- Only admins can update (e.g. cancel) invitations
create policy "team_invitations_update"
  on public.team_invitations for update
  to authenticated
  using (public.has_team_role(team_id, 'admin'));

-- Only admins can delete invitations
create policy "team_invitations_delete"
  on public.team_invitations for delete
  to authenticated
  using (public.has_team_role(team_id, 'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- PROJECTS
-- ════════════════════════════════════════════════════════════════════════════

alter table public.projects enable row level security;

-- Team members can see projects
create policy "projects_select"
  on public.projects for select
  to authenticated
  using (public.is_team_member(team_id));

-- Admins and editors can create projects
create policy "projects_insert"
  on public.projects for insert
  to authenticated
  with check (public.has_team_role(team_id, 'editor'));

-- Admins and editors can update projects ONLY when draft
-- Exception: admins can change status from approved back to draft
create policy "projects_update"
  on public.projects for update
  to authenticated
  using (
    public.has_team_role(team_id, 'editor')
    and (status = 'draft' or public.has_team_role(team_id, 'admin'))
  )
  with check (
    public.has_team_role(team_id, 'editor')
  );

-- Only admins can delete projects
create policy "projects_delete"
  on public.projects for delete
  to authenticated
  using (public.has_team_role(team_id, 'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- PROJECT FILES
-- ════════════════════════════════════════════════════════════════════════════

alter table public.project_files enable row level security;

-- Team members can see files of their projects
create policy "project_files_select"
  on public.project_files for select
  to authenticated
  using (public.is_team_member(public.project_team_id(project_id)));

-- Admins and editors can add files when project is draft
create policy "project_files_insert"
  on public.project_files for insert
  to authenticated
  with check (
    public.has_team_role(public.project_team_id(project_id), 'editor')
    and public.is_project_draft(project_id)
  );

-- Admins and editors can update files when project is draft
create policy "project_files_update"
  on public.project_files for update
  to authenticated
  using (
    public.has_team_role(public.project_team_id(project_id), 'editor')
    and public.is_project_draft(project_id)
  )
  with check (
    public.has_team_role(public.project_team_id(project_id), 'editor')
    and public.is_project_draft(project_id)
  );

-- Admins and editors can delete files when project is draft
create policy "project_files_delete"
  on public.project_files for delete
  to authenticated
  using (
    public.has_team_role(public.project_team_id(project_id), 'editor')
    and public.is_project_draft(project_id)
  );

-- ════════════════════════════════════════════════════════════════════════════
-- TEAM PACKAGES
-- ════════════════════════════════════════════════════════════════════════════

alter table public.team_packages enable row level security;

-- Team members can see team packages
create policy "team_packages_select"
  on public.team_packages for select
  to authenticated
  using (public.is_team_member(team_id));

-- Admins and editors can create packages
create policy "team_packages_insert"
  on public.team_packages for insert
  to authenticated
  with check (public.has_team_role(team_id, 'editor'));

-- Admins and editors can update packages
create policy "team_packages_update"
  on public.team_packages for update
  to authenticated
  using (public.has_team_role(team_id, 'editor'))
  with check (public.has_team_role(team_id, 'editor'));

-- Only admins can delete packages
create policy "team_packages_delete"
  on public.team_packages for delete
  to authenticated
  using (public.has_team_role(team_id, 'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- STORAGE: gerber-files bucket
-- ════════════════════════════════════════════════════════════════════════════

-- Create the storage bucket (private)
insert into storage.buckets (id, name, public, file_size_limit)
values ('gerber-files', 'gerber-files', false, 10485760)  -- 10 MiB
on conflict (id) do nothing;

-- Storage path convention: {team_id}/{project_id}/{packet}/{filename}
-- Extract team_id from the storage path (first segment)

create or replace function public.storage_path_team_id(path text)
returns uuid
language sql
immutable
as $$
  select (string_to_array(path, '/'))[1]::uuid;
$$;

create or replace function public.storage_path_project_id(path text)
returns uuid
language sql
immutable
as $$
  select (string_to_array(path, '/'))[2]::uuid;
$$;

-- Download: team members can download files from their team's projects
create policy "gerber_files_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'gerber-files'
    and public.is_team_member(public.storage_path_team_id(name))
  );

-- Upload: editors/admins can upload when project is draft
create policy "gerber_files_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'gerber-files'
    and public.has_team_role(public.storage_path_team_id(name), 'editor')
    and public.is_project_draft(public.storage_path_project_id(name))
  );

-- Delete: editors/admins can delete when project is draft
create policy "gerber_files_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'gerber-files'
    and public.has_team_role(public.storage_path_team_id(name), 'editor')
    and public.is_project_draft(public.storage_path_project_id(name))
  );
