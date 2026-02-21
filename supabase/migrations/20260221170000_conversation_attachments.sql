-- ============================================================================
-- Conversation attachments
-- ============================================================================

create table if not exists public.project_conversation_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.project_conversation_messages(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  file_size bigint not null,
  mime_type text,
  created_at timestamptz not null default now(),
  unique(storage_path)
);

create index if not exists project_conversation_attachments_project_idx
  on public.project_conversation_attachments (project_id, created_at desc);

create index if not exists project_conversation_attachments_message_idx
  on public.project_conversation_attachments (message_id, created_at asc);

create index if not exists project_conversation_attachments_team_idx
  on public.project_conversation_attachments (team_id);

alter table public.project_conversation_attachments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_conversation_attachments'
      and policyname = 'project_conversation_attachments_select'
  ) then
    create policy "project_conversation_attachments_select"
      on public.project_conversation_attachments for select
      to authenticated
      using (public.is_team_member(team_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_conversation_attachments'
      and policyname = 'project_conversation_attachments_insert'
  ) then
    create policy "project_conversation_attachments_insert"
      on public.project_conversation_attachments for insert
      to authenticated
      with check (public.has_team_role(team_id, 'viewer'));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_conversation_attachments'
      and policyname = 'project_conversation_attachments_delete'
  ) then
    create policy "project_conversation_attachments_delete"
      on public.project_conversation_attachments for delete
      to authenticated
      using (
        public.has_team_role(team_id, 'admin')
        or exists (
          select 1
          from public.project_conversation_messages m
          where m.id = message_id
            and m.author_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'gerber_files_conversation_insert'
  ) then
    create policy "gerber_files_conversation_insert"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'gerber-files'
        and split_part(name, '/', 3) = 'conversation'
        and public.has_team_role(public.storage_path_team_id(name), 'viewer')
      );
  end if;
end $$;
