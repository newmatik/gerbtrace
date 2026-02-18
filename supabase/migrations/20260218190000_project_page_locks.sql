-- Per-page lock state for viewer tabs (team projects)
alter table public.projects
  add column if not exists page_locks jsonb;

comment on column public.projects.page_locks is
  'Per-page lock metadata keyed by tab id (files/pcb/panel/smd/tht/bom). Each value stores locked, locked_at, locked_by, locked_by_name.';
