import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Real-time presence tracking for a project.
 *
 * Tracks which users are currently viewing or editing a team project.
 * Uses Supabase Realtime Presence.
 */

export type PresenceTab = 'files' | 'pcb' | 'panel' | 'paste' | 'smd' | 'tht' | 'bom' | 'pricing' | 'docs' | 'summary' | 'conversation'

export interface PresenceUser {
  userId: string
  name: string
  avatarUrl: string | null
  role: 'admin' | 'editor' | 'viewer'
  mode: 'viewing' | 'editing'
  /** ISO timestamp when user joined */
  joinedAt: string
  /** Tab the user is currently viewing (per-tab presence) */
  currentTab?: PresenceTab
}

export function usePresence(projectId: Ref<string | null>) {
  const supabase = useSupabase()
  const { user } = useAuth()
  const { profile } = useCurrentUser()
  const { currentTeamRole } = useTeam()

  const presentUsers = ref<PresenceUser[]>([])
  const joinTimestamps = new Map<string, string>()
  let channel: RealtimeChannel | null = null

  function syncPresence() {
    if (!channel) return
    const state = channel.presenceState<PresenceUser>()
    const users: PresenceUser[] = []

    for (const key of Object.keys(state)) {
      const presences = state[key]
      if (presences?.length) {
        // Take the latest presence for each key
        const latestPresence = presences[presences.length - 1]! as PresenceUser
        users.push(latestPresence)
        // Preserve join timestamps from existing state
        if (!joinTimestamps.has(latestPresence.userId)) {
          joinTimestamps.set(latestPresence.userId, latestPresence.joinedAt)
        }
      }
    }

    // Exclude self from the displayed list
    presentUsers.value = users.filter(u => u.userId !== user.value?.id)
  }

  async function join() {
    if (!projectId.value || !user.value) return

    const channelName = `project-presence:${projectId.value}`
    channel = supabase.channel(channelName)

    channel.on('presence', { event: 'sync' }, syncPresence)
    channel.on('presence', { event: 'join' }, syncPresence)
    channel.on('presence', { event: 'leave' }, syncPresence)

    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const joinedAt = new Date().toISOString()
        joinTimestamps.set(user.value!.id, joinedAt)
        await channel!.track({
          userId: user.value!.id,
          name: profile.value?.name ?? user.value!.email ?? 'Unknown',
          avatarUrl: profile.value?.avatar_url ?? null,
          role: currentTeamRole.value === 'guest' ? 'viewer' : (currentTeamRole.value ?? 'viewer'),
          mode: 'viewing',
          joinedAt,
        } satisfies PresenceUser)
      }
    })
  }

  async function updatePresence(mode: 'viewing' | 'editing', currentTab?: PresenceTab) {
    if (!channel || !user.value) return
    const joinedAt = joinTimestamps.get(user.value.id) ?? new Date().toISOString()
    if (!joinTimestamps.has(user.value.id)) {
      joinTimestamps.set(user.value.id, joinedAt)
    }
    await channel.track({
      userId: user.value.id,
      name: profile.value?.name ?? user.value.email ?? 'Unknown',
      avatarUrl: profile.value?.avatar_url ?? null,
      role: currentTeamRole.value === 'guest' ? 'viewer' : (currentTeamRole.value ?? 'viewer'),
      mode,
      joinedAt,
      ...(currentTab !== undefined && { currentTab }),
    } satisfies PresenceUser)
  }

  /** @deprecated Use updatePresence instead. Kept for backwards compatibility. */
  async function updateMode(mode: 'viewing' | 'editing') {
    await updatePresence(mode)
  }

  function leave() {
    if (channel) {
      channel.untrack()
      supabase.removeChannel(channel)
      channel = null
    }
    presentUsers.value = []
  }

  // Auto-join/leave when project changes
  watch(projectId, (newId, oldId) => {
    if (oldId) leave()
    if (newId) join()
  }, { immediate: true })

  // Cleanup on unmount
  onBeforeUnmount(() => {
    leave()
  })

  /** Users currently in a specific tab (filters by currentTab) */
  function presentUsersInTab(tab: PresenceTab): PresenceUser[] {
    return presentUsers.value.filter(u => u.currentTab === tab)
  }

  return {
    presentUsers: readonly(presentUsers),
    presentUsersInTab,
    updatePresence,
    updateMode,
    leave,
  }
}
