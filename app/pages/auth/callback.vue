<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        <!-- Password recovery form -->
        <template v-if="showPasswordReset">
          <div class="text-center mb-6">
            <div class="flex justify-center mb-4">
              <div class="size-14 rounded-full bg-primary/10 flex items-center justify-center">
                <UIcon name="i-lucide-key-round" class="size-7 text-primary" />
              </div>
            </div>
            <h1 class="text-2xl font-bold mb-2">Set a new password</h1>
            <p class="text-sm text-neutral-500 dark:text-neutral-400">
              Enter your new password below.
            </p>
          </div>

          <form @submit.prevent="handlePasswordUpdate">
            <div class="space-y-3">
              <UFormField label="New password">
                <UInput
                  v-model="newPassword"
                  type="password"
                  placeholder="At least 8 characters"
                  required
                  autofocus
                  size="lg"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Confirm password">
                <UInput
                  v-model="confirmPassword"
                  type="password"
                  placeholder="Repeat your password"
                  required
                  size="lg"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UButton
              type="submit"
              block
              size="lg"
              class="mt-5"
              :loading="passwordLoading"
              :disabled="!newPassword || newPassword.length < 8 || newPassword !== confirmPassword"
            >
              Update Password
            </UButton>
          </form>

          <p v-if="passwordMismatch" class="mt-3 text-sm text-center text-amber-600 dark:text-amber-400">
            Passwords do not match.
          </p>

          <p v-if="successMessage" class="mt-4 text-sm text-center text-green-600 dark:text-green-400">
            {{ successMessage }}
          </p>

          <p v-if="errorMessage" class="mt-4 text-sm text-center text-red-600 dark:text-red-400">
            {{ errorMessage }}
          </p>
        </template>

        <!-- Processing spinner -->
        <template v-else-if="processing">
          <div class="text-center space-y-3">
            <UIcon name="i-lucide-loader-2" class="text-3xl text-primary animate-spin" />
            <p class="text-sm text-neutral-500">Completing sign-in...</p>
          </div>
        </template>

        <!-- Error state -->
        <template v-else-if="errorMessage">
          <div class="text-center space-y-3">
            <UIcon name="i-lucide-alert-circle" class="text-3xl text-red-500" />
            <p class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>
            <p v-if="errorHint" class="text-xs text-neutral-500 dark:text-neutral-400">{{ errorHint }}</p>
            <NuxtLink to="/auth/login">
              <UButton size="sm" variant="outline">Back to sign in</UButton>
            </NuxtLink>
          </div>
        </template>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const route = useRoute()
const supabase = useSupabase()
const { updatePassword } = useAuth()

const processing = ref(true)
const errorMessage = ref('')
const errorHint = ref('')
const successMessage = ref('')

// Password recovery state
const showPasswordReset = ref(false)
const newPassword = ref('')
const confirmPassword = ref('')
const passwordLoading = ref(false)
const passwordMismatch = computed(() =>
  confirmPassword.value.length > 0 && newPassword.value !== confirmPassword.value,
)

onMounted(async () => {
  try {
    // Check for error parameters in the URL hash (GoTrue error redirects)
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

    // Handle PKCE code exchange (fallback if flowType is pkce)
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

    // Listen for auth state changes — needed for both implicit hash detection
    // and to catch the PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked a password reset link — show the reset form
        processing.value = false
        showPasswordReset.value = true
        subscription.unsubscribe()
        return
      }

      if (newSession) {
        subscription.unsubscribe()
        handlePostAuth(newSession)
      }
    })

    // Also check if a session already exists (e.g., implicit flow already resolved)
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      errorMessage.value = error.message
      processing.value = false
      subscription.unsubscribe()
      return
    }

    // If we already have a session and this is a recovery flow, show the form
    if (session && (route.query.type === 'recovery' || hashType === 'recovery')) {
      processing.value = false
      showPasswordReset.value = true
      subscription.unsubscribe()
      return
    }

    if (session) {
      subscription.unsubscribe()
      handlePostAuth(session)
      return
    }

    // Timeout after 15 seconds if nothing happens
    setTimeout(() => {
      if (processing.value) {
        processing.value = false
        errorMessage.value = 'Sign-in timed out. Please try again.'
        errorHint.value = 'If you clicked a link from an email, it may have expired.'
        subscription.unsubscribe()
      }
    }, 15000)
  } catch (e) {
    errorMessage.value = 'An unexpected error occurred'
    processing.value = false
  }
})

async function handlePostAuth(session: any) {
  // Handle invitation token if present
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

  router.replace('/')
}

async function handlePasswordUpdate() {
  if (newPassword.value.length < 8) {
    errorMessage.value = 'Password must be at least 8 characters.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''
  passwordLoading.value = true

  try {
    const { error } = await updatePassword(newPassword.value)
    if (error) {
      errorMessage.value = error.message
    } else {
      successMessage.value = 'Password updated successfully! Redirecting...'
      setTimeout(() => router.replace('/'), 1500)
    }
  } finally {
    passwordLoading.value = false
  }
}
</script>
