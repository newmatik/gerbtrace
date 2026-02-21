-- Second round of Supabase advisor fixes:
--   Security:  set search_path on 3 remaining functions,
--              move dblink/http extensions out of public schema
--   Performance: wrap auth.uid() in (select …) in 8 RLS policies,
--               add covering indexes for 10 unindexed foreign keys,
--               drop 2 clearly redundant unused indexes

-- ============================================================================
-- Security: set search_path on remaining functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_space_scopes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
declare
  v_space_team_id uuid;
begin
  if new.space_id is null then
    return new;
  end if;
  select team_id into v_space_team_id from public.spaces where id = new.space_id;
  if v_space_team_id is null then
    raise exception 'Space not found';
  end if;
  if v_space_team_id <> new.team_id then
    raise exception 'Space must belong to the same team';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_project_updated_meta()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
begin
  new.updated_at = now();
  new.updated_by = coalesce(auth.uid(), new.updated_by, old.updated_by, old.created_by);
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validate_project_approver()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
begin
  if new.approver_user_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.team_members tm
    where tm.team_id = new.team_id
      and tm.user_id = new.approver_user_id
      and tm.status = 'active'
      and tm.role in ('admin', 'editor')
  ) then
    raise exception
      'Invalid approver: must be an active admin/editor team member'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

-- ============================================================================
-- Security: move relocatable extensions out of public schema
-- (http is non-relocatable so it must stay in public)
-- ============================================================================

ALTER EXTENSION dblink SET SCHEMA extensions;

-- ============================================================================
-- Performance: wrap auth.uid() in (select …) to avoid per-row re-evaluation
-- ============================================================================

ALTER POLICY "notifications_select"
  ON public.notifications
  USING (recipient_user_id = (select auth.uid()));

ALTER POLICY "notifications_update"
  ON public.notifications
  USING (recipient_user_id = (select auth.uid()))
  WITH CHECK (recipient_user_id = (select auth.uid()));

ALTER POLICY "project_conversation_messages_insert"
  ON public.project_conversation_messages
  WITH CHECK (
    can_access_project(project_id)
    AND ((author_id IS NULL) OR (author_id = (select auth.uid())))
  );

ALTER POLICY "project_conversation_messages_update"
  ON public.project_conversation_messages
  USING (
    can_access_project(project_id)
    AND ((author_id = (select auth.uid())) OR has_team_role(team_id, 'admin'::team_role))
  )
  WITH CHECK (
    can_access_project(project_id)
    AND ((author_id = (select auth.uid())) OR has_team_role(team_id, 'admin'::team_role))
  );

ALTER POLICY "project_conversation_messages_delete"
  ON public.project_conversation_messages
  USING (
    can_access_project(project_id)
    AND ((author_id = (select auth.uid())) OR has_team_role(team_id, 'admin'::team_role))
  );

ALTER POLICY "project_conversation_attachments_delete"
  ON public.project_conversation_attachments
  USING (
    has_team_role(team_id, 'admin'::team_role)
    OR (EXISTS (
      SELECT 1
      FROM project_conversation_messages m
      WHERE m.id = project_conversation_attachments.message_id
        AND m.author_id = (select auth.uid())
    ))
  );

ALTER POLICY "team_members_select"
  ON public.team_members
  USING (is_team_member(team_id) OR (user_id = (select auth.uid())));

ALTER POLICY "space_members_select"
  ON public.space_members
  USING (
    has_team_role(space_team_id(space_id), 'admin'::team_role)
    OR (user_id = (select auth.uid()))
    OR is_space_member(space_id)
  );

-- ============================================================================
-- Performance: add covering indexes for unindexed foreign keys
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_notifications_actor_user_id
  ON public.notifications (actor_user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_message_id
  ON public.notifications (message_id);

CREATE INDEX IF NOT EXISTS idx_notifications_project_id
  ON public.notifications (project_id);

CREATE INDEX IF NOT EXISTS idx_notifications_team_id
  ON public.notifications (team_id);

CREATE INDEX IF NOT EXISTS idx_pcm_author_id
  ON public.project_conversation_messages (author_id);

CREATE INDEX IF NOT EXISTS idx_projects_approver_user_id
  ON public.projects (approver_user_id);

CREATE INDEX IF NOT EXISTS idx_projects_space_id
  ON public.projects (space_id);

CREATE INDEX IF NOT EXISTS idx_projects_updated_by
  ON public.projects (updated_by);

CREATE INDEX IF NOT EXISTS idx_space_invitations_invited_by
  ON public.space_invitations (invited_by);

CREATE INDEX IF NOT EXISTS idx_spaces_created_by
  ON public.spaces (created_by);

-- ============================================================================
-- Performance: drop clearly redundant unused indexes
-- ============================================================================

-- space_invitations_token_idx is redundant with space_invitations_token_key (unique)
DROP INDEX IF EXISTS public.space_invitations_token_idx;

-- projects_team_idx on (team_id) is subsumed by projects_team_space_idx on (team_id, space_id)
DROP INDEX IF EXISTS public.projects_team_idx;
