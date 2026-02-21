<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        <!-- Confirmation pending state -->
        <template v-if="confirmationPending">
          <div class="text-center py-8">
            <div class="flex justify-center mb-4">
              <div class="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                <UIcon name="i-lucide-mail-check" class="size-8 text-primary" />
              </div>
            </div>
            <h1 class="text-2xl font-bold mb-2">Check your email</h1>
            <p class="text-neutral-500 dark:text-neutral-400 mb-2">
              We sent a confirmation link to
            </p>
            <p class="font-medium mb-6">{{ registeredEmail }}</p>
            <p class="text-sm text-neutral-400 dark:text-neutral-500 mb-6">
              Click the link in the email to activate your account. If you don't see it, check your spam folder.
            </p>
            <UButton
              variant="outline"
              color="neutral"
              block
              size="lg"
              class="mb-3"
              :loading="resendLoading"
              :disabled="resendCooldown > 0"
              @click="handleResend"
            >
              {{ resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend confirmation email' }}
            </UButton>
            <UButton
              variant="ghost"
              color="neutral"
              block
              size="lg"
              @click="confirmationPending = false"
            >
              Use a different email
            </UButton>
          </div>
        </template>

        <!-- Registration form -->
        <template v-else>
          <div class="flex items-center justify-center gap-3 mb-8">
            <img
              :src="isDark ? '/icon-black.png' : '/icon-blue.png'"
              alt="Gerbtrace"
              class="size-8 rounded-lg"
            >
            <h1 class="text-2xl font-bold">Create an account</h1>
          </div>

          <!-- OAuth providers -->
          <UButton
            block
            size="lg"
            color="neutral"
            variant="outline"
            icon="i-simple-icons-microsoft"
            class="mb-3"
            :loading="microsoftLoading"
            @click="handleMicrosoft"
          >
            Sign up with Microsoft
          </UButton>
          <UButton
            block
            size="lg"
            color="neutral"
            variant="outline"
            icon="i-lucide-github"
            class="mb-4"
            :loading="githubLoading"
            @click="handleGitHub"
          >
            Sign up with GitHub
          </UButton>

          <div class="flex items-center gap-3 my-5">
            <div class="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
            <span class="text-xs text-neutral-400">or</span>
            <div class="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
          </div>

          <form @submit.prevent="handleSubmit">
            <div class="space-y-3">
              <UFormField label="Name">
                <UInput
                  v-model="name"
                  type="text"
                  placeholder="Your name"
                  required
                  autofocus
                  size="lg"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Email">
                <UInput
                  v-model="email"
                  type="email"
                  placeholder="you@company.com"
                  required
                  size="lg"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Password">
                <UInput
                  v-model="password"
                  type="password"
                  placeholder="At least 8 characters"
                  required
                  minlength="8"
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
              :loading="submitLoading"
            >
              Create Account
            </UButton>
          </form>

          <p v-if="errorMessage" class="mt-4 text-sm text-center text-red-600 dark:text-red-400">
            {{ errorMessage }}
          </p>

          <div class="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
            Already have an account?
            <NuxtLink to="/auth/login" class="text-primary hover:underline">Sign in</NuxtLink>
          </div>
        </template>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useColorMode } from '#imports'

const router = useRouter()
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const { signUp, signInWithGitHub, signInWithMicrosoft, resendSignUpConfirmation, isAuthenticated } = useAuth()

const name = ref('')
const email = ref('')
const password = ref('')
const submitLoading = ref(false)
const githubLoading = ref(false)
const microsoftLoading = ref(false)
const errorMessage = ref('')

// Email confirmation state
const confirmationPending = ref(false)
const registeredEmail = ref('')
const resendLoading = ref(false)
const resendCooldown = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

watch(isAuthenticated, (authed) => {
  if (authed) router.replace('/')
}, { immediate: true })

async function handleSubmit() {
  errorMessage.value = ''
  submitLoading.value = true

  try {
    const { data, error } = await signUp(email.value, password.value, name.value)
    if (error) {
      errorMessage.value = error.message
    } else {
      // Check if email confirmation is required (no session returned = needs confirmation)
      if (!data.session) {
        registeredEmail.value = email.value
        confirmationPending.value = true
        startResendCooldown()
      }
      // If a session is returned, autoconfirm is on and the watcher will redirect
    }
  } finally {
    submitLoading.value = false
  }
}

async function handleResend() {
  resendLoading.value = true
  try {
    const { error } = await resendSignUpConfirmation(registeredEmail.value)
    if (error) {
      errorMessage.value = error.message
    } else {
      startResendCooldown()
    }
  } finally {
    resendLoading.value = false
  }
}

function startResendCooldown() {
  resendCooldown.value = 60
  if (cooldownTimer) clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    resendCooldown.value--
    if (resendCooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}

async function handleGitHub() {
  githubLoading.value = true
  errorMessage.value = ''
  const { error } = await signInWithGitHub()
  if (error) {
    errorMessage.value = error.message
    githubLoading.value = false
  }
}

async function handleMicrosoft() {
  microsoftLoading.value = true
  errorMessage.value = ''
  const { error } = await signInWithMicrosoft()
  if (error) {
    errorMessage.value = error.message
    microsoftLoading.value = false
  }
}

onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})
</script>
