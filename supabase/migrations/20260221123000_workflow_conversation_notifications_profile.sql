-- Workflow states, approval transitions, project conversation, notifications,
-- and profile avatar storage.

-- 1) Extend project status enum
do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'public.project_status'::regtype
      and enumlabel = 'in_progress'
  ) then
    alter type public.project_status add value 'in_progress' after 'draft';
  end if;

  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'public.project_status'::regtype
      and enumlabel = 'for_approval'
  ) then
    alter type public.project_status add value 'for_approval' after 'in_progress';
  end if;
end $$;

-- 2) Projects: approver and editable-state helper
alter table public.projects
  add column if not exists approver_user_id uuid references public.profiles(id) on delete set null;

create index if not exists projects_team_approver_idx
  on public.projects (team_id, approver_user_id);

-- Keep legacy function name used by existing policies, but broaden semantics:
-- editable states are draft and in_progress.
create or replace function public.is_project_draft(p_project_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.projects
    where id = p_project_id
      and status in ('draft', 'in_progress')
  );
$$;

create or replace function public.validate_project_approver()
returns trigger
language plpgsql
as $$
begin
  if new.approver_user_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.team_members tm
    where tm.team_id = new.team_id
      and tm.user_id = new.approver_user_id
      and tm.status = 'active'
      and tm.role in ('admin', 'editor')
  ) then
    raise exception
      'Invalid approver: must be an active admin/editor team member'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists projects_validate_approver on public.projects;
create trigger projects_validate_approver
  before insert or update of approver_user_id, team_id
  on public.projects
  for each row
  execute function public.validate_project_approver();

-- 3) Conversation tables
create table if not exists public.project_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  parent_message_id uuid references public.project_conversation_messages(id) on delete cascade,
  message_type text not null default 'comment',
  body text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_conversation_message_type_chk check (message_type in ('comment', 'system'))
);

create index if not exists project_conversation_messages_project_idx
  on public.project_conversation_messages (project_id, created_at desc);
create index if not exists project_conversation_messages_parent_idx
  on public.project_conversation_messages (parent_message_id);
create index if not exists project_conversation_messages_team_idx
  on public.project_conversation_messages (team_id);

create table if not exists public.project_conversation_mentions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.project_conversation_messages(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(message_id, mentioned_user_id)
);

create index if not exists project_conversation_mentions_user_idx
  on public.project_conversation_mentions (mentioned_user_id, created_at desc);

-- 4) Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  team_id uuid references public.teams(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  message_id uuid references public.project_conversation_messages(id) on delete cascade,
  type text not null,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_chk check (
    type in ('mention', 'approval_requested', 'approved', 'changes_requested', 'status_changed')
  )
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (recipient_user_id, read_at)
  where read_at is null;

-- 5) RLS for new tables
alter table public.project_conversation_messages enable row level security;
alter table public.project_conversation_mentions enable row level security;
alter table public.notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_conversation_messages'
      and policyname = 'project_conversation_messages_select'
  ) then
    create policy "project_conversation_messages_select"
      on public.project_conversation_messages for select
      to authenticated
      using (public.is_team_member(team_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_conversation_messages'
      and policyname = 'project_conversation_messages_insert'
  ) then
    create policy "project_conversation_messages_insert"
      on public.project_conversation_messages for insert
      to authenticated
      with check (
        public.has_team_role(team_id, 'viewer')
        and (
          author_id is null
          or author_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_conversation_messages'
      and policyname = 'project_conversation_messages_update'
  ) then
    create policy "project_conversation_messages_update"
      on public.project_conversation_messages for update
      to authenticated
      using (
        public.is_team_member(team_id)
        and (author_id = auth.uid() or public.has_team_role(team_id, 'admin'))
      )
      with check (
        public.is_team_member(team_id)
        and (author_id = auth.uid() or public.has_team_role(team_id, 'admin'))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_conversation_messages'
      and policyname = 'project_conversation_messages_delete'
  ) then
    create policy "project_conversation_messages_delete"
      on public.project_conversation_messages for delete
      to authenticated
      using (
        public.is_team_member(team_id)
        and (author_id = auth.uid() or public.has_team_role(team_id, 'admin'))
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_conversation_mentions'
      and policyname = 'project_conversation_mentions_select'
  ) then
    create policy "project_conversation_mentions_select"
      on public.project_conversation_mentions for select
      to authenticated
      using (
        public.is_team_member((
          select m.team_id
          from public.project_conversation_messages m
          where m.id = message_id
        ))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_conversation_mentions'
      and policyname = 'project_conversation_mentions_insert'
  ) then
    create policy "project_conversation_mentions_insert"
      on public.project_conversation_mentions for insert
      to authenticated
      with check (
        public.is_team_member((
          select m.team_id
          from public.project_conversation_messages m
          where m.id = message_id
        ))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'project_conversation_mentions'
      and policyname = 'project_conversation_mentions_delete'
  ) then
    create policy "project_conversation_mentions_delete"
      on public.project_conversation_mentions for delete
      to authenticated
      using (
        public.is_team_member((
          select m.team_id
          from public.project_conversation_messages m
          where m.id = message_id
        ))
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'notifications_select'
  ) then
    create policy "notifications_select"
      on public.notifications for select
      to authenticated
      using (recipient_user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'notifications_update'
  ) then
    create policy "notifications_update"
      on public.notifications for update
      to authenticated
      using (recipient_user_id = auth.uid())
      with check (recipient_user_id = auth.uid());
  end if;
end $$;

-- 6) Helpers + workflow transition function
create or replace function public.create_notification(
  p_recipient_user_id uuid,
  p_type text,
  p_team_id uuid,
  p_project_id uuid,
  p_message_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if p_recipient_user_id is null then
    return;
  end if;

  if v_actor is not null and p_recipient_user_id = v_actor then
    return;
  end if;

  insert into public.notifications (
    recipient_user_id,
    actor_user_id,
    team_id,
    project_id,
    message_id,
    type,
    payload
  ) values (
    p_recipient_user_id,
    v_actor,
    p_team_id,
    p_project_id,
    p_message_id,
    p_type,
    coalesce(p_payload, '{}'::jsonb)
  );
end;
$$;

create or replace function public.transition_project_workflow(
  p_project_id uuid,
  p_action text,
  p_approver_user_id uuid default null,
  p_message text default null
)
returns public.projects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_project public.projects%rowtype;
  v_message_id uuid;
  v_action text := lower(trim(coalesce(p_action, '')));
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_project
  from public.projects
  where id = p_project_id
  for update;

  if not found then
    raise exception 'Project not found';
  end if;

  if not public.is_team_member(v_project.team_id) then
    raise exception 'Forbidden';
  end if;

  if v_action = 'set_in_progress' then
    if v_project.status not in ('draft', 'for_approval') then
      raise exception 'Project must be draft or for_approval';
    end if;
    if v_user_id <> v_project.created_by and v_user_id <> v_project.assignee_user_id then
      raise exception 'Only project creator or assignee can move to in_progress';
    end if;

    update public.projects
    set status = 'in_progress',
        approver_user_id = null,
        approved_by = null,
        approved_at = null,
        updated_at = now()
    where id = v_project.id
    returning * into v_project;

    insert into public.project_conversation_messages (
      project_id, team_id, author_id, message_type, body, metadata
    ) values (
      v_project.id, v_project.team_id, v_user_id, 'system',
      'moved workflow to In Progress',
      jsonb_build_object('action', v_action, 'status', v_project.status)
    )
    returning id into v_message_id;

    return v_project;
  elsif v_action = 'request_approval' then
    if v_project.status not in ('draft', 'in_progress') then
      raise exception 'Project must be draft or in_progress';
    end if;
    if v_user_id <> v_project.created_by and v_user_id <> v_project.assignee_user_id then
      raise exception 'Only project creator or assignee can request approval';
    end if;
    if p_approver_user_id is null then
      raise exception 'Approver is required';
    end if;
    if not exists (
      select 1
      from public.team_members tm
      where tm.team_id = v_project.team_id
        and tm.user_id = p_approver_user_id
        and tm.status = 'active'
        and tm.role in ('admin', 'editor')
    ) then
      raise exception 'Approver must be an active admin/editor team member';
    end if;

    update public.projects
    set status = 'for_approval',
        approver_user_id = p_approver_user_id,
        approved_by = null,
        approved_at = null,
        updated_at = now()
    where id = v_project.id
    returning * into v_project;

    insert into public.project_conversation_messages (
      project_id, team_id, author_id, message_type, body, metadata
    ) values (
      v_project.id, v_project.team_id, v_user_id, 'system',
      'requested approval',
      jsonb_build_object(
        'action', v_action,
        'status', v_project.status,
        'approver_user_id', p_approver_user_id
      )
    )
    returning id into v_message_id;

    perform public.create_notification(
      p_approver_user_id,
      'approval_requested',
      v_project.team_id,
      v_project.id,
      v_message_id,
      jsonb_build_object('project_name', v_project.name)
    );

    return v_project;
  elsif v_action = 'approve' then
    if v_project.status <> 'for_approval' then
      raise exception 'Project must be for_approval';
    end if;
    if not (
      public.has_team_role(v_project.team_id, 'admin')
      or v_user_id = v_project.approver_user_id
    ) then
      raise exception 'Only selected approver or team admin can approve';
    end if;

    update public.projects
    set status = 'approved',
        approved_by = v_user_id,
        approved_at = now(),
        updated_at = now()
    where id = v_project.id
    returning * into v_project;

    insert into public.project_conversation_messages (
      project_id, team_id, author_id, message_type, body, metadata
    ) values (
      v_project.id, v_project.team_id, v_user_id, 'system',
      'approved this project',
      jsonb_build_object('action', v_action, 'status', v_project.status)
    )
    returning id into v_message_id;

    perform public.create_notification(
      v_project.created_by,
      'approved',
      v_project.team_id,
      v_project.id,
      v_message_id,
      jsonb_build_object('project_name', v_project.name)
    );
    if v_project.assignee_user_id is not null and v_project.assignee_user_id <> v_project.created_by then
      perform public.create_notification(
        v_project.assignee_user_id,
        'approved',
        v_project.team_id,
        v_project.id,
        v_message_id,
        jsonb_build_object('project_name', v_project.name)
      );
    end if;

    return v_project;
  elsif v_action = 'request_changes' then
    if v_project.status <> 'for_approval' then
      raise exception 'Project must be for_approval';
    end if;
    if not (
      public.has_team_role(v_project.team_id, 'admin')
      or v_user_id = v_project.approver_user_id
    ) then
      raise exception 'Only selected approver or team admin can request changes';
    end if;
    if p_message is null or btrim(p_message) = '' then
      raise exception 'A request changes message is required';
    end if;

    update public.projects
    set status = 'in_progress',
        approver_user_id = null,
        approved_by = null,
        approved_at = null,
        updated_at = now()
    where id = v_project.id
    returning * into v_project;

    insert into public.project_conversation_messages (
      project_id, team_id, author_id, message_type, body, metadata
    ) values (
      v_project.id, v_project.team_id, v_user_id, 'system',
      btrim(p_message),
      jsonb_build_object('action', v_action, 'status', v_project.status)
    )
    returning id into v_message_id;

    perform public.create_notification(
      v_project.created_by,
      'changes_requested',
      v_project.team_id,
      v_project.id,
      v_message_id,
      jsonb_build_object('project_name', v_project.name)
    );
    if v_project.assignee_user_id is not null and v_project.assignee_user_id <> v_project.created_by then
      perform public.create_notification(
        v_project.assignee_user_id,
        'changes_requested',
        v_project.team_id,
        v_project.id,
        v_message_id,
        jsonb_build_object('project_name', v_project.name)
      );
    end if;

    return v_project;
  else
    raise exception 'Unknown workflow action: %', p_action;
  end if;
end;
$$;

-- 7) Keep legacy function names for backwards compatibility
create or replace function public.approve_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.transition_project_workflow(p_project_id, 'approve');
end;
$$;

create or replace function public.revert_to_draft(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  select team_id into v_team_id
  from public.projects
  where id = p_project_id;

  if v_team_id is null then
    raise exception 'Project not found';
  end if;

  if not public.has_team_role(v_team_id, 'admin') then
    raise exception 'Only team admins can revert projects to draft';
  end if;

  update public.projects
  set status = 'draft',
      approver_user_id = null,
      approved_by = null,
      approved_at = null,
      updated_at = now()
  where id = p_project_id;
end;
$$;

-- 8) Avatars bucket
insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 2097152) -- 2 MiB
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_select'
  ) then
    create policy "avatars_select"
      on storage.objects for select
      to public
      using (bucket_id = 'avatars');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_insert'
  ) then
    create policy "avatars_insert"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_update'
  ) then
    create policy "avatars_update"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'avatars_delete'
  ) then
    create policy "avatars_delete"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

-- 9) Realtime publication for new collaborative tables
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'project_conversation_messages'
  ) then
    alter publication supabase_realtime add table public.project_conversation_messages;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'project_conversation_mentions'
  ) then
    alter publication supabase_realtime add table public.project_conversation_mentions;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
