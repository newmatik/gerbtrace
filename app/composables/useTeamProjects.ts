/**
 * CRUD for team projects stored in Supabase.
 *
 * Returns a shape compatible with local useProject() so the viewer/compare
 * pages can work identically with both local and team projects.
 */

import type { BomLine, BomPricingCache } from '~/utils/bom-types'
import type { PanelConfig } from '~/utils/panel-types'
import type { PasteSettings } from '~/composables/usePasteSettings'
import type { BomColumnMapping } from '~/utils/bom-types'
import type { PnPColumnMapping, PnPCoordUnit } from '~/utils/pnp-parser'

export type LockableViewerTab = 'files' | 'pcb' | 'panel' | 'smd' | 'tht' | 'bom'

export interface ViewerPageLockState {
  locked: boolean
  locked_at: string | null
  locked_by: string | null
  locked_by_name: string | null
}

export interface TeamProject {
  id: string
  team_id: string
  name: string
  assignee_user_id: string | null
  mode: 'viewer' | 'compare'
  status: 'draft' | 'in_progress' | 'for_approval' | 'approved'
  approver_user_id: string | null
  approved_by: string | null
  approved_at: string | null
  created_by: string
  pnp_origin_x: number | null
  pnp_origin_y: number | null
  pnp_convention: string | null
  pnp_rotation_overrides: Record<string, number> | null
  pnp_dnp_components: string[] | null
  pnp_cad_package_map: Record<string, string> | null
  pnp_polarized_overrides: Record<string, boolean> | null
  pnp_component_notes: Record<string, string> | null
  pnp_field_overrides: Record<string, { designator?: string; value?: string; x?: number; y?: number }> | null
  pnp_manual_components: { id: string; designator: string; value: string; package: string; x: number; y: number; rotation: number; side: 'top' | 'bottom' }[] | null
  pnp_deleted_components: string[] | null
  pnp_sort_smd: { key: 'ref' | 'x' | 'y' | 'rot' | 'pol' | 'value' | 'cadPackage' | 'package' | null; asc: boolean } | null
  pnp_sort_tht: { key: 'ref' | 'x' | 'y' | 'rot' | 'pol' | 'value' | 'cadPackage' | 'package' | null; asc: boolean } | null
  pnp_manual_order_smd: string[] | null
  pnp_manual_order_tht: string[] | null
  pnp_component_groups: { id: string; componentType: 'smd' | 'tht'; name: string; comment: string; hidden: boolean; collapsed: boolean }[] | null
  pnp_group_assignments: Record<string, string> | null
  bom_lines: BomLine[] | null
  bom_pricing_cache: BomPricingCache | null
  bom_board_quantity: number | null
  bom_groups: { id: string; name: string; comment: string; collapsed: boolean }[] | null
  bom_ai_suggestions: Record<string, any> | null
  pcb_data: {
    sizeX?: number
    sizeY?: number
    layerCount?: number
    material?: string
    surfaceFinish?: string
    copperWeight?: string
    innerCopperWeight?: string
    thicknessMm?: number
    solderMaskColor?: string
    panelizationMode?: 'single' | 'panelized'
    pricingQuantities?: number[]
    selectedPricingQuantity?: number
  } | null
  panel_data: PanelConfig | null
  page_locks: Partial<Record<LockableViewerTab, ViewerPageLockState>> | null
  paste_settings: PasteSettings | null
  layer_order: string[] | null
  document_order: string[] | null
  bom_file_import_options: Record<string, { skipRows?: number; skipBottomRows?: number; mapping?: BomColumnMapping; fixedColumns?: number[]; delimiter?: ',' | ';' | '\t' | 'fixed'; decimal?: '.' | ','; extraColumns?: string[] }> | null
  pnp_file_import_options: Record<string, { skipRows?: number; skipBottomRows?: number; mapping?: PnPColumnMapping; unitOverride?: 'auto' | PnPCoordUnit; fixedColumns?: number[]; delimiter?: ',' | ';' | '\t' | 'fixed'; decimal?: '.' | ',' }> | null
  preview_image_path: string | null
  created_at: string
  updated_at: string
}

export interface TeamProjectFile {
  id: string
  project_id: string
  packet: number
  file_name: string
  storage_path: string
  layer_type: string | null
  content_hash: string | null
  created_at: string
  updated_at: string
}

export interface TeamProjectDocument {
  id: string
  project_id: string
  file_name: string
  storage_path: string
  doc_type: string
  created_at: string
  updated_at: string
}

const TEAM_PROJECTS_CACHE_TTL_MS = 60_000
const inFlightByTeam = new Map<string, Promise<TeamProject[]>>()
const projectByIdCache = new Map<string, TeamProject>()
const projectFilesByPacketCache = new Map<string, TeamProjectFile[]>()
const fileTextCache = new Map<string, string>()
const projectDocumentsCache = new Map<string, TeamProjectDocument[]>()
const documentBlobCache = new Map<string, Blob>()
const previewUrlCache = new Map<string, { url: string; expiresAt: number }>()

function getProjectPacketKey(projectId: string, packet: number) {
  return `${projectId}:${packet}`
}

export function useTeamProjects() {
  const supabase = useSupabase()
  const { currentTeamId } = useTeam()

  const projects = useState<TeamProject[]>('team-projects:list', () => [])
  const projectsLoading = useState<boolean>('team-projects:loading', () => false)
  const projectsByTeam = useState<Record<string, TeamProject[]>>('team-projects:by-team', () => ({}))
  const fetchedAtByTeam = useState<Record<string, number>>('team-projects:fetched-at', () => ({}))

  function setProjectsForTeam(teamId: string, nextProjects: TeamProject[]) {
    projectsByTeam.value = {
      ...projectsByTeam.value,
      [teamId]: nextProjects,
    }
    fetchedAtByTeam.value = {
      ...fetchedAtByTeam.value,
      [teamId]: Date.now(),
    }
    if (currentTeamId.value === teamId) {
      projects.value = nextProjects
    }
  }

  /** Fetch all projects for the current team */
  async function fetchProjects(options?: { force?: boolean; background?: boolean }): Promise<TeamProject[]> {
    const teamId = currentTeamId.value
    if (!teamId) {
      projects.value = []
      return []
    }

    const cached = projectsByTeam.value[teamId]
    const fetchedAt = fetchedAtByTeam.value[teamId] ?? 0
    const isFresh = Date.now() - fetchedAt < TEAM_PROJECTS_CACHE_TTL_MS
    const hasCached = Array.isArray(cached)

    if (!options?.force && hasCached && isFresh) {
      if (currentTeamId.value === teamId) {
        projects.value = cached
      }
      return cached
    }

    const inFlight = inFlightByTeam.get(teamId)
    if (inFlight) return inFlight

    if (!options?.background || !hasCached) {
      projectsLoading.value = true
    }

    const request = (async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('team_id', teamId)
        .order('updated_at', { ascending: false })

      if (error) {
        console.warn('[useTeamProjects] Failed to fetch:', error.message)
        return hasCached ? cached : []
      }

      const nextProjects = (data ?? []) as unknown as TeamProject[]
      setProjectsForTeam(teamId, nextProjects)
      return nextProjects
    })()

    inFlightByTeam.set(teamId, request)

    try {
      const result = await request
      if (currentTeamId.value === teamId) {
        projects.value = result
      }
      return result
    } finally {
      inFlightByTeam.delete(teamId)
      if (currentTeamId.value === teamId) {
        projectsLoading.value = false
      }
    }
  }

  /** Get a single project by ID */
  async function getProject(projectId: string, options?: { force?: boolean }): Promise<TeamProject | null> {
    const cached = projectByIdCache.get(projectId)
    if (!options?.force && cached) return cached

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (error) return null
    const project = data as unknown as TeamProject
    projectByIdCache.set(projectId, project)
    return project
  }

  /** Create a new team project */
  async function createProject(mode: 'viewer' | 'compare', name?: string) {
    const teamId = currentTeamId.value
    if (!teamId) return { project: null, error: new Error('No team selected') }

    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) return { project: null, error: new Error('Not authenticated') }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        team_id: teamId,
        name: name ?? `New ${mode === 'viewer' ? 'Viewer' : 'Compare'} Project`,
        mode,
        created_by: userId,
      })
      .select()
      .single()

    if (!error && data) {
      projectByIdCache.set((data as unknown as TeamProject).id, data as unknown as TeamProject)
      const nextProjects = [data as unknown as TeamProject, ...projects.value]
      setProjectsForTeam(teamId, nextProjects)
    }

    return { project: (data as unknown as TeamProject) ?? null, error }
  }

  /** Update project metadata */
  async function updateProject(projectId: string, updates: Partial<TeamProject>) {
    const teamId = currentTeamId.value
    if (!teamId) return { data: null, error: new Error('No team selected') }

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single()

    if (!error && data) {
      projectByIdCache.set(projectId, data as unknown as TeamProject)
      const idx = projects.value.findIndex(p => p.id === projectId)
      if (idx >= 0) {
        const nextProjects = [...projects.value]
        nextProjects[idx] = data as unknown as TeamProject
        setProjectsForTeam(teamId, nextProjects)
      }
    }

    return { data: (data as unknown as TeamProject) ?? null, error }
  }

  /** Delete a project (admin only) */
  async function deleteProject(projectId: string) {
    const teamId = currentTeamId.value
    if (!teamId) return { error: new Error('No team selected') }

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)

    if (!error) {
      projectByIdCache.delete(projectId)
      projectFilesByPacketCache.forEach((_, key) => {
        if (key.startsWith(`${projectId}:`)) projectFilesByPacketCache.delete(key)
      })
      projectDocumentsCache.delete(projectId)
      const nextProjects = projects.value.filter(p => p.id !== projectId)
      setProjectsForTeam(teamId, nextProjects)
    }

    return { error }
  }

  async function setWorkflowStatus(
    projectId: string,
    action: 'set_in_progress' | 'request_approval' | 'approve' | 'request_changes',
    options?: { approverUserId?: string | null; message?: string | null },
  ) {
    const { data, error } = await supabase.rpc('transition_project_workflow', {
      p_project_id: projectId,
      p_action: action,
      p_approver_user_id: options?.approverUserId ?? null,
      p_message: options?.message ?? null,
    })

    if (!error && data) {
      const next = data as TeamProject
      projectByIdCache.set(projectId, next)
      const idx = projects.value.findIndex(p => p.id === projectId)
      if (idx >= 0) {
        const nextProjects = [...projects.value]
        nextProjects[idx] = next
        if (currentTeamId.value) {
          setProjectsForTeam(currentTeamId.value, nextProjects)
        }
      }
      return { data: next, error: null }
    }

    return { data: null, error }
  }

  /** Approve a project (selected approver/admin) */
  async function approveProject(projectId: string) {
    const { error } = await supabase.rpc('approve_project', { p_project_id: projectId })
    if (!error) {
      const project = projects.value.find(p => p.id === projectId)
      if (project) {
        project.status = 'approved'
        project.approved_at = new Date().toISOString()
      }
    }
    return { error }
  }

  async function requestApproval(projectId: string, approverUserId: string) {
    return setWorkflowStatus(projectId, 'request_approval', { approverUserId })
  }

  async function requestChanges(projectId: string, message: string) {
    return setWorkflowStatus(projectId, 'request_changes', { message })
  }

  async function moveToInProgress(projectId: string) {
    return setWorkflowStatus(projectId, 'set_in_progress')
  }

  /** Revert project to draft (admin only) */
  async function revertToDraft(projectId: string) {
    const { error } = await supabase.rpc('revert_to_draft', { p_project_id: projectId })
    if (!error) {
      const project = projects.value.find(p => p.id === projectId)
      if (project) {
        project.status = 'draft'
        project.approved_at = null
        project.approved_by = null
      }
    }
    return { error }
  }

  // ── File operations ──────────────────────────────────────────────────

  /** Get files for a project */
  async function getProjectFiles(projectId: string, packet = 0): Promise<TeamProjectFile[]> {
    const key = getProjectPacketKey(projectId, packet)
    const cached = projectFilesByPacketCache.get(key)
    if (cached) return cached

    const { data, error } = await supabase
      .from('project_files')
      .select('*')
      .eq('project_id', projectId)
      .eq('packet', packet)
      .order('file_name')

    if (error) {
      console.error('[useTeamProjects] Failed to fetch project files:', projectId, error.message)
      return []
    }
    const files = (data ?? []) as TeamProjectFile[]
    projectFilesByPacketCache.set(key, files)
    return files
  }

  /** Upload a file to a team project */
  async function uploadFile(
    projectId: string,
    teamId: string,
    packet: number,
    fileName: string,
    content: string,
    layerType?: string,
  ) {
    const storagePath = `${teamId}/${projectId}/${packet}/${fileName}`

    // Upload to storage
    const blob = new Blob([content], { type: 'text/plain' })
    const { error: uploadError } = await supabase.storage
      .from('gerber-files')
      .upload(storagePath, blob, { upsert: true })

    if (uploadError) {
      console.error('[useTeamProjects] Storage upload failed:', storagePath, uploadError.message)
      return { file: null, error: uploadError }
    }

    // Create/update file record
    const { data, error } = await supabase
      .from('project_files')
      .upsert({
        project_id: projectId,
        packet,
        file_name: fileName,
        storage_path: storagePath,
        layer_type: layerType ?? null,
      }, { onConflict: 'project_id,packet,file_name' })
      .select()
      .single()

    if (error) {
      console.error('[useTeamProjects] File record upsert failed:', fileName, error.message)
      // Rollback: delete the uploaded file from storage
      const { error: rollbackError } = await supabase.storage
        .from('gerber-files')
        .remove([storagePath])
      if (rollbackError) {
        console.error('[useTeamProjects] Failed to rollback storage file after DB error:', storagePath, rollbackError.message)
      }
      return { file: null, error }
    } else if (data) {
      const key = getProjectPacketKey(projectId, packet)
      projectFilesByPacketCache.delete(key)
      fileTextCache.set(storagePath, content)
    }

    return { file: data as TeamProjectFile | null, error }
  }

  /** Download a file's content */
  async function downloadFile(storagePath: string): Promise<string | null> {
    const cached = fileTextCache.get(storagePath)
    if (typeof cached === 'string') return cached

    const { data, error } = await supabase.storage
      .from('gerber-files')
      .download(storagePath)

    if (error || !data) {
      console.error('[useTeamProjects] File download failed:', storagePath, error?.message)
      return null
    }
    const text = await data.text()
    fileTextCache.set(storagePath, text)
    return text
  }

  /** Delete a file */
  async function deleteFile(fileId: string, storagePath: string) {
    const maybeProjectId = storagePath.split('/')[1]
    const maybePacket = Number(storagePath.split('/')[2])

    // Delete record first
    const { error } = await supabase
      .from('project_files')
      .delete()
      .eq('id', fileId)

    if (error) {
      console.error('[useTeamProjects] File record deletion failed:', fileId, error.message)
      return { error }
    }

    // Only delete from storage if DB deletion succeeded
    const { error: storageError } = await supabase.storage
      .from('gerber-files')
      .remove([storagePath])

    if (storageError) {
      console.error('[useTeamProjects] Storage deletion failed:', storagePath, storageError.message)
      // Note: DB record is already deleted, storage file remains
      // This is less critical than leaving orphaned DB records
    } else {
      fileTextCache.delete(storagePath)
      if (maybeProjectId && Number.isFinite(maybePacket)) {
        projectFilesByPacketCache.delete(getProjectPacketKey(maybeProjectId, maybePacket))
      }
    }

    return { error: storageError }
  }

  // ── Document operations ────────────────────────────────────────────────

  /** Get documents for a project */
  async function getProjectDocuments(projectId: string): Promise<TeamProjectDocument[]> {
    const cached = projectDocumentsCache.get(projectId)
    if (cached) return cached

    const { data, error } = await supabase
      .from('project_documents')
      .select('*')
      .eq('project_id', projectId)
      .order('file_name')

    if (error) {
      console.error('[useTeamProjects] Failed to fetch project documents:', projectId, error.message)
      return []
    }
    const docs = (data ?? []) as TeamProjectDocument[]
    projectDocumentsCache.set(projectId, docs)
    return docs
  }

  /** Upload a PDF document to a team project */
  async function uploadDocument(
    projectId: string,
    teamId: string,
    fileName: string,
    data: Blob,
    docType: string,
  ) {
    const storagePath = `${teamId}/${projectId}/docs/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('gerber-files')
      .upload(storagePath, data, { upsert: true, contentType: 'application/pdf' })

    if (uploadError) {
      console.error('[useTeamProjects] Document upload failed:', storagePath, uploadError.message)
      return { doc: null, error: uploadError }
    }

    const { data: record, error } = await supabase
      .from('project_documents')
      .upsert({
        project_id: projectId,
        file_name: fileName,
        storage_path: storagePath,
        doc_type: docType,
      }, { onConflict: 'project_id,file_name' })
      .select()
      .single()

    if (error) {
      console.error('[useTeamProjects] Document record upsert failed:', fileName, error.message)
      // Rollback: delete the uploaded document from storage
      const { error: rollbackError } = await supabase.storage
        .from('gerber-files')
        .remove([storagePath])
      if (rollbackError) {
        console.error('[useTeamProjects] Failed to rollback storage document after DB error:', storagePath, rollbackError.message)
      }
      return { doc: null, error }
    } else {
      projectDocumentsCache.delete(projectId)
      documentBlobCache.set(storagePath, data)
    }

    return { doc: record as TeamProjectDocument | null, error }
  }

  /** Download a document's binary content */
  async function downloadDocument(storagePath: string): Promise<Blob | null> {
    const cached = documentBlobCache.get(storagePath)
    if (cached) return cached

    const { data, error } = await supabase.storage
      .from('gerber-files')
      .download(storagePath)

    if (error || !data) {
      console.error('[useTeamProjects] Document download failed:', storagePath, error?.message)
      return null
    }
    documentBlobCache.set(storagePath, data)
    return data
  }

  /** Update a document's type */
  async function updateDocumentType(docId: string, docType: string) {
    const { error } = await supabase
      .from('project_documents')
      .update({ doc_type: docType })
      .eq('id', docId)

    return { error }
  }

  /** Delete a document */
  async function deleteDocument(docId: string, storagePath: string) {
    const maybeProjectId = storagePath.split('/')[1]

    // Delete record first
    const { error } = await supabase
      .from('project_documents')
      .delete()
      .eq('id', docId)

    if (error) {
      console.error('[useTeamProjects] Document record deletion failed:', docId, error.message)
      return { error }
    }

    // Only delete from storage if DB deletion succeeded
    const { error: storageError } = await supabase.storage
      .from('gerber-files')
      .remove([storagePath])

    if (storageError) {
      console.error('[useTeamProjects] Storage deletion failed:', storagePath, storageError.message)
      // Note: DB record is already deleted, storage file remains
      // This is less critical than leaving orphaned DB records
    } else {
      documentBlobCache.delete(storagePath)
      if (maybeProjectId) projectDocumentsCache.delete(maybeProjectId)
    }

    return { error: storageError }
  }

  // ── Preview image operations ─────────────────────────────────────────

  async function uploadPreviewImage(
    projectId: string,
    teamId: string,
    blob: Blob,
  ) {
    const storagePath = `${teamId}/${projectId}/preview.png`

    const { error: uploadError } = await supabase.storage
      .from('gerber-files')
      .upload(storagePath, blob, { upsert: true, contentType: 'image/png' })

    if (uploadError) {
      console.warn('[useTeamProjects] Preview upload failed:', uploadError.message)
      return { error: uploadError }
    }

    const { error: updateError } = await supabase
      .from('projects')
      .update({ preview_image_path: storagePath })
      .eq('id', projectId)

    if (updateError) {
      console.warn('[useTeamProjects] Preview path update failed:', updateError.message)
      return { error: updateError }
    }

    const cached = projectByIdCache.get(projectId)
    if (cached) cached.preview_image_path = storagePath

    const idx = projects.value.findIndex(p => p.id === projectId)
    if (idx >= 0) projects.value[idx].preview_image_path = storagePath

    previewUrlCache.delete(projectId)

    return { error: null }
  }

  async function getPreviewUrl(project: Pick<TeamProject, 'id' | 'preview_image_path'>): Promise<string | null> {
    if (!project.preview_image_path) return null

    const cached = previewUrlCache.get(project.id)
    if (cached && cached.expiresAt > Date.now()) return cached.url

    const { data, error } = await supabase.storage
      .from('gerber-files')
      .createSignedUrl(project.preview_image_path, 3600)

    if (error || !data?.signedUrl) return null

    previewUrlCache.set(project.id, {
      url: data.signedUrl,
      expiresAt: Date.now() + 3_500_000,
    })
    return data.signedUrl
  }

  // Clear module-scoped caches on logout to prevent cross-session data leaks.
  const { isAuthenticated } = useAuth()
  watch(isAuthenticated, (authed) => {
    if (!authed) {
      projectByIdCache.clear()
      projectFilesByPacketCache.clear()
      fileTextCache.clear()
      projectDocumentsCache.clear()
      documentBlobCache.clear()
      previewUrlCache.clear()
      inFlightByTeam.clear()
      projects.value = []
      projectsByTeam.value = {}
      fetchedAtByTeam.value = {}
    }
  })

  // Auto-fetch when team changes
  watch(currentTeamId, () => {
    if (!currentTeamId.value) {
      projects.value = []
      return
    }

    const cached = projectsByTeam.value[currentTeamId.value]
    if (cached) {
      projects.value = cached
      void fetchProjects({ background: true })
      return
    }

    void fetchProjects()
  }, { immediate: true })

  return {
    projects: readonly(projects),
    projectsLoading: readonly(projectsLoading),
    fetchProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    setWorkflowStatus,
    moveToInProgress,
    requestApproval,
    approveProject,
    requestChanges,
    revertToDraft,
    getProjectFiles,
    uploadFile,
    downloadFile,
    deleteFile,
    getProjectDocuments,
    uploadDocument,
    downloadDocument,
    updateDocumentType,
    deleteDocument,
    uploadPreviewImage,
    getPreviewUrl,
  }
}
