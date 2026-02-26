<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 px-4 py-10">
      <div class="w-full max-w-3xl mx-auto">
        <NuxtLink to="/dashboard" class="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 flex items-center gap-1 mb-4">
          <UIcon name="i-lucide-arrow-left" class="text-sm" />
          Back to projects
        </NuxtLink>

        <h1 class="text-2xl font-bold mb-1">Profile</h1>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
          Manage your account and password.
        </p>

        <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5">
          <h2 class="text-sm font-semibold mb-3">Account</h2>
          <div class="grid gap-6 md:grid-cols-[1fr_auto]">
            <div class="space-y-3 text-sm">
              <div>
                <div class="text-neutral-500 dark:text-neutral-400">Email</div>
                <div class="font-medium break-all">{{ profile?.email ?? user?.email ?? '—' }}</div>
              </div>
              <div class="space-y-2 max-w-md">
                <UFormField label="Display name">
                  <UInput v-model="nameValue" placeholder="Your name" class="w-full" />
                </UFormField>
                <p v-if="nameMessage" class="text-xs" :class="nameError ? 'text-red-500' : 'text-green-600 dark:text-green-400'">
                  {{ nameMessage }}
                </p>
                <UButton size="sm" :loading="nameSaving" :disabled="!canSaveName" @click="handleUpdateName">
                  Save Name
                </UButton>
              </div>
            </div>

            <div class="flex flex-col items-center gap-2">
              <UserAvatar :src="profile?.avatar_url" :name="profile?.name ?? profile?.email ?? user?.email ?? ''" class="size-20 text-lg bg-primary/10 text-primary font-semibold border border-neutral-200 dark:border-neutral-800" />
              <UButton v-if="profile?.avatar_url" size="xs" color="error" variant="soft" :loading="avatarRemoving" @click="handleRemoveAvatar">
                Remove
              </UButton>
            </div>
          </div>

          <div class="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
            <h3 class="text-xs font-semibold text-neutral-500">Change Avatar</h3>
            <AvatarCropper @cropped="handleAvatarCropped" @picked="avatarMessage = ''" />
            <p v-if="avatarMessage" class="text-xs" :class="avatarError ? 'text-red-500' : 'text-green-600 dark:text-green-400'">
              {{ avatarMessage }}
            </p>
            <UButton size="sm" :loading="avatarSaving" :disabled="!croppedAvatarBlob" @click="handleAvatarUpload">
              Upload Avatar
            </UButton>
          </div>

          <div v-if="!spacesLoading && spaces.length > 0" class="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-medium text-neutral-500">Spaces</span>
              <UBadge v-for="space in spaces" :key="space.id" color="primary" variant="subtle">
                {{ space.name }}
              </UBadge>
            </div>
          </div>
        </div>

        <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5 mt-4">
          <h2 class="text-sm font-semibold mb-3">Change Password</h2>
          <form class="space-y-3 max-w-md" @submit.prevent="handleUpdatePassword">
            <UFormField label="Current password">
              <UInput
                v-model="currentPassword"
                type="password"
                placeholder="Enter your current password"
                class="w-full"
                required
                autofocus
              />
            </UFormField>
            <UFormField label="New password">
              <UInput
                v-model="newPassword"
                type="password"
                placeholder="At least 8 characters"
                class="w-full"
                required
              />
            </UFormField>
            <UFormField label="Confirm password">
              <UInput
                v-model="confirmPassword"
                type="password"
                placeholder="Repeat your new password"
                class="w-full"
                required
              />
            </UFormField>
            <p v-if="passwordMismatch" class="text-xs text-amber-600 dark:text-amber-400">
              Passwords do not match.
            </p>
            <p v-if="passwordError" class="text-xs text-red-500">{{ passwordError }}</p>
            <p v-if="passwordSuccess" class="text-xs text-green-600 dark:text-green-400">{{ passwordSuccess }}</p>
            <div class="pt-2">
              <UButton
                type="submit"
                size="sm"
                :loading="passwordSaving"
                :disabled="!currentPassword || !newPassword || newPassword.length < 8 || newPassword !== confirmPassword"
              >
                Update Password
              </UButton>
            </div>
          </form>
        </div>

        <!-- MFA / Two-Factor Authentication -->
        <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5 mt-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold">Two-Factor Authentication</h2>
            <UBadge v-if="mfaFactors.length > 0" color="success" variant="subtle" size="xs">
              Enabled
            </UBadge>
          </div>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
            Add an extra layer of security with a TOTP authenticator app.
          </p>

          <p v-if="mfaError" class="text-xs text-red-500 mb-3">{{ mfaError }}</p>
          <p v-if="mfaSuccess" class="text-xs text-green-600 dark:text-green-400 mb-3">{{ mfaSuccess }}</p>

          <!-- Enrolled factors -->
          <div v-if="mfaFactors.length > 0 && !mfaEnrolling" class="space-y-3">
            <div v-for="factor in mfaFactors" :key="factor.id" class="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-shield-check" class="text-green-500" />
                <span class="text-sm">Authenticator App</span>
              </div>
              <UButton
                v-if="mfaUnenrollFactorId !== factor.id"
                size="xs"
                color="error"
                variant="soft"
                @click="mfaUnenrollFactorId = factor.id; mfaUnenrollCode = ''; mfaError = ''"
              >
                Remove
              </UButton>
            </div>

            <div v-if="mfaUnenrollFactorId" class="space-y-2 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <p class="text-xs font-medium">Enter your 6-digit code to confirm removal:</p>
              <UInput
                v-model="mfaUnenrollCode"
                type="text"
                inputmode="numeric"
                placeholder="000000"
                maxlength="6"
                class="text-center tracking-[0.3em] font-mono"
              />
              <div class="flex gap-2">
                <UButton
                  size="xs"
                  color="error"
                  :loading="mfaUnenrollLoading"
                  :disabled="mfaUnenrollCode.length !== 6"
                  @click="handleMfaUnenroll"
                >
                  Confirm Removal
                </UButton>
                <UButton size="xs" variant="ghost" @click="mfaUnenrollFactorId = null">
                  Cancel
                </UButton>
              </div>
            </div>
          </div>

          <!-- Enrollment flow -->
          <div v-if="mfaEnrolling" class="space-y-3">
            <p class="text-xs">Scan this QR code with your authenticator app:</p>
            <div class="flex justify-center">
              <img :src="mfaQrCode" alt="TOTP QR Code" class="w-40 h-40 rounded-lg border border-neutral-200 dark:border-neutral-800">
            </div>
            <div class="text-center">
              <p class="text-xs text-neutral-500 mb-1">Or enter this secret manually:</p>
              <code class="text-xs bg-neutral-100 dark:bg-neutral-900 px-2 py-1 rounded select-all">{{ mfaTotpSecret }}</code>
            </div>
            <UFormField label="Enter the 6-digit code from your app">
              <UInput
                v-model="mfaVerifyCode"
                type="text"
                inputmode="numeric"
                placeholder="000000"
                maxlength="6"
                class="text-center tracking-[0.3em] font-mono"
              />
            </UFormField>
            <div class="flex gap-2">
              <UButton
                size="xs"
                :loading="mfaVerifyLoading"
                :disabled="mfaVerifyCode.length !== 6"
                @click="handleMfaVerifyEnrollment"
              >
                Verify & Enable
              </UButton>
              <UButton
                size="xs"
                variant="ghost"
                @click="mfaEnrolling = false; mfaQrCode = ''; mfaTotpSecret = ''; mfaVerifyCode = ''"
              >
                Cancel
              </UButton>
            </div>
          </div>

          <!-- Enable button -->
          <UButton v-if="mfaFactors.length === 0 && !mfaEnrolling" size="sm" @click="handleMfaStartEnroll">
            Set up two-factor authentication
          </UButton>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const supabase = useSupabase()
const { isAuthenticated, user, signIn, updatePassword } = useAuth()
const { profile, updateProfile } = useCurrentUser()
const { uploadAvatar } = useAvatarUpload()
const { spaces, spacesLoading, fetchSpaces } = useSpaces()

watch(isAuthenticated, (authed) => {
  if (!authed) router.replace('/auth/login')
}, { immediate: true })

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordSaving = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')
const nameValue = ref('')
const nameSaving = ref(false)
const nameMessage = ref('')
const nameError = ref(false)
const avatarSaving = ref(false)
const avatarRemoving = ref(false)
const avatarMessage = ref('')
const avatarError = ref(false)
const croppedAvatarBlob = ref<Blob | null>(null)


const canSaveName = computed(() => {
  const next = nameValue.value.trim()
  if (!next) return false
  return next !== (profile.value?.name ?? '').trim()
})

const passwordMismatch = computed(() =>
  confirmPassword.value.length > 0 && newPassword.value !== confirmPassword.value,
)

async function handleUpdatePassword() {
  if (!currentPassword.value) {
    passwordError.value = 'Current password is required.'
    return
  }
  if (newPassword.value.length < 8) {
    passwordError.value = 'Password must be at least 8 characters.'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    return
  }

  passwordSaving.value = true
  passwordError.value = ''
  passwordSuccess.value = ''
  try {
    const email = profile.value?.email ?? user.value?.email
    if (!email) {
      passwordError.value = 'Could not determine your account email.'
      return
    }

    const { error: verifyError } = await signIn(email, currentPassword.value)
    if (verifyError) {
      passwordError.value = 'Current password is incorrect.'
      return
    }

    const { error } = await updatePassword(newPassword.value)
    if (error) {
      passwordError.value = error.message
      return
    }
    passwordSuccess.value = 'Password updated successfully.'
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } finally {
    passwordSaving.value = false
  }
}

async function handleUpdateName() {
  const trimmed = nameValue.value.trim()
  if (!trimmed) return
  nameSaving.value = true
  nameMessage.value = ''
  nameError.value = false
  try {
    const { error } = await updateProfile({ name: trimmed })
    if (error) {
      nameMessage.value = error.message
      nameError.value = true
      return
    }
    nameMessage.value = 'Name updated.'
  } finally {
    nameSaving.value = false
  }
}

function handleAvatarCropped(blob: Blob) {
  croppedAvatarBlob.value = blob
  avatarMessage.value = 'Image ready. Click "Upload Avatar" to save.'
  avatarError.value = false
}

async function handleAvatarUpload() {
  if (!croppedAvatarBlob.value) return
  avatarSaving.value = true
  avatarMessage.value = ''
  avatarError.value = false
  try {
    const { error } = await uploadAvatar(croppedAvatarBlob.value)
    if (error) {
      avatarMessage.value = error.message
      avatarError.value = true
      return
    }
    avatarMessage.value = 'Avatar updated.'
    croppedAvatarBlob.value = null
  } finally {
    avatarSaving.value = false
  }
}

async function handleRemoveAvatar() {
  avatarRemoving.value = true
  avatarMessage.value = ''
  avatarError.value = false
  try {
    const { error } = await updateProfile({ avatar_url: null })
    if (error) {
      avatarMessage.value = error.message
      avatarError.value = true
      return
    }
    avatarMessage.value = 'Avatar removed.'
    croppedAvatarBlob.value = null
  } finally {
    avatarRemoving.value = false
  }
}

// MFA state
type TotpFactor = { id: string; friendly_name?: string; status: string }
const mfaFactors = ref<TotpFactor[]>([])
const mfaEnrolling = ref(false)
const mfaQrCode = ref('')
const mfaTotpSecret = ref('')
const mfaNewFactorId = ref('')
const mfaVerifyCode = ref('')
const mfaVerifyLoading = ref(false)
const mfaUnenrollFactorId = ref<string | null>(null)
const mfaUnenrollCode = ref('')
const mfaUnenrollLoading = ref(false)
const mfaError = ref('')
const mfaSuccess = ref('')

async function loadMfaFactors() {
  mfaError.value = ''
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) {
    mfaError.value = error.message
    return
  }
  mfaFactors.value = (data?.totp ?? []) as TotpFactor[]
}

async function handleMfaStartEnroll() {
  mfaError.value = ''
  mfaSuccess.value = ''
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (error) { mfaError.value = error.message; return }
  mfaEnrolling.value = true
  mfaQrCode.value = data.totp.qr_code
  mfaTotpSecret.value = data.totp.secret
  mfaNewFactorId.value = data.id
}

async function handleMfaVerifyEnrollment() {
  if (mfaVerifyCode.value.length !== 6) return
  mfaError.value = ''
  mfaSuccess.value = ''
  mfaVerifyLoading.value = true
  try {
    const { data: cd, error: ce } = await supabase.auth.mfa.challenge({ factorId: mfaNewFactorId.value })
    if (ce) { mfaError.value = ce.message; return }
    const { error: ve } = await supabase.auth.mfa.verify({ factorId: mfaNewFactorId.value, challengeId: cd.id, code: mfaVerifyCode.value })
    if (ve) { mfaError.value = ve.message; mfaVerifyCode.value = ''; return }
    mfaEnrolling.value = false; mfaQrCode.value = ''; mfaTotpSecret.value = ''; mfaVerifyCode.value = ''
    mfaSuccess.value = 'Two-factor authentication enabled.'
    await loadMfaFactors()
  } finally { mfaVerifyLoading.value = false }
}

async function handleMfaUnenroll() {
  if (!mfaUnenrollFactorId.value || mfaUnenrollCode.value.length !== 6) return
  mfaError.value = ''
  mfaSuccess.value = ''
  mfaUnenrollLoading.value = true
  try {
    const { data: cd, error: ce } = await supabase.auth.mfa.challenge({ factorId: mfaUnenrollFactorId.value })
    if (ce) { mfaError.value = ce.message; return }
    const { error: ve } = await supabase.auth.mfa.verify({ factorId: mfaUnenrollFactorId.value, challengeId: cd.id, code: mfaUnenrollCode.value })
    if (ve) { mfaError.value = ve.message; mfaUnenrollCode.value = ''; return }
    const { error: ue } = await supabase.auth.mfa.unenroll({ factorId: mfaUnenrollFactorId.value })
    if (ue) { mfaError.value = ue.message; return }
    mfaUnenrollFactorId.value = null; mfaUnenrollCode.value = ''
    mfaSuccess.value = 'Two-factor authentication disabled.'
    await loadMfaFactors()
  } finally { mfaUnenrollLoading.value = false }
}

watch(() => profile.value?.name, (next) => {
  nameValue.value = next ?? ''
}, { immediate: true })

onMounted(() => {
  fetchSpaces({ background: true })
  loadMfaFactors()
})
</script>
