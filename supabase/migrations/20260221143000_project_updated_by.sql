-- Track who last updated each team project.
alter table public.projects
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

-- Backfill existing projects so UI can show an updater immediately.
update public.projects
set updated_by = coalesce(updated_by, created_by)
where updated_by is null;

create or replace function public.set_project_updated_meta()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = coalesce(auth.uid(), new.updated_by, old.updated_by, old.created_by);
  return new;
end;
$$;

drop trigger if exists projects_updated_at on public.projects;

create trigger projects_updated_at
before update on public.projects
for each row execute function public.set_project_updated_meta();
