<script setup lang="ts">
const { query } = useAdminApi()
const loading = ref(true)
const error = ref<string | null>(null)
const subscriptions = ref<any[]>([])
const statusFilter = ref('all')

async function fetchData() {
  loading.value = true
  try {
    const data = await query<{ subscriptions: any[] }>('subscriptions')
    subscriptions.value = data.subscriptions ?? []
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)

const filtered = computed(() => {
  if (!statusFilter.value || statusFilter.value === 'all') return subscriptions.value
  return subscriptions.value.filter(s => s.status === statusFilter.value)
})

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const statusOptions = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Past Due', value: 'past_due' },
  { label: 'Canceled', value: 'canceled' },
]
</script>

<template>
  <AdminLayout>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold">Subscriptions</h2>
      <USelect v-model="statusFilter" :items="statusOptions" size="sm" class="w-36" />
    </div>

    <div v-if="loading" class="text-[var(--ui-text-dimmed)]">Loading...</div>
    <div v-else-if="error" class="text-red-500">{{ error }}</div>
    <div v-else-if="filtered.length === 0" class="text-[var(--ui-text-dimmed)]">No subscriptions found.</div>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-[var(--ui-border)]">
            <th class="text-left py-2 pr-3">Team</th>
            <th class="text-center py-2 px-2">Plan</th>
            <th class="text-center py-2 px-2">Status</th>
            <th class="text-center py-2 px-2">Period Start</th>
            <th class="text-center py-2 px-2">Period End</th>
            <th class="text-center py-2 px-2">Cancels</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in filtered" :key="s.id" class="border-b border-[var(--ui-border)]">
            <td class="py-2 pr-3">
              <NuxtLink v-if="s.teams" :to="`/admin/teams/${s.teams.id}`" class="font-medium hover:text-primary">{{ s.teams.name }}</NuxtLink>
              <span v-else class="text-[var(--ui-text-dimmed)]">--</span>
            </td>
            <td class="text-center py-2 px-2">
              <PlanBadge v-if="s.teams" :plan="s.teams.plan" />
            </td>
            <td class="text-center py-2 px-2">
              <UBadge
                :label="s.status"
                :color="s.status === 'active' ? 'success' : s.status === 'past_due' ? 'warning' : 'neutral'"
                variant="subtle"
                size="sm"
              />
            </td>
            <td class="text-center py-2 px-2 text-[var(--ui-text-dimmed)]">{{ formatDate(s.current_period_start) }}</td>
            <td class="text-center py-2 px-2 text-[var(--ui-text-dimmed)]">{{ formatDate(s.current_period_end) }}</td>
            <td class="text-center py-2 px-2">
              <span v-if="s.cancel_at_period_end" class="text-amber-500 text-xs">Yes</span>
              <span v-else class="text-[var(--ui-text-dimmed)]">--</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AdminLayout>
</template>
