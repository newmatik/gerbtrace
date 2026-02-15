/**
 * Reactive current user profile from the `profiles` table.
 *
 * Fetches and caches the profile for the authenticated user.
 * Automatically refetches when the auth user changes.
 */

export interface UserProfile {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

const profile = ref<UserProfile | null>(null)
const profileLoading = ref(false)

export function useCurrentUser() {
  const supabase = useSupabase()
  const { user, isAuthenticated } = useAuth()

  async function fetchProfile() {
    if (!user.value) {
      profile.value = null
      return
    }

    profileLoading.value = true
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.value.id)
        .single()

      if (error) {
        console.warn('[useCurrentUser] Failed to fetch profile:', error.message)
        profile.value = null
      } else {
        profile.value = data as UserProfile
      }
    } finally {
      profileLoading.value = false
    }
  }

  async function updateProfile(updates: { name?: string; avatar_url?: string }) {
    if (!user.value) return { error: new Error('Not authenticated') }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.value.id)
      .select()
      .single()

    if (!error && data) {
      profile.value = data as UserProfile
    }

    return { data, error }
  }

  // Refetch profile when auth user changes
  watch(user, (newUser) => {
    if (newUser) {
      fetchProfile()
    } else {
      profile.value = null
    }
  }, { immediate: true })

  return {
    profile: readonly(profile),
    profileLoading: readonly(profileLoading),
    isAuthenticated,
    fetchProfile,
    updateProfile,
  }
}
