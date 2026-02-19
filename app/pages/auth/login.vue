<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        <!-- OTP code entry state (after magic link sent) -->
        <template v-if="otpPending">
          <div class="text-center mb-6">
            <div class="flex justify-center mb-4">
              <div class="size-14 rounded-full bg-primary/10 flex items-center justify-center">
                <UIcon name="i-lucide-mail-check" class="size-7 text-primary" />
              </div>
            </div>
            <h1 class="text-2xl font-bold mb-2">Check your email</h1>
            <p class="text-sm text-neutral-500 dark:text-neutral-400">
              We sent a sign-in link and code to
            </p>
            <p class="text-sm font-medium mt-1">{{ email }}</p>
          </div>

          <form @submit.prevent="handleOtpSubmit">
            <UFormField label="Enter the 6-digit code from the email">
              <UInput
                v-model="otpCode"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                placeholder="000000"
                required
                autofocus
                size="lg"
                maxlength="6"
                class="w-full text-center text-xl tracking-[0.5em] font-mono"
              />
            </UFormField>

            <UButton
              type="submit"
              block
              size="lg"
              class="mt-4"
              :loading="otpLoading"
              :disabled="otpCode.length !== 6"
            >
              Verify Code
            </UButton>
          </form>

          <p v-if="errorMessage" class="mt-4 text-sm text-center text-red-600 dark:text-red-400">
            {{ errorMessage }}
          </p>

          <div class="mt-6 flex flex-col items-center gap-2">
            <p class="text-xs text-neutral-400">
              Or click the link in the email to sign in directly.
            </p>
            <button
              class="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              @click="otpPending = false; errorMessage = ''; successMessage = ''"
            >
              Use a different email
            </button>
          </div>
        </template>

        <!-- Normal login form -->
        <template v-else>
          <div class="flex items-center justify-center gap-3 mb-8">
            <img
              :src="isDark ? '/icon-black.png' : '/icon-blue.png'"
              alt="Gerbtrace"
              class="size-8 rounded-lg"
            >
            <h1 class="text-2xl font-bold">Sign in to Gerbtrace</h1>
          </div>

          <!-- GitHub OAuth -->
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
            Continue with GitHub
          </UButton>

          <div class="flex items-center gap-3 my-5">
            <div class="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
            <span class="text-xs text-neutral-400">or</span>
            <div class="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
          </div>

          <!-- Magic link / Email+Password toggle -->
          <div class="flex justify-center gap-1 mb-5">
            <UButton
              size="xs"
              :variant="mode === 'magic' ? 'solid' : 'ghost'"
              color="neutral"
              @click="mode = 'magic'"
            >
              Magic Link
            </UButton>
            <UButton
              size="xs"
              :variant="mode === 'password' ? 'solid' : 'ghost'"
              color="neutral"
              @click="mode = 'password'"
            >
              Email & Password
            </UButton>
          </div>

          <form @submit.prevent="handleSubmit">
            <div class="space-y-3">
              <UFormField label="Email">
                <UInput
                  v-model="email"
                  type="email"
                  placeholder="you@company.com"
                  required
                  autofocus
                  size="lg"
                  class="w-full"
                  @keydown.enter.prevent="mode === 'password' ? handleSubmit() : undefined"
                />
              </UFormField>

              <UFormField v-if="mode === 'password'" label="Password">
                <UInput
                  v-model="password"
                  type="password"
                  placeholder="Your password"
                  required
                  size="lg"
                  class="w-full"
                  @keydown.enter.prevent="handleSubmit"
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
              {{ mode === 'magic' ? 'Send Magic Link' : 'Sign In' }}
            </UButton>
          </form>

          <p v-if="successMessage" class="mt-4 text-sm text-center text-green-600 dark:text-green-400">
            {{ successMessage }}
          </p>

          <p v-if="errorMessage" class="mt-4 text-sm text-center text-red-600 dark:text-red-400">
            {{ errorMessage }}
          </p>

          <div class="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
            Don't have an account?
            <NuxtLink to="/auth/register" class="text-primary hover:underline">Sign up</NuxtLink>
          </div>

          <div v-if="mode === 'password'" class="mt-2 text-center text-xs text-neutral-400">
            <button class="hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors" @click="handleForgot">
              Forgot password?
            </button>
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
const { signIn, signInWithMagicLink, signInWithGitHub, resetPassword, isAuthenticated } = useAuth()
const supabase = useSupabase()

const mode = ref<'magic' | 'password'>('magic')
const email = ref('')
const password = ref('')
const submitLoading = ref(false)
const githubLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// OTP verification state
const otpPending = ref(false)
const otpCode = ref('')
const otpLoading = ref(false)

// Redirect if already logged in
watch(isAuthenticated, (authed) => {
  if (authed) router.replace('/')
}, { immediate: true })

async function handleSubmit() {
  errorMessage.value = ''
  successMessage.value = ''
  submitLoading.value = true

  try {
    if (mode.value === 'magic') {
      const { error } = await signInWithMagicLink(email.value)
      if (error) {
        errorMessage.value = error.message
      } else {
        // Show the OTP code entry screen
        otpCode.value = ''
        otpPending.value = true
      }
    } else {
      const { error } = await signIn(email.value, password.value)
      if (error) {
        // Provide a friendlier message for unconfirmed emails
        if (error.message?.toLowerCase().includes('email not confirmed')) {
          errorMessage.value = 'Your email address has not been confirmed yet. Please check your inbox for the confirmation link, or sign up again to resend it.'
        } else {
          errorMessage.value = error.message
        }
      } else {
        router.replace('/')
      }
    }
  } finally {
    submitLoading.value = false
  }
}

async function handleOtpSubmit() {
  errorMessage.value = ''
  otpLoading.value = true

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.value,
      token: otpCode.value,
      type: 'magiclink',
    })
    if (error) {
      errorMessage.value = error.message
    } else if (data.session) {
      // Success — the onAuthStateChange listener will update state and redirect
      router.replace('/')
    }
  } finally {
    otpLoading.value = false
  }
}

async function handleGitHub() {
  githubLoading.value = true
  errorMessage.value = ''
  const { error } = await signInWithGitHub()
  if (error) {
    errorMessage.value = error.message
    githubLoading.value = false
  }
  // OAuth redirects away; loading stays true
}

async function handleForgot() {
  if (!email.value) {
    errorMessage.value = 'Enter your email address first'
    return
  }
  errorMessage.value = ''
  const { error } = await resetPassword(email.value)
  if (error) {
    errorMessage.value = error.message
  } else {
    successMessage.value = 'Password reset email sent!'
  }
}
</script>
