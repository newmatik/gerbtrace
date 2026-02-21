/**
 * Plan-awareness composable.
 *
 * Centralises plan limits, feature flags, and usage tracking.
 * Reads `teams.plan` from useTeam() and fetches monthly usage via RPC.
 */

import type { TeamPlan } from './useTeam'

export interface PlanLimits {
  members: number
  projects: number
  spaces: number
  sparkAi: boolean
  elexessSearches: number
  guests: boolean
}

const PLAN_LIMITS: Record<TeamPlan, PlanLimits> = {
  free: { members: 5, projects: 20, spaces: 1, sparkAi: false, elexessSearches: 0, guests: false },
  pro: { members: 15, projects: Infinity, spaces: 3, sparkAi: true, elexessSearches: 1_000, guests: false },
  team: { members: 100, projects: Infinity, spaces: Infinity, sparkAi: true, elexessSearches: 10_000, guests: true },
  enterprise: { members: Infinity, projects: Infinity, spaces: Infinity, sparkAi: true, elexessSearches: Infinity, guests: true },
}

const USAGE_REFRESH_INTERVAL_MS = 120_000

export function useTeamPlan() {
  const supabase = useSupabase()
  const { currentTeam, currentTeamId } = useTeam()
  const { members } = useTeamMembers()
  const { projects } = useTeamProjects()

  const plan = computed<TeamPlan>(() => currentTeam.value?.plan ?? 'free')
  const limits = computed(() => PLAN_LIMITS[plan.value])

  const isFree = computed(() => plan.value === 'free')
  const isPro = computed(() => plan.value === 'pro')
  const isTeam = computed(() => plan.value === 'team')
  const isEnterprise = computed(() => plan.value === 'enterprise')

  const canUseSparkAi = computed(() => limits.value.sparkAi)
  const canUseElexess = computed(() => limits.value.elexessSearches > 0)
  const canInviteGuests = computed(() => limits.value.guests)

  const maxMembers = computed(() => limits.value.members)
  const maxProjects = computed(() => limits.value.projects)
  const maxSpaces = computed(() => limits.value.spaces)
  const maxElexessSearches = computed(() => limits.value.elexessSearches)

  const memberCount = computed(() => members.value.length)
  const projectCount = computed(() => projects.value.length)

  const isAtMemberLimit = computed(() => memberCount.value >= maxMembers.value)
  const isAtProjectLimit = computed(() => projectCount.value >= maxProjects.value)

  // Monthly usage (fetched via RPC)
  const elexessSearchesUsed = ref(0)
  const sparkAiRunsUsed = ref(0)
  const usageLoading = ref(false)
  let usageTimer: ReturnType<typeof setInterval> | null = null

  const elexessSearchesRemaining = computed(() =>
    maxElexessSearches.value === Infinity
      ? Infinity
      : Math.max(0, maxElexessSearches.value - elexessSearchesUsed.value),
  )
  const isAtElexessLimit = computed(() =>
    maxElexessSearches.value !== Infinity && elexessSearchesUsed.value >= maxElexessSearches.value,
  )

  const suggestedUpgrade = computed<'Pro' | 'Team' | null>(() => {
    if (isFree.value) return 'Pro'
    if (isPro.value) return 'Team'
    return null
  })

  async function fetchUsage() {
    const teamId = currentTeamId.value
    if (!teamId) return
    usageLoading.value = true
    try {
      const { data, error } = await supabase.rpc('get_team_monthly_usage', { p_team_id: teamId })
      if (!error && data && Array.isArray(data) && data.length > 0) {
        elexessSearchesUsed.value = Number(data[0].elexess_searches) || 0
        sparkAiRunsUsed.value = Number(data[0].spark_ai_runs) || 0
      }
    } catch {
      // Silently fail — usage display is informational.
    } finally {
      usageLoading.value = false
    }
  }

  /** Log a usage event and return whether the action is allowed. */
  async function logUsageEvent(eventType: 'elexess_search' | 'spark_ai_run', metadata?: Record<string, unknown>): Promise<boolean> {
    const teamId = currentTeamId.value
    if (!teamId) return false
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) return false

    const { data, error } = await supabase.rpc('log_usage_event', {
      p_team_id: teamId,
      p_user_id: userId,
      p_event_type: eventType,
      p_metadata: metadata ?? null,
    })

    if (error) {
      console.warn('[useTeamPlan] log_usage_event error:', error.message)
      return false
    }

    const allowed = data === true
    if (allowed) {
      if (eventType === 'elexess_search') elexessSearchesUsed.value++
      else if (eventType === 'spark_ai_run') sparkAiRunsUsed.value++
    }
    return allowed
  }

  watch(currentTeamId, (teamId) => {
    if (usageTimer) { clearInterval(usageTimer); usageTimer = null }
    elexessSearchesUsed.value = 0
    sparkAiRunsUsed.value = 0
    if (!teamId) return
    fetchUsage()
    usageTimer = setInterval(fetchUsage, USAGE_REFRESH_INTERVAL_MS)
  }, { immediate: true })

  onScopeDispose(() => {
    if (usageTimer) clearInterval(usageTimer)
  })

  return {
    plan,
    limits,
    isFree,
    isPro,
    isTeam,
    isEnterprise,
    canUseSparkAi,
    canUseElexess,
    canInviteGuests,
    maxMembers,
    maxProjects,
    maxSpaces,
    maxElexessSearches,
    memberCount,
    projectCount,
    isAtMemberLimit,
    isAtProjectLimit,
    elexessSearchesUsed: readonly(elexessSearchesUsed),
    sparkAiRunsUsed: readonly(sparkAiRunsUsed),
    elexessSearchesRemaining,
    isAtElexessLimit,
    suggestedUpgrade,
    usageLoading: readonly(usageLoading),
    fetchUsage,
    logUsageEvent,
    PLAN_LIMITS,
  }
}
