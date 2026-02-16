-- Sync profile name when auth.users metadata is updated.
--
-- The existing handle_new_user() trigger only fires on INSERT, so users
-- created via magic-link sign-in (which sets no metadata) get the email
-- prefix as their name. This companion trigger propagates later metadata
-- changes (e.g. from OAuth linking or admin updates) to profiles.name.

create or replace function public.handle_user_updated()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_new_name text;
begin
  v_new_name := coalesce(
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'full_name'
  );

  -- Only update when metadata actually carries a name and it changed
  if v_new_name is not null and v_new_name <> '' then
    update public.profiles
       set name       = v_new_name,
           updated_at = now()
     where id = new.id
       and (name is distinct from v_new_name);
  end if;

  return new;
end;
$$;

-- Idempotent: drop-then-create for the trigger (CREATE OR REPLACE TRIGGER
-- is not available in PG < 14 on some builds, so drop+create is safest).
drop trigger if exists on_auth_user_updated on auth.users;

create trigger on_auth_user_updated
  after update of raw_user_meta_data on auth.users
  for each row
  when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
  execute function public.handle_user_updated();
