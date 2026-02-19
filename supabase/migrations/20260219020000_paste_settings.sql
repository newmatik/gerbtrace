-- Add paste application settings (JSONB) to projects table
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS paste_settings jsonb DEFAULT NULL;
