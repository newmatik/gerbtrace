-- ============================================================================
-- Team clock format preference
-- ============================================================================
-- Adds a team-level setting for 24h vs 12h time display.
-- ============================================================================

alter table public.teams
  add column if not exists time_format text;

update public.teams
set time_format = '24h'
where time_format is null
   or time_format not in ('24h', '12h');

alter table public.teams
  alter column time_format set default '24h';

alter table public.teams
  alter column time_format set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teams_time_format_check'
      and conrelid = 'public.teams'::regclass
  ) then
    alter table public.teams
      add constraint teams_time_format_check
      check (time_format in ('24h', '12h'));
  end if;
end $$;
