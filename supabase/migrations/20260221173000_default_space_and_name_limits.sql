-- Ensure every team has a default space and enforce short names.

-- 1) Normalize existing names before adding strict length constraints.
update public.teams
set name = left(trim(name), 15)
where name is distinct from left(trim(name), 15);

update public.spaces
set name = left(trim(name), 15)
where name is distinct from left(trim(name), 15);

-- 2) Enforce max name length at database level.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'teams_name_len_chk'
      and conrelid = 'public.teams'::regclass
  ) then
    alter table public.teams drop constraint teams_name_len_chk;
  end if;

  alter table public.teams
    add constraint teams_name_len_chk
    check (char_length(trim(name)) between 1 and 15);

  if exists (
    select 1
    from pg_constraint
    where conname = 'spaces_name_len_chk'
      and conrelid = 'public.spaces'::regclass
  ) then
    alter table public.spaces drop constraint spaces_name_len_chk;
  end if;

  alter table public.spaces
    add constraint spaces_name_len_chk
    check (char_length(trim(name)) between 1 and 15);
end $$;

-- 3) Ensure every team has a default space.
insert into public.spaces (team_id, name, created_by)
select
  t.id,
  'General',
  (
    select tm.user_id
    from public.team_members tm
    where tm.team_id = t.id
      and tm.role = 'admin'
      and tm.status = 'active'
    order by tm.created_at asc
    limit 1
  )
from public.teams t
where not exists (
  select 1
  from public.spaces s
  where s.team_id = t.id
);

-- 4) Ensure members are in the default space and patch invalid project space IDs.
with default_space as (
  select distinct on (s.team_id)
    s.team_id,
    s.id as space_id
  from public.spaces s
  order by
    s.team_id,
    case when lower(s.name) = 'general' then 0 else 1 end,
    s.created_at asc,
    s.id asc
)
insert into public.space_members (space_id, user_id, status)
select
  ds.space_id,
  tm.user_id,
  'active'::public.member_status
from default_space ds
join public.team_members tm
  on tm.team_id = ds.team_id
where tm.status = 'active'
  and tm.role <> 'guest'
on conflict (space_id, user_id) do update
  set status = 'active';

with default_space as (
  select distinct on (s.team_id)
    s.team_id,
    s.id as space_id
  from public.spaces s
  order by
    s.team_id,
    case when lower(s.name) = 'general' then 0 else 1 end,
    s.created_at asc,
    s.id asc
)
update public.projects p
set space_id = ds.space_id
from default_space ds
where p.team_id = ds.team_id
  and (
    p.space_id is null
    or not exists (
      select 1
      from public.spaces s
      where s.id = p.space_id
        and s.team_id = p.team_id
    )
  );

-- 5) New teams automatically get a default space and membership.
create or replace function public.create_team(
  p_name text,
  p_slug text,
  p_auto_join_domain text default null
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  v_team_id uuid;
  v_default_space_id uuid;
  v_user_id uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if char_length(v_name) = 0 then
    raise exception 'Team name is required';
  end if;
  if char_length(v_name) > 15 then
    raise exception 'Team name must be 15 characters or fewer';
  end if;

  if p_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' then
    raise exception 'Invalid slug format. Use 3-40 lowercase alphanumeric characters and hyphens.';
  end if;

  if public.is_slug_reserved(p_slug) then
    raise exception 'This subdomain is reserved and cannot be used.';
  end if;

  insert into public.teams (name, slug, auto_join_domain)
  values (v_name, p_slug, p_auto_join_domain)
  returning id into v_team_id;

  insert into public.team_members (team_id, user_id, role, status)
  values (v_team_id, v_user_id, 'admin', 'active');

  insert into public.spaces (team_id, name, created_by)
  values (v_team_id, 'General', v_user_id)
  returning id into v_default_space_id;

  insert into public.space_members (space_id, user_id, status)
  values (v_default_space_id, v_user_id, 'active')
  on conflict (space_id, user_id) do update
    set status = 'active';

  return v_team_id;
end;
$$;
