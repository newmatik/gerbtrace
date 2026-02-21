<script setup lang="ts">
const { query } = useAdminApi()
const loading = ref(true)
const error = ref<string | null>(null)
const events = ref<any[]>([])
const total = ref(0)
const page = ref(0)
const pageSize = 50

const eventTypeFilter = ref('all')
const teamIdFilter = ref('')

async function fetchLogs() {
  loading.value = true
  try {
    const params: Record<string, unknown> = {
      limit: pageSize,
      offset: page.value * pageSize,
    }
    if (eventTypeFilter.value && eventTypeFilter.value !== 'all') params.event_type = eventTypeFilter.value
    if (teamIdFilter.value) params.team_id = teamIdFilter.value

    const data = await query<{ events: any[]; total: number }>('usage_logs', params)
    events.value = data.events ?? []
    total.value = data.total ?? 0
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(fetchLogs)

watch([eventTypeFilter, teamIdFilter], () => {
  page.value = 0
  fetchLogs()
})

watch(page, fetchLogs)

const totalPages = computed(() => Math.ceil(total.value / pageSize))

function exportCsv() {
  const rows = [
    ['Timestamp', 'Team', 'User', 'Event Type', 'Metadata'].join(','),
    ...events.value.map(e =>
      [
        new Date(e.created_at).toISOString(),
        `"${e.teams?.name ?? ''}"`,
        `"${e.profiles?.name ?? e.profiles?.email ?? ''}"`,
        e.event_type,
        `"${e.metadata ? JSON.stringify(e.metadata).replace(/"/g, '""') : ''}"`,
      ].join(','),
    ),
  ]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gerbtrace-usage-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const eventTypeOptions = [
  { label: 'All Types', value: 'all' },
  { label: 'Elexess Search', value: 'elexess_search' },
  { label: 'Spark AI Run', value: 'spark_ai_run' },
]
</script>

<template>
  <AdminLayout>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold">Usage Logs</h2>
      <div class="flex gap-2">
        <USelect v-model="eventTypeFilter" :items="eventTypeOptions" size="sm" class="w-40" />
        <UButton icon="i-lucide-download" variant="outline" size="sm" @click="exportCsv" :disabled="events.length === 0">
          Export CSV
        </UButton>
      </div>
    </div>

    <div v-if="loading" class="text-[var(--ui-text-dimmed)]">Loading...</div>
    <div v-else-if="error" class="text-red-500">{{ error }}</div>
    <div v-else-if="events.length === 0" class="text-[var(--ui-text-dimmed)]">No usage events found.</div>
    <template v-else>
      <div class="text-xs text-[var(--ui-text-dimmed)] mb-2">
        Showing {{ page * pageSize + 1 }}--{{ Math.min((page + 1) * pageSize, total) }} of {{ total }}
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-[var(--ui-border)]">
              <th class="text-left py-2 pr-3">Timestamp</th>
              <th class="text-left py-2 px-2">Team</th>
              <th class="text-left py-2 px-2">User</th>
              <th class="text-center py-2 px-2">Type</th>
              <th class="text-left py-2 px-2">Metadata</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in events" :key="e.id" class="border-b border-[var(--ui-border)]">
              <td class="py-1.5 pr-3 text-xs text-[var(--ui-text-dimmed)] whitespace-nowrap">{{ new Date(e.created_at).toLocaleString() }}</td>
              <td class="py-1.5 px-2">
                <NuxtLink v-if="e.teams" :to="`/admin/teams/${e.team_id}`" class="hover:text-primary text-xs">{{ e.teams.name }}</NuxtLink>
              </td>
              <td class="py-1.5 px-2 text-xs">{{ e.profiles?.name ?? e.profiles?.email ?? '--' }}</td>
              <td class="text-center py-1.5 px-2"><UBadge :label="e.event_type" variant="subtle" size="sm" /></td>
              <td class="py-1.5 px-2 text-xs text-[var(--ui-text-dimmed)] max-w-xs truncate">{{ e.metadata ? JSON.stringify(e.metadata) : '--' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 mt-4">
        <UButton variant="outline" size="xs" :disabled="page === 0" @click="page--">Previous</UButton>
        <span class="text-xs text-[var(--ui-text-dimmed)]">Page {{ page + 1 }} of {{ totalPages }}</span>
        <UButton variant="outline" size="xs" :disabled="page >= totalPages - 1" @click="page++">Next</UButton>
      </div>
    </template>
  </AdminLayout>
</template>
