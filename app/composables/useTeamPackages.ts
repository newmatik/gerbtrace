import type { PackageDefinition } from '~/utils/package-types'
import { normalizePackageType } from '~/utils/package-types'

/**
 * CRUD for team-scoped package definitions stored in Supabase.
 *
 * Team packages are shared across all team members and merged into
 * the package lookup alongside built-in and local custom packages.
 */

export interface TeamPackageRecord {
  id: string
  team_id: string
  data: PackageDefinition
  created_by: string
  created_at: string
  updated_at: string
}

export function useTeamPackages() {
  const supabase = useSupabase()
  const { currentTeamId } = useTeam()

  const teamPackages = ref<TeamPackageRecord[]>([])
  const teamPackagesLoading = ref(false)

  /** All package definitions from team packages */
  const teamPackageDefinitions = computed<PackageDefinition[]>(() =>
    teamPackages.value.map(tp => tp.data),
  )

  /** Fetch all packages for the current team */
  async function fetchTeamPackages() {
    if (!currentTeamId.value) {
      teamPackages.value = []
      return
    }

    teamPackagesLoading.value = true
    try {
      const { data, error } = await supabase
        .from('team_packages')
        .select('*')
        .eq('team_id', currentTeamId.value)
        .order('created_at', { ascending: true })

      if (error) {
        console.warn('[useTeamPackages] Failed to fetch:', error.message)
        teamPackages.value = []
      } else {
        teamPackages.value = (data ?? []).map((rec: any) => ({
          ...rec,
          data: normalizePackageType(rec.data) as PackageDefinition,
        })) as TeamPackageRecord[]
      }
    } finally {
      teamPackagesLoading.value = false
    }
  }

  /** Add a new team package */
  async function addTeamPackage(packageDef: PackageDefinition) {
    if (!currentTeamId.value) return { error: new Error('No team selected') }

    const userId = (await supabase.auth.getUser()).data.user?.id
    if (!userId) return { error: new Error('Not authenticated') }

    const { data, error } = await supabase
      .from('team_packages')
      .insert({
        team_id: currentTeamId.value,
        data: packageDef as unknown as Record<string, unknown>,
        created_by: userId,
      })
      .select()
      .single()

    if (!error && data) {
      teamPackages.value.push(data as TeamPackageRecord)
    }

    return { data: data as TeamPackageRecord | null, error }
  }

  /** Update an existing team package */
  async function updateTeamPackage(packageId: string, packageDef: PackageDefinition) {
    const { data, error } = await supabase
      .from('team_packages')
      .update({ data: packageDef as unknown as Record<string, unknown> })
      .eq('id', packageId)
      .select()
      .single()

    if (!error && data) {
      const idx = teamPackages.value.findIndex(tp => tp.id === packageId)
      if (idx >= 0) teamPackages.value[idx] = data as TeamPackageRecord
    }

    return { data: data as TeamPackageRecord | null, error }
  }

  /** Remove a team package (admin only) */
  async function removeTeamPackage(packageId: string) {
    const { error } = await supabase
      .from('team_packages')
      .delete()
      .eq('id', packageId)

    if (!error) {
      teamPackages.value = teamPackages.value.filter(tp => tp.id !== packageId)
    }

    return { error }
  }

  /** Check if a package name conflicts with a built-in package (client-side) */
  function isBuiltInConflict(name: string): boolean {
    // Reuse the normalise function from usePackageLibrary
    const normalised = name.trim().toLowerCase()
    const { packages: builtInPackages } = usePackageLibrary()
    return builtInPackages.value.some(bp => {
      if (bp.name.toLowerCase() === normalised) return true
      if (bp.aliases?.some(a => a.toLowerCase() === normalised)) return true
      return false
    })
  }

  // Subscribe to real-time changes on team_packages
  watch(currentTeamId, async (teamId, _old, onCleanup) => {
    if (!teamId) {
      teamPackages.value = []
      return
    }

    await fetchTeamPackages()

    const channel = supabase.channel(`team-packages:${teamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'team_packages',
        filter: `team_id=eq.${teamId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new) {
          const rec = payload.new as TeamPackageRecord
          const normalized = {
            ...rec,
            data: normalizePackageType(rec.data) as PackageDefinition,
          }
          const existing = teamPackages.value.find(tp => tp.id === normalized.id)
          if (!existing) teamPackages.value.push(normalized)
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          const rec = payload.new as TeamPackageRecord
          const normalized = {
            ...rec,
            data: normalizePackageType(rec.data) as PackageDefinition,
          }
          const idx = teamPackages.value.findIndex(tp => tp.id === normalized.id)
          if (idx >= 0) teamPackages.value[idx] = normalized
        } else if (payload.eventType === 'DELETE' && payload.old) {
          teamPackages.value = teamPackages.value.filter(tp => tp.id !== (payload.old as TeamPackageRecord).id)
        }
      })

    await channel.subscribe()

    onCleanup(() => {
      supabase.removeChannel(channel)
    })
  }, { immediate: true })

  return {
    teamPackages: readonly(teamPackages),
    teamPackageDefinitions,
    teamPackagesLoading: readonly(teamPackagesLoading),
    fetchTeamPackages,
    addTeamPackage,
    updateTeamPackage,
    removeTeamPackage,
    isBuiltInConflict,
  }
}
