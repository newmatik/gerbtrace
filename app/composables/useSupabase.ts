import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Singleton Supabase client.
 *
 * Initialised once with the URL + anon key from Nuxt runtime config.
 * Auth state is automatically persisted to localStorage by the Supabase client.
 */

let _client: SupabaseClient | null = null
let _available = false

function createStubClient(): any {
  return new Proxy(function () {}, {
    get(_, prop) {
      if (prop === 'then') return undefined
      return createStubClient()
    },
    apply() {
      return Promise.resolve({ data: null, error: null })
    },
  })
}

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
    _available = false
    _client = createStubClient() as SupabaseClient
    return _client
  }

  _available = true
  _client = createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })

  return _client
}
