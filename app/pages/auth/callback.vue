<script setup lang="ts">
const router = useRouter()
const route = useRoute()
const supabase = useSupabase()

const processing = ref(true)
const errorMessage = ref('')
const errorHint = ref('')
let authSubscription: { unsubscribe: () => void } | null = null
let timeoutId: ReturnType<typeof setTimeout> | null = null

onUnmounted(() => {
  authSubscription?.unsubscribe()
  if (timeoutId) clearTimeout(timeoutId)
})

onMounted(async () => {
  try {
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const hashType = hashParams.get('type')
    const urlError = hashParams.get('error_description') || hashParams.get('error')
    if (urlError) {
      const errorCode = hashParams.get('error_code') || ''
      errorMessage.value = decodeURIComponent(urlError.replace(/\+/g, ' '))
      if (errorCode === 'otp_expired') {
        errorHint.value = 'The link has expired. Please request a new one.'
      }
      processing.value = false
      return
    }

    const queryParam = (v: unknown): string | undefined => {
      if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : undefined
      return typeof v === 'string' ? v : undefined
    }
    const code = queryParam(route.query.code)
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        errorMessage.value = error.message
        if (error.message?.toLowerCase().includes('expired')) {
          errorHint.value = 'The link has expired. Please request a new one.'
        }
        processing.value = false
        return
      }
    }

    let handled = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (handled) return

      if (event === 'PASSWORD_RECOVERY') {
        handled = true
        processing.value = false
        subscription.unsubscribe()
        router.replace('/auth/reset-password')
        return
      }

      if (newSession) {
        handled = true
        subscription.unsubscribe()
        handlePostAuth(newSession)
      }
    })
    authSubscription = subscription

    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      errorMessage.value = error.message
      processing.value = false
      subscription.unsubscribe()
      return
    }

    const queryType = queryParam(route.query.type)
    if (session && (queryType === 'recovery' || hashType === 'recovery')) {
      handled = true
      processing.value = false
      subscription.unsubscribe()
      router.replace('/auth/reset-password')
      return
    }

    if (session && !handled) {
      subscription.unsubscribe()
      handlePostAuth(session)
      return
    }

    timeoutId = setTimeout(() => {
      if (processing.value) {
        processing.value = false
        errorMessage.value = 'Sign-in timed out. Please try again.'
        errorHint.value = 'If you clicked a link from an email, it may have expired.'
        subscription.unsubscribe()
      }
    }, 15000)
  } catch {
    errorMessage.value = 'An unexpected error occurred'
    processing.value = false
  }
})

async function handlePostAuth(session: any) {
  const invitationToken = route.query.invitation as string
  const spaceInvitationToken = route.query.space_invitation as string

  if (invitationToken && session) {
    try {
      const { error: invError } = await supabase.rpc('accept_invitation', {
        p_token: invitationToken,
      })
      if (invError) {
        console.warn('Failed to accept invitation:', invError.message)
      }
    } catch (e) {
      console.warn('Invitation acceptance failed:', e)
    }
  }

  if (spaceInvitationToken && session) {
    try {
      const { error: invError } = await supabase.rpc('accept_space_invitation', {
        p_token: spaceInvitationToken,
      })
      if (invError) {
        console.warn('Failed to accept space invitation:', invError.message)
      }
    } catch (e) {
      console.warn('Space invitation acceptance failed:', e)
    }
  }

  const isInvite = !!session.user?.invited_at && !session.user?.email_confirmed_at

  if (isInvite) {
    router.replace('/auth/set-password')
  } else {
    router.replace('/dashboard')
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        <template v-if="processing">
          <div class="text-center space-y-3">
            <UIcon name="i-lucide-loader-2" class="text-3xl text-primary animate-spin" />
            <p class="text-sm text-neutral-500">
              Completing sign-in...
            </p>
          </div>
        </template>

        <template v-else-if="errorMessage">
          <div class="text-center space-y-3">
            <UIcon name="i-lucide-alert-circle" class="text-3xl text-red-500" />
            <p class="text-sm text-red-600 dark:text-red-400">
              {{ errorMessage }}
            </p>
            <p v-if="errorHint" class="text-xs text-neutral-500 dark:text-neutral-400">
              {{ errorHint }}
            </p>
            <UButton size="sm" variant="outline" to="/auth/login">
              Back to sign in
            </UButton>
          </div>
        </template>
      </div>
    </main>
  </div>
</template>
