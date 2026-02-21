export interface Space {
  id: string
  team_id: string
  name: string
  description: string
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

const SPACES_CACHE_TTL_MS = 180_000
const inFlightByTeam = new Map<string, Promise<Space[]>>()

export function useSpaces() {
  const supabase = useSupabase()
  const { currentTeamId, isAdmin } = useTeam()
  const { isAuthenticated } = useAuth()

  const spaces = useState<Space[]>('spaces:list', () => [])
  const spacesLoading = useState<boolean>('spaces:loading', () => false)
  const spacesByTeam = useState<Record<string, Space[]>>('spaces:by-team', () => ({}))
  const fetchedAtByTeam = useState<Record<string, number>>('spaces:fetched-at', () => ({}))
  const membersBySpaceId = useState<Record<string, SpaceMember[]>>('spaces:members-by-space', () => ({}))
  const invitationsBySpaceId = useState<Record<string, SpaceInvitation[]>>('spaces:invitations-by-space', () => ({}))

  function setSpacesForTeam(teamId: string, nextSpaces: Space[]) {
    spacesByTeam.value = {
      ...spacesByTeam.value,
      [teamId]: nextSpaces,
    }
    fetchedAtByTeam.value = {
      ...fetchedAtByTeam.value,
      [teamId]: Date.now(),
    }
    if (currentTeamId.value === teamId) {
      spaces.value = nextSpaces
    }
  }

  async function fetchSpaces(options?: { force?: boolean; background?: boolean }) {
    const teamId = currentTeamId.value
    if (!teamId) {
      spaces.value = []
      return
    }

    const cached = spacesByTeam.value[teamId]
    const fetchedAt = fetchedAtByTeam.value[teamId] ?? 0
    const isFresh = Date.now() - fetchedAt < SPACES_CACHE_TTL_MS
    const hasCached = Array.isArray(cached)

    if (!options?.force && hasCached && isFresh) {
      if (currentTeamId.value === teamId) {
        spaces.value = cached
      }
      return
    }

    const inFlight = inFlightByTeam.get(teamId)
    if (inFlight) {
      await inFlight
      return
    }

    if (!options?.background || !hasCached) {
      spacesLoading.value = true
    }

    const request = (async () => {
      const { data, error } = await supabase
        .from('spaces')
        .select('*')
        .eq('team_id', teamId)
        .order('name', { ascending: true })

      if (error) {
        console.warn('[useSpaces] fetch failed:', error.message)
        return hasCached ? cached : []
      }

      const nextSpaces = (data ?? []) as Space[]
      setSpacesForTeam(teamId, nextSpaces)
      return nextSpaces
    })()

    inFlightByTeam.set(teamId, request)

    try {
      const nextSpaces = await request
      if (currentTeamId.value === teamId) {
        spaces.value = nextSpaces
      }
    } finally {
      inFlightByTeam.delete(teamId)
      if (currentTeamId.value === teamId) {
        spacesLoading.value = false
      }
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
    if (!error && data) {
      const nextSpaces = [...spaces.value, data as Space]
        .sort((a, b) => a.name.localeCompare(b.name))
      setSpacesForTeam(currentTeamId.value, nextSpaces)
    }
    return { data: (data as Space) ?? null, error }
  }

  async function updateSpace(spaceId: string, updates: { name?: string; description?: string }) {
    const payload: Record<string, unknown> = {}
    if (updates.name !== undefined) {
      const normalizedName = updates.name.trim()
      if (normalizedName.length === 0) return { data: null, error: new Error('Space name is required') }
      if (normalizedName.length > 15) return { data: null, error: new Error('Space name must be 15 characters or fewer') }
      payload.name = normalizedName
    }
    if (updates.description !== undefined) {
      payload.description = updates.description
    }
    if (Object.keys(payload).length === 0) return { data: null, error: new Error('No changes') }

    const { data, error } = await supabase
      .from('spaces')
      .update(payload)
      .eq('id', spaceId)
      .select()
      .single()
    if (!error && data) {
      const idx = spaces.value.findIndex(s => s.id === spaceId)
      if (idx >= 0) {
        const nextSpaces = [...spaces.value]
        nextSpaces[idx] = data as Space
        nextSpaces.sort((a, b) => a.name.localeCompare(b.name))
        if (currentTeamId.value) {
          setSpacesForTeam(currentTeamId.value, nextSpaces)
        }
      }
    }
    return { data: (data as Space) ?? null, error }
  }

  async function deleteSpace(spaceId: string) {
    const { error } = await supabase
      .from('spaces')
      .delete()
      .eq('id', spaceId)
    if (!error) {
      const nextSpaces = spaces.value.filter(s => s.id !== spaceId)
      if (currentTeamId.value) {
        setSpacesForTeam(currentTeamId.value, nextSpaces)
      }
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

  watch(currentTeamId, (teamId) => {
    if (!teamId) {
      spaces.value = []
      return
    }

    const cached = spacesByTeam.value[teamId]
    if (cached) {
      spaces.value = cached
      void fetchSpaces({ background: true })
      return
    }

    void fetchSpaces()
  }, { immediate: true })

  watch(isAuthenticated, (authed) => {
    if (!authed) {
      inFlightByTeam.clear()
      spaces.value = []
      spacesByTeam.value = {}
      fetchedAtByTeam.value = {}
      membersBySpaceId.value = {}
      invitationsBySpaceId.value = {}
    }
  })

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
