-- ============================================================================
-- BOM board quantity
-- ============================================================================
-- Adds a board quantity column to projects for BOM pricing calculation.
-- Total pieces per BOM line = bom_board_quantity * line quantity.
-- ============================================================================

alter table public.projects
  add column if not exists bom_board_quantity integer;
