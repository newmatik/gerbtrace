export default defineNuxtRouteMiddleware(async () => {
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

  if (!user.value) return navigateTo('/dashboard')
})
