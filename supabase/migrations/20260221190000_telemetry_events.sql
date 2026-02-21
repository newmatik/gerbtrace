create table if not exists public.telemetry_events (
  id bigint generated always as identity primary key,
  hostname text not null,
  path text,
  referrer text,
  ip text,
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.telemetry_events enable row level security;

create policy "Service role only"
  on public.telemetry_events
  for all
  using (false);
