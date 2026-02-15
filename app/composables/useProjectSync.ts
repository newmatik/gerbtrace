import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { TeamProject, TeamProjectFile } from './useTeamProjects'

/**
 * Real-time project sync using Supabase Realtime.
 *
 * Subscribes to Postgres Changes on the project row and its files,
 * plus Broadcast for ephemeral PnP edit events.
 */

export interface ProjectEditEvent {
  type: 'pnp-edit'
  field: string
  value: unknown
  userId: string
  timestamp: string
}

export function useProjectSync(projectId: Ref<string | null>) {
  const supabase = useSupabase()
  const { user } = useAuth()

  /** Reactive project data, updated in real-time */
  const project = ref<TeamProject | null>(null)
  /** Reactive file list, updated in real-time */
  const files = ref<TeamProjectFile[]>([])
  /** Incoming PnP edit events from other users */
  const lastEditEvent = ref<ProjectEditEvent | null>(null)

  let channel: RealtimeChannel | null = null

  function handleProjectChange(payload: RealtimePostgresChangesPayload<TeamProject>) {
    if (payload.eventType === 'UPDATE' && payload.new) {
      project.value = payload.new as TeamProject
    } else if (payload.eventType === 'DELETE') {
      project.value = null
    }
  }

  function handleFileChange(payload: RealtimePostgresChangesPayload<TeamProjectFile>) {
    if (payload.eventType === 'INSERT' && payload.new) {
      const existing = files.value.findIndex(f => f.id === (payload.new as TeamProjectFile).id)
      if (existing < 0) {
        files.value.push(payload.new as TeamProjectFile)
      }
    } else if (payload.eventType === 'UPDATE' && payload.new) {
      const idx = files.value.findIndex(f => f.id === (payload.new as TeamProjectFile).id)
      if (idx >= 0) files.value[idx] = payload.new as TeamProjectFile
    } else if (payload.eventType === 'DELETE' && payload.old) {
      files.value = files.value.filter(f => f.id !== (payload.old as TeamProjectFile).id)
    }
  }

  async function subscribe() {
    if (!projectId.value) return

    const channelName = `project-sync:${projectId.value}`
    channel = supabase.channel(channelName)

    // Subscribe to project row changes
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'projects',
      filter: `id=eq.${projectId.value}`,
    }, handleProjectChange as any)

    // Subscribe to file changes
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'project_files',
      filter: `project_id=eq.${projectId.value}`,
    }, handleFileChange as any)

    // Subscribe to broadcast PnP edit events
    channel.on('broadcast', { event: 'pnp-edit' }, (payload) => {
      const event = payload.payload as ProjectEditEvent
      // Ignore our own events
      if (event.userId !== user.value?.id) {
        lastEditEvent.value = event
      }
    })

    await channel.subscribe()

    // Load initial data
    await fetchProject()
    await fetchFiles()
  }

  async function fetchProject() {
    if (!projectId.value) return
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId.value)
      .single()
    if (data) project.value = data as TeamProject
  }

  async function fetchFiles(packet = 0) {
    if (!projectId.value) return
    const { data } = await supabase
      .from('project_files')
      .select('*')
      .eq('project_id', projectId.value)
      .eq('packet', packet)
      .order('file_name')
    if (data) files.value = data as TeamProjectFile[]
  }

  /** Broadcast a PnP edit event to other users */
  function broadcastEdit(field: string, value: unknown) {
    if (!channel || !user.value) return
    channel.send({
      type: 'broadcast',
      event: 'pnp-edit',
      payload: {
        type: 'pnp-edit',
        field,
        value,
        userId: user.value.id,
        timestamp: new Date().toISOString(),
      } satisfies ProjectEditEvent,
    })
  }

  function unsubscribe() {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
    project.value = null
    files.value = []
    lastEditEvent.value = null
  }

  // Auto-subscribe/unsubscribe when project changes
  watch(projectId, (newId, oldId) => {
    if (oldId) unsubscribe()
    if (newId) subscribe()
  }, { immediate: true })

  onBeforeUnmount(() => {
    unsubscribe()
  })

  return {
    project: readonly(project),
    files: readonly(files),
    lastEditEvent: readonly(lastEditEvent),
    broadcastEdit,
    fetchProject,
    fetchFiles,
  }
}
