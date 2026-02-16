import type { THTPackageDefinition } from '~/utils/tht-package-types'

/**
 * CRUD for team-scoped THT package definitions stored in Supabase.
 *
 * Team THT packages are shared across all team members and merged into
 * the THT package lookup alongside local custom THT packages.
 */

export interface TeamThtPackageRecord {
  id: string
  team_id: string
  data: THTPackageDefinition
  created_by: string
  created_at: string
  updated_at: string
}

export function useTeamThtPackages() {
  const supabase = useSupabase()
  const { currentTeamId } = useTeam()

  const teamThtPackages = ref<TeamThtPackageRecord[]>([])
  const teamThtPackagesLoading = ref(false)

  /** All THT package definitions from team packages */
  const teamThtPackageDefinitions = computed<THTPackageDefinition[]>(() =>
    teamThtPackages.value.map(tp => tp.data),
  )

  /** Fetch all THT packages for the current team */
  async function fetchTeamThtPackages() {
    if (!currentTeamId.value) {
      teamThtPackages.value = []
      return
    }

    teamThtPackagesLoading.value = true
    try {
      const { data, error } = await supabase
        .from('team_tht_packages')
        .select('*')
        .eq('team_id', currentTeamId.value)
        .order('created_at', { ascending: true })

      if (error) {
        console.warn('[useTeamThtPackages] Failed to fetch:', error.message)
        teamThtPackages.value = []
      } else {
        teamThtPackages.value = (data ?? []) as TeamThtPackageRecord[]
      }
    } finally {
      teamThtPackagesLoading.value = false
    }
  }

  /** Add a new team THT package */
  async function addTeamThtPackage(packageDef: THTPackageDefinition) {
    if (!currentTeamId.value) return { error: new Error('No team selected') }

    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) return { error: new Error('Not authenticated') }

    const { data, error } = await supabase
      .from('team_tht_packages')
      .insert({
        team_id: currentTeamId.value,
        data: packageDef as unknown as Record<string, unknown>,
        created_by: userId,
      })
      .select()
      .single()

    if (!error && data) {
      teamThtPackages.value.push(data as TeamThtPackageRecord)
    }

    return { data: data as TeamThtPackageRecord | null, error }
  }

  /** Update an existing team THT package */
  async function updateTeamThtPackage(packageId: string, packageDef: THTPackageDefinition) {
    const { data, error } = await supabase
      .from('team_tht_packages')
      .update({ data: packageDef as unknown as Record<string, unknown> })
      .eq('id', packageId)
      .select()
      .single()

    if (!error && data) {
      const idx = teamThtPackages.value.findIndex(tp => tp.id === packageId)
      if (idx >= 0) teamThtPackages.value[idx] = data as TeamThtPackageRecord
    }

    return { data: data as TeamThtPackageRecord | null, error }
  }

  /** Remove a team THT package (admin only) */
  async function removeTeamThtPackage(packageId: string) {
    const { error } = await supabase
      .from('team_tht_packages')
      .delete()
      .eq('id', packageId)

    if (!error) {
      teamThtPackages.value = teamThtPackages.value.filter(tp => tp.id !== packageId)
    }

    return { error }
  }

  // Subscribe to real-time changes on team_tht_packages
  watch(currentTeamId, (teamId, _old, onCleanup) => {
    if (!teamId) {
      teamThtPackages.value = []
      return
    }

    fetchTeamThtPackages()

    const channel = supabase.channel(`team-tht-packages:${teamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_tht_packages',
        filter: `team_id=eq.${teamId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new) {
          const existing = teamThtPackages.value.find(tp => tp.id === (payload.new as TeamThtPackageRecord).id)
          if (!existing) teamThtPackages.value.push(payload.new as TeamThtPackageRecord)
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          const idx = teamThtPackages.value.findIndex(tp => tp.id === (payload.new as TeamThtPackageRecord).id)
          if (idx >= 0) teamThtPackages.value[idx] = payload.new as TeamThtPackageRecord
        } else if (payload.eventType === 'DELETE' && payload.old) {
          teamThtPackages.value = teamThtPackages.value.filter(tp => tp.id !== (payload.old as TeamThtPackageRecord).id)
        }
      })
      .subscribe()

    onCleanup(() => {
      supabase.removeChannel(channel)
    })
  }, { immediate: true })

  return {
    teamThtPackages: readonly(teamThtPackages),
    teamThtPackageDefinitions,
    teamThtPackagesLoading: readonly(teamThtPackagesLoading),
    fetchTeamThtPackages,
    addTeamThtPackage,
    updateTeamThtPackage,
    removeTeamThtPackage,
  }
}
