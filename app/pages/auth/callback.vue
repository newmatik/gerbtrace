<script setup lang="ts">
const router = useRouter()
const route = useRoute()
const supabase = useSupabase()

const processing = ref(true)
const errorMessage = ref('')
const errorHint = ref('')

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

    const code = route.query.code as string | undefined
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        processing.value = false
        subscription.unsubscribe()
        router.replace('/auth/reset-password')
        return
      }

      if (newSession) {
        subscription.unsubscribe()
        handlePostAuth(newSession)
      }
    })

    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      errorMessage.value = error.message
      processing.value = false
      subscription.unsubscribe()
      return
    }

    if (session && (route.query.type === 'recovery' || hashType === 'recovery')) {
      processing.value = false
      subscription.unsubscribe()
      router.replace('/auth/reset-password')
      return
    }

    if (session) {
      subscription.unsubscribe()
      handlePostAuth(session)
      return
    }

    setTimeout(() => {
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

  const isInvite = session.user?.app_metadata?.providers?.length === 1
    && session.user?.app_metadata?.providers?.[0] === 'email'
    && !session.user?.user_metadata?.email_verified

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
            <NuxtLink to="/auth/login">
              <UButton size="sm" variant="outline">
                Back to sign in
              </UButton>
            </NuxtLink>
          </div>
        </template>
      </div>
    </main>
  </div>
</template>
