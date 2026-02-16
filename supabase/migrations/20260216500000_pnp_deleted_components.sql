-- Add pnp_deleted_components column to projects table
-- Stores component keys that the user has deleted from the PnP view

alter table public.projects
  add column if not exists pnp_deleted_components jsonb;
