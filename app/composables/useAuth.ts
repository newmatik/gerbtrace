import type { User, Session, AuthError } from '@supabase/supabase-js'

/**
 * Reactive auth state backed by Supabase GoTrue.
 *
 * Provides sign-up, sign-in (email/password, magic link, GitHub OAuth),
 * sign-out, and reactive user/session refs. Token refresh is automatic.
 */

const WEB_ORIGIN = 'https://gerbtrace.com'

/**
 * Return the origin to use for email-based auth redirects (magic link,
 * password reset). These links always open in the user's browser, so in the
 * Tauri desktop app we must use the web URL instead of `tauri://localhost`.
 * In local dev and in the web app we keep `window.location.origin`.
 */
function webOrigin(): string {
  const origin = window.location.origin
  if (origin.startsWith('tauri://') || origin.startsWith('https://tauri.')) {
    return WEB_ORIGIN
  }
  return origin
}

const user = ref<User | null>(null)
const session = ref<Session | null>(null)
const loading = ref(true)
const initialised = ref(false)

function clearClientAuthStorage() {
  if (!import.meta.client) return
  const maybeAuthKey = (key: string) =>
    key.includes('supabase.auth.token')
    || key.endsWith('-auth-token')
    || key.includes('sb-') && key.includes('auth-token')

  try {
    for (const key of Object.keys(window.localStorage)) {
      if (maybeAuthKey(key)) window.localStorage.removeItem(key)
    }
  } catch {
    // ignore storage access errors
  }

  try {
    for (const key of Object.keys(window.sessionStorage)) {
      if (maybeAuthKey(key)) window.sessionStorage.removeItem(key)
    }
  } catch {
    // ignore storage access errors
  }
}

export function useAuth() {
  const supabase = useSupabase()

  // One-time initialisation: get existing session + listen for changes
  if (!initialised.value) {
    initialised.value = true

    supabase.auth.getSession().then(({ data }) => {
      session.value = data.session
      user.value = data.session?.user ?? null
      loading.value = false
    })

    supabase.auth.onAuthStateChange((_event, newSession) => {
      session.value = newSession
      user.value = newSession?.user ?? null
      loading.value = false
    })
  }

  const isAuthenticated = computed(() => !!user.value)

  /** Sign up with email + password */
  async function signUp(email: string, password: string, name?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: name ?? email.split('@')[0] },
      },
    })
    return { data, error }
  }

  /** Sign in with email + password */
  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  /** Sign in with magic link (passwordless) */
  async function signInWithMagicLink(email: string) {
    // Always use the web origin for magic-link emails — the link will open in
    // the user's browser, not inside the Tauri desktop app.
    const origin = webOrigin()
    const redirectTo = `${origin}/auth/callback`
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: false,
      },
    })
    return { data, error }
  }

  /** Sign in with GitHub OAuth */
  async function signInWithGitHub() {
    const redirectTo = `${window.location.origin}/auth/callback`
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo },
    })
    return { data, error }
  }

  /** Sign out (clears session). Force mode also purges local auth storage. */
  async function signOut(options?: { force?: boolean }) {
    if (options?.force) {
      // Immediately clear reactive state so UI cannot remain in limbo.
      user.value = null
      session.value = null
      clearClientAuthStorage()
    }

    // Prefer global sign-out in force mode, fallback to local if needed.
    const { error } = options?.force
      ? await supabase.auth.signOut({ scope: 'global' })
      : await supabase.auth.signOut()

    if (error && options?.force) {
      await supabase.auth.signOut({ scope: 'local' })
    }

    user.value = null
    session.value = null
    if (options?.force) clearClientAuthStorage()

    return { error: error ?? null }
  }

  /** Reset password */
  async function resetPassword(email: string) {
    // Always use the web origin for password reset emails — the link in the
    // email will open in the user's browser, not inside the Tauri desktop app.
    const origin = webOrigin()
    const redirectTo = `${origin}/auth/callback?type=recovery`
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })
    return { data, error }
  }

  /** Update the current user's password (used after recovery flow) */
  async function updatePassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword })
    return { data, error }
  }

  return {
    user: readonly(user),
    session: readonly(session),
    loading: readonly(loading),
    isAuthenticated,
    signUp,
    signIn,
    signInWithMagicLink,
    signInWithGitHub,
    signOut,
    resetPassword,
    updatePassword,
  }
}
