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

-- Remove any duplicate rows first (keep the most recent per unique key)
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

alter table public.project_files
  add constraint project_files_project_packet_file_uniq
  unique (project_id, packet, file_name);

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

-- ── 3. Missing project columns ──────────────────────────────────────────────

alter table public.projects
  add column if not exists pnp_component_notes  jsonb,
  add column if not exists pnp_field_overrides   jsonb,
  add column if not exists pnp_manual_components jsonb;
