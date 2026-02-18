/**
 * Team member management: list, invite, role changes, disable.
 */

import type { UserProfile } from './useCurrentUser'

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: 'admin' | 'editor' | 'viewer'
  status: 'active' | 'disabled'
  created_at: string
  profile: UserProfile
}

export interface TeamInvitation {
  id: string
  team_id: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
  invited_by: string | null
  accepted_at: string | null
  expires_at: string
  created_at: string
}

export function useTeamMembers() {
  const supabase = useSupabase()
  const { currentTeamId } = useTeam()

  const members = ref<TeamMember[]>([])
  const invitations = ref<TeamInvitation[]>([])
  const membersLoading = ref(false)

  /** Fetch members and pending invitations for the current team */
  async function fetchMembers() {
    if (!currentTeamId.value) {
      members.value = []
      invitations.value = []
      return
    }

    membersLoading.value = true
    try {
      // Fetch members with profile info
      const { data: memberData, error: memError } = await supabase
        .from('team_members')
        .select(`
          id, team_id, user_id, role, status, created_at,
          profile:profiles(id, email, name, avatar_url, created_at, updated_at)
        `)
        .eq('team_id', currentTeamId.value)
        .order('created_at', { ascending: true })

      if (memError) {
        console.warn('[useTeamMembers] Failed to fetch members:', memError.message)
      } else {
        members.value = (memberData ?? []) as unknown as TeamMember[]
      }

      // Fetch pending invitations
      const { data: invData, error: invError } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('team_id', currentTeamId.value)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (invError) {
        console.warn('[useTeamMembers] Failed to fetch invitations:', invError.message)
      } else {
        invitations.value = (invData ?? []) as TeamInvitation[]
      }
    } finally {
      membersLoading.value = false
    }
  }

  /** Invite a new member by email */
  async function invite(email: string, role: 'admin' | 'editor' | 'viewer') {
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
    await fetchMembers()
    return { data: invitation, error: null }
  }

  /** Change a member's role */
  async function changeRole(memberId: string, newRole: 'admin' | 'editor' | 'viewer') {
    const { error } = await supabase
      .from('team_members')
      .update({ role: newRole })
      .eq('id', memberId)

    if (!error) {
      const member = members.value.find(m => m.id === memberId)
      if (member) member.role = newRole
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
      }
    }

    return { error }
  }

  /** Set a member password directly (admin only) */
  async function resetMemberPassword(userId: string, newPassword: string) {
    if (!currentTeamId.value) return { error: new Error('No team selected') }

    try {
      const { error } = await supabase.functions.invoke('admin-password-reset', {
        body: {
          team_id: currentTeamId.value,
          user_id: userId,
          new_password: newPassword,
        },
      })
      return { error }
    } catch (error) {
      return { error: error as Error }
    }
  }

  // Auto-fetch when team changes
  watch(currentTeamId, () => {
    fetchMembers()
  }, { immediate: true })

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
