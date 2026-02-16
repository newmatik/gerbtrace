-- ============================================================================
-- Project documents (PDF files)
-- ============================================================================
-- Stores metadata for PDF documents attached to team projects.
-- Actual PDF binary data lives in the 'gerber-files' Supabase Storage bucket
-- using the path: {team_id}/{project_id}/docs/{file_name}
-- ============================================================================

-- ── Table ────────────────────────────────────────────────────────────────────

create table if not exists public.project_documents (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  file_name     text not null,
  storage_path  text not null,
  doc_type      text not null default 'Drawings',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.project_documents is
  'PDF documents attached to a project. Actual content in Supabase Storage.';

create index if not exists project_documents_project_idx
  on public.project_documents (project_id);

-- Unique constraint for upsert support
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'project_documents_project_file_uniq'
  ) then
    alter table public.project_documents
      add constraint project_documents_project_file_uniq
      unique (project_id, file_name);
  end if;
end;
$$;

-- updated_at trigger
create trigger project_documents_updated_at
  before update on public.project_documents
  for each row execute function public.set_updated_at();

-- ── RLS policies ─────────────────────────────────────────────────────────────

alter table public.project_documents enable row level security;

-- Team members can see documents of their projects
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'project_documents_select' and tablename = 'project_documents') then
    create policy "project_documents_select"
      on public.project_documents for select
      to authenticated
      using (public.is_team_member(public.project_team_id(project_id)));
  end if;
end;
$$;

-- Admins and editors can add documents when project is draft
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'project_documents_insert' and tablename = 'project_documents') then
    create policy "project_documents_insert"
      on public.project_documents for insert
      to authenticated
      with check (
        public.has_team_role(public.project_team_id(project_id), 'editor')
        and public.is_project_draft(project_id)
      );
  end if;
end;
$$;

-- Admins and editors can update documents when project is draft
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'project_documents_update' and tablename = 'project_documents') then
    create policy "project_documents_update"
      on public.project_documents for update
      to authenticated
      using (
        public.has_team_role(public.project_team_id(project_id), 'editor')
        and public.is_project_draft(project_id)
      )
      with check (
        public.has_team_role(public.project_team_id(project_id), 'editor')
        and public.is_project_draft(project_id)
      );
  end if;
end;
$$;

-- Admins and editors can delete documents when project is draft
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'project_documents_delete' and tablename = 'project_documents') then
    create policy "project_documents_delete"
      on public.project_documents for delete
      to authenticated
      using (
        public.has_team_role(public.project_team_id(project_id), 'editor')
        and public.is_project_draft(project_id)
      );
  end if;
end;
$$;
