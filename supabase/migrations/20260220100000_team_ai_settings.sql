-- Add AI (Spark) integration settings to teams
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_api_key text,
  ADD COLUMN IF NOT EXISTS ai_model text NOT NULL DEFAULT '';
