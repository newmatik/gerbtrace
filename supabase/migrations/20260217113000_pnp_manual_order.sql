-- Persist manual drag order for PnP component tables
do $$
declare
  v_owner name;
begin
  select r.rolname into v_owner
  from pg_class c
  join pg_roles r on r.oid = c.relowner
  where c.oid = 'public.projects'::regclass;

  if v_owner is not null and v_owner <> current_user then
    execute format('set local role %I', v_owner);
  end if;

  execute $sql$
    alter table public.projects
      add column if not exists pnp_manual_order_smd jsonb,
      add column if not exists pnp_manual_order_tht jsonb;
  $sql$;
end $$;
