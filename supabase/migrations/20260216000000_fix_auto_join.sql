-- ============================================================================
-- Fix: Auto-join by domain on signup and login
-- ============================================================================
-- The handle_new_user() trigger only created a profile but never checked
-- auto_join_domain on teams. This migration adds a try_auto_join() function
-- and wires it into the signup trigger so new users are automatically added
-- to teams whose auto_join_domain matches their email domain.
--
-- The function is also callable as an RPC from the frontend so that existing
-- users who were missed get auto-joined on their next login.
-- ============================================================================

-- ── try_auto_join: match user email domain to teams.auto_join_domain ────────

create or replace function public.try_auto_join(
  p_user_id uuid default null,
  p_email   text default null
)
returns int
language plpgsql
security definer set search_path = ''
as $$
declare
  v_user_id uuid;
  v_email   text;
  v_domain  text;
  v_count   int := 0;
  v_team    record;
begin
  -- Resolve user: prefer explicit param (from trigger), fall back to auth.uid()
  v_user_id := coalesce(p_user_id, auth.uid());

  if v_user_id is null then
    return 0;
  end if;

  -- Resolve email: prefer explicit param (from trigger), fall back to profile
  if p_email is not null then
    v_email := p_email;
  else
    select email into v_email from public.profiles where id = v_user_id;
  end if;

  if v_email is null then
    return 0;
  end if;

  -- Extract domain
  v_domain := lower(split_part(v_email, '@', 2));

  if v_domain = '' or v_domain is null then
    return 0;
  end if;

  -- Find all teams with a matching auto_join_domain and add user as viewer
  for v_team in
    select id from public.teams
    where lower(auto_join_domain) = v_domain
  loop
    insert into public.team_members (team_id, user_id, role, status)
    values (v_team.id, v_user_id, 'viewer', 'active')
    on conflict (team_id, user_id) do nothing;

    if found then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

-- ── Update handle_new_user to also perform auto-join ────────────────────────
-- The function may be owned by supabase_admin (self-hosted Supabase) or
-- postgres (CI / local).  SET ROLE lets the postgres superuser adopt the
-- owner identity so CREATE OR REPLACE succeeds in either case.

do $$
declare
  v_owner text;
begin
  select r.rolname into v_owner
    from pg_proc p
    join pg_roles r on p.proowner = r.oid
   where p.proname = 'handle_new_user'
     and p.pronamespace = 'public'::regnamespace;

  if v_owner is not null and v_owner <> current_user then
    execute format('set role %I', v_owner);
  end if;
end;
$$;

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

  -- Auto-join teams whose auto_join_domain matches the new user's email domain
  perform public.try_auto_join(new.id, new.email);

  return new;
end;
$$;

reset role;
