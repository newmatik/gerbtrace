ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS bom_groups jsonb DEFAULT '[]'::jsonb;
