<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 px-4 py-10">
      <div class="w-full max-w-lg mx-auto">
        <NuxtLink to="/" class="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 flex items-center gap-1 mb-4">
          <UIcon name="i-lucide-arrow-left" class="text-sm" />
          Back to projects
        </NuxtLink>

        <h1 class="text-2xl font-bold mb-6">Team Settings</h1>

        <div v-if="!isAdmin" class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-700 dark:text-amber-400">
          Only team administrators can modify these settings.
        </div>

        <form v-else @submit.prevent="handleSave" class="space-y-5">
          <UFormField label="Team Name">
            <UInput
              v-model="teamName"
              size="lg"
              :disabled="saving"
            />
          </UFormField>

          <UFormField label="Subdomain">
            <UInput
              :model-value="currentTeam?.slug"
              size="lg"
              disabled
            >
              <template #trailing>
                <span class="text-xs text-neutral-400">.gerbtrace.com</span>
              </template>
            </UInput>
            <template #help>
              <span class="text-xs text-neutral-400">
                Subdomains cannot be changed after creation.
              </span>
            </template>
          </UFormField>

          <UFormField label="Auto-Join Domain" hint="Optional">
            <UInput
              v-model="autoJoinDomain"
              placeholder="e.g. company.com"
              size="lg"
              :disabled="saving"
            />
            <template #help>
              <span class="text-xs text-neutral-400">
                Users with this email domain can automatically join the team.
              </span>
            </template>
          </UFormField>

          <div class="flex justify-end gap-3 pt-4">
            <UButton
              type="submit"
              :loading="saving"
              :disabled="!hasChanges"
            >
              Save Changes
            </UButton>
          </div>
        </form>

        <p v-if="successMessage" class="mt-4 text-sm text-green-600 dark:text-green-400">
          {{ successMessage }}
        </p>
        <p v-if="errorMessage" class="mt-4 text-sm text-red-600 dark:text-red-400">
          {{ errorMessage }}
        </p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const { currentTeam, isAdmin, updateTeam } = useTeam()
const { isAuthenticated } = useAuth()

watch(isAuthenticated, (authed) => {
  if (!authed) router.replace('/auth/login')
}, { immediate: true })

const teamName = ref('')
const autoJoinDomain = ref('')
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Init from current team
watch(currentTeam, (team) => {
  if (team) {
    teamName.value = team.name
    autoJoinDomain.value = team.auto_join_domain ?? ''
  }
}, { immediate: true })

const hasChanges = computed(() => {
  if (!currentTeam.value) return false
  return teamName.value !== currentTeam.value.name
    || autoJoinDomain.value !== (currentTeam.value.auto_join_domain ?? '')
})

async function handleSave() {
  errorMessage.value = ''
  successMessage.value = ''
  saving.value = true

  try {
    const { error } = await updateTeam({
      name: teamName.value.trim(),
      auto_join_domain: autoJoinDomain.value.trim() || null,
    })

    if (error) {
      errorMessage.value = (error as any).message ?? 'Failed to save'
    } else {
      successMessage.value = 'Settings saved!'
      setTimeout(() => { successMessage.value = '' }, 3000)
    }
  } finally {
    saving.value = false
  }
}
</script>
