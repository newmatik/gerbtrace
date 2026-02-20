-- Add AI suggestion storage to projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS bom_ai_suggestions jsonb DEFAULT '{}'::jsonb;
