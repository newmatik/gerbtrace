-- Persist per-file BOM/PnP import options in team projects.
alter table public.projects
  add column if not exists bom_file_import_options jsonb,
  add column if not exists pnp_file_import_options jsonb;
