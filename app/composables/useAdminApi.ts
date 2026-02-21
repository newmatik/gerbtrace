/**
 * Admin API helper.
 *
 * Provides typed methods to call admin Edge Functions with auth headers.
 */

export function useAdminApi() {
  const supabase = useSupabase()

  async function getToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }

  async function query<T = any>(mode: string, params?: Record<string, unknown>): Promise<T> {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')

    const { data, error } = await supabase.functions.invoke('admin-usage', {
      body: { mode, ...params },
      headers: { Authorization: `Bearer ${token}` },
    })
    if (error) throw error
    return data as T
  }

  async function action(payload: Record<string, unknown>): Promise<any> {
    const token = await getToken()
    if (!token) throw new Error('Not authenticated')

    const { data, error } = await supabase.functions.invoke('admin-team-action', {
      body: payload,
      headers: { Authorization: `Bearer ${token}` },
    })
    if (error) throw error
    return data
  }

  return { query, action }
}
