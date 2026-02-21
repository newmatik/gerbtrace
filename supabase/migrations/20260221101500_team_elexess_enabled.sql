ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS elexess_enabled boolean NOT NULL DEFAULT true;

UPDATE public.teams
SET elexess_enabled = true
WHERE elexess_enabled IS NULL;
