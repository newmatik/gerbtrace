const PUBLIC_PREFIXES = [
  '/',
  '/auth',
  '/docs',
  '/pricing',
  '/privacy',
  '/terms',
  '/imprint',
  '/features',
  '/dpa',
  '/de/datenschutz',
  '/de/agb',
  '/de/impressum',
  '/de/avv',
]

const CONSENT_EXEMPT_PATHS = ['/auth/', '/profile', '/de/auth/']

function isPublicRoute(path: string): boolean {
  if (path === '/') return true
  return PUBLIC_PREFIXES.some(prefix => prefix !== '/' && path.startsWith(prefix))
}

function isConsentExempt(path: string): boolean {
  return CONSENT_EXEMPT_PATHS.some(prefix => path.startsWith(prefix))
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (isPublicRoute(to.path)) return

  const { user, loading } = useAuth()
  const supabase = useSupabase()

  if (loading.value) {
    await Promise.race([
      new Promise<void>((resolve) => {
        const stop = watch(loading, (isLoading) => {
          if (!isLoading) {
            stop()
            resolve()
          }
        }, { immediate: true })
      }),
      new Promise<void>(resolve => setTimeout(resolve, 5000)),
    ])
  }

  if (!user.value) return navigateTo('/auth/login')

  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (data?.nextLevel === 'aal2' && data?.currentLevel === 'aal1') {
    return navigateTo('/auth/mfa')
  }

  if (!isConsentExempt(to.path)) {
    const { hasAcceptedCurrentTerms } = useConsent()
    const hasConsent = await hasAcceptedCurrentTerms()
    if (!hasConsent) {
      return navigateTo(`/auth/consent?redirect=${encodeURIComponent(to.fullPath)}`)
    }
  }
})
