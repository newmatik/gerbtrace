-- Fix INSERT ... RETURNING on spaces by inlining the SELECT policy.
--
-- can_access_space(id) does SELECT FROM public.spaces internally.
-- During INSERT ... RETURNING, the STABLE function snapshot predates
-- the new row, so the function cannot find it and returns false,
-- causing a spurious RLS violation.  Inlining the two checks against
-- the current row's columns avoids the self-referencing subquery.

DROP POLICY IF EXISTS "spaces_select" ON public.spaces;
CREATE POLICY "spaces_select"
  ON public.spaces FOR SELECT
  TO authenticated
  USING (
    public.has_team_role(team_id, 'admin')
    OR public.is_space_member(id)
  );
