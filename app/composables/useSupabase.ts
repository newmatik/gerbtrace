import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Singleton Supabase client.
 *
 * Initialised once with the URL + anon key from Nuxt runtime config.
 * Auth state is automatically persisted to localStorage by the Supabase client.
 */

let _client: SupabaseClient | null = null
let _available = false

/**
 * Returns true if Supabase is configured (URL + anon key present).
 * Use this to guard features that require Supabase.
 */
export function useSupabaseAvailable(): boolean {
  if (_client) return _available

  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl as string
  const key = config.public.supabaseAnonKey as string
  return !!(url && key)
}

export function useSupabase(): SupabaseClient {
  if (_client) return _client

  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl as string
  const key = config.public.supabaseAnonKey as string

  if (!url || !key) {
    console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY — collaborative features disabled')
    // Create a dummy client that throws clear errors instead of failing silently
    _available = false
    _client = new Proxy({} as SupabaseClient, {
      get(target, prop) {
        return new Proxy(() => {}, {
          apply() {
            throw new Error('[Supabase] Supabase is not configured. Check your SUPABASE_URL and SUPABASE_ANON_KEY environment variables.')
          }
        })
      }
    })
    return _client
  }

  _available = true
  _client = createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
    },
  })

  return _client
}
