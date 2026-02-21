<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 px-4 py-10">
      <div class="w-full max-w-4xl mx-auto">
        <NuxtLink to="/" class="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 flex items-center gap-1 mb-4">
          <UIcon name="i-lucide-arrow-left" class="text-sm" />
          Back to projects
        </NuxtLink>

        <h1 class="text-2xl font-bold mb-6">Team</h1>

        <div class="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside>
            <div class="text-xs font-semibold tracking-wide uppercase text-neutral-400 mb-3">
              Team
            </div>
            <nav class="space-y-1">
              <NuxtLink
                v-for="item in navItems"
                :key="item.label"
                :to="item.to"
                class="flex items-center gap-2 rounded-md px-3 py-2 text-sm border transition-colors"
                :class="isActive(item)
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-transparent text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'"
              >
                <UIcon :name="item.icon" class="text-sm" />
                {{ item.label }}
              </NuxtLink>
            </nav>
          </aside>

          <section>
            <div v-if="!isAdmin" class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-700 dark:text-amber-400 mb-5">
              Only team administrators can modify these settings.
            </div>

            <form v-if="activeSection === 'general'" @submit.prevent="handleSave" class="space-y-5">
              <h2 class="text-lg font-semibold">General</h2>
              <UFormField label="Team Name">
                <UInput
                  v-model="teamName"
                  size="lg"
                  maxlength="15"
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

              <p v-if="successMessage" class="text-sm text-green-600 dark:text-green-400">
                {{ successMessage }}
              </p>
              <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400">
                {{ errorMessage }}
              </p>
            </form>

            <form v-else-if="activeSection === 'defaults'" @submit.prevent="handleSaveDefaults" class="space-y-5">
              <h2 class="text-lg font-semibold">Defaults</h2>
              <UFormField label="Default Currency">
                <USelect
                  v-model="defaultCurrency"
                  :items="currencyOptions"
                  size="lg"
                  :disabled="savingDefaults"
                />
                <template #help>
                  <span class="text-xs text-neutral-400">
                    BOM prices are converted and displayed in this currency.
                  </span>
                </template>
              </UFormField>

              <UFormField label="Clock Format">
                <USelect
                  v-model="timeFormat"
                  :items="timeFormatOptions"
                  size="lg"
                  :disabled="savingDefaults"
                />
                <template #help>
                  <span class="text-xs text-neutral-400">
                    Controls whether dates show as 24-hour or 12-hour (AM/PM) time.
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
                      :disabled="savingDefaults"
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
                      :disabled="savingDefaults"
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
                      :disabled="savingDefaults"
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
                      :disabled="savingDefaults"
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
                  :loading="savingDefaults"
                  :disabled="!hasDefaultsChanges"
                >
                  Save Defaults
                </UButton>
              </div>

              <p v-if="defaultsSuccessMessage" class="text-sm text-green-600 dark:text-green-400">
                {{ defaultsSuccessMessage }}
              </p>
              <p v-if="defaultsErrorMessage" class="text-sm text-red-600 dark:text-red-400">
                {{ defaultsErrorMessage }}
              </p>
            </form>

            <div v-else-if="activeSection === 'integrations'" class="space-y-3">
              <h2 class="text-lg font-semibold">Integrations</h2>
              <!-- Elexess -->
              <form
                @submit.prevent="handleSaveElexess"
                class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-3"
              >
                <div class="flex items-center justify-between gap-4">
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-plug-zap" class="text-lg text-sky-500" />
                    <h2 class="text-lg font-semibold">Elexess</h2>
                  </div>
                  <label class="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                    <span class="text-xs font-medium text-neutral-500 dark:text-neutral-400">Enable</span>
                    <USwitch
                      :model-value="elexessEnabled"
                      @update:model-value="elexessEnabled = $event"
                    />
                  </label>
                </div>
                <p class="text-sm text-neutral-500 dark:text-neutral-400">
                  Enable Elexess to fetch BOM pricing and availability using your team credentials.
                </p>

                <template v-if="elexessEnabled">
                  <div class="grid gap-3 md:grid-cols-3">
                    <UFormField label="Username">
                      <UInput
                        v-model="elexessUsername"
                        size="md"
                        placeholder="Elexess API username"
                        :disabled="savingElexess"
                      />
                    </UFormField>

                    <UFormField label="Password">
                      <UInput
                        v-model="elexessPassword"
                        type="password"
                        size="md"
                        placeholder="Elexess API password"
                        :disabled="savingElexess"
                      />
                    </UFormField>

                    <div class="flex flex-col justify-end">
                      <UButton
                        type="button"
                        size="sm"
                        color="neutral"
                        variant="outline"
                        :loading="validatingElexess"
                        :disabled="!elexessUsername || !elexessPassword || savingElexess"
                        @click.prevent="validateElexessCredentials"
                      >
                        Test Connection
                      </UButton>
                      <span v-if="elexessValidationResult === 'valid'" class="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <UIcon name="i-lucide-check-circle" class="text-xs" />
                        Connected
                      </span>
                      <span v-else-if="elexessValidationResult === 'invalid'" class="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <UIcon name="i-lucide-x-circle" class="text-xs" />
                        {{ elexessValidationError || 'Connection failed' }}
                      </span>
                    </div>
                  </div>
                </template>

                <div class="flex justify-end">
                  <UButton
                    type="submit"
                    :loading="savingElexess"
                    :disabled="!hasElexessChanges"
                  >
                    Save Settings
                  </UButton>
                </div>

                <p v-if="elexessSuccessMessage" class="text-sm text-green-600 dark:text-green-400">
                  {{ elexessSuccessMessage }}
                </p>
                <p v-if="elexessErrorMessage" class="text-sm text-red-600 dark:text-red-400">
                  {{ elexessErrorMessage }}
                </p>
              </form>

              <!-- Spark AI -->
              <form
                @submit.prevent="handleSaveSpark"
                class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-3"
              >
                <div class="flex items-center justify-between gap-4">
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-sparkles" class="text-lg text-violet-500" />
                    <h2 class="text-lg font-semibold">Spark</h2>
                    <UBadge size="xs" variant="subtle" color="secondary">AI</UBadge>
                  </div>
                  <label class="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                    <span class="text-xs font-medium text-neutral-500 dark:text-neutral-400">Enable</span>
                    <USwitch
                      :model-value="sparkEnabled"
                      @update:model-value="sparkEnabled = $event"
                    />
                  </label>
                </div>
                <p class="text-sm text-neutral-500 dark:text-neutral-400">
                  Enable Spark to enrich BOM lines with AI-generated descriptions and component metadata.
                </p>

                <template v-if="sparkEnabled">
                  <div class="grid gap-3 md:grid-cols-2">
                    <UFormField label="Anthropic API Key">
                      <UInput
                        v-model="sparkApiKey"
                        type="password"
                        size="md"
                        placeholder="sk-ant-..."
                        :disabled="savingSpark"
                      />
                      <template #help>
                        <span class="text-xs text-neutral-400">
                          Get your API key from
                          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" class="underline hover:text-neutral-600 dark:hover:text-neutral-300">console.anthropic.com</a>
                        </span>
                      </template>
                    </UFormField>

                    <div class="flex flex-col justify-end">
                      <UButton
                        type="button"
                        size="sm"
                        color="neutral"
                        variant="outline"
                        :loading="validatingKey"
                        :disabled="!sparkApiKey || savingSpark"
                        @click.prevent="validateApiKey"
                      >
                        Test Connection
                      </UButton>
                      <span v-if="keyValidationResult === 'valid'" class="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <UIcon name="i-lucide-check-circle" class="text-xs" />
                        Connected
                      </span>
                      <span v-else-if="keyValidationResult === 'invalid'" class="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                        <UIcon name="i-lucide-x-circle" class="text-xs" />
                        {{ keyValidationError || 'Connection failed' }}
                      </span>
                    </div>
                  </div>

                  <UFormField v-if="keyValidationResult === 'valid' && sparkModelOptions.length > 0" label="Model">
                    <USelectMenu
                      v-model="sparkModel"
                      :items="sparkModelOptions"
                      value-key="value"
                      label-key="label"
                      size="lg"
                      :disabled="savingSpark"
                      placeholder="Select a model"
                      class="w-full"
                    />
                    <template #help>
                      <span class="text-xs text-neutral-400">
                        Sonnet is recommended for best quality. Haiku is faster and cheaper.
                      </span>
                    </template>
                  </UFormField>
                  <p v-else-if="keyValidationResult === 'valid' && sparkModelOptions.length === 0" class="text-sm text-neutral-500 dark:text-neutral-400">
                    Click "Test Connection" to load available models.
                  </p>
                </template>

                <div class="flex justify-end">
                  <UButton
                    type="submit"
                    :loading="savingSpark"
                    :disabled="!hasSparkChanges"
                  >
                    Save Settings
                  </UButton>
                </div>

                <p v-if="sparkSuccessMessage" class="text-sm text-green-600 dark:text-green-400">
                  {{ sparkSuccessMessage }}
                </p>
                <p v-if="sparkErrorMessage" class="text-sm text-red-600 dark:text-red-400">
                  {{ sparkErrorMessage }}
                </p>
              </form>
            </div>

            <div v-else class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5">
              <h2 class="text-lg font-semibold mb-2">Team Members</h2>
              <p class="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                Manage invitations, roles, and access control.
              </p>
              <UButton to="/team/members" icon="i-lucide-users">
                Open Team Members
              </UButton>
            </div>
          </section>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const route = useRoute()
const { currentTeam, currentTeamRole, isAdmin, updateTeam } = useTeam()
const { isAuthenticated } = useAuth()

watch(isAuthenticated, (authed) => {
  if (!authed) router.replace('/auth/login')
}, { immediate: true })

watch(currentTeamRole, (role) => {
  if (role === 'guest') router.replace('/')
}, { immediate: true })

const navItems = [
  { label: 'Spaces', icon: 'i-lucide-folders', to: '/team/spaces' },
  { label: 'General', icon: 'i-lucide-settings-2', to: '/team/settings' },
  { label: 'Defaults', icon: 'i-lucide-sliders-horizontal', to: '/team/settings?section=defaults' },
  { label: 'Integrations', icon: 'i-lucide-plug-zap', to: '/team/settings?section=integrations' },
  { label: 'Members', icon: 'i-lucide-users', to: '/team/members' },
]

type SettingsSection = 'general' | 'defaults' | 'integrations'
const activeSection = computed<SettingsSection>(() => {
  const section = route.query.section
  const value = Array.isArray(section) ? section[0] : section
  if (value === 'defaults' || value === 'integrations') return value
  return 'general'
})

function isActive(item: { to: string }) {
  if (item.to === '/team/spaces') return route.path === '/team/spaces'
  if (item.to === '/team/members') return route.path === '/team/members'
  if (item.to.includes('section=defaults')) return route.path === '/team/settings' && activeSection.value === 'defaults'
  if (item.to.includes('section=integrations')) return route.path === '/team/settings' && activeSection.value === 'integrations'
  return route.path === '/team/settings' && activeSection.value === 'general'
}

const teamName = ref('')
const autoJoinDomain = ref('')
const defaultCurrency = ref<'USD' | 'EUR'>('EUR')
const timeFormat = ref<'24h' | '12h'>('24h')
const preferredPanelWidthInput = ref<string | number>('')
const preferredPanelHeightInput = ref<string | number>('')
const maxPanelWidthInput = ref<string | number>('')
const maxPanelHeightInput = ref<string | number>('')
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Defaults tab state
const savingDefaults = ref(false)
const defaultsErrorMessage = ref('')
const defaultsSuccessMessage = ref('')

// Elexess credentials state
const elexessEnabled = ref(false)
const elexessUsername = ref('')
const elexessPassword = ref('')
const savingElexess = ref(false)
const elexessErrorMessage = ref('')
const elexessSuccessMessage = ref('')
const validatingElexess = ref(false)
const elexessValidationResult = ref<'valid' | 'invalid' | null>(null)
const elexessValidationError = ref('')

// Spark AI state
const sparkEnabled = ref(false)
const sparkApiKey = ref('')
const sparkModel = ref('')
const savingSpark = ref(false)
const sparkErrorMessage = ref('')
const sparkSuccessMessage = ref('')
const validatingKey = ref(false)
const keyValidationResult = ref<'valid' | 'invalid' | null>(null)
const keyValidationError = ref('')

const currencyOptions = [
  { label: 'EUR', value: 'EUR' as const },
  { label: 'USD', value: 'USD' as const },
]

const timeFormatOptions = [
  { label: '24-hour (13:25)', value: '24h' as const },
  { label: '12-hour (01:25 PM)', value: '12h' as const },
]

const sparkModelOptions = ref<Array<{ label: string, value: string }>>([])

// Init from current team
watch(currentTeam, (team) => {
  if (team) {
    teamName.value = team.name
    autoJoinDomain.value = team.auto_join_domain ?? ''
    defaultCurrency.value = team.default_currency ?? 'EUR'
    timeFormat.value = team.time_format ?? '24h'
    elexessEnabled.value = team.elexess_enabled ?? !!(team.elexess_username && team.elexess_password)
    elexessUsername.value = team.elexess_username ?? ''
    elexessPassword.value = team.elexess_password ?? ''
    preferredPanelWidthInput.value = toInputValue(team.preferred_panel_width_mm)
    preferredPanelHeightInput.value = toInputValue(team.preferred_panel_height_mm)
    maxPanelWidthInput.value = toInputValue(team.max_panel_width_mm)
    maxPanelHeightInput.value = toInputValue(team.max_panel_height_mm)
    sparkEnabled.value = team.ai_enabled
    sparkApiKey.value = team.ai_api_key ?? ''
    sparkModel.value = team.ai_model || ''
    if (team.ai_api_key) {
      keyValidationResult.value = 'valid'
      if (sparkModel.value) {
        sparkModelOptions.value = [{ label: sparkModel.value, value: sparkModel.value }]
      } else {
        sparkModelOptions.value = []
      }
    }
  }
}, { immediate: true })

watch([elexessUsername, elexessPassword], () => {
  elexessValidationResult.value = null
  elexessValidationError.value = ''
})

watch(sparkApiKey, () => {
  keyValidationResult.value = null
  keyValidationError.value = ''
})

const hasChanges = computed(() => {
  if (!currentTeam.value) return false
  return teamName.value !== currentTeam.value.name
    || autoJoinDomain.value !== (currentTeam.value.auto_join_domain ?? '')
})

const hasDefaultsChanges = computed(() => {
  if (!currentTeam.value) return false
  const preferredPanelWidth = parseOptionalMm(preferredPanelWidthInput.value)
  const preferredPanelHeight = parseOptionalMm(preferredPanelHeightInput.value)
  const maxPanelWidth = parseOptionalMm(maxPanelWidthInput.value)
  const maxPanelHeight = parseOptionalMm(maxPanelHeightInput.value)
  return defaultCurrency.value !== (currentTeam.value.default_currency ?? 'EUR')
    || timeFormat.value !== (currentTeam.value.time_format ?? '24h')
    || preferredPanelWidth !== currentTeam.value.preferred_panel_width_mm
    || preferredPanelHeight !== currentTeam.value.preferred_panel_height_mm
    || maxPanelWidth !== currentTeam.value.max_panel_width_mm
    || maxPanelHeight !== currentTeam.value.max_panel_height_mm
})

const hasElexessChanges = computed(() => {
  if (!currentTeam.value) return false
  const currentEnabled = currentTeam.value.elexess_enabled ?? !!(currentTeam.value.elexess_username && currentTeam.value.elexess_password)
  return elexessEnabled.value !== currentEnabled
    || elexessUsername.value !== (currentTeam.value.elexess_username ?? '')
    || elexessPassword.value !== (currentTeam.value.elexess_password ?? '')
})

const hasSparkChanges = computed(() => {
  if (!currentTeam.value) return false
  return sparkEnabled.value !== currentTeam.value.ai_enabled
    || sparkApiKey.value !== (currentTeam.value.ai_api_key ?? '')
    || sparkModel.value !== (currentTeam.value.ai_model ?? '')
})

async function handleSave() {
  errorMessage.value = ''
  successMessage.value = ''
  saving.value = true

  try {
    if (teamName.value.trim().length === 0) {
      errorMessage.value = 'Team name is required'
      return
    }
    if (teamName.value.trim().length > 15) {
      errorMessage.value = 'Team name must be 15 characters or fewer'
      return
    }
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

async function handleSaveDefaults() {
  defaultsErrorMessage.value = ''
  defaultsSuccessMessage.value = ''
  savingDefaults.value = true

  try {
    const preferredPanelWidth = parseOptionalMm(preferredPanelWidthInput.value)
    const preferredPanelHeight = parseOptionalMm(preferredPanelHeightInput.value)
    const maxPanelWidth = parseOptionalMm(maxPanelWidthInput.value)
    const maxPanelHeight = parseOptionalMm(maxPanelHeightInput.value)

    if (
      preferredPanelWidth != null && maxPanelWidth != null && preferredPanelWidth > maxPanelWidth
      || preferredPanelHeight != null && maxPanelHeight != null && preferredPanelHeight > maxPanelHeight
    ) {
      defaultsErrorMessage.value = 'Preferred panel size cannot exceed maximum panel size.'
      return
    }

    const { error } = await updateTeam({
      default_currency: defaultCurrency.value,
      time_format: timeFormat.value,
      preferred_panel_width_mm: preferredPanelWidth,
      preferred_panel_height_mm: preferredPanelHeight,
      max_panel_width_mm: maxPanelWidth,
      max_panel_height_mm: maxPanelHeight,
    })

    if (error) {
      defaultsErrorMessage.value = (error as any).message ?? 'Failed to save defaults'
    } else {
      defaultsSuccessMessage.value = 'Defaults saved!'
      setTimeout(() => { defaultsSuccessMessage.value = '' }, 3000)
    }
  } finally {
    savingDefaults.value = false
  }
}

function parseOptionalMm(value: string | number | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null
    return Math.round(value * 100) / 100
  }

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

  if (elexessEnabled.value && (!elexessUsername.value.trim() || !elexessPassword.value.trim())) {
    elexessErrorMessage.value = 'Username and password are required when Elexess is enabled.'
    return
  }

  savingElexess.value = true

  try {
    const { error } = await updateTeam({
      elexess_enabled: elexessEnabled.value,
      elexess_username: elexessUsername.value.trim() || null,
      elexess_password: elexessPassword.value.trim() || null,
    })

    if (error) {
      elexessErrorMessage.value = (error as any).message ?? 'Failed to save settings'
    } else {
      elexessSuccessMessage.value = 'Elexess settings saved!'
      setTimeout(() => { elexessSuccessMessage.value = '' }, 3000)
    }
  } finally {
    savingElexess.value = false
  }
}

async function validateElexessCredentials() {
  elexessValidationResult.value = null
  elexessValidationError.value = ''
  validatingElexess.value = true

  try {
    const result = await $fetch<{ valid: boolean, error?: string }>('/api/elexess/validate-credentials', {
      method: 'POST',
      body: {
        username: elexessUsername.value,
        password: elexessPassword.value,
      },
    })

    if (result.valid) {
      elexessValidationResult.value = 'valid'
    } else {
      elexessValidationResult.value = 'invalid'
      elexessValidationError.value = result.error ?? 'Invalid credentials'
    }
  } catch (err: any) {
    elexessValidationResult.value = 'invalid'
    elexessValidationError.value = err?.data?.message ?? err?.message ?? 'Connection failed'
  } finally {
    validatingElexess.value = false
  }
}

async function validateApiKey() {
  keyValidationResult.value = null
  keyValidationError.value = ''
  validatingKey.value = true

  try {
    const result = await $fetch<{
      valid: boolean
      models: Array<{ id: string, name: string }>
      error?: string
    }>('/api/ai/validate-key', {
      method: 'POST',
      body: { apiKey: sparkApiKey.value },
    })

    if (result.valid) {
      keyValidationResult.value = 'valid'
      sparkModelOptions.value = result.models.map(m => ({
        label: m.name,
        value: m.id,
      }))
      if (sparkModelOptions.value.length > 0 && !sparkModelOptions.value.some(o => o.value === sparkModel.value)) {
        sparkModel.value = sparkModelOptions.value[0].value
      }
    } else {
      keyValidationResult.value = 'invalid'
      keyValidationError.value = result.error ?? 'Invalid key'
    }
  } catch (err: any) {
    keyValidationResult.value = 'invalid'
    keyValidationError.value = err?.data?.message ?? err?.message ?? 'Connection failed'
  } finally {
    validatingKey.value = false
  }
}

async function handleSaveSpark() {
  sparkErrorMessage.value = ''
  sparkSuccessMessage.value = ''

  if (sparkEnabled.value && !sparkApiKey.value.trim()) {
    sparkErrorMessage.value = 'API key is required when Spark is enabled.'
    return
  }
  if (sparkEnabled.value && sparkApiKey.value.trim() && !sparkModel.value) {
    sparkErrorMessage.value = 'Please select a model before saving. Click "Test Connection" to load available models.'
    return
  }

  savingSpark.value = true

  try {
    const { error } = await updateTeam({
      ai_enabled: sparkEnabled.value,
      ai_api_key: sparkApiKey.value.trim() || null,
      ai_model: sparkModel.value || '',
    })

    if (error) {
      sparkErrorMessage.value = (error as any).message ?? 'Failed to save Spark settings'
    } else {
      sparkSuccessMessage.value = 'Spark settings saved!'
      setTimeout(() => { sparkSuccessMessage.value = '' }, 3000)
    }
  } finally {
    savingSpark.value = false
  }
}
</script>
