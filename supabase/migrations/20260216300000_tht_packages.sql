-- ============================================================================
-- THT (Through-Hole Technology) Packages
-- ============================================================================
-- Adds a team_tht_packages table mirroring team_packages for THT components.
-- THT packages use a simple primitives-based format instead of TPSys.
-- ============================================================================

-- ── team_tht_packages ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.team_tht_packages (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  data        jsonb not null,
  created_by  uuid not null references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Prevent duplicate THT package names within a team (expression index)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'team_tht_packages_team_name_uniq'
  ) THEN
    CREATE UNIQUE INDEX team_tht_packages_team_name_uniq
      ON public.team_tht_packages (team_id, ((data ->> 'name')));
  END IF;
END $$;

comment on table public.team_tht_packages is
  'THT package definitions shared within a team. data column holds full THTPackageDefinition JSON.';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'team_tht_packages_team_idx'
  ) THEN
    CREATE INDEX team_tht_packages_team_idx ON public.team_tht_packages (team_id);
  END IF;
END $$;

-- ── updated_at trigger ────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'team_tht_packages_updated_at'
      AND tgrelid = 'public.team_tht_packages'::regclass
  ) THEN
    CREATE TRIGGER team_tht_packages_updated_at
      BEFORE UPDATE ON public.team_tht_packages
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ── RLS policies ──────────────────────────────────────────────────────────

ALTER TABLE public.team_tht_packages ENABLE ROW LEVEL SECURITY;

-- Team members can see THT packages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'team_tht_packages_select'
      AND tablename = 'team_tht_packages'
  ) THEN
    CREATE POLICY "team_tht_packages_select"
      ON public.team_tht_packages FOR SELECT
      TO authenticated
      USING (public.is_team_member(team_id));
  END IF;
END $$;

-- Editors and admins can create THT packages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'team_tht_packages_insert'
      AND tablename = 'team_tht_packages'
  ) THEN
    CREATE POLICY "team_tht_packages_insert"
      ON public.team_tht_packages FOR INSERT
      TO authenticated
      WITH CHECK (public.has_team_role(team_id, 'editor'));
  END IF;
END $$;

-- Editors and admins can update THT packages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'team_tht_packages_update'
      AND tablename = 'team_tht_packages'
  ) THEN
    CREATE POLICY "team_tht_packages_update"
      ON public.team_tht_packages FOR UPDATE
      TO authenticated
      USING (public.has_team_role(team_id, 'editor'))
      WITH CHECK (public.has_team_role(team_id, 'editor'));
  END IF;
END $$;

-- Only admins can delete THT packages
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'team_tht_packages_delete'
      AND tablename = 'team_tht_packages'
  ) THEN
    CREATE POLICY "team_tht_packages_delete"
      ON public.team_tht_packages FOR DELETE
      TO authenticated
      USING (public.has_team_role(team_id, 'admin'));
  END IF;
END $$;

-- ── Enable Realtime ───────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.team_tht_packages;
