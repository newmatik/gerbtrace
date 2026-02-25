import { CURRENT_LEGAL_VERSIONS, isConsentVersionAtLeast } from '~/utils/legalVersions'

type ConsentType = keyof typeof CURRENT_LEGAL_VERSIONS

const consentChecked = ref(false)
const consentResult = ref<boolean | null>(null)

export function useConsent() {
  const supabase = useSupabase()
  const { user } = useAuth()

  async function hasAcceptedCurrentTerms(): Promise<boolean> {
    if (consentResult.value !== null) return consentResult.value
    if (!user.value) return false

    const { data, error } = await supabase
      .from('user_consents')
      .select('consent_type, version')
      .eq('user_id', user.value.id)
      .in('consent_type', ['terms', 'privacy'])

    if (error || !data) {
      consentResult.value = false
      return false
    }

    const latestByType = new Map<string, string>()
    for (const row of data) {
      const current = latestByType.get(row.consent_type)
      const version = String(row.version ?? '')
      if (!current || isConsentVersionAtLeast(version, current)) {
        latestByType.set(row.consent_type, version)
      }
    }

    const termsVersion = latestByType.get('terms')
    const privacyVersion = latestByType.get('privacy')
    const accepted = !!termsVersion
      && !!privacyVersion
      && isConsentVersionAtLeast(termsVersion, CURRENT_LEGAL_VERSIONS.terms)
      && isConsentVersionAtLeast(privacyVersion, CURRENT_LEGAL_VERSIONS.privacy)
    consentResult.value = accepted
    consentChecked.value = true
    return accepted
  }

  async function recordConsent(types: ConsentType[]): Promise<{ error: any }> {
    if (!user.value) return { error: new Error('Not authenticated') }

    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) {
      return { error: new Error('Missing session') }
    }

    try {
      await $fetch('/api/legal/consent', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        body: {
          types,
        },
      })
      consentResult.value = null
      return { error: null }
    }
    catch (error: any) {
      return { error }
    }
  }

  function clearConsentCache() {
    consentResult.value = null
    consentChecked.value = false
  }

  return {
    hasAcceptedCurrentTerms,
    recordConsent,
    clearConsentCache,
    consentChecked: readonly(consentChecked),
  }
}
