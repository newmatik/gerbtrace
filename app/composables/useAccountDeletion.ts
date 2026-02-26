export function useAccountDeletion() {
  const supabase = useSupabase()
  const { user } = useAuth()

  const deleting = ref(false)
  const error = ref<string | null>(null)

  async function deleteAccount(): Promise<boolean> {
    if (!user.value) {
      error.value = 'Not authenticated'
      return false
    }

    deleting.value = true
    error.value = null

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        error.value = 'Session expired. Please sign in again.'
        return false
      }

      const res = await fetch(
        `${useRuntimeConfig().public.supabaseUrl}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        },
      )

      const data = await res.json()
      if (!res.ok) {
        error.value = data.error || 'Failed to delete account'
        return false
      }

      await supabase.auth.signOut()
      return true
    } catch (e: any) {
      error.value = e.message || 'An unexpected error occurred'
      return false
    } finally {
      deleting.value = false
    }
  }

  return {
    deleteAccount,
    deleting: readonly(deleting),
    error: readonly(error),
  }
}
