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

          <div class="space-y-3">
            <div class="text-sm font-medium">Panel Defaults</div>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Preferred Width (mm)" hint="Optional">
                <UInput
                  v-model="preferredPanelWidthInput"
                  type="number"
                  min="50"
                  max="1000"
                  step="1"
                  size="lg"
                  placeholder="300"
                  :disabled="saving"
                />
              </UFormField>
              <UFormField label="Preferred Height (mm)" hint="Optional">
                <UInput
                  v-model="preferredPanelHeightInput"
                  type="number"
                  min="50"
                  max="1000"
                  step="1"
                  size="lg"
                  placeholder="250"
                  :disabled="saving"
                />
              </UFormField>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Maximum Width (mm)" hint="Optional">
                <UInput
                  v-model="maxPanelWidthInput"
                  type="number"
                  min="50"
                  max="1200"
                  step="1"
                  size="lg"
                  placeholder="450"
                  :disabled="saving"
                />
              </UFormField>
              <UFormField label="Maximum Height (mm)" hint="Optional">
                <UInput
                  v-model="maxPanelHeightInput"
                  type="number"
                  min="50"
                  max="1200"
                  step="1"
                  size="lg"
                  placeholder="400"
                  :disabled="saving"
                />
              </UFormField>
            </div>
            <p class="text-xs text-neutral-400">
              Preferred size is the suggestion target. Maximum size is used for panel-size warnings.
            </p>
          </div>

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

        <!-- Elexess API Credentials (admin only) -->
        <form v-if="isAdmin" @submit.prevent="handleSaveElexess" class="space-y-5 mt-8 pt-8 border-t border-neutral-200 dark:border-neutral-800">
          <h2 class="text-lg font-semibold">Elexess API Credentials</h2>
          <p class="text-sm text-neutral-500 dark:text-neutral-400">
            Configure the Elexess API credentials used for BOM pricing and availability lookups.
          </p>

          <UFormField label="Username">
            <UInput
              v-model="elexessUsername"
              size="lg"
              placeholder="Elexess API username"
              :disabled="savingElexess"
            />
          </UFormField>

          <UFormField label="Password">
            <UInput
              v-model="elexessPassword"
              type="password"
              size="lg"
              placeholder="Elexess API password"
              :disabled="savingElexess"
            />
          </UFormField>

          <div class="flex justify-end gap-3 pt-4">
            <UButton
              type="submit"
              :loading="savingElexess"
              :disabled="!hasElexessChanges"
            >
              Save Credentials
            </UButton>
          </div>

          <p v-if="elexessSuccessMessage" class="text-sm text-green-600 dark:text-green-400">
            {{ elexessSuccessMessage }}
          </p>
          <p v-if="elexessErrorMessage" class="text-sm text-red-600 dark:text-red-400">
            {{ elexessErrorMessage }}
          </p>
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
const preferredPanelWidthInput = ref('')
const preferredPanelHeightInput = ref('')
const maxPanelWidthInput = ref('')
const maxPanelHeightInput = ref('')
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Elexess credentials state
const elexessUsername = ref('')
const elexessPassword = ref('')
const savingElexess = ref(false)
const elexessErrorMessage = ref('')
const elexessSuccessMessage = ref('')

// Init from current team
watch(currentTeam, (team) => {
  if (team) {
    teamName.value = team.name
    autoJoinDomain.value = team.auto_join_domain ?? ''
    elexessUsername.value = team.elexess_username ?? ''
    elexessPassword.value = team.elexess_password ?? ''
    preferredPanelWidthInput.value = toInputValue(team.preferred_panel_width_mm)
    preferredPanelHeightInput.value = toInputValue(team.preferred_panel_height_mm)
    maxPanelWidthInput.value = toInputValue(team.max_panel_width_mm)
    maxPanelHeightInput.value = toInputValue(team.max_panel_height_mm)
  }
}, { immediate: true })

const hasChanges = computed(() => {
  if (!currentTeam.value) return false
  const preferredPanelWidth = parseOptionalMm(preferredPanelWidthInput.value)
  const preferredPanelHeight = parseOptionalMm(preferredPanelHeightInput.value)
  const maxPanelWidth = parseOptionalMm(maxPanelWidthInput.value)
  const maxPanelHeight = parseOptionalMm(maxPanelHeightInput.value)
  return teamName.value !== currentTeam.value.name
    || autoJoinDomain.value !== (currentTeam.value.auto_join_domain ?? '')
    || preferredPanelWidth !== currentTeam.value.preferred_panel_width_mm
    || preferredPanelHeight !== currentTeam.value.preferred_panel_height_mm
    || maxPanelWidth !== currentTeam.value.max_panel_width_mm
    || maxPanelHeight !== currentTeam.value.max_panel_height_mm
})

const hasElexessChanges = computed(() => {
  if (!currentTeam.value) return false
  return elexessUsername.value !== (currentTeam.value.elexess_username ?? '')
    || elexessPassword.value !== (currentTeam.value.elexess_password ?? '')
})

async function handleSave() {
  errorMessage.value = ''
  successMessage.value = ''
  saving.value = true

  try {
    const preferredPanelWidth = parseOptionalMm(preferredPanelWidthInput.value)
    const preferredPanelHeight = parseOptionalMm(preferredPanelHeightInput.value)
    const maxPanelWidth = parseOptionalMm(maxPanelWidthInput.value)
    const maxPanelHeight = parseOptionalMm(maxPanelHeightInput.value)

    if (
      preferredPanelWidth != null && maxPanelWidth != null && preferredPanelWidth > maxPanelWidth
      || preferredPanelHeight != null && maxPanelHeight != null && preferredPanelHeight > maxPanelHeight
    ) {
      errorMessage.value = 'Preferred panel size cannot exceed maximum panel size.'
      return
    }

    const { error } = await updateTeam({
      name: teamName.value.trim(),
      auto_join_domain: autoJoinDomain.value.trim() || null,
      preferred_panel_width_mm: preferredPanelWidth,
      preferred_panel_height_mm: preferredPanelHeight,
      max_panel_width_mm: maxPanelWidth,
      max_panel_height_mm: maxPanelHeight,
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

function parseOptionalMm(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return null
  if (n <= 0) return null
  return Math.round(n * 100) / 100
}

function toInputValue(value: number | null | undefined): string {
  if (value == null) return ''
  return String(value)
}

async function handleSaveElexess() {
  elexessErrorMessage.value = ''
  elexessSuccessMessage.value = ''
  savingElexess.value = true

  try {
    const { error } = await updateTeam({
      elexess_username: elexessUsername.value.trim() || null,
      elexess_password: elexessPassword.value.trim() || null,
    })

    if (error) {
      elexessErrorMessage.value = (error as any).message ?? 'Failed to save credentials'
    } else {
      elexessSuccessMessage.value = 'Elexess credentials saved!'
      setTimeout(() => { elexessSuccessMessage.value = '' }, 3000)
    }
  } finally {
    savingElexess.value = false
  }
}
</script>
