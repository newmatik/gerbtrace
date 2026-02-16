-- ============================================================================
-- PCB board parameters for pricing estimation
-- ============================================================================
-- Adds a pcb_data JSONB column to projects for storing board parameters
-- (size, layers, surface finish, copper weight) used by the pricing model.
-- ============================================================================

alter table public.projects
  add column if not exists pcb_data jsonb;
