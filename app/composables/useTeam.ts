/**
 * Team context management.
 *
 * Resolves the active team from subdomain or manual selection.
 * Provides reactive list of user's teams, team switching, and team creation.
 */

export type TeamPlan = 'free' | 'pro' | 'team' | 'enterprise'

export interface Team {
  id: string
  name: string
  slug: string
  auto_join_domain: string | null
  plan: TeamPlan
  stripe_customer_id: string | null
  billing_name: string | null
  billing_email: string | null
  billing_address: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string } | null
  billing_vat_id: string | null
  billing_tax_exempt: string | null
  default_currency: 'USD' | 'EUR'
  time_format: '24h' | '12h'
  elexess_enabled: boolean
  preferred_panel_width_mm: number | null
  preferred_panel_height_mm: number | null
  max_panel_width_mm: number | null
  max_panel_height_mm: number | null
  ai_enabled: boolean
  created_at: string
  updated_at: string
}

export interface TeamMemberWithRole {
  team_id: string
  role: 'admin' | 'editor' | 'viewer' | 'guest'
  status: 'active' | 'disabled'
}

const teams = ref<Team[]>([])
const currentTeamId = ref<string | null>(null)
const teamsLoading = ref(false)
const teamsLoaded = ref(false)

export function useTeam() {
  const supabase = useSupabase()
  const { isAuthenticated, user } = useAuth()
  const { slug: subdomainSlug } = useTeamSlug()

  const currentTeam = computed<Team | null>(() => {
    if (!currentTeamId.value) return null
    return teams.value.find(t => t.id === currentTeamId.value) ?? null
  })

  const currentTeamRole = ref<'admin' | 'editor' | 'viewer' | 'guest' | null>(null)

  /** Fetch all teams the current user belongs to */
  async function fetchTeams() {
    if (!isAuthenticated.value || !user.value) {
      teams.value = []
      currentTeamId.value = null
      teamsLoaded.value = false
      return
    }

    teamsLoading.value = true
    try {
      // Try auto-join: adds the user to any teams whose auto_join_domain
      // matches their email domain. Idempotent (ON CONFLICT DO NOTHING).
      // This covers both first-login catch-up and edge cases where the
      // signup trigger didn't fire (e.g. OAuth).
      const { error: autoJoinError } = await supabase.rpc('try_auto_join')
      if (autoJoinError) console.warn('[useTeam] try_auto_join RPC failed:', autoJoinError)

      // Get team memberships
      const { data: memberships, error: memError } = await supabase
        .from('team_members')
        .select('team_id, role, status')
        .eq('user_id', user.value.id)
        .eq('status', 'active')

      if (memError) {
        console.warn('[useTeam] Failed to fetch memberships:', memError.message)
        teamsLoaded.value = true
        return
      }

      if (!memberships?.length) {
        teams.value = []
        currentTeamId.value = null
        teamsLoaded.value = true
        return
      }

      const teamIds = memberships.map(m => m.team_id)

      // Fetch team details
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .in('id', teamIds)

      if (teamError) {
        console.warn('[useTeam] Failed to fetch teams:', teamError.message)
        teamsLoaded.value = true
        return
      } else {
        teams.value = (teamData ?? []) as Team[]
      }

      // Auto-select team from subdomain or first available
      if (subdomainSlug.value) {
        const subdomainTeam = teams.value.find(t => t.slug === subdomainSlug.value)
        if (subdomainTeam) {
          currentTeamId.value = subdomainTeam.id
        }
      }

      // Fallback: restore from localStorage or use first team
      if (!currentTeamId.value && teams.value.length > 0) {
        const saved = localStorage.getItem('gerbtrace-current-team')
        const savedTeam = saved ? teams.value.find(t => t.id === saved) : null
        currentTeamId.value = savedTeam?.id ?? teams.value[0]!.id
      }

      // Set current role
      if (currentTeamId.value) {
        const membership = memberships.find(m => m.team_id === currentTeamId.value)
        currentTeamRole.value = (membership?.role as typeof currentTeamRole.value) ?? null
      }

      teamsLoaded.value = true
    } finally {
      teamsLoading.value = false
    }
  }

  /** Switch to a different team */
  function switchTeam(teamId: string) {
    const team = teams.value.find(t => t.id === teamId)
    if (!team) return
    currentTeamId.value = teamId
    localStorage.setItem('gerbtrace-current-team', teamId)

    // Update role
    supabase
      .from('team_members')
      .select('role')
      .eq('team_id', teamId)
      .eq('user_id', user.value?.id ?? '')
      .single()
      .then(({ data }) => {
        currentTeamRole.value = (data?.role as typeof currentTeamRole.value) ?? null
      })
  }

  /** Create a new team (current user becomes admin) */
  async function createTeam(name: string, slug: string, autoJoinDomain?: string) {
    const normalizedName = name.trim()
    if (!normalizedName) return { teamId: null, error: new Error('Team name is required') }
    if (normalizedName.length > 15) return { teamId: null, error: new Error('Team name must be 15 characters or fewer') }
    const { data, error } = await supabase.rpc('create_team', {
      p_name: normalizedName,
      p_slug: slug,
      p_auto_join_domain: autoJoinDomain ?? null,
    })

    if (error) return { teamId: null, error }

    // Refresh teams list
    await fetchTeams()

    // Switch to the new team
    if (data) {
      switchTeam(data as string)
    }

    return { teamId: data as string, error: null }
  }

  /** Update team settings (admin only) */
  async function updateTeam(updates: {
    name?: string
    auto_join_domain?: string | null
    default_currency?: 'USD' | 'EUR'
    time_format?: '24h' | '12h'
    elexess_enabled?: boolean
    preferred_panel_width_mm?: number | null
    preferred_panel_height_mm?: number | null
    max_panel_width_mm?: number | null
    max_panel_height_mm?: number | null
    ai_enabled?: boolean
  }) {
    if (!currentTeamId.value) return { error: new Error('No team selected') }
    if (typeof updates.name === 'string') {
      const normalizedName = updates.name.trim()
      if (!normalizedName) return { error: new Error('Team name is required') }
      if (normalizedName.length > 15) return { error: new Error('Team name must be 15 characters or fewer') }
      updates = { ...updates, name: normalizedName }
    }

    const { data, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', currentTeamId.value)
      .select()
      .single()

    if (!error && data) {
      const idx = teams.value.findIndex(t => t.id === currentTeamId.value)
      if (idx >= 0) teams.value[idx] = data as Team
    }

    return { data, error }
  }

  /** Check if a slug is available */
  async function checkSlugAvailable(slug: string): Promise<boolean> {
    // Check reserved slugs via database function
    const { data: reserved } = await supabase.rpc('is_slug_reserved', { p_slug: slug })
    if (reserved) return false

    // Check if already taken by another team
    const { data } = await supabase
      .from('teams')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    return !data
  }

  // Auto-fetch teams when auth state changes
  watch(isAuthenticated, (authed) => {
    if (authed) {
      fetchTeams()
    } else {
      teams.value = []
      currentTeamId.value = null
      currentTeamRole.value = null
      teamsLoaded.value = false
    }
  }, { immediate: true })

  const isAdmin = computed(() => currentTeamRole.value === 'admin')
  const isEditor = computed(() => currentTeamRole.value === 'editor' || currentTeamRole.value === 'admin')
  const hasTeam = computed(() => teams.value.length > 0)

  return {
    teams: readonly(teams),
    currentTeam,
    currentTeamId: readonly(currentTeamId),
    currentTeamRole: readonly(currentTeamRole),
    teamsLoading: readonly(teamsLoading),
    teamsLoaded: readonly(teamsLoaded),
    isAdmin,
    isEditor,
    hasTeam,
    fetchTeams,
    switchTeam,
    createTeam,
    updateTeam,
    checkSlugAvailable,
  }
}
