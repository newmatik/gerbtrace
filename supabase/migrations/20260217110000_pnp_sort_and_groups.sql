-- Persist PnP sorting and grouping state per project
alter table public.projects
  add column if not exists pnp_sort_smd jsonb,
  add column if not exists pnp_sort_tht jsonb,
  add column if not exists pnp_component_groups jsonb,
  add column if not exists pnp_group_assignments jsonb;
