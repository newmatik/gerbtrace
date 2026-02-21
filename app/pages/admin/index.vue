<script setup lang="ts">
const { query } = useAdminApi()
const loading = ref(true)
const error = ref<string | null>(null)
const data = ref<any>(null)

onMounted(async () => {
  try {
    data.value = await query('overview')
  } catch (e: any) {
    error.value = e.message ?? 'Failed to load'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <AdminLayout>
    <h2 class="text-lg font-semibold mb-6">Overview</h2>

    <div v-if="loading" class="text-[var(--ui-text-dimmed)]">Loading...</div>
    <div v-else-if="error" class="text-red-500">{{ error }}</div>
    <template v-else-if="data">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div class="rounded-lg border border-[var(--ui-border)] p-4">
          <div class="text-xs font-medium text-[var(--ui-text-dimmed)] mb-1">Total Teams</div>
          <div class="text-2xl font-bold">{{ data.total_teams }}</div>
          <div class="text-xs text-[var(--ui-text-dimmed)] mt-1">
            <span v-for="(count, plan) in data.plan_counts" :key="plan" class="mr-2">
              {{ plan }}: {{ count }}
            </span>
          </div>
        </div>

        <div class="rounded-lg border border-[var(--ui-border)] p-4">
          <div class="text-xs font-medium text-[var(--ui-text-dimmed)] mb-1">Total Users</div>
          <div class="text-2xl font-bold">{{ data.total_users }}</div>
        </div>

        <div class="rounded-lg border border-[var(--ui-border)] p-4">
          <div class="text-xs font-medium text-[var(--ui-text-dimmed)] mb-1">Active Subscriptions</div>
          <div class="text-2xl font-bold">{{ data.active_subscriptions }}</div>
          <div class="text-xs text-[var(--ui-text-dimmed)] mt-1">of {{ data.total_subscriptions }} total</div>
        </div>

        <div class="rounded-lg border border-[var(--ui-border)] p-4">
          <div class="text-xs font-medium text-[var(--ui-text-dimmed)] mb-1">This Month</div>
          <div class="text-sm mt-1">Elexess: {{ data.elexess_searches_this_month }}</div>
          <div class="text-sm">Spark AI: {{ data.spark_ai_runs_this_month }}</div>
        </div>
      </div>

      <div class="flex gap-3">
        <UButton to="/admin/teams" variant="outline" size="sm">View Teams</UButton>
        <UButton to="/admin/users" variant="outline" size="sm">View Users</UButton>
        <UButton to="/admin/usage-logs" variant="outline" size="sm">View Usage Logs</UButton>
      </div>
    </template>
  </AdminLayout>
</template>
