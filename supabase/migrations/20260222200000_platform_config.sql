-- Platform-wide configuration for centralized API keys.
-- Single-row table: only the service role can read/write.

CREATE TABLE IF NOT EXISTS public.platform_config (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spark_api_key    text,
  spark_model      text NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  elexess_username text,
  elexess_password text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

-- Seed from the newmatik team (no-op if row already exists or team not found).
INSERT INTO public.platform_config (spark_api_key, spark_model, elexess_username, elexess_password)
SELECT
  t.ai_api_key,
  CASE WHEN t.ai_model = '' THEN 'claude-sonnet-4-20250514' ELSE t.ai_model END,
  t.elexess_username,
  t.elexess_password
FROM public.teams t
WHERE t.slug = 'newmatik'
  AND NOT EXISTS (SELECT 1 FROM public.platform_config)
LIMIT 1;

-- Ensure at least one row exists even if newmatik team is not found.
INSERT INTO public.platform_config (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.platform_config);

-- ── Updated log_usage_event(): add spark_ai_run limits ───────────────────────

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

  IF p_event_type = 'spark_ai_run' THEN
    v_limit := CASE v_plan
      WHEN 'free' THEN 0
      WHEN 'pro' THEN 25
      WHEN 'team' THEN 150
      ELSE NULL
    END;

    IF v_limit IS NOT NULL THEN
      SELECT count(*) INTO v_current
      FROM public.usage_events
      WHERE team_id = p_team_id
        AND event_type = 'spark_ai_run'
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
