<script setup lang="ts">
import { useColorMode } from '#imports'

const supabase = useSupabase()
const router = useRouter()
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const newPassword = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const sessionValid = ref(false)
let redirectTimer: ReturnType<typeof setTimeout> | null = null

onUnmounted(() => {
  if (redirectTimer) clearTimeout(redirectTimer)
})

const passwordMismatch = computed(() =>
  confirmPassword.value.length > 0 && newPassword.value !== confirmPassword.value,
)

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    navigateTo('/auth/login')
    return
  }
  sessionValid.value = true
})

async function handleSubmit() {
  errorMessage.value = ''
  successMessage.value = ''
  if (newPassword.value.length < 8) {
    errorMessage.value = 'Password must be at least 8 characters.'
    return
  }
  if (newPassword.value !== confirmPassword.value) return

  isLoading.value = true

  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword.value })
    if (error) {
      errorMessage.value = error.message
    } else {
      successMessage.value = 'Password updated successfully! Redirecting...'
      try { await supabase.auth.signOut() } catch { /* non-fatal; token TTL handles expiry */ }
      redirectTimer = setTimeout(() => navigateTo('/auth/login'), 1500)
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 flex items-center justify-center px-4">
      <div v-if="sessionValid" class="w-full max-w-md">
        <div class="text-center mb-6">
          <div class="flex justify-center mb-4">
            <img
              :src="isDark ? '/icon-black.png' : '/icon-blue.png'"
              alt="Gerbtrace"
              class="size-10 rounded-lg"
            >
          </div>
          <h1 class="text-2xl font-bold mb-2">
            Reset your password
          </h1>
          <p class="text-sm text-neutral-500 dark:text-neutral-400">
            Enter your new password below.
          </p>
        </div>

        <form class="space-y-3" @submit.prevent="handleSubmit">
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

          <p v-if="passwordMismatch" class="text-sm text-amber-600 dark:text-amber-400">
            Passwords do not match.
          </p>

          <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400">
            {{ errorMessage }}
          </p>

          <p v-if="successMessage" class="text-sm text-green-600 dark:text-green-400">
            {{ successMessage }}
          </p>

          <UButton
            type="submit"
            block
            size="lg"
            class="mt-5"
            :loading="isLoading"
            :disabled="!newPassword || newPassword.length < 8 || newPassword !== confirmPassword"
          >
            Update Password
          </UButton>
        </form>
      </div>
    </main>
  </div>
</template>
