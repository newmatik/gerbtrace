-- Add panel configuration column (JSONB) to projects table
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS panel_data jsonb DEFAULT NULL;
