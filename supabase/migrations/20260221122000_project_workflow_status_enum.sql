-- Pre-migration for workflow status values.
-- Enum values must be committed before they can be used in functions/checks.

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
