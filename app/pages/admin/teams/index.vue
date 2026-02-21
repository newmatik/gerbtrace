<script setup lang="ts">
import type { TeamPlan } from '~/composables/useTeam'

interface AdminTeam {
  id: string
  name: string
  slug: string
  plan: TeamPlan
  members_count: number
  projects_count: number
  spaces_count: number
  elexess_searches: number
  spark_ai_runs: number
  stripe_status: string | null
  created_at: string
}

const { query, action } = useAdminApi()
const loading = ref(true)
const error = ref<string | null>(null)
const teams = ref<AdminTeam[]>([])
const search = ref('')
const planFilter = ref<string>('all')

async function fetchTeams() {
  loading.value = true
  try {
    const data = await query<{ teams: AdminTeam[] }>('teams')
    teams.value = data.teams ?? []
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(fetchTeams)

const filteredTeams = computed(() => {
  let result = teams.value
  if (planFilter.value && planFilter.value !== 'all') result = result.filter(t => t.plan === planFilter.value)
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter(t => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q))
  }
  return result
})

const sortKey = ref<keyof AdminTeam>('name')
const sortAsc = ref(true)

const sortedTeams = computed(() => {
  return [...filteredTeams.value].sort((a, b) => {
    const aVal = a[sortKey.value]
    const bVal = b[sortKey.value]
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortAsc.value ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }
    return sortAsc.value ? Number(aVal ?? 0) - Number(bVal ?? 0) : Number(bVal ?? 0) - Number(aVal ?? 0)
  })
})

function toggleSort(key: keyof AdminTeam) {
  if (sortKey.value === key) sortAsc.value = !sortAsc.value
  else { sortKey.value = key; sortAsc.value = true }
}

function sortIndicator(key: keyof AdminTeam) {
  if (sortKey.value !== key) return ''
  return sortAsc.value ? ' ↑' : ' ↓'
}

// Actions
const changePlanTeamId = ref<string | null>(null)
const changePlanModalOpen = ref(false)
const changePlanValue = ref<string>('free')
const actionLoading = ref(false)

async function changePlan() {
  if (!changePlanTeamId.value) return
  actionLoading.value = true
  try {
    await action({ action: 'change_plan', team_id: changePlanTeamId.value, plan: changePlanValue.value })
    changePlanTeamId.value = null
    changePlanModalOpen.value = false
    await fetchTeams()
  } finally {
    actionLoading.value = false
  }
}

async function cancelSubscription(teamId: string) {
  if (!confirm('Cancel this team\'s Stripe subscription? This sets the team to Free.')) return
  actionLoading.value = true
  try {
    await action({ action: 'cancel_subscription', team_id: teamId })
    await fetchTeams()
  } finally {
    actionLoading.value = false
  }
}

async function deleteTeam(teamId: string, name: string) {
  if (!confirm(`Permanently delete team "${name}"? This cannot be undone.`)) return
  actionLoading.value = true
  try {
    await action({ action: 'delete_team', team_id: teamId })
    await fetchTeams()
  } finally {
    actionLoading.value = false
  }
}

function openChangePlan(team: AdminTeam) {
  changePlanTeamId.value = team.id
  changePlanValue.value = team.plan
  changePlanModalOpen.value = true
}

const planOptions = [
  { label: 'Free', value: 'free' },
  { label: 'Pro', value: 'pro' },
  { label: 'Team', value: 'team' },
  { label: 'Enterprise', value: 'enterprise' },
]
</script>

<template>
  <AdminLayout>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold">Teams</h2>
      <div class="flex gap-2">
        <UInput v-model="search" placeholder="Search..." size="sm" class="w-48" />
        <USelect v-model="planFilter" :items="[{ label: 'All Plans', value: 'all' }, ...planOptions]" size="sm" class="w-36" />
      </div>
    </div>

    <div v-if="loading" class="text-[var(--ui-text-dimmed)]">Loading...</div>
    <div v-else-if="error" class="text-red-500">{{ error }}</div>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-[var(--ui-border)]">
            <th class="text-left py-2 pr-3 cursor-pointer select-none" @click="toggleSort('name')">Team{{ sortIndicator('name') }}</th>
            <th class="text-center py-2 px-2 cursor-pointer select-none" @click="toggleSort('plan')">Plan{{ sortIndicator('plan') }}</th>
            <th class="text-center py-2 px-2 cursor-pointer select-none" @click="toggleSort('members_count')">Members{{ sortIndicator('members_count') }}</th>
            <th class="text-center py-2 px-2 cursor-pointer select-none" @click="toggleSort('projects_count')">Projects{{ sortIndicator('projects_count') }}</th>
            <th class="text-center py-2 px-2 cursor-pointer select-none" @click="toggleSort('elexess_searches')">Elexess{{ sortIndicator('elexess_searches') }}</th>
            <th class="text-center py-2 px-2 cursor-pointer select-none" @click="toggleSort('spark_ai_runs')">Spark{{ sortIndicator('spark_ai_runs') }}</th>
            <th class="text-center py-2 px-2">Stripe</th>
            <th class="text-right py-2 pl-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in sortedTeams" :key="t.id" class="border-b border-[var(--ui-border)]">
            <td class="py-2 pr-3">
              <NuxtLink :to="`/admin/teams/${t.id}`" class="font-medium hover:text-primary">{{ t.name }}</NuxtLink>
              <div class="text-xs text-[var(--ui-text-dimmed)]">{{ t.slug }}</div>
            </td>
            <td class="text-center py-2 px-2"><PlanBadge :plan="t.plan" /></td>
            <td class="text-center py-2 px-2">{{ t.members_count }}</td>
            <td class="text-center py-2 px-2">{{ t.projects_count }}</td>
            <td class="text-center py-2 px-2">{{ t.elexess_searches }}</td>
            <td class="text-center py-2 px-2">{{ t.spark_ai_runs }}</td>
            <td class="text-center py-2 px-2">
              <UBadge v-if="t.stripe_status" :label="t.stripe_status" :color="t.stripe_status === 'active' ? 'success' : 'warning'" variant="subtle" size="sm" />
              <span v-else class="text-[var(--ui-text-dimmed)]">--</span>
            </td>
            <td class="text-right py-2 pl-2">
              <UDropdownMenu
                :items="[
                  [
                    { label: 'View Details', icon: 'i-lucide-eye', to: `/admin/teams/${t.id}` },
                    { label: 'Change Plan', icon: 'i-lucide-arrow-up-right', onSelect: () => openChangePlan(t) },
                  ],
                  [
                    { label: 'Cancel Subscription', icon: 'i-lucide-ban', onSelect: () => cancelSubscription(t.id), disabled: !t.stripe_status || t.stripe_status !== 'active' },
                    { label: 'Delete Team', icon: 'i-lucide-trash-2', onSelect: () => deleteTeam(t.id, t.name) },
                  ],
                ]"
              >
                <UButton icon="i-lucide-more-horizontal" variant="ghost" size="xs" />
              </UDropdownMenu>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Change plan modal -->
    <UModal v-model:open="changePlanModalOpen">
      <template #default>
        <div class="p-5 space-y-4">
          <h3 class="text-lg font-semibold">Change Plan</h3>
          <UFormField label="New Plan">
            <USelect v-model="changePlanValue" :items="planOptions" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton variant="outline" @click="changePlanModalOpen = false">Cancel</UButton>
            <UButton :loading="actionLoading" @click="changePlan">Save</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </AdminLayout>
</template>
