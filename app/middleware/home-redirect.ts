export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.client) return

  // Allow authenticated users to view the marketing site intentionally
  if (to.query.site !== undefined) return

  try {
    const { isTauri } = await import('@tauri-apps/api/core')
    if (await isTauri()) return navigateTo('/dashboard', { replace: true })
  } catch {
    // not running in Tauri
  }

  const { user, loading } = useAuth()

  if (loading.value) {
    await new Promise<void>((resolve) => {
      const stop = watch(loading, (isLoading) => {
        if (!isLoading) {
          stop()
          resolve()
        }
      }, { immediate: true })
    })
  }

  if (user.value) return navigateTo('/dashboard', { replace: true })
})
