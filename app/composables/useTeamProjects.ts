/**
 * CRUD for team projects stored in Supabase.
 *
 * Returns a shape compatible with local useProject() so the viewer/compare
 * pages can work identically with both local and team projects.
 */

import type { BomLine, BomPricingCache } from '~/utils/bom-types'

export interface TeamProject {
  id: string
  team_id: string
  name: string
  mode: 'viewer' | 'compare'
  status: 'draft' | 'approved'
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
  bom_lines: BomLine[] | null
  bom_pricing_cache: BomPricingCache | null
  bom_board_quantity: number | null
  pcb_data: {
    sizeX?: number
    sizeY?: number
    layerCount?: number
    surfaceFinish?: string
    copperWeight?: string
  } | null
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

export function useTeamProjects() {
  const supabase = useSupabase()
  const { currentTeamId } = useTeam()

  const projects = ref<TeamProject[]>([])
  const projectsLoading = ref(false)

  /** Fetch all projects for the current team */
  async function fetchProjects() {
    if (!currentTeamId.value) {
      projects.value = []
      return
    }

    projectsLoading.value = true
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('team_id', currentTeamId.value)
        .order('updated_at', { ascending: false })

      if (error) {
        console.warn('[useTeamProjects] Failed to fetch:', error.message)
        projects.value = []
      } else {
        projects.value = (data ?? []) as TeamProject[]
      }
    } finally {
      projectsLoading.value = false
    }
  }

  /** Get a single project by ID */
  async function getProject(projectId: string): Promise<TeamProject | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (error) return null
    return data as TeamProject
  }

  /** Create a new team project */
  async function createProject(mode: 'viewer' | 'compare', name?: string) {
    if (!currentTeamId.value) return { project: null, error: new Error('No team selected') }

    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) return { project: null, error: new Error('Not authenticated') }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        team_id: currentTeamId.value,
        name: name ?? `New ${mode === 'viewer' ? 'Viewer' : 'Compare'} Project`,
        mode,
        created_by: userId,
      })
      .select()
      .single()

    if (!error && data) {
      projects.value.unshift(data as TeamProject)
    }

    return { project: data as TeamProject | null, error }
  }

  /** Update project metadata */
  async function updateProject(projectId: string, updates: Partial<TeamProject>) {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single()

    if (!error && data) {
      const idx = projects.value.findIndex(p => p.id === projectId)
      if (idx >= 0) projects.value[idx] = data as TeamProject
    }

    return { data: data as TeamProject | null, error }
  }

  /** Delete a project (admin only) */
  async function deleteProject(projectId: string) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)

    if (!error) {
      projects.value = projects.value.filter(p => p.id !== projectId)
    }

    return { error }
  }

  /** Approve a project (admin only) */
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
    return (data ?? []) as TeamProjectFile[]
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
    }

    return { file: data as TeamProjectFile | null, error }
  }

  /** Download a file's content */
  async function downloadFile(storagePath: string): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from('gerber-files')
      .download(storagePath)

    if (error || !data) {
      console.error('[useTeamProjects] File download failed:', storagePath, error?.message)
      return null
    }
    return await data.text()
  }

  /** Delete a file */
  async function deleteFile(fileId: string, storagePath: string) {
    // Delete from storage
    await supabase.storage.from('gerber-files').remove([storagePath])

    // Delete record
    const { error } = await supabase
      .from('project_files')
      .delete()
      .eq('id', fileId)

    return { error }
  }

  // ── Document operations ────────────────────────────────────────────────

  /** Get documents for a project */
  async function getProjectDocuments(projectId: string): Promise<TeamProjectDocument[]> {
    const { data, error } = await supabase
      .from('project_documents')
      .select('*')
      .eq('project_id', projectId)
      .order('file_name')

    if (error) {
      console.error('[useTeamProjects] Failed to fetch project documents:', projectId, error.message)
      return []
    }
    return (data ?? []) as TeamProjectDocument[]
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
    }

    return { doc: record as TeamProjectDocument | null, error }
  }

  /** Download a document's binary content */
  async function downloadDocument(storagePath: string): Promise<Blob | null> {
    const { data, error } = await supabase.storage
      .from('gerber-files')
      .download(storagePath)

    if (error || !data) {
      console.error('[useTeamProjects] Document download failed:', storagePath, error?.message)
      return null
    }
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
    await supabase.storage.from('gerber-files').remove([storagePath])

    const { error } = await supabase
      .from('project_documents')
      .delete()
      .eq('id', docId)

    return { error }
  }

  // Auto-fetch when team changes
  watch(currentTeamId, () => {
    fetchProjects()
  }, { immediate: true })

  return {
    projects: readonly(projects),
    projectsLoading: readonly(projectsLoading),
    fetchProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    approveProject,
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
  }
}
