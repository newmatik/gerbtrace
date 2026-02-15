/**
 * CRUD for team projects stored in Supabase.
 *
 * Returns a shape compatible with local useProject() so the viewer/compare
 * pages can work identically with both local and team projects.
 */

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

    if (error) return []
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

    if (uploadError) return { file: null, error: uploadError }

    // Create file record
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

    return { file: data as TeamProjectFile | null, error }
  }

  /** Download a file's content */
  async function downloadFile(storagePath: string): Promise<string | null> {
    const { data, error } = await supabase.storage
      .from('gerber-files')
      .download(storagePath)

    if (error || !data) return null
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
  }
}
