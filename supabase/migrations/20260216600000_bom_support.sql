-- ============================================================================
-- BOM (Bill of Materials) support
-- ============================================================================
-- Adds BOM data columns to projects and Elexess API credentials to teams.
-- ============================================================================

-- ── BOM columns on projects ─────────────────────────────────────────────────

alter table public.projects
  add column if not exists bom_lines jsonb;

alter table public.projects
  add column if not exists bom_pricing_cache jsonb;

-- ── Elexess API credentials on teams ────────────────────────────────────────

alter table public.teams
  add column if not exists elexess_username text;

alter table public.teams
  add column if not exists elexess_password text;
