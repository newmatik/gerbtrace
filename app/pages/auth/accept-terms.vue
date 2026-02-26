<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        <div class="flex items-center justify-center gap-3 mb-8">
          <img
            :src="isDark ? '/icon-black.png' : '/icon-blue.png'"
            alt="Gerbtrace"
            class="size-8 rounded-lg"
          >
          <h1 class="text-2xl font-bold">{{ isReConsent ? 'Updated Terms' : 'Accept Terms' }}</h1>
        </div>

        <p v-if="isReConsent" class="text-sm text-neutral-500 dark:text-neutral-400 mb-6 text-center">
          We've updated our Terms of Service and Privacy Policy. Please review and accept the updated versions to continue using Gerbtrace.
        </p>
        <p v-else class="text-sm text-neutral-500 dark:text-neutral-400 mb-6 text-center">
          Before you continue, please review and accept our Terms of Service and Privacy Policy.
        </p>

        <div class="space-y-3 mb-6">
          <div class="flex items-center gap-2 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
            <UIcon name="i-lucide-file-text" class="text-lg text-neutral-400 shrink-0" />
            <NuxtLink to="/terms" target="_blank" class="text-sm text-primary hover:underline">
              Terms of Service
            </NuxtLink>
            <UIcon name="i-lucide-external-link" class="text-xs text-neutral-400" />
          </div>
          <div class="flex items-center gap-2 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
            <UIcon name="i-lucide-shield" class="text-lg text-neutral-400 shrink-0" />
            <NuxtLink to="/privacy" target="_blank" class="text-sm text-primary hover:underline">
              Privacy Policy
            </NuxtLink>
            <UIcon name="i-lucide-external-link" class="text-xs text-neutral-400" />
          </div>
        </div>

        <label class="flex items-start gap-3 mb-6 cursor-pointer">
          <UCheckbox v-model="accepted" class="mt-0.5" />
          <span class="text-sm text-neutral-700 dark:text-neutral-300">
            I have read and agree to the
            <NuxtLink to="/terms" target="_blank" class="text-primary hover:underline">Terms of Service</NuxtLink>
            and the
            <NuxtLink to="/privacy" target="_blank" class="text-primary hover:underline">Privacy Policy</NuxtLink>.
          </span>
        </label>

        <UButton
          block
          size="lg"
          :disabled="!accepted"
          :loading="submitting"
          @click="handleAccept"
        >
          Continue
        </UButton>

        <p v-if="errorMessage" class="mt-4 text-sm text-center text-red-600 dark:text-red-400">
          {{ errorMessage }}
        </p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useColorMode } from '#imports'

definePageMeta({
  alias: ['/auth/consent', '/de/auth/consent'],
})

const router = useRouter()
const route = useRoute()
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const { isAuthenticated } = useAuth()
const { recordConsent, hasAcceptedCurrentTerms } = useConsent()

const accepted = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const isReConsent = ref(false)

watch(isAuthenticated, (authed) => {
  if (!authed) router.replace('/auth/login')
}, { immediate: true })

onMounted(async () => {
  const alreadyAccepted = await hasAcceptedCurrentTerms()
  const redirect = (route.query.redirect as string) || '/dashboard'
  const safeRedirect = /^\/(?!\/)/.test(redirect) ? redirect : '/dashboard'
  if (alreadyAccepted) {
    router.replace(safeRedirect)
    return
  }
  isReConsent.value = route.query.reconsent === '1'
})

async function handleAccept() {
  if (!accepted.value) return
  submitting.value = true
  errorMessage.value = ''

  try {
    const { error } = await recordConsent(['terms', 'privacy'])
    if (error) {
      errorMessage.value = error.message || 'Failed to record consent. Please try again.'
      return
    }
    const redirect = (route.query.redirect as string) || '/dashboard'
    const safeRedirect = /^\/(?!\/)/.test(redirect) ? redirect : '/dashboard'
    router.replace(safeRedirect)
  } finally {
    submitting.value = false
  }
}
</script>
