-- ============================================================================
-- Gerbtrace Collaborative Teams: Database Functions
-- ============================================================================
-- Business logic that lives in PostgreSQL for transactional safety.
-- ============================================================================

-- ── Reserved slugs (subdomains that cannot be claimed by teams) ────────────

create or replace function public.is_slug_reserved(p_slug text)
returns boolean
language sql
immutable
as $$
  select p_slug = any(array[
    'www', 'app', 'api', 'admin', 'auth', 'team', 'teams',
    'static', 'assets', 'cdn', 'mail', 'email', 'smtp',
    'ftp', 'ssh', 'git', 'ns1', 'ns2', 'dns',
    'blog', 'docs', 'help', 'support', 'status',
    'billing', 'dashboard', 'console', 'login', 'signup',
    'register', 'account', 'settings', 'profile',
    'gerbtrace'
  ]);
$$;

-- ── create_team: transactionally creates team + admin membership ───────────

create or replace function public.create_team(
  p_name text,
  p_slug text,
  p_auto_join_domain text default null
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_team_id uuid;
  v_user_id uuid := auth.uid();
begin
  -- Validate caller is authenticated
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Validate slug format
  if p_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' then
    raise exception 'Invalid slug format. Use 3-40 lowercase alphanumeric characters and hyphens.';
  end if;

  -- Check reserved slugs
  if public.is_slug_reserved(p_slug) then
    raise exception 'This subdomain is reserved and cannot be used.';
  end if;

  -- Create the team
  insert into public.teams (name, slug, auto_join_domain)
  values (p_name, p_slug, p_auto_join_domain)
  returning id into v_team_id;

  -- Add the creator as admin
  insert into public.team_members (team_id, user_id, role, status)
  values (v_team_id, v_user_id, 'admin', 'active');

  return v_team_id;
end;
$$;

-- ── accept_invitation: validate token, create membership ───────────────────

create or replace function public.accept_invitation(p_token text)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_invitation record;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Find the invitation
  select * into v_invitation
  from public.team_invitations
  where token = p_token
    and accepted_at is null
    and expires_at > now();

  if v_invitation is null then
    raise exception 'Invalid or expired invitation.';
  end if;

  -- Check email matches (the invitation was sent to this email)
  -- We check against the profile email to ensure the right user accepts
  if not exists (
    select 1 from public.profiles
    where id = v_user_id and lower(email) = lower(v_invitation.email)
  ) then
    raise exception 'This invitation was sent to a different email address.';
  end if;

  -- Check not already a member
  if exists (
    select 1 from public.team_members
    where team_id = v_invitation.team_id and user_id = v_user_id
  ) then
    -- Already a member, just mark invitation as accepted
    update public.team_invitations
    set accepted_at = now()
    where id = v_invitation.id;

    return jsonb_build_object('team_id', v_invitation.team_id, 'already_member', true);
  end if;

  -- Create membership
  insert into public.team_members (team_id, user_id, role, status)
  values (v_invitation.team_id, v_user_id, v_invitation.role, 'active');

  -- Mark invitation as accepted
  update public.team_invitations
  set accepted_at = now()
  where id = v_invitation.id;

  return jsonb_build_object('team_id', v_invitation.team_id, 'role', v_invitation.role::text);
end;
$$;

-- ── approve_project: freeze a project (admin only) ─────────────────────────

create or replace function public.approve_project(p_project_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_team_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Get the project's team
  select team_id into v_team_id
  from public.projects
  where id = p_project_id;

  if v_team_id is null then
    raise exception 'Project not found';
  end if;

  -- Check admin role
  if not public.has_team_role(v_team_id, 'admin') then
    raise exception 'Only team admins can approve projects';
  end if;

  -- Approve
  update public.projects
  set status = 'approved',
      approved_by = v_user_id,
      approved_at = now(),
      updated_at = now()
  where id = p_project_id and status = 'draft';

  if not found then
    raise exception 'Project is already approved or does not exist';
  end if;
end;
$$;

-- ── revert_to_draft: unfreeze a project (admin only) ───────────────────────

create or replace function public.revert_to_draft(p_project_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_team_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select team_id into v_team_id
  from public.projects
  where id = p_project_id;

  if v_team_id is null then
    raise exception 'Project not found';
  end if;

  if not public.has_team_role(v_team_id, 'admin') then
    raise exception 'Only team admins can revert projects to draft';
  end if;

  update public.projects
  set status = 'draft',
      approved_by = null,
      approved_at = null,
      updated_at = now()
  where id = p_project_id and status = 'approved';

  if not found then
    raise exception 'Project is already a draft or does not exist';
  end if;
end;
$$;

-- ── check_package_name: prevent collisions with built-in packages ──────────

create or replace function public.check_team_package_name()
returns trigger
language plpgsql
as $$
declare
  v_name text;
begin
  v_name := lower(trim(new.data ->> 'name'));

  if v_name is null or v_name = '' then
    raise exception 'Package name is required';
  end if;

  -- Check against built-in package names
  if exists (
    select 1 from public.built_in_package_names
    where name_normalised = v_name
  ) then
    raise exception 'Package name "%" conflicts with a built-in package', (new.data ->> 'name');
  end if;

  return new;
end;
$$;

create trigger team_packages_check_name
  before insert or update on public.team_packages
  for each row execute function public.check_team_package_name();
