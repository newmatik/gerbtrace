-- ============================================================================
-- Admin: update a team member's profile name
-- ============================================================================
-- Allows team admins to change the display name of members in their team.
-- Uses security definer to bypass the profiles RLS (which only allows
-- self-updates) after verifying the caller is a team admin.
--
-- On the production droplet the function may already exist (owned by
-- supabase_admin). The deploy user (postgres) cannot SET ROLE to
-- supabase_admin, so we skip the CREATE when the function is present.
-- ============================================================================

do $$
begin
  if exists (
    select 1 from pg_proc
    where proname = 'admin_update_member_name'
      and pronamespace = 'public'::regnamespace
  ) then
    raise notice 'admin_update_member_name already exists — skipping';
    return;
  end if;

  execute $fn$
    create function public.admin_update_member_name(
      p_team_id uuid,
      p_user_id uuid,
      p_name text
    )
    returns void
    language plpgsql
    security definer set search_path = ''
    as $body$
    begin
      -- Verify caller is an active admin of the team
      if not public.has_team_role(p_team_id, 'admin') then
        raise exception 'Only team admins can update member names';
      end if;

      -- Verify target user is a member of the team
      if not exists (
        select 1 from public.team_members
        where team_id = p_team_id and user_id = p_user_id
      ) then
        raise exception 'User is not a member of this team';
      end if;

      -- Update the profile name
      update public.profiles
      set name = p_name, updated_at = now()
      where id = p_user_id;
    end;
    $body$;
  $fn$;
end;
$$;
