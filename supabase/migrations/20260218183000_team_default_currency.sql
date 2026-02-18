-- ============================================================================
-- Team default currency
-- ============================================================================
-- Adds a team-level currency setting used for BOM price display.
-- ============================================================================

alter table public.teams
  add column if not exists default_currency text;

update public.teams
set default_currency = 'EUR'
where default_currency is null
   or default_currency not in ('USD', 'EUR');

alter table public.teams
  alter column default_currency set default 'EUR';

alter table public.teams
  alter column default_currency set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teams_default_currency_check'
      and conrelid = 'public.teams'::regclass
  ) then
    alter table public.teams
      add constraint teams_default_currency_check
      check (default_currency in ('USD', 'EUR'));
  end if;
end $$;
