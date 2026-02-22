<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

const route = useRoute()
const teamId = route.params.id as string
const { query, action } = useAdminApi()
const loading = ref(true)
const error = ref<string | null>(null)
const data = ref<any>(null)
const actionLoading = ref(false)

async function fetchDetail() {
  loading.value = true
  try {
    data.value = await query('team_detail', { team_id: teamId })
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(fetchDetail)

const tabs: TabsItem[] = [
  { label: 'Overview', value: 'overview', icon: 'i-lucide-layout-dashboard' },
  { label: 'Members', value: 'members', icon: 'i-lucide-users' },
  { label: 'Projects', value: 'projects', icon: 'i-lucide-folder-kanban' },
  { label: 'Integrations', value: 'integrations', icon: 'i-lucide-plug-zap' },
  { label: 'Activity', value: 'activity', icon: 'i-lucide-activity' },
]

const changePlanOpen = ref(false)
const changePlanValue = ref('free')

function openChangePlan() {
  changePlanValue.value = data.value?.team?.plan ?? 'free'
  changePlanOpen.value = true
}

async function savePlan() {
  actionLoading.value = true
  try {
    await action({ action: 'change_plan', team_id: teamId, plan: changePlanValue.value })
    changePlanOpen.value = false
    await fetchDetail()
  } finally {
    actionLoading.value = false
  }
}

async function cancelSub() {
  if (!confirm('Cancel Stripe subscription? Team will be set to Free.')) return
  actionLoading.value = true
  try {
    await action({ action: 'cancel_subscription', team_id: teamId })
    await fetchDetail()
  } finally {
    actionLoading.value = false
  }
}

async function deleteTeam() {
  if (!confirm(`Permanently delete "${data.value?.team?.name}"?`)) return
  actionLoading.value = true
  try {
    await action({ action: 'delete_team', team_id: teamId })
    navigateTo('/admin/teams')
  } finally {
    actionLoading.value = false
  }
}

const planOptions = [
  { label: 'Free', value: 'free' },
  { label: 'Pro', value: 'pro' },
  { label: 'Team', value: 'team' },
  { label: 'Enterprise', value: 'enterprise' },
]

const integrationsOpen = ref(false)
const intAiKey = ref('')
const intAiModel = ref('')
const intElexessUser = ref('')
const intElexessPass = ref('')
const savingIntegrations = ref(false)

function openIntegrations() {
  intAiKey.value = ''
  intAiModel.value = ''
  intElexessUser.value = ''
  intElexessPass.value = ''
  integrationsOpen.value = true
}

async function saveIntegrations() {
  savingIntegrations.value = true
  try {
    const updates: Record<string, unknown> = { team_id: teamId }
    if (intAiKey.value.trim()) updates.ai_api_key = intAiKey.value.trim()
    if (intAiModel.value.trim()) updates.ai_model = intAiModel.value.trim()
    if (intElexessUser.value.trim()) updates.elexess_username = intElexessUser.value.trim()
    if (intElexessPass.value.trim()) updates.elexess_password = intElexessPass.value.trim()

    await action({ action: 'update_team_integrations', ...updates })
    integrationsOpen.value = false
    await fetchDetail()
  } finally {
    savingIntegrations.value = false
  }
}

async function clearIntegrationOverride(field: 'ai' | 'elexess') {
  savingIntegrations.value = true
  try {
    const updates: Record<string, unknown> = { team_id: teamId }
    if (field === 'ai') {
      updates.ai_api_key = null
      updates.ai_model = ''
    } else {
      updates.elexess_username = null
      updates.elexess_password = null
    }
    await action({ action: 'update_team_integrations', ...updates })
    await fetchDetail()
  } finally {
    savingIntegrations.value = false
  }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <AdminLayout>
    <NuxtLink to="/admin/teams" class="text-xs text-[var(--ui-text-dimmed)] hover:text-[var(--ui-text)] flex items-center gap-1 mb-4">
      <UIcon name="i-lucide-arrow-left" class="text-sm" />
      Back to teams
    </NuxtLink>

    <div v-if="loading" class="text-[var(--ui-text-dimmed)]">Loading...</div>
    <div v-else-if="error" class="text-red-500">{{ error }}</div>
    <template v-else-if="data">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-semibold">{{ data.team.name }}</h2>
          <PlanBadge :plan="data.team.plan" />
          <span class="text-xs text-[var(--ui-text-dimmed)]">{{ data.team.slug }}.gerbtrace.com</span>
        </div>
        <div class="flex gap-2">
          <UButton variant="outline" size="sm" @click="openChangePlan">Change Plan</UButton>
          <UButton v-if="data.subscription?.status === 'active'" variant="outline" size="sm" color="warning" :loading="actionLoading" @click="cancelSub">Cancel Subscription</UButton>
          <UButton variant="outline" size="sm" color="error" :loading="actionLoading" @click="deleteTeam">Delete</UButton>
        </div>
      </div>

      <!-- Tabs -->
      <UTabs :items="tabs" variant="link" size="sm" color="neutral" class="w-full">
        <!-- Overview tab -->
        <template #overview>
          <div class="pt-4 space-y-6">
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div class="rounded-lg border border-[var(--ui-border)] p-3">
                <div class="text-xs text-[var(--ui-text-dimmed)]">Members</div>
                <div class="text-xl font-bold">{{ data.members.length }}</div>
              </div>
              <div class="rounded-lg border border-[var(--ui-border)] p-3">
                <div class="text-xs text-[var(--ui-text-dimmed)]">Projects</div>
                <div class="text-xl font-bold">{{ data.projects.length }}</div>
              </div>
              <div class="rounded-lg border border-[var(--ui-border)] p-3">
                <div class="text-xs text-[var(--ui-text-dimmed)]">Elexess (month)</div>
                <div class="text-xl font-bold">{{ data.usage.elexess_searches }}</div>
              </div>
              <div class="rounded-lg border border-[var(--ui-border)] p-3">
                <div class="text-xs text-[var(--ui-text-dimmed)]">Spark AI (month)</div>
                <div class="text-xl font-bold">{{ data.usage.spark_ai_runs }}</div>
              </div>
            </div>

            <div v-if="data.subscription" class="rounded-lg border border-[var(--ui-border)] p-4">
              <h3 class="text-sm font-semibold mb-2">Subscription</h3>
              <div class="text-sm space-y-1">
                <div>Status: <UBadge :label="data.subscription.status" :color="data.subscription.status === 'active' ? 'success' : 'warning'" variant="subtle" size="sm" /></div>
                <div>Period: {{ formatDate(data.subscription.current_period_start) }} &ndash; {{ formatDate(data.subscription.current_period_end) }}</div>
                <div v-if="data.subscription.cancel_at_period_end" class="text-amber-500">Cancels at period end</div>
              </div>
            </div>

            <div v-if="data.team.billing_name" class="rounded-lg border border-[var(--ui-border)] p-4">
              <h3 class="text-sm font-semibold mb-2">Billing</h3>
              <div class="text-sm space-y-1">
                <div>{{ data.team.billing_name }}</div>
                <div v-if="data.team.billing_email" class="text-[var(--ui-text-dimmed)]">{{ data.team.billing_email }}</div>
                <div v-if="data.team.billing_vat_id">VAT: {{ data.team.billing_vat_id }}</div>
              </div>
            </div>
          </div>
        </template>

        <!-- Members tab -->
        <template #members>
          <div class="pt-4">
            <div v-if="data.members.length === 0" class="text-sm text-[var(--ui-text-dimmed)]">No members.</div>
            <table v-else class="w-full text-sm">
              <thead>
                <tr class="border-b border-[var(--ui-border)]">
                  <th class="text-left py-1.5">Name</th>
                  <th class="text-left py-1.5">Email</th>
                  <th class="text-center py-1.5">Role</th>
                  <th class="text-center py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in data.members" :key="m.id" class="border-b border-[var(--ui-border)]">
                  <td class="py-1.5">{{ m.profiles?.name ?? '--' }}</td>
                  <td class="py-1.5 text-[var(--ui-text-dimmed)]">{{ m.profiles?.email }}</td>
                  <td class="text-center py-1.5"><UBadge :label="m.role" variant="subtle" size="sm" /></td>
                  <td class="text-center py-1.5"><UBadge :label="m.status" :color="m.status === 'active' ? 'success' : 'neutral'" variant="subtle" size="sm" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- Projects tab -->
        <template #projects>
          <div class="pt-4">
            <div v-if="data.projects.length === 0" class="text-sm text-[var(--ui-text-dimmed)]">No projects.</div>
            <table v-else class="w-full text-sm">
              <thead>
                <tr class="border-b border-[var(--ui-border)]">
                  <th class="text-left py-1.5">Name</th>
                  <th class="text-center py-1.5">Mode</th>
                  <th class="text-center py-1.5">Status</th>
                  <th class="text-right py-1.5">Updated</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in data.projects" :key="p.id" class="border-b border-[var(--ui-border)]">
                  <td class="py-1.5">{{ p.name }}</td>
                  <td class="text-center py-1.5">{{ p.mode }}</td>
                  <td class="text-center py-1.5"><UBadge :label="p.status" variant="subtle" size="sm" /></td>
                  <td class="text-right py-1.5 text-[var(--ui-text-dimmed)]">{{ formatDate(p.updated_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- Integrations tab -->
        <template #integrations>
          <div class="pt-4">
            <div v-if="!data.integrations" class="text-sm text-[var(--ui-text-dimmed)]">No integration data available.</div>
            <template v-else>
              <div class="flex items-center justify-between mb-4">
                <p class="text-sm text-[var(--ui-text-dimmed)]">Custom API keys override the global platform defaults for this team.</p>
                <UButton size="xs" variant="outline" @click="openIntegrations">Set Custom Keys</UButton>
              </div>
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="rounded-lg border border-[var(--ui-border)] p-4 space-y-2">
                  <div class="font-medium flex items-center gap-2">
                    <UIcon name="i-lucide-sparkles" class="text-violet-500" />
                    Spark AI
                  </div>
                  <div class="text-sm">Status: <UBadge :label="data.integrations.ai_enabled ? 'Enabled' : 'Disabled'" :color="data.integrations.ai_enabled ? 'success' : 'neutral'" variant="subtle" size="sm" /></div>
                  <div class="text-sm flex items-center gap-2">
                    Keys: <UBadge :label="data.integrations.ai_has_custom_key ? 'Custom' : 'Global'" :color="data.integrations.ai_has_custom_key ? 'info' : 'neutral'" variant="subtle" size="sm" />
                    <UButton v-if="data.integrations.ai_has_custom_key" size="xs" variant="link" color="error" :loading="savingIntegrations" @click="clearIntegrationOverride('ai')">Clear</UButton>
                  </div>
                </div>
                <div class="rounded-lg border border-[var(--ui-border)] p-4 space-y-2">
                  <div class="font-medium flex items-center gap-2">
                    <UIcon name="i-lucide-plug-zap" class="text-sky-500" />
                    Elexess
                  </div>
                  <div class="text-sm">Status: <UBadge :label="data.integrations.elexess_enabled ? 'Enabled' : 'Disabled'" :color="data.integrations.elexess_enabled ? 'success' : 'neutral'" variant="subtle" size="sm" /></div>
                  <div class="text-sm flex items-center gap-2">
                    Keys: <UBadge :label="data.integrations.elexess_has_custom_credentials ? 'Custom' : 'Global'" :color="data.integrations.elexess_has_custom_credentials ? 'info' : 'neutral'" variant="subtle" size="sm" />
                    <UButton v-if="data.integrations.elexess_has_custom_credentials" size="xs" variant="link" color="error" :loading="savingIntegrations" @click="clearIntegrationOverride('elexess')">Clear</UButton>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </template>

        <!-- Activity tab -->
        <template #activity>
          <div class="pt-4">
            <div v-if="data.recent_events.length === 0" class="text-sm text-[var(--ui-text-dimmed)]">No events yet.</div>
            <table v-else class="w-full text-sm">
              <thead>
                <tr class="border-b border-[var(--ui-border)]">
                  <th class="text-left py-1.5">Time</th>
                  <th class="text-left py-1.5">User</th>
                  <th class="text-left py-1.5">Type</th>
                  <th class="text-left py-1.5">Details</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in data.recent_events" :key="e.id" class="border-b border-[var(--ui-border)]">
                  <td class="py-1.5 text-[var(--ui-text-dimmed)] text-xs">{{ new Date(e.created_at).toLocaleString() }}</td>
                  <td class="py-1.5">{{ e.profiles?.name ?? '--' }}</td>
                  <td class="py-1.5"><UBadge :label="e.event_type" variant="subtle" size="sm" /></td>
                  <td class="py-1.5 text-xs text-[var(--ui-text-dimmed)]">{{ e.metadata ? JSON.stringify(e.metadata) : '--' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </UTabs>
    </template>

    <!-- Change plan modal -->
    <UModal v-model:open="changePlanOpen">
      <template #default>
        <div class="p-5 space-y-4">
          <h3 class="text-lg font-semibold">Change Plan</h3>
          <UFormField label="New Plan">
            <USelect v-model="changePlanValue" :items="planOptions" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton variant="outline" @click="changePlanOpen = false">Cancel</UButton>
            <UButton :loading="actionLoading" @click="savePlan">Save</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Integration overrides modal -->
    <UModal v-model:open="integrationsOpen">
      <template #default>
        <div class="p-5 space-y-4">
          <h3 class="text-lg font-semibold">Set Custom Integration Keys</h3>
          <p class="text-xs text-[var(--ui-text-dimmed)]">Leave fields empty to keep the current value. Custom keys override the global platform defaults.</p>

          <div class="space-y-3">
            <h4 class="text-sm font-medium">Spark AI</h4>
            <UFormField label="API Key">
              <UInput v-model="intAiKey" type="password" size="md" placeholder="Custom Anthropic API key" />
            </UFormField>
            <UFormField label="Model">
              <UInput v-model="intAiModel" size="md" placeholder="e.g. claude-sonnet-4-20250514" />
            </UFormField>
          </div>

          <div class="space-y-3">
            <h4 class="text-sm font-medium">Elexess</h4>
            <UFormField label="Username">
              <UInput v-model="intElexessUser" size="md" placeholder="Custom Elexess username" />
            </UFormField>
            <UFormField label="Password">
              <UInput v-model="intElexessPass" type="password" size="md" placeholder="Custom Elexess password" />
            </UFormField>
          </div>

          <div class="flex justify-end gap-2">
            <UButton variant="outline" @click="integrationsOpen = false">Cancel</UButton>
            <UButton :loading="savingIntegrations" @click="saveIntegrations">Save</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </AdminLayout>
</template>
