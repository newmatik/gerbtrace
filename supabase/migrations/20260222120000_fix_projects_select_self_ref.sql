-- Fix projects_select RLS policy: replace self-referencing can_access_project(id)
-- with an inline expression that reads columns directly from the row.
--
-- Root cause: INSERT ... RETURNING triggers the SELECT policy. The old policy
-- called can_access_project(id) which re-queries the projects table by id.
-- During the same INSERT command the newly inserted row is invisible to
-- that subquery (same-command snapshot), so the function returns false and
-- PostgREST returns 403.
--
-- The inline expression avoids querying the projects table altogether:
--   - Admins see all team projects
--   - Regular members (viewer/editor) see unassigned projects (no space)
--   - Space members see projects in their spaces (including guests)

DROP POLICY IF EXISTS "projects_select" ON public.projects;

CREATE POLICY "projects_select"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    public.has_team_role(team_id, 'admin')
    OR (public.is_team_member(team_id) AND space_id IS NULL)
    OR public.is_space_member(space_id)
  );

-- Also update can_access_project() so other tables' policies that reference
-- it (project_conversation_messages, project_files, etc.) stay consistent.

CREATE OR REPLACE FUNCTION public.can_access_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_project_id
      AND (
        public.has_team_role(p.team_id, 'admin')
        OR (public.is_team_member(p.team_id) AND p.space_id IS NULL)
        OR public.is_space_member(p.space_id)
      )
  );
$$;
