-- ============================================================================
-- Team panel size preferences
-- ============================================================================
-- Adds preferred and maximum panel dimensions to team settings.
-- ============================================================================

alter table public.teams
  add column if not exists preferred_panel_width_mm numeric;

alter table public.teams
  add column if not exists preferred_panel_height_mm numeric;

alter table public.teams
  add column if not exists max_panel_width_mm numeric;

alter table public.teams
  add column if not exists max_panel_height_mm numeric;
