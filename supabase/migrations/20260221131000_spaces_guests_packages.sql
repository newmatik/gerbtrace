-- Spaces, guests, project-space access control and space packages.

-- 1) Tables
create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists spaces_team_name_uniq
  on public.spaces (team_id, lower(name));
create index if not exists spaces_team_idx
  on public.spaces (team_id);

create table if not exists public.space_members (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.member_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (space_id, user_id)
);

create index if not exists space_members_space_idx
  on public.space_members (space_id);
create index if not exists space_members_user_idx
  on public.space_members (user_id);

create table if not exists public.space_invitations (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  email text not null,
  invited_by uuid references public.profiles(id) on delete set null,
  token text unique not null,
  accepted_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists space_invitations_space_idx
  on public.space_invitations (space_id);
create index if not exists space_invitations_token_idx
  on public.space_invitations (token);

-- 2) Projects and packages: add space_id
alter table public.projects
  add column if not exists space_id uuid references public.spaces(id) on delete set null;

create index if not exists projects_team_space_idx
  on public.projects (team_id, space_id);

alter table public.team_packages
  add column if not exists space_id uuid references public.spaces(id) on delete set null;

alter table public.team_tht_packages
  add column if not exists space_id uuid references public.spaces(id) on delete set null;

create index if not exists team_packages_space_idx on public.team_packages(space_id);
create index if not exists team_tht_packages_space_idx on public.team_tht_packages(space_id);

drop index if exists team_packages_team_name_uniq;
drop index if exists team_tht_packages_team_name_uniq;

create unique index if not exists team_packages_team_space_name_uniq
  on public.team_packages (team_id, coalesce(space_id, '00000000-0000-0000-0000-000000000000'::uuid), ((data ->> 'name')));

create unique index if not exists team_tht_packages_team_space_name_uniq
  on public.team_tht_packages (team_id, coalesce(space_id, '00000000-0000-0000-0000-000000000000'::uuid), ((data ->> 'name')));

-- 3) Helpers
create or replace function public.is_active_team_account(p_team_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = p_team_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
  );
$$;

create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = p_team_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
      and tm.role in ('viewer', 'editor', 'admin')
  );
$$;

create or replace function public.has_team_role(p_team_id uuid, p_min_role public.team_role)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.team_id = p_team_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
      and (
        case p_min_role
          when 'guest' then tm.role in ('guest', 'viewer', 'editor', 'admin')
          when 'viewer' then tm.role in ('viewer', 'editor', 'admin')
          when 'editor' then tm.role in ('editor', 'admin')
          when 'admin'  then tm.role = 'admin'
        end
      )
  );
$$;

create or replace function public.project_space_id(p_project_id uuid)
returns uuid
language sql
stable
security definer set search_path = ''
as $$
  select p.space_id from public.projects p where p.id = p_project_id;
$$;

create or replace function public.space_team_id(p_space_id uuid)
returns uuid
language sql
stable
security definer set search_path = ''
as $$
  select s.team_id from public.spaces s where s.id = p_space_id;
$$;

create or replace function public.is_space_member(p_space_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.space_members sm
    where sm.space_id = p_space_id
      and sm.user_id = auth.uid()
      and sm.status = 'active'
  );
$$;

create or replace function public.can_access_space(p_space_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.spaces s
    where s.id = p_space_id
      and (
        public.has_team_role(s.team_id, 'admin')
        or public.is_space_member(s.id)
      )
  );
$$;

create or replace function public.can_access_project(p_project_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and (
        public.has_team_role(p.team_id, 'admin')
        or (p.space_id is not null and public.is_space_member(p.space_id))
      )
  );
$$;

create or replace function public.can_edit_space_package(
  p_team_id uuid,
  p_space_id uuid,
  p_created_by uuid
)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select (
    public.has_team_role(p_team_id, 'editor')
    or (
      exists (
        select 1 from public.team_members tm
        where tm.team_id = p_team_id
          and tm.user_id = auth.uid()
          and tm.status = 'active'
          and tm.role = 'guest'
      )
      and p_space_id is not null
      and public.is_space_member(p_space_id)
      and p_created_by = auth.uid()
    )
  );
$$;

create or replace function public.validate_space_scopes()
returns trigger
language plpgsql
as $$
declare
  v_space_team_id uuid;
begin
  if new.space_id is null then
    return new;
  end if;
  select team_id into v_space_team_id from public.spaces where id = new.space_id;
  if v_space_team_id is null then
    raise exception 'Space not found';
  end if;
  if v_space_team_id <> new.team_id then
    raise exception 'Space must belong to the same team';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_validate_space_scope on public.projects;
create trigger projects_validate_space_scope
  before insert or update of space_id, team_id
  on public.projects
  for each row
  execute function public.validate_space_scopes();

drop trigger if exists team_packages_validate_space_scope on public.team_packages;
create trigger team_packages_validate_space_scope
  before insert or update of space_id, team_id
  on public.team_packages
  for each row
  execute function public.validate_space_scopes();

drop trigger if exists team_tht_packages_validate_space_scope on public.team_tht_packages;
create trigger team_tht_packages_validate_space_scope
  before insert or update of space_id, team_id
  on public.team_tht_packages
  for each row
  execute function public.validate_space_scopes();

-- 4) Backfill: one default space per team and memberships for non-guests.
insert into public.spaces (team_id, name, created_by)
select t.id, 'General', (
  select tm.user_id from public.team_members tm
  where tm.team_id = t.id and tm.role = 'admin' and tm.status = 'active'
  order by tm.created_at asc
  limit 1
)
from public.teams t
where not exists (select 1 from public.spaces s where s.team_id = t.id);

update public.projects p
set space_id = s.id
from public.spaces s
where p.space_id is null
  and s.team_id = p.team_id
  and s.name = 'General';

insert into public.space_members (space_id, user_id, status)
select s.id, tm.user_id, 'active'::public.member_status
from public.spaces s
join public.team_members tm on tm.team_id = s.team_id
where tm.status = 'active'
  and tm.role <> 'guest'
on conflict (space_id, user_id) do nothing;

-- 5) Invitation accept flow for space guests
create or replace function public.accept_space_invitation(p_token text)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_invitation record;
  v_space record;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invitation
  from public.space_invitations
  where token = p_token
    and accepted_at is null
    and expires_at > now();

  if v_invitation is null then
    raise exception 'Invalid or expired invitation.';
  end if;

  select s.* into v_space from public.spaces s where s.id = v_invitation.space_id;
  if v_space is null then
    raise exception 'Space not found';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = v_user_id and lower(email) = lower(v_invitation.email)
  ) then
    raise exception 'This invitation was sent to a different email address.';
  end if;

  insert into public.team_members (team_id, user_id, role, status)
  values (v_space.team_id, v_user_id, 'guest', 'active')
  on conflict (team_id, user_id) do nothing;

  insert into public.space_members (space_id, user_id, status)
  values (v_space.id, v_user_id, 'active')
  on conflict (space_id, user_id) do update
    set status = 'active';

  update public.space_invitations
  set accepted_at = now()
  where id = v_invitation.id;

  return jsonb_build_object(
    'team_id', v_space.team_id,
    'space_id', v_space.id
  );
end;
$$;

-- 6) RLS updates
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.space_invitations enable row level security;

drop policy if exists "teams_select" on public.teams;
create policy "teams_select"
  on public.teams for select
  to authenticated
  using (public.is_active_team_account(id));

drop policy if exists "team_members_select" on public.team_members;
create policy "team_members_select"
  on public.team_members for select
  to authenticated
  using (
    public.is_team_member(team_id)
    or user_id = auth.uid()
  );

drop policy if exists "team_invitations_select" on public.team_invitations;
create policy "team_invitations_select"
  on public.team_invitations for select
  to authenticated
  using (public.has_team_role(team_id, 'admin'));

drop policy if exists "team_invitations_insert" on public.team_invitations;
create policy "team_invitations_insert"
  on public.team_invitations for insert
  to authenticated
  with check (public.has_team_role(team_id, 'admin'));

drop policy if exists "team_invitations_update" on public.team_invitations;
create policy "team_invitations_update"
  on public.team_invitations for update
  to authenticated
  using (public.has_team_role(team_id, 'admin'));

drop policy if exists "team_invitations_delete" on public.team_invitations;
create policy "team_invitations_delete"
  on public.team_invitations for delete
  to authenticated
  using (public.has_team_role(team_id, 'admin'));

create policy "spaces_select"
  on public.spaces for select
  to authenticated
  using (public.can_access_space(id));

create policy "spaces_insert"
  on public.spaces for insert
  to authenticated
  with check (public.has_team_role(team_id, 'admin'));

create policy "spaces_update"
  on public.spaces for update
  to authenticated
  using (public.has_team_role(team_id, 'admin'))
  with check (public.has_team_role(team_id, 'admin'));

create policy "spaces_delete"
  on public.spaces for delete
  to authenticated
  using (public.has_team_role(team_id, 'admin'));

create policy "space_members_select"
  on public.space_members for select
  to authenticated
  using (
    public.has_team_role(public.space_team_id(space_id), 'admin')
    or user_id = auth.uid()
    or public.is_space_member(space_id)
  );

create policy "space_members_insert"
  on public.space_members for insert
  to authenticated
  with check (public.has_team_role(public.space_team_id(space_id), 'admin'));

create policy "space_members_update"
  on public.space_members for update
  to authenticated
  using (public.has_team_role(public.space_team_id(space_id), 'admin'))
  with check (public.has_team_role(public.space_team_id(space_id), 'admin'));

create policy "space_members_delete"
  on public.space_members for delete
  to authenticated
  using (public.has_team_role(public.space_team_id(space_id), 'admin'));

create policy "space_invitations_select"
  on public.space_invitations for select
  to authenticated
  using (public.has_team_role(public.space_team_id(space_id), 'admin'));

create policy "space_invitations_insert"
  on public.space_invitations for insert
  to authenticated
  with check (public.has_team_role(public.space_team_id(space_id), 'admin'));

create policy "space_invitations_update"
  on public.space_invitations for update
  to authenticated
  using (public.has_team_role(public.space_team_id(space_id), 'admin'));

create policy "space_invitations_delete"
  on public.space_invitations for delete
  to authenticated
  using (public.has_team_role(public.space_team_id(space_id), 'admin'));

drop policy if exists "projects_select" on public.projects;
create policy "projects_select"
  on public.projects for select
  to authenticated
  using (public.can_access_project(id));

drop policy if exists "projects_insert" on public.projects;
create policy "projects_insert"
  on public.projects for insert
  to authenticated
  with check (
    public.has_team_role(team_id, 'editor')
    and (space_id is null or public.can_access_space(space_id))
  );

drop policy if exists "projects_update" on public.projects;
create policy "projects_update"
  on public.projects for update
  to authenticated
  using (
    public.has_team_role(team_id, 'editor')
    and (status in ('draft', 'in_progress') or public.has_team_role(team_id, 'admin'))
  )
  with check (
    public.has_team_role(team_id, 'editor')
    and (space_id is null or public.can_access_space(space_id))
  );

drop policy if exists "projects_delete" on public.projects;
create policy "projects_delete"
  on public.projects for delete
  to authenticated
  using (public.has_team_role(team_id, 'admin'));

drop policy if exists "project_files_select" on public.project_files;
create policy "project_files_select"
  on public.project_files for select
  to authenticated
  using (public.can_access_project(project_id));

drop policy if exists "project_files_insert" on public.project_files;
create policy "project_files_insert"
  on public.project_files for insert
  to authenticated
  with check (
    public.has_team_role(public.project_team_id(project_id), 'editor')
    and public.is_project_draft(project_id)
  );

drop policy if exists "project_files_update" on public.project_files;
create policy "project_files_update"
  on public.project_files for update
  to authenticated
  using (
    public.has_team_role(public.project_team_id(project_id), 'editor')
    and public.is_project_draft(project_id)
  )
  with check (
    public.has_team_role(public.project_team_id(project_id), 'editor')
    and public.is_project_draft(project_id)
  );

drop policy if exists "project_files_delete" on public.project_files;
create policy "project_files_delete"
  on public.project_files for delete
  to authenticated
  using (
    public.has_team_role(public.project_team_id(project_id), 'editor')
    and public.is_project_draft(project_id)
  );

do $$
begin
  if to_regclass('public.project_documents') is not null then
    execute 'drop policy if exists "project_documents_select" on public.project_documents';
    execute '
      create policy "project_documents_select"
      on public.project_documents for select
      to authenticated
      using (public.can_access_project(project_id))
    ';
  end if;
end $$;

drop policy if exists "project_conversation_messages_select" on public.project_conversation_messages;
create policy "project_conversation_messages_select"
  on public.project_conversation_messages for select
  to authenticated
  using (public.can_access_project(project_id));

drop policy if exists "project_conversation_messages_insert" on public.project_conversation_messages;
create policy "project_conversation_messages_insert"
  on public.project_conversation_messages for insert
  to authenticated
  with check (
    public.can_access_project(project_id)
    and (
      author_id is null
      or author_id = auth.uid()
    )
  );

drop policy if exists "project_conversation_messages_update" on public.project_conversation_messages;
create policy "project_conversation_messages_update"
  on public.project_conversation_messages for update
  to authenticated
  using (
    public.can_access_project(project_id)
    and (author_id = auth.uid() or public.has_team_role(team_id, 'admin'))
  )
  with check (
    public.can_access_project(project_id)
    and (author_id = auth.uid() or public.has_team_role(team_id, 'admin'))
  );

drop policy if exists "project_conversation_messages_delete" on public.project_conversation_messages;
create policy "project_conversation_messages_delete"
  on public.project_conversation_messages for delete
  to authenticated
  using (
    public.can_access_project(project_id)
    and (author_id = auth.uid() or public.has_team_role(team_id, 'admin'))
  );

drop policy if exists "team_packages_select" on public.team_packages;
create policy "team_packages_select"
  on public.team_packages for select
  to authenticated
  using (
    (space_id is null and public.is_active_team_account(team_id))
    or (space_id is not null and public.can_access_space(space_id))
  );

drop policy if exists "team_packages_insert" on public.team_packages;
create policy "team_packages_insert"
  on public.team_packages for insert
  to authenticated
  with check (
    (
      space_id is null and public.has_team_role(team_id, 'editor')
    )
    or (
      space_id is not null
      and public.can_edit_space_package(team_id, space_id, created_by)
    )
  );

drop policy if exists "team_packages_update" on public.team_packages;
create policy "team_packages_update"
  on public.team_packages for update
  to authenticated
  using (
    (
      space_id is null and public.has_team_role(team_id, 'editor')
    )
    or (
      space_id is not null
      and public.can_edit_space_package(team_id, space_id, created_by)
    )
  )
  with check (
    (
      space_id is null and public.has_team_role(team_id, 'editor')
    )
    or (
      space_id is not null
      and public.can_edit_space_package(team_id, space_id, created_by)
    )
  );

drop policy if exists "team_packages_delete" on public.team_packages;
create policy "team_packages_delete"
  on public.team_packages for delete
  to authenticated
  using (
    (space_id is null and public.has_team_role(team_id, 'admin'))
    or (space_id is not null and public.can_edit_space_package(team_id, space_id, created_by))
  );

drop policy if exists "team_tht_packages_select" on public.team_tht_packages;
create policy "team_tht_packages_select"
  on public.team_tht_packages for select
  to authenticated
  using (
    (space_id is null and public.is_active_team_account(team_id))
    or (space_id is not null and public.can_access_space(space_id))
  );

drop policy if exists "team_tht_packages_insert" on public.team_tht_packages;
create policy "team_tht_packages_insert"
  on public.team_tht_packages for insert
  to authenticated
  with check (
    (
      space_id is null and public.has_team_role(team_id, 'editor')
    )
    or (
      space_id is not null
      and public.can_edit_space_package(team_id, space_id, created_by)
    )
  );

drop policy if exists "team_tht_packages_update" on public.team_tht_packages;
create policy "team_tht_packages_update"
  on public.team_tht_packages for update
  to authenticated
  using (
    (
      space_id is null and public.has_team_role(team_id, 'editor')
    )
    or (
      space_id is not null
      and public.can_edit_space_package(team_id, space_id, created_by)
    )
  )
  with check (
    (
      space_id is null and public.has_team_role(team_id, 'editor')
    )
    or (
      space_id is not null
      and public.can_edit_space_package(team_id, space_id, created_by)
    )
  );

drop policy if exists "team_tht_packages_delete" on public.team_tht_packages;
create policy "team_tht_packages_delete"
  on public.team_tht_packages for delete
  to authenticated
  using (
    (space_id is null and public.has_team_role(team_id, 'admin'))
    or (space_id is not null and public.can_edit_space_package(team_id, space_id, created_by))
  );

-- 7) Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'spaces'
  ) then
    alter publication supabase_realtime add table public.spaces;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'space_members'
  ) then
    alter publication supabase_realtime add table public.space_members;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'space_invitations'
  ) then
    alter publication supabase_realtime add table public.space_invitations;
  end if;
end $$;
