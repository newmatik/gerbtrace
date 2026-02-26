-- User consent tracking for GDPR compliance.
-- Each row records an immutable consent event (versioned).

create table if not exists public.user_consents (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  consent_type text not null,
  version      text not null default 'v1',
  accepted     boolean not null default true,
  ip_address   text,
  user_agent   text,
  created_at   timestamptz not null default now(),
  unique (user_id, consent_type, version)
);

alter table public.user_consents
  add column if not exists version text;

update public.user_consents
set consent_type = 'terms',
    version = regexp_replace(consent_type, '^terms_?', '')
where consent_type like 'terms_%';

update public.user_consents
set consent_type = 'privacy',
    version = regexp_replace(consent_type, '^privacy_?', '')
where consent_type like 'privacy_%';

update public.user_consents
set version = 'v1'
where version is null or btrim(version) = '';

alter table public.user_consents
  alter column version set default 'v1';

alter table public.user_consents
  alter column version set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_consents_user_type_version_key'
      and conrelid = 'public.user_consents'::regclass
  ) then
    alter table public.user_consents
      add constraint user_consents_user_type_version_key
      unique (user_id, consent_type, version);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_consents_type_check'
      and conrelid = 'public.user_consents'::regclass
  ) then
    alter table public.user_consents
      add constraint user_consents_type_check check (consent_type in ('terms', 'privacy'));
  end if;
end $$;

create index if not exists idx_user_consents_user on public.user_consents(user_id);
create index if not exists idx_user_consents_lookup on public.user_consents(user_id, consent_type, version);

alter table public.user_consents enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'user_consents' and policyname = 'Users can read own consents'
  ) then
    create policy "Users can read own consents"
      on public.user_consents for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'user_consents' and policyname = 'Users can insert own consents'
  ) then
    create policy "Users can insert own consents"
      on public.user_consents for insert
      with check (auth.uid() = user_id);
  end if;
end $$;
