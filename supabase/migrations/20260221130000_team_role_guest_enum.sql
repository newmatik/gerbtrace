-- Add guest as a team role for space-limited external users.

do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'public.team_role'::regtype
      and enumlabel = 'guest'
  ) then
    alter type public.team_role add value 'guest' before 'viewer';
  end if;
end $$;
