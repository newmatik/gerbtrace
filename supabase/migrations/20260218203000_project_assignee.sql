-- Add project assignee support for team overview assignment/filtering.
alter table public.projects
  add column if not exists assignee_user_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_assignee_user_id_fkey'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_assignee_user_id_fkey
      foreign key (assignee_user_id)
      references public.profiles(id)
      on delete set null;
  end if;
end
$$;

create index if not exists projects_team_assignee_idx
  on public.projects (team_id, assignee_user_id);

comment on column public.projects.assignee_user_id is
  'Optional assigned owner for team workflow. Must reference a profile; UI only offers active team admins/editors.';
