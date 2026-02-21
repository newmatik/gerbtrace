-- ============================================================================
-- Billing, Subscriptions, and Usage Tracking
-- ============================================================================

-- ── Plan enum ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.team_plan AS ENUM ('free', 'pro', 'team', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Add billing columns to teams ─────────────────────────────────────────────

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS plan public.team_plan NOT NULL DEFAULT 'free';
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS billing_name text;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS billing_email text;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS billing_address jsonb;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS billing_vat_id text;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS billing_tax_exempt text;

-- Set Newmatik to enterprise
UPDATE public.teams SET plan = 'enterprise' WHERE slug = 'newmatik';

-- ── Subscriptions table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  stripe_subscription_id text UNIQUE NOT NULL,
  status                 text NOT NULL,
  price_id               text NOT NULL,
  current_period_start   timestamptz NOT NULL,
  current_period_end     timestamptz NOT NULL,
  cancel_at_period_end   boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_team_idx ON public.subscriptions (team_id);

DO $$ BEGIN
  CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Subscriptions RLS ────────────────────────────────────────────────────────

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'subscriptions_select' AND tablename = 'subscriptions') THEN
    CREATE POLICY subscriptions_select ON public.subscriptions FOR SELECT TO authenticated
      USING (public.is_team_member(team_id));
  END IF;
END $$;

-- ── Usage events table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.usage_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type  text NOT NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_events_team_month_idx
  ON public.usage_events (team_id, event_type, created_at);

-- ── Usage events RLS ─────────────────────────────────────────────────────────

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'usage_events_select' AND tablename = 'usage_events') THEN
    CREATE POLICY usage_events_select ON public.usage_events FOR SELECT TO authenticated
      USING (public.has_team_role(team_id, 'admin'));
  END IF;
END $$;

-- ── File size column for storage tracking ────────────────────────────────────

ALTER TABLE public.project_files ADD COLUMN IF NOT EXISTS file_size bigint;

-- ── get_team_monthly_usage() ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_team_monthly_usage(p_team_id uuid)
RETURNS TABLE (
  elexess_searches bigint,
  spark_ai_runs    bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    count(*) FILTER (WHERE event_type = 'elexess_search'),
    count(*) FILTER (WHERE event_type = 'spark_ai_run')
  FROM public.usage_events
  WHERE team_id = p_team_id
    AND created_at >= date_trunc('month', now());
$$;

-- ── log_usage_event() ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_usage_event(
  p_team_id    uuid,
  p_user_id    uuid,
  p_event_type text,
  p_metadata   jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan    text;
  v_limit   int;
  v_current bigint;
BEGIN
  SELECT plan::text INTO v_plan FROM public.teams WHERE id = p_team_id;

  IF p_event_type = 'elexess_search' THEN
    v_limit := CASE v_plan
      WHEN 'free' THEN 0
      WHEN 'pro' THEN 1000
      WHEN 'team' THEN 10000
      ELSE NULL
    END;

    IF v_limit IS NOT NULL THEN
      SELECT count(*) INTO v_current
      FROM public.usage_events
      WHERE team_id = p_team_id
        AND event_type = 'elexess_search'
        AND created_at >= date_trunc('month', now());

      IF v_current >= v_limit THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.usage_events (team_id, user_id, event_type, metadata)
  VALUES (p_team_id, p_user_id, p_event_type, p_metadata);

  RETURN true;
END;
$$;

-- ── check_project_limit() trigger ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_project_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan    text;
  v_limit   int;
  v_current bigint;
BEGIN
  SELECT plan::text INTO v_plan FROM public.teams WHERE id = NEW.team_id;

  v_limit := CASE v_plan
    WHEN 'free' THEN 20
    ELSE NULL
  END;

  IF v_limit IS NOT NULL THEN
    SELECT count(*) INTO v_current
    FROM public.projects
    WHERE team_id = NEW.team_id;

    IF v_current >= v_limit THEN
      RAISE EXCEPTION 'Project limit reached for your plan (% projects on % plan)', v_limit, v_plan;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER projects_check_limit
    BEFORE INSERT ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.check_project_limit();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── check_space_limit() trigger ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_space_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan    text;
  v_limit   int;
  v_current bigint;
BEGIN
  SELECT plan::text INTO v_plan FROM public.teams WHERE id = NEW.team_id;

  v_limit := CASE v_plan
    WHEN 'free' THEN 1
    WHEN 'pro' THEN 3
    ELSE NULL
  END;

  IF v_limit IS NOT NULL THEN
    SELECT count(*) INTO v_current
    FROM public.spaces
    WHERE team_id = NEW.team_id;

    IF v_current >= v_limit THEN
      RAISE EXCEPTION 'Space limit reached for your plan (% spaces on % plan)', v_limit, v_plan;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER spaces_check_limit
    BEFORE INSERT ON public.spaces
    FOR EACH ROW EXECUTE FUNCTION public.check_space_limit();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── check_member_limit() trigger ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_member_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan    text;
  v_limit   int;
  v_current bigint;
BEGIN
  SELECT plan::text INTO v_plan FROM public.teams WHERE id = NEW.team_id;

  v_limit := CASE v_plan
    WHEN 'free' THEN 5
    WHEN 'pro' THEN 15
    WHEN 'team' THEN 100
    ELSE NULL
  END;

  IF v_limit IS NOT NULL THEN
    SELECT count(*) INTO v_current
    FROM public.team_members
    WHERE team_id = NEW.team_id;

    IF v_current >= v_limit THEN
      RAISE EXCEPTION 'Member limit reached for your plan (% members on % plan)', v_limit, v_plan;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER team_members_check_limit
    BEFORE INSERT ON public.team_members
    FOR EACH ROW EXECUTE FUNCTION public.check_member_limit();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
