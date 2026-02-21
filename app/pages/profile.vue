<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 px-4 py-10">
      <div class="w-full max-w-2xl mx-auto">
        <NuxtLink to="/" class="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 flex items-center gap-1 mb-4">
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
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
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

watch(() => profile.value?.name, (next) => {
  nameValue.value = next ?? ''
}, { immediate: true })

onMounted(() => {
  fetchSpaces({ background: true })
})
</script>
