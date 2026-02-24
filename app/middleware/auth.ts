export default defineNuxtRouteMiddleware(async () => {
  const { user, loading } = useAuth()
  const supabase = useSupabase()

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

  if (!user.value) return navigateTo('/auth/login')

  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (data?.nextLevel === 'aal2' && data?.currentLevel === 'aal1') {
    return navigateTo('/auth/mfa')
  }
})
