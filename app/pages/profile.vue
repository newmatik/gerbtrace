<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 px-4 py-10">
      <div class="w-full max-w-2xl mx-auto">
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
          <div class="grid gap-4 md:grid-cols-[1fr_auto]">
            <div class="space-y-3 text-sm">
              <div>
                <div class="text-neutral-500 dark:text-neutral-400">Email</div>
                <div class="font-medium break-all">{{ profile?.email ?? user?.email ?? '—' }}</div>
              </div>
              <div class="space-y-2">
                <UFormField label="Display name">
                  <UInput v-model="nameValue" placeholder="Your name" />
                </UFormField>
                <p v-if="nameMessage" class="text-xs" :class="nameError ? 'text-red-500' : 'text-green-600 dark:text-green-400'">
                  {{ nameMessage }}
                </p>
                <UButton size="sm" :loading="nameSaving" :disabled="!canSaveName" @click="handleUpdateName">
                  Save Name
                </UButton>
              </div>
            </div>
            <div class="space-y-2">
              <div class="text-xs text-neutral-500">Avatar</div>
              <img
                v-if="profile?.avatar_url"
                :src="profile.avatar_url"
                alt="Avatar"
                class="size-20 rounded-full object-cover border border-neutral-200 dark:border-neutral-800"
              >
              <div v-else class="size-20 rounded-full bg-primary/10 flex items-center justify-center text-lg font-semibold text-primary">
                {{ userInitials }}
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5 mt-4 space-y-3">
          <h2 class="text-sm font-semibold">Avatar</h2>
          <AvatarCropper @cropped="handleAvatarCropped" />
          <p v-if="avatarMessage" class="text-xs" :class="avatarError ? 'text-red-500' : 'text-green-600 dark:text-green-400'">
            {{ avatarMessage }}
          </p>
          <UButton size="sm" :loading="avatarSaving" :disabled="!croppedAvatarBlob" @click="handleAvatarUpload">
            Upload Avatar
          </UButton>
        </div>

        <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5 mt-4 space-y-3">
          <h2 class="text-sm font-semibold">Spaces You Can Access</h2>
          <div v-if="spacesLoading" class="text-sm text-neutral-500">Loading spaces...</div>
          <div v-else-if="spaces.length === 0" class="text-sm text-neutral-500">No accessible spaces.</div>
          <div v-else class="flex flex-wrap gap-2">
            <UBadge v-for="space in spaces" :key="space.id" color="primary" variant="subtle">
              {{ space.name }}
            </UBadge>
          </div>
        </div>

        <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5 mt-4">
          <h2 class="text-sm font-semibold mb-3">Change Password</h2>
          <form class="space-y-3" @submit.prevent="handleUpdatePassword">
            <UFormField label="Current password">
              <UInput
                v-model="currentPassword"
                type="password"
                placeholder="Enter your current password"
                required
                autofocus
              />
            </UFormField>
            <UFormField label="New password">
              <UInput
                v-model="newPassword"
                type="password"
                placeholder="At least 8 characters"
                required
              />
            </UFormField>
            <UFormField label="Confirm password">
              <UInput
                v-model="confirmPassword"
                type="password"
                placeholder="Repeat your new password"
                required
              />
            </UFormField>
            <p v-if="passwordMismatch" class="text-xs text-amber-600 dark:text-amber-400">
              Passwords do not match.
            </p>
            <p v-if="passwordError" class="text-xs text-red-500">{{ passwordError }}</p>
            <p v-if="passwordSuccess" class="text-xs text-green-600 dark:text-green-400">{{ passwordSuccess }}</p>
            <div class="flex justify-end pt-2">
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

        <!-- Data Export -->
        <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5 mt-4">
          <h2 class="text-sm font-semibold mb-2">Your Data</h2>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
            Download a copy of your personal data in JSON format (Art. 20 GDPR).
          </p>
          <UButton size="sm" variant="outline" :loading="exportLoading" @click="handleExportData">
            Export My Data
          </UButton>
          <p v-if="exportError" class="mt-2 text-xs text-red-500">{{ exportError }}</p>
        </div>

        <!-- Danger Zone -->
        <div class="rounded-lg border border-red-300 dark:border-red-800 p-5 mt-4">
          <h2 class="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">Danger Zone</h2>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
            Permanently delete your account, all your personal data, and remove yourself from all teams. This action cannot be undone.
          </p>
          <UButton size="sm" color="error" variant="soft" @click="showDeleteModal = true">
            Delete My Account
          </UButton>
        </div>

        <!-- Delete Account Confirmation Modal -->
        <UModal v-model:open="showDeleteModal">
          <template #content>
            <div class="p-6">
              <h3 class="text-lg font-semibold text-red-600 dark:text-red-400 mb-3">Delete Account</h3>
              <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                This will permanently delete your account and all associated data. Active subscriptions will be cancelled. This cannot be undone.
              </p>
              <p class="text-sm font-medium mb-2">
                Type your email address to confirm:
              </p>
              <UInput
                v-model="deleteConfirmEmail"
                type="email"
                :placeholder="profile?.email ?? user?.email ?? ''"
                class="mb-4"
              />
              <p v-if="deleteError" class="text-xs text-red-500 mb-3">{{ deleteError }}</p>
              <div class="flex justify-end gap-2">
                <UButton variant="ghost" color="neutral" @click="showDeleteModal = false; deleteConfirmEmail = ''">
                  Cancel
                </UButton>
                <UButton
                  color="error"
                  :loading="accountDeleting"
                  :disabled="deleteConfirmEmail !== (profile?.email ?? user?.email ?? '')"
                  @click="handleDeleteAccount"
                >
                  Permanently Delete
                </UButton>
              </div>
            </div>
          </template>
        </UModal>
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
const { deleteAccount, deleting: accountDeleting, error: deleteAccountError } = useAccountDeletion()

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
const avatarMessage = ref('')
const avatarError = ref(false)
const croppedAvatarBlob = ref<Blob | null>(null)

const userInitials = computed(() => {
  const name = profile.value?.name ?? profile.value?.email ?? user.value?.email ?? ''
  return name.split(' ').map(part => part[0]).join('').toUpperCase().slice(0, 2) || '?'
})

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
  avatarMessage.value = ''
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

// Data export
const exportLoading = ref(false)
const exportError = ref('')

async function handleExportData() {
  exportLoading.value = true
  exportError.value = ''
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { exportError.value = 'Session expired.'; return }

    const res = await fetch('/api/account/export', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) { exportError.value = 'Export failed. Please try again.'; return }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'gerbtrace-export.json'
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    exportError.value = 'Export failed. Please try again.'
  } finally {
    exportLoading.value = false
  }
}

// Account deletion
const showDeleteModal = ref(false)
const deleteConfirmEmail = ref('')
const deleteError = ref('')

async function handleDeleteAccount() {
  deleteError.value = ''
  const success = await deleteAccount()
  if (success) {
    showDeleteModal.value = false
    router.replace('/')
  } else {
    deleteError.value = deleteAccountError.value || 'Failed to delete account.'
  }
}

watch(() => profile.value?.name, (next) => {
  nameValue.value = next ?? ''
}, { immediate: true })

onMounted(() => {
  fetchSpaces({ background: true })
  loadMfaFactors()
})
</script>
