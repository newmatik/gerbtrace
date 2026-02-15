<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <div v-if="processing" class="space-y-3">
        <UIcon name="i-lucide-loader-2" class="text-3xl text-primary animate-spin" />
        <p class="text-sm text-neutral-500">Completing sign-in...</p>
      </div>
      <div v-else-if="errorMessage" class="space-y-3">
        <UIcon name="i-lucide-alert-circle" class="text-3xl text-red-500" />
        <p class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>
        <NuxtLink to="/auth/login">
          <UButton size="sm" variant="outline">Back to sign in</UButton>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const route = useRoute()
const supabase = useSupabase()

const processing = ref(true)
const errorMessage = ref('')

onMounted(async () => {
  try {
    // Supabase Auth handles the OAuth/magic-link callback automatically
    // by detecting the hash fragment in the URL. We just need to wait for it.
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      errorMessage.value = error.message
      processing.value = false
      return
    }

    // Handle invitation token if present
    const invitationToken = route.query.invitation as string
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

    // Redirect home
    if (session) {
      router.replace('/')
    } else {
      // If no session yet, wait for auth state change
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (newSession) {
          subscription.unsubscribe()
          router.replace('/')
        }
      })

      // Timeout after 10 seconds
      setTimeout(() => {
        processing.value = false
        errorMessage.value = 'Sign-in timed out. Please try again.'
      }, 10000)
    }
  } catch (e) {
    errorMessage.value = 'An unexpected error occurred'
    processing.value = false
  }
})
</script>
