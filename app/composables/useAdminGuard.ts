/**
 * Platform admin check.
 *
 * Returns whether the current user is a platform admin.
 * Does NOT redirect -- callers decide what to do with the result.
 */

export function useAdminGuard() {
  const { user, isAuthenticated, loading } = useAuth()
  const config = useRuntimeConfig()

  const adminIds = computed(() => {
    const raw = (config.public as any).platformAdminIds as string ?? ''
    return raw.split(',').map((s: string) => s.trim()).filter(Boolean)
  })

  const isPlatformAdmin = computed(() => {
    if (!isAuthenticated.value || !user.value) return false
    return adminIds.value.includes(user.value.id)
  })

  return {
    isPlatformAdmin,
    isLoading: loading,
  }
}
