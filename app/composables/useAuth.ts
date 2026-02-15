import type { User, Session, AuthError } from '@supabase/supabase-js'

/**
 * Reactive auth state backed by Supabase GoTrue.
 *
 * Provides sign-up, sign-in (email/password, magic link, GitHub OAuth),
 * sign-out, and reactive user/session refs. Token refresh is automatic.
 */

const user = ref<User | null>(null)
const session = ref<Session | null>(null)
const loading = ref(true)
const initialised = ref(false)

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
    const redirectTo = `${window.location.origin}/auth/callback`
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
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

  /** Sign out (clears session) */
  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      user.value = null
      session.value = null
    }
    return { error }
  }

  /** Reset password */
  async function resetPassword(email: string) {
    const redirectTo = `${window.location.origin}/auth/callback?type=recovery`
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })
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
  }
}
