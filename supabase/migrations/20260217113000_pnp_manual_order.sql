-- Persist manual drag order for PnP component tables
alter table public.projects
  add column if not exists pnp_manual_order_smd jsonb,
  add column if not exists pnp_manual_order_tht jsonb;
