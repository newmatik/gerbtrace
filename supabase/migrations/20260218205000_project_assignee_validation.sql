-- Enforce valid project assignees at the database layer.
-- Assignee must be an active team member with role admin/editor.

create or replace function public.validate_project_assignee()
returns trigger
language plpgsql
as $$
begin
  if new.assignee_user_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.team_members tm
    where tm.team_id = new.team_id
      and tm.user_id = new.assignee_user_id
      and tm.status = 'active'
      and tm.role in ('admin', 'editor')
  ) then
    raise exception
      'Invalid assignee: must be an active admin/editor team member'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists projects_validate_assignee on public.projects;
create trigger projects_validate_assignee
  before insert or update of assignee_user_id, team_id
  on public.projects
  for each row
  execute function public.validate_project_assignee();
