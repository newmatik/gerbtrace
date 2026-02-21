-- Fix the default value for ai_model (remove hardcoded invalid model ID)
ALTER TABLE public.teams
  ALTER COLUMN ai_model SET DEFAULT '';

-- Clear any invalid model IDs that were saved with the old default
UPDATE public.teams
  SET ai_model = ''
  WHERE ai_model IN ('claude-sonnet-4-20250514', 'claude-haiku-4-20250414');
