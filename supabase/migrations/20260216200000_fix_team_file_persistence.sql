-- ============================================================================
-- Fix: Team project file persistence
-- ============================================================================
-- 1. Add unique constraint on project_files(project_id, packet, file_name)
--    Required for the PostgREST .upsert({ onConflict: ... }) to work.
--    Without this, every upsert fails with "no unique or exclusion constraint
--    matching the ON CONFLICT specification" and file records are never saved.
--
-- 2. Add UPDATE policy on storage.objects for the gerber-files bucket.
--    Required for re-uploading (overwriting) files via .upload({ upsert: true }).
--
-- 3. Add missing jsonb columns on projects table that are used by the app
--    but were not in the original schema.
-- ============================================================================

-- ── 1. Unique constraint for upsert support ─────────────────────────────────
-- ── 3. Missing project columns ──────────────────────────────────────────────
--
-- On the production droplet these tables are owned by supabase_admin.
-- The deploy user (postgres) must adopt that role to ALTER them.

do $$
declare
  pf_owner name;
  pr_owner name;
begin
  -- Adopt owner of project_files
  select tableowner into pf_owner
    from pg_tables where schemaname = 'public' and tablename = 'project_files';
  if pf_owner is not null and pf_owner != current_user then
    execute format('SET LOCAL ROLE %I', pf_owner);
  end if;

  -- Remove duplicate rows (keep the most recent per unique key)
  with ranked as (
    select
      ctid,
      row_number() over (
        partition by project_id, packet, file_name
        order by created_at desc, ctid desc
      ) as rn
    from public.project_files
  )
  delete from public.project_files p
  using ranked r
  where p.ctid = r.ctid
    and r.rn > 1;

  -- Add unique constraint (idempotent check)
  if not exists (
    select 1 from pg_constraint
    where conname = 'project_files_project_packet_file_uniq'
  ) then
    alter table public.project_files
      add constraint project_files_project_packet_file_uniq
      unique (project_id, packet, file_name);
  end if;

  -- Adopt owner of projects
  select tableowner into pr_owner
    from pg_tables where schemaname = 'public' and tablename = 'projects';
  if pr_owner is not null and pr_owner != current_user then
    execute format('SET LOCAL ROLE %I', pr_owner);
  end if;

  -- Add missing jsonb columns
  alter table public.projects
    add column if not exists pnp_component_notes  jsonb,
    add column if not exists pnp_field_overrides   jsonb,
    add column if not exists pnp_manual_components jsonb;

  -- Reset role
  reset role;
end;
$$;

-- ── 2. Storage UPDATE policy ────────────────────────────────────────────────

create policy "gerber_files_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'gerber-files'
    and public.has_team_role(public.storage_path_team_id(name), 'editor')
    and public.is_project_draft(public.storage_path_project_id(name))
  )
  with check (
    bucket_id = 'gerber-files'
    and public.has_team_role(public.storage_path_team_id(name), 'editor')
    and public.is_project_draft(public.storage_path_project_id(name))
  );
