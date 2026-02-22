-- Add covering index for usage_events_user_id_fkey (Supabase advisor).
-- Idempotent: safe to re-run.

CREATE INDEX IF NOT EXISTS idx_usage_events_user_id
  ON public.usage_events (user_id);
