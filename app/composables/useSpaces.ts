export interface Space {
  id: string
  team_id: string
  name: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface SpaceMember {
  id: string
  space_id: string
  user_id: string
  status: 'active' | 'disabled'
  created_at: string
}

export interface SpaceInvitation {
  id: string
  space_id: string
  email: string
  invited_by: string | null
  token: string
  accepted_at: string | null
  expires_at: string
  created_at: string
}

export function useSpaces() {
  const supabase = useSupabase()
  const { currentTeamId, isAdmin } = useTeam()

  const spaces = ref<Space[]>([])
  const spacesLoading = ref(false)
  const membersBySpaceId = ref<Record<string, SpaceMember[]>>({})
  const invitationsBySpaceId = ref<Record<string, SpaceInvitation[]>>({})

  async function fetchSpaces() {
    if (!currentTeamId.value) {
      spaces.value = []
      return
    }
    spacesLoading.value = true
    try {
      const { data, error } = await supabase
        .from('spaces')
        .select('*')
        .eq('team_id', currentTeamId.value)
        .order('name', { ascending: true })

      if (error) {
        console.warn('[useSpaces] fetch failed:', error.message)
        spaces.value = []
      } else {
        spaces.value = (data ?? []) as Space[]
      }
    } finally {
      spacesLoading.value = false
    }
  }

  async function createSpace(name: string) {
    if (!currentTeamId.value) return { data: null, error: new Error('No team selected') }
    const normalizedName = name.trim()
    if (normalizedName.length === 0) return { data: null, error: new Error('Space name is required') }
    if (normalizedName.length > 15) return { data: null, error: new Error('Space name must be 15 characters or fewer') }
    const userId = (await supabase.auth.getUser()).data.user?.id
    const { data, error } = await supabase
      .from('spaces')
      .insert({ team_id: currentTeamId.value, name: normalizedName, created_by: userId ?? null })
      .select()
      .single()
    if (!error && data) spaces.value.push(data as Space)
    return { data: (data as Space) ?? null, error }
  }

  async function updateSpace(spaceId: string, name: string) {
    const normalizedName = name.trim()
    if (normalizedName.length === 0) return { data: null, error: new Error('Space name is required') }
    if (normalizedName.length > 15) return { data: null, error: new Error('Space name must be 15 characters or fewer') }
    const { data, error } = await supabase
      .from('spaces')
      .update({ name: normalizedName })
      .eq('id', spaceId)
      .select()
      .single()
    if (!error && data) {
      const idx = spaces.value.findIndex(s => s.id === spaceId)
      if (idx >= 0) spaces.value[idx] = data as Space
    }
    return { data: (data as Space) ?? null, error }
  }

  async function deleteSpace(spaceId: string) {
    const { error } = await supabase
      .from('spaces')
      .delete()
      .eq('id', spaceId)
    if (!error) {
      spaces.value = spaces.value.filter(s => s.id !== spaceId)
      delete membersBySpaceId.value[spaceId]
      delete invitationsBySpaceId.value[spaceId]
    }
    return { error }
  }

  async function fetchSpaceMembers(spaceId: string) {
    const { data, error } = await supabase
      .from('space_members')
      .select('*')
      .eq('space_id', spaceId)
      .order('created_at', { ascending: true })
    if (error) return { data: [], error }
    membersBySpaceId.value = { ...membersBySpaceId.value, [spaceId]: (data ?? []) as SpaceMember[] }
    return { data: (data ?? []) as SpaceMember[], error: null }
  }

  async function addSpaceMember(spaceId: string, userId: string) {
    const { data, error } = await supabase
      .from('space_members')
      .upsert({ space_id: spaceId, user_id: userId, status: 'active' }, { onConflict: 'space_id,user_id' })
      .select()
      .single()
    if (!error) await fetchSpaceMembers(spaceId)
    return { data: (data as SpaceMember) ?? null, error }
  }

  async function removeSpaceMember(spaceId: string, userId: string) {
    const { error } = await supabase
      .from('space_members')
      .delete()
      .eq('space_id', spaceId)
      .eq('user_id', userId)
    if (!error) await fetchSpaceMembers(spaceId)
    return { error }
  }

  async function fetchSpaceInvitations(spaceId: string) {
    if (!isAdmin.value) return { data: [], error: null }
    const { data, error } = await supabase
      .from('space_invitations')
      .select('*')
      .eq('space_id', spaceId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    if (error) return { data: [], error }
    invitationsBySpaceId.value = { ...invitationsBySpaceId.value, [spaceId]: (data ?? []) as SpaceInvitation[] }
    return { data: (data ?? []) as SpaceInvitation[], error: null }
  }

  async function inviteGuestToSpace(spaceId: string, email: string) {
    const token = crypto.randomUUID() + crypto.randomUUID()
    const { data, error } = await supabase
      .from('space_invitations')
      .insert({
        space_id: spaceId,
        email: email.trim(),
        invited_by: (await supabase.auth.getUser()).data.user?.id ?? null,
        token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()
    if (error) return { data: null, error }

    try {
      await supabase.functions.invoke('send-invitation', {
        body: { invitation_kind: 'space', invitation_id: (data as SpaceInvitation).id },
      })
    } catch (invokeError) {
      console.warn('Failed to trigger space invitation email', invokeError)
    }

    await fetchSpaceInvitations(spaceId)
    return { data: data as SpaceInvitation, error: null }
  }

  return {
    spaces: readonly(spaces),
    spacesLoading: readonly(spacesLoading),
    membersBySpaceId: readonly(membersBySpaceId),
    invitationsBySpaceId: readonly(invitationsBySpaceId),
    fetchSpaces,
    createSpace,
    updateSpace,
    deleteSpace,
    fetchSpaceMembers,
    addSpaceMember,
    removeSpaceMember,
    fetchSpaceInvitations,
    inviteGuestToSpace,
  }
}
