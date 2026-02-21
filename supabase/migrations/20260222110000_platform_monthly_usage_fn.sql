CREATE OR REPLACE FUNCTION public.get_platform_monthly_usage()
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
  WHERE created_at >= date_trunc('month', now());
$$;
