<script setup lang="ts">
import { useColorMode } from '#imports'

const supabase = useSupabase()
const router = useRouter()
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const sessionValid = ref(false)

const passwordMismatch = computed(() =>
  confirmPassword.value.length > 0 && password.value !== confirmPassword.value,
)

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    errorMessage.value = 'This invitation link is invalid or has expired.'
    return
  }
  sessionValid.value = true
})

async function handleSubmit() {
  if (password.value.length < 8) {
    errorMessage.value = 'Password must be at least 8 characters.'
    return
  }
  if (password.value !== confirmPassword.value) {
    errorMessage.value = ''
    return
  }

  errorMessage.value = ''
  isLoading.value = true

  try {
    const { error } = await supabase.auth.updateUser({ password: password.value })
    if (error) {
      errorMessage.value = error.message
    } else {
      const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (assurance?.nextLevel === 'aal2' && assurance?.currentLevel === 'aal1') {
        router.replace('/auth/mfa')
      } else {
        router.replace('/dashboard')
      }
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
      <div class="w-full max-w-md">
        <div class="text-center mb-6">
          <div class="flex justify-center mb-4">
            <img
              :src="isDark ? '/icon-black.png' : '/icon-blue.png'"
              alt="Gerbtrace"
              class="size-10 rounded-lg"
            >
          </div>
          <h1 class="text-2xl font-bold mb-2">
            Welcome to Gerbtrace
          </h1>
          <p class="text-sm text-neutral-500 dark:text-neutral-400">
            Set a password for your account to get started.
          </p>
        </div>

        <template v-if="sessionValid">
          <form class="space-y-3" @submit.prevent="handleSubmit">
            <UFormField label="Password">
              <UInput
                v-model="password"
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

            <UButton
              type="submit"
              block
              size="lg"
              class="mt-5"
              :loading="isLoading"
              :disabled="!password || password.length < 8 || password !== confirmPassword"
            >
              Set Password
            </UButton>
          </form>
        </template>

        <template v-else>
          <p v-if="errorMessage" class="text-sm text-center text-red-600 dark:text-red-400">
            {{ errorMessage }}
          </p>
          <div class="mt-4 text-center">
            <UButton variant="outline" to="/auth/login">
              Go to sign in
            </UButton>
          </div>
        </template>
      </div>
    </main>
  </div>
</template>
