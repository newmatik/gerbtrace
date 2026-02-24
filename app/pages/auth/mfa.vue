<script setup lang="ts">
import { useColorMode } from '#imports'

const supabase = useSupabase()
const router = useRouter()
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const code = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const factorId = ref('')

onMounted(async () => {
  const { data } = await supabase.auth.mfa.listFactors()
  const totpFactor = data?.totp?.[0]
  if (!totpFactor) {
    navigateTo('/auth/login')
    return
  }
  factorId.value = totpFactor.id
})

async function handleVerify() {
  if (code.value.length !== 6) return

  errorMessage.value = ''
  isLoading.value = true

  try {
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: factorId.value,
    })
    if (challengeError) {
      errorMessage.value = challengeError.message
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factorId.value,
      challengeId: challengeData.id,
      code: code.value,
    })
    if (verifyError) {
      errorMessage.value = verifyError.message
      code.value = ''
    } else {
      router.replace('/dashboard')
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
            Two-factor authentication
          </h1>
          <p class="text-sm text-neutral-500 dark:text-neutral-400">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>

        <form class="space-y-3" @submit.prevent="handleVerify">
          <UFormField label="Verification code">
            <UInput
              v-model="code"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              placeholder="000000"
              required
              autofocus
              size="lg"
              maxlength="6"
              class="w-full text-center tracking-[0.3em] font-mono text-lg"
            />
          </UFormField>

          <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400">
            {{ errorMessage }}
          </p>

          <UButton
            type="submit"
            block
            size="lg"
            class="mt-5"
            :loading="isLoading"
            :disabled="code.length !== 6"
          >
            Verify
          </UButton>
        </form>

        <p class="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
          <NuxtLink to="/auth/login" class="text-primary hover:underline">
            Back to sign in
          </NuxtLink>
        </p>
      </div>
    </main>
  </div>
</template>
