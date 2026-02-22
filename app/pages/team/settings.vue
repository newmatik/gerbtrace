<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 px-4 py-10">
      <div class="w-full max-w-4xl mx-auto">
        <NuxtLink to="/dashboard" class="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 flex items-center gap-1 mb-4">
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
            <div v-if="teamsLoaded && !isAdmin" class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-700 dark:text-amber-400 mb-5">
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
              <div v-if="!canUseElexess" class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-2">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-plug-zap" class="text-lg text-sky-500" />
                  <h2 class="text-lg font-semibold">Elexess</h2>
                  <PlanBadge plan="pro" />
                </div>
                <p class="text-sm text-neutral-500 dark:text-neutral-400">
                  Elexess Price Search is available on the Pro plan.
                  <NuxtLink to="/team/settings?section=billing" class="text-primary underline">Upgrade</NuxtLink>
                </p>
              </div>
              <div
                v-else
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
                      :loading="savingElexess"
                      @update:model-value="toggleElexess"
                    />
                  </label>
                </div>
                <p class="text-sm text-neutral-500 dark:text-neutral-400">
                  Enable Elexess Price Search to fetch BOM pricing and availability. Credentials are managed by platform administrators.
                </p>

                <p v-if="elexessErrorMessage" class="text-sm text-red-600 dark:text-red-400">
                  {{ elexessErrorMessage }}
                </p>
              </div>

              <!-- Spark AI -->
              <div v-if="!canUseSparkAi" class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-2">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-sparkles" class="text-lg text-violet-500" />
                  <h2 class="text-lg font-semibold">Spark</h2>
                  <UBadge size="xs" variant="subtle" color="secondary">AI</UBadge>
                  <PlanBadge plan="pro" />
                </div>
                <p class="text-sm text-neutral-500 dark:text-neutral-400">
                  Spark AI is available on the Pro plan.
                  <NuxtLink to="/team/settings?section=billing" class="text-primary underline">Upgrade</NuxtLink>
                </p>
              </div>
              <div
                v-else
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
                      :loading="savingSpark"
                      @update:model-value="toggleSpark"
                    />
                  </label>
                </div>
                <p class="text-sm text-neutral-500 dark:text-neutral-400">
                  Enable Spark AI to enrich BOM lines with AI-generated descriptions, component types, and manufacturer suggestions.
                </p>

                <p v-if="sparkErrorMessage" class="text-sm text-red-600 dark:text-red-400">
                  {{ sparkErrorMessage }}
                </p>
              </div>
            </div>

            <!-- Billing -->
            <div v-else-if="activeSection === 'billing'" class="space-y-6">
              <div class="flex items-center gap-3">
                <h2 class="text-lg font-semibold">Billing</h2>
                <PlanBadge :plan="plan" />
              </div>

              <!-- Usage overview -->
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-2">
                  <div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">Members</div>
                  <div class="text-sm">{{ memberCount }} <span class="text-neutral-400">of {{ formatLimit(maxMembers) }}</span></div>
                  <div v-if="Number.isFinite(maxMembers)" class="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
                    <div class="bg-primary rounded-full h-1.5 transition-all" :style="{ width: `${Math.min(100, (memberCount / maxMembers) * 100)}%` }" />
                  </div>
                </div>
                <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-2">
                  <div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">Projects</div>
                  <div class="text-sm">{{ projectCount }} <span class="text-neutral-400">of {{ formatLimit(maxProjects) }}</span></div>
                  <div v-if="Number.isFinite(maxProjects)" class="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
                    <div class="bg-primary rounded-full h-1.5 transition-all" :style="{ width: `${Math.min(100, (projectCount / maxProjects) * 100)}%` }" />
                  </div>
                </div>
                <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-2">
                  <div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">Elexess searches this month</div>
                  <div class="text-sm">
                    {{ elexessSearchesUsed }}
                    <span v-if="Number.isFinite(maxElexessSearches)" class="text-neutral-400">of {{ maxElexessSearches.toLocaleString() }}</span>
                    <span v-else class="text-neutral-400">Unlimited</span>
                  </div>
                  <div v-if="Number.isFinite(maxElexessSearches) && maxElexessSearches > 0" class="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
                    <div class="rounded-full h-1.5 transition-all" :class="isAtElexessLimit ? 'bg-red-500' : 'bg-primary'" :style="{ width: `${Math.min(100, (elexessSearchesUsed / maxElexessSearches) * 100)}%` }" />
                  </div>
                </div>
                <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-2">
                  <div class="text-xs font-medium text-neutral-500 dark:text-neutral-400">Spark AI runs this month</div>
                  <div class="text-sm">{{ sparkAiRunsUsed }}</div>
                </div>
              </div>

              <!-- Billing details (from Stripe) -->
              <div v-if="currentTeam?.billing_name || currentTeam?.billing_vat_id" class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-2">
                <div class="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-2">Billing details</div>
                <div v-if="currentTeam?.billing_name" class="text-sm">{{ currentTeam.billing_name }}</div>
                <div v-if="currentTeam?.billing_email" class="text-sm text-neutral-500">{{ currentTeam.billing_email }}</div>
                <div v-if="currentTeam?.billing_address" class="text-sm text-neutral-500">
                  {{ [currentTeam.billing_address.line1, currentTeam.billing_address.city, currentTeam.billing_address.postal_code, currentTeam.billing_address.country].filter(Boolean).join(', ') }}
                </div>
                <div v-if="currentTeam?.billing_vat_id" class="text-sm">
                  VAT ID: {{ currentTeam.billing_vat_id }}
                </div>
              </div>

              <!-- Actions based on plan -->
              <div v-if="isEnterprise" class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-5">
                <p class="text-sm text-neutral-500">Enterprise plan — contact your account manager for billing changes.</p>
              </div>

              <template v-else>
                <div v-if="!isFree && isAdmin" class="flex gap-3">
                  <UButton variant="outline" :loading="portalLoading" @click="openPortal">
                    Manage Subscription
                  </UButton>
                </div>

                <div v-if="isFree || isPro" class="grid gap-4 sm:grid-cols-2">
                  <div v-if="isFree" class="rounded-xl border-2 border-[var(--ui-primary)] p-5 space-y-3">
                    <div class="font-semibold">Pro <span class="text-neutral-400 font-normal text-sm">$25/mo</span></div>
                    <ul class="text-sm space-y-1 text-neutral-600 dark:text-neutral-300">
                      <li>15 members, unlimited projects</li>
                      <li>Spark AI + 1,000 Elexess searches</li>
                      <li>3 Spaces</li>
                    </ul>
                    <UButton color="primary" block :loading="checkoutLoadingId === String(config.public.stripePriceIdPro)" :disabled="!isAdmin || !!checkoutLoadingId" @click="startCheckout(String(config.public.stripePriceIdPro))">
                      Upgrade to Pro
                    </UButton>
                  </div>

                  <div class="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5 space-y-3">
                    <div class="font-semibold">Team <span class="text-neutral-400 font-normal text-sm">$149/mo</span></div>
                    <ul class="text-sm space-y-1 text-neutral-600 dark:text-neutral-300">
                      <li>100 members, unlimited Spaces</li>
                      <li>10,000 Elexess searches/mo</li>
                      <li>Guest role for external users</li>
                    </ul>
                    <UButton variant="outline" block :loading="checkoutLoadingId === String(config.public.stripePriceIdTeam)" :disabled="!isAdmin || !!checkoutLoadingId" @click="startCheckout(String(config.public.stripePriceIdTeam))">
                      {{ isPro ? 'Upgrade to Team' : 'Choose Team' }}
                    </UButton>
                  </div>
                </div>
              </template>
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
const { currentTeam, currentTeamRole, isAdmin, updateTeam, teamsLoaded } = useTeam()
const { isAuthenticated } = useAuth()

watch(isAuthenticated, (authed) => {
  if (!authed) router.replace('/auth/login')
}, { immediate: true })

watch(currentTeamRole, (role) => {
  if (role === 'guest') router.replace('/dashboard')
}, { immediate: true })

const navItems = [
  { label: 'Spaces', icon: 'i-lucide-folders', to: '/team/spaces' },
  { label: 'General', icon: 'i-lucide-settings-2', to: '/team/settings' },
  { label: 'Defaults', icon: 'i-lucide-sliders-horizontal', to: '/team/settings?section=defaults' },
  { label: 'Integrations', icon: 'i-lucide-plug-zap', to: '/team/settings?section=integrations' },
  { label: 'Billing', icon: 'i-lucide-credit-card', to: '/team/settings?section=billing' },
  { label: 'Members', icon: 'i-lucide-users', to: '/team/members' },
]

type SettingsSection = 'general' | 'defaults' | 'integrations' | 'billing'
const activeSection = computed<SettingsSection>(() => {
  const section = route.query.section
  const value = Array.isArray(section) ? section[0] : section
  if (value === 'defaults' || value === 'integrations' || value === 'billing') return value
  return 'general'
})

function isActive(item: { to: string }) {
  if (item.to === '/team/spaces') return route.path === '/team/spaces'
  if (item.to === '/team/members') return route.path === '/team/members'
  if (item.to.includes('section=defaults')) return route.path === '/team/settings' && activeSection.value === 'defaults'
  if (item.to.includes('section=integrations')) return route.path === '/team/settings' && activeSection.value === 'integrations'
  if (item.to.includes('section=billing')) return route.path === '/team/settings' && activeSection.value === 'billing'
  return route.path === '/team/settings' && activeSection.value === 'general'
}

// ── Billing section ─────────────────────────────────────────────────
const {
  plan, isFree, isPro, isTeam: isTeamPlan, isEnterprise, suggestedUpgrade,
  canUseSparkAi, canUseElexess,
  maxMembers, maxProjects, maxSpaces, maxElexessSearches,
  memberCount, projectCount,
  elexessSearchesUsed, sparkAiRunsUsed,
  elexessSearchesRemaining, isAtElexessLimit,
} = useTeamPlan()

const config = useRuntimeConfig()

const checkoutLoadingId = ref<string | null>(null)
const portalLoading = ref(false)

async function startCheckout(priceId: string) {
  if (!currentTeam.value) return
  checkoutLoadingId.value = priceId
  try {
    const supabase = useSupabase()
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return

    const { data, error } = await supabase.functions.invoke('stripe-checkout', {
      body: { team_id: currentTeam.value.id, price_id: priceId },
      headers: { Authorization: `Bearer ${token}` },
    })
    if (error) {
      console.error('Checkout error:', error)
      return
    }
    if ((data as any)?.url) {
      window.location.href = (data as any).url
    }
  } finally {
    checkoutLoadingId.value = null
  }
}

async function openPortal() {
  if (!currentTeam.value) return
  portalLoading.value = true
  try {
    const supabase = useSupabase()
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) return

    const { data, error } = await supabase.functions.invoke('stripe-portal', {
      body: { team_id: currentTeam.value.id },
      headers: { Authorization: `Bearer ${token}` },
    })
    if (error) {
      console.error('Portal error:', error)
      return
    }
    if ((data as any)?.url) {
      window.location.href = (data as any).url
    }
  } finally {
    portalLoading.value = false
  }
}

function formatLimit(value: number): string {
  return Number.isFinite(value) ? String(value) : 'Unlimited'
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
const savingElexess = ref(false)
const elexessErrorMessage = ref('')

// Spark AI state
const sparkEnabled = ref(false)
const savingSpark = ref(false)
const sparkErrorMessage = ref('')

const currencyOptions = [
  { label: 'EUR', value: 'EUR' as const },
  { label: 'USD', value: 'USD' as const },
]

const timeFormatOptions = [
  { label: '24-hour (13:25)', value: '24h' as const },
  { label: '12-hour (01:25 PM)', value: '12h' as const },
]

// Init from current team
watch(currentTeam, (team) => {
  if (team) {
    teamName.value = team.name
    autoJoinDomain.value = team.auto_join_domain ?? ''
    defaultCurrency.value = team.default_currency ?? 'EUR'
    timeFormat.value = team.time_format ?? '24h'
    elexessEnabled.value = team.elexess_enabled !== false
    preferredPanelWidthInput.value = toInputValue(team.preferred_panel_width_mm)
    preferredPanelHeightInput.value = toInputValue(team.preferred_panel_height_mm)
    maxPanelWidthInput.value = toInputValue(team.max_panel_width_mm)
    maxPanelHeightInput.value = toInputValue(team.max_panel_height_mm)
    sparkEnabled.value = team.ai_enabled
  }
}, { immediate: true })

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

async function toggleElexess(value: boolean) {
  elexessErrorMessage.value = ''
  elexessEnabled.value = value
  savingElexess.value = true

  try {
    const { error } = await updateTeam({ elexess_enabled: value })
    if (error) {
      elexessEnabled.value = !value
      elexessErrorMessage.value = (error as any).message ?? 'Failed to save settings'
    }
  } catch {
    elexessEnabled.value = !value
    elexessErrorMessage.value = 'Failed to save settings'
  } finally {
    savingElexess.value = false
  }
}

async function toggleSpark(value: boolean) {
  sparkErrorMessage.value = ''
  sparkEnabled.value = value
  savingSpark.value = true

  try {
    const { error } = await updateTeam({ ai_enabled: value })
    if (error) {
      sparkEnabled.value = !value
      sparkErrorMessage.value = (error as any).message ?? 'Failed to save settings'
    }
  } catch {
    sparkEnabled.value = !value
    sparkErrorMessage.value = 'Failed to save settings'
  } finally {
    savingSpark.value = false
  }
}
</script>
