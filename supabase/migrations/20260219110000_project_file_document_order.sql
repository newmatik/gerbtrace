-- Persist custom ordering for layer and document lists in viewer projects.
alter table public.projects
  add column if not exists layer_order jsonb;

alter table public.projects
  add column if not exists document_order jsonb;
