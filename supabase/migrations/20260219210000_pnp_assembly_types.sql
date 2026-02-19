ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS pnp_assembly_types jsonb DEFAULT NULL;
