/**
 * Team member management: list, invite, role changes, disable.
 */

import type { UserProfile } from './useCurrentUser'

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: 'admin' | 'editor' | 'viewer' | 'guest'
  status: 'active' | 'disabled'
  created_at: string
  profile: UserProfile
}

export interface TeamInvitation {
  id: string
  team_id: string
  email: string
  role: 'admin' | 'editor' | 'viewer' | 'guest'
  invited_by: string | null
  accepted_at: string | null
  expires_at: string
  created_at: string
}

const TEAM_MEMBERS_CACHE_TTL_MS = 180_000
const inFlightByTeam = new Map<string, Promise<{ members: TeamMember[]; invitations: TeamInvitation[] }>>()

export function useTeamMembers() {
  const supabase = useSupabase()
  const { currentTeamId } = useTeam()
  const { isAuthenticated } = useAuth()

  const members = useState<TeamMember[]>('team-members:list', () => [])
  const invitations = useState<TeamInvitation[]>('team-members:invitations', () => [])
  const membersLoading = useState<boolean>('team-members:loading', () => false)
  const membersByTeam = useState<Record<string, TeamMember[]>>('team-members:by-team', () => ({}))
  const invitationsByTeam = useState<Record<string, TeamInvitation[]>>('team-members:invitations-by-team', () => ({}))
  const fetchedAtByTeam = useState<Record<string, number>>('team-members:fetched-at', () => ({}))

  function setTeamData(teamId: string, nextMembers: TeamMember[], nextInvitations: TeamInvitation[]) {
    membersByTeam.value = {
      ...membersByTeam.value,
      [teamId]: nextMembers,
    }
    invitationsByTeam.value = {
      ...invitationsByTeam.value,
      [teamId]: nextInvitations,
    }
    fetchedAtByTeam.value = {
      ...fetchedAtByTeam.value,
      [teamId]: Date.now(),
    }
    if (currentTeamId.value === teamId) {
      members.value = nextMembers
      invitations.value = nextInvitations
    }
  }

  /** Fetch members and pending invitations for the current team */
  async function fetchMembers(options?: { force?: boolean; background?: boolean }) {
    const teamId = currentTeamId.value
    if (!teamId) {
      members.value = []
      invitations.value = []
      return
    }

    const cachedMembers = membersByTeam.value[teamId]
    const cachedInvitations = invitationsByTeam.value[teamId]
    const fetchedAt = fetchedAtByTeam.value[teamId] ?? 0
    const hasCached = Array.isArray(cachedMembers) && Array.isArray(cachedInvitations)
    const isFresh = Date.now() - fetchedAt < TEAM_MEMBERS_CACHE_TTL_MS

    if (!options?.force && hasCached && isFresh) {
      if (currentTeamId.value === teamId) {
        members.value = cachedMembers
        invitations.value = cachedInvitations
      }
      return
    }

    const inFlight = inFlightByTeam.get(teamId)
    if (inFlight) {
      await inFlight
      return
    }

    if (!options?.background || !hasCached) {
      membersLoading.value = true
    }

    const request = (async () => {
      // Fetch members with profile info
      const { data: memberData, error: memError } = await supabase
        .from('team_members')
        .select(`
          id, team_id, user_id, role, status, created_at,
          profile:profiles(id, email, name, avatar_url, created_at, updated_at)
        `)
        .eq('team_id', teamId)
        .order('created_at', { ascending: true })

      let nextMembers: TeamMember[] = hasCached ? [...(cachedMembers ?? [])] : []
      if (memError) {
        console.warn('[useTeamMembers] Failed to fetch members:', memError.message)
      } else {
        nextMembers = (memberData ?? []) as unknown as TeamMember[]
      }

      let nextInvitations: TeamInvitation[] = hasCached ? [...(cachedInvitations ?? [])] : []

      // Fetch pending invitations
      const { data: invData, error: invError } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('team_id', teamId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (invError) {
        console.warn('[useTeamMembers] Failed to fetch invitations:', invError.message)
      } else {
        nextInvitations = (invData ?? []) as TeamInvitation[]
      }

      setTeamData(teamId, nextMembers, nextInvitations)
      return {
        members: nextMembers,
        invitations: nextInvitations,
      }
    })()

    inFlightByTeam.set(teamId, request)

    try {
      await request
    } finally {
      inFlightByTeam.delete(teamId)
      if (currentTeamId.value === teamId) {
        membersLoading.value = false
      }
    }
  }

  /** Invite a new member by email */
  async function invite(email: string, role: 'admin' | 'editor' | 'viewer' | 'guest') {
    if (!currentTeamId.value) return { error: new Error('No team selected') }

    // Generate a random token
    const token = crypto.randomUUID() + crypto.randomUUID()

    // Insert invitation
    const { data: invitation, error: insertError } = await supabase
      .from('team_invitations')
      .insert({
        team_id: currentTeamId.value,
        email,
        role,
        invited_by: (await supabase.auth.getUser()).data.user?.id,
        token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      .select()
      .single()

    if (insertError) return { error: insertError }

    // Send the invitation email via Edge Function
    try {
      await supabase.functions.invoke('send-invitation', {
        body: { invitation_id: invitation.id },
      })
    } catch (e) {
      console.warn('Failed to send invitation email:', e)
    }

    // Refresh the list
    await fetchMembers({ force: true })
    return { data: invitation, error: null }
  }

  /** Change a member's role */
  async function changeRole(memberId: string, newRole: 'admin' | 'editor' | 'viewer' | 'guest') {
    const { error } = await supabase
      .from('team_members')
      .update({ role: newRole })
      .eq('id', memberId)

    if (!error) {
      const member = members.value.find(m => m.id === memberId)
      if (member) {
        member.role = newRole
        if (currentTeamId.value) {
          setTeamData(currentTeamId.value, [...members.value], [...invitations.value])
        }
      }
    }

    return { error }
  }

  /** Toggle a member's active/disabled status */
  async function toggleStatus(memberId: string) {
    const member = members.value.find(m => m.id === memberId)
    if (!member) return { error: new Error('Member not found') }

    const newStatus = member.status === 'active' ? 'disabled' : 'active'
    const { error } = await supabase
      .from('team_members')
      .update({ status: newStatus })
      .eq('id', memberId)

    if (!error) {
      member.status = newStatus
      if (currentTeamId.value) {
        setTeamData(currentTeamId.value, [...members.value], [...invitations.value])
      }
    }

    return { error }
  }

  /** Remove a member from the team */
  async function removeMember(memberId: string) {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)

    if (!error) {
      members.value = members.value.filter(m => m.id !== memberId)
      if (currentTeamId.value) {
        setTeamData(currentTeamId.value, [...members.value], [...invitations.value])
      }
    }

    return { error }
  }

  /** Cancel a pending invitation */
  async function cancelInvitation(invitationId: string) {
    const { error } = await supabase
      .from('team_invitations')
      .delete()
      .eq('id', invitationId)

    if (!error) {
      invitations.value = invitations.value.filter(i => i.id !== invitationId)
      if (currentTeamId.value) {
        setTeamData(currentTeamId.value, [...members.value], [...invitations.value])
      }
    }

    return { error }
  }

  /** Update a member's display name (admin only, via RPC) */
  async function updateMemberName(userId: string, name: string) {
    if (!currentTeamId.value) return { error: new Error('No team selected') }

    const { error } = await supabase.rpc('admin_update_member_name', {
      p_team_id: currentTeamId.value,
      p_user_id: userId,
      p_name: name.trim(),
    })

    if (!error) {
      const member = members.value.find(m => m.user_id === userId)
      if (member?.profile) {
        (member.profile as UserProfile).name = name.trim()
        if (currentTeamId.value) {
          setTeamData(currentTeamId.value, [...members.value], [...invitations.value])
        }
      }
    }

    return { error }
  }

  /** Set a member password directly (admin only) */
  async function resetMemberPassword(userId: string, newPassword: string) {
    if (!currentTeamId.value) return { error: new Error('No team selected') }

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) return { error: userError ?? new Error('Not authenticated') }

      let { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) return { error: sessionError }
      let accessToken = sessionData.session?.access_token
      if (!accessToken) {
        const refreshed = await supabase.auth.refreshSession()
        sessionData = refreshed.data
        sessionError = refreshed.error
        if (sessionError) return { error: sessionError }
        accessToken = sessionData.session?.access_token
      }
      if (!accessToken) return { error: new Error('Not authenticated') }

      const { error } = await supabase.functions.invoke('admin-password-reset', {
        body: {
          team_id: currentTeamId.value,
          user_id: userId,
          new_password: newPassword,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (error) {
        const context = (error as any).context
        if (context && typeof context.text === 'function') {
          try {
            const text = await context.text()
            const payload = JSON.parse(text)
            if (payload?.error && typeof payload.error === 'string') {
              return { error: new Error(payload.error) }
            }
          } catch {
            // keep original error when response body is not parseable
          }
        }
      }

      return { error }
    } catch (error) {
      return { error: error as Error }
    }
  }

  // Auto-fetch when team changes, and subscribe to realtime updates
  watch(currentTeamId, async (teamId, _old, onCleanup) => {
    if (!teamId) {
      members.value = []
      invitations.value = []
      return
    }

    const cachedMembers = membersByTeam.value[teamId]
    const cachedInvitations = invitationsByTeam.value[teamId]
    const fetchedAt = fetchedAtByTeam.value[teamId] ?? 0
    const hasCached = Array.isArray(cachedMembers) && Array.isArray(cachedInvitations)
    const isFresh = Date.now() - fetchedAt < TEAM_MEMBERS_CACHE_TTL_MS

    if (hasCached) {
      members.value = cachedMembers
      invitations.value = cachedInvitations
      if (!isFresh) {
        void fetchMembers({ background: true })
      }
    } else {
      await fetchMembers()
    }

    const channel = supabase.channel(`team-members:${teamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_members',
        filter: `team_id=eq.${teamId}`,
      }, () => {
        void fetchMembers({ force: true, background: true })
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_invitations',
        filter: `team_id=eq.${teamId}`,
      }, () => {
        void fetchMembers({ force: true, background: true })
      })

    await channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[useTeamMembers] Real-time subscription established')
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[useTeamMembers] Real-time subscription failed')
      }
    })

    onCleanup(() => {
      supabase.removeChannel(channel)
    })
  }, { immediate: true })

  watch(isAuthenticated, (authed) => {
    if (!authed) {
      inFlightByTeam.clear()
      members.value = []
      invitations.value = []
      membersByTeam.value = {}
      invitationsByTeam.value = {}
      fetchedAtByTeam.value = {}
    }
  })

  return {
    members: readonly(members),
    invitations: readonly(invitations),
    membersLoading: readonly(membersLoading),
    fetchMembers,
    invite,
    changeRole,
    toggleStatus,
    removeMember,
    cancelInvitation,
    updateMemberName,
    resetMemberPassword,
  }
}
