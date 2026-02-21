<script setup lang="ts">
const { query, action } = useAdminApi()
const loading = ref(true)
const error = ref<string | null>(null)
const users = ref<any[]>([])
const search = ref('')
const actionLoading = ref<string | null>(null)

async function fetchUsers() {
  loading.value = true
  try {
    const data = await query<{ users: any[] }>('users')
    users.value = data.users ?? []
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(fetchUsers)

const filteredUsers = computed(() => {
  if (!search.value) return users.value
  const q = search.value.toLowerCase()
  return users.value.filter(u =>
    (u.name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q),
  )
})

async function toggleUser(userId: string, currentlyDisabled: boolean) {
  actionLoading.value = userId
  try {
    await action({ action: currentlyDisabled ? 'enable_user' : 'disable_user', user_id: userId })
    await fetchUsers()
  } finally {
    actionLoading.value = null
  }
}

function isAllDisabled(user: any): boolean {
  return user.teams.length > 0 && user.teams.every((t: any) => t.status === 'disabled')
}
</script>

<template>
  <AdminLayout>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold">Users</h2>
      <UInput v-model="search" placeholder="Search by name or email..." size="sm" class="w-64" />
    </div>

    <div v-if="loading" class="text-[var(--ui-text-dimmed)]">Loading...</div>
    <div v-else-if="error" class="text-red-500">{{ error }}</div>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-[var(--ui-border)]">
            <th class="text-left py-2 pr-3">User</th>
            <th class="text-left py-2 px-2">Email</th>
            <th class="text-center py-2 px-2">Teams</th>
            <th class="text-left py-2 px-2">Memberships</th>
            <th class="text-right py-2 pl-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in filteredUsers" :key="u.id" class="border-b border-[var(--ui-border)]">
            <td class="py-2 pr-3">
              <div class="font-medium">{{ u.name ?? '--' }}</div>
              <div class="text-xs text-[var(--ui-text-dimmed)]">{{ u.id.slice(0, 8) }}...</div>
            </td>
            <td class="py-2 px-2 text-[var(--ui-text-dimmed)]">{{ u.email }}</td>
            <td class="text-center py-2 px-2">{{ u.team_count }}</td>
            <td class="py-2 px-2">
              <div v-for="t in u.teams" :key="t.team_id" class="text-xs">
                <NuxtLink :to="`/admin/teams/${t.team_id}`" class="hover:text-primary">{{ t.team_name }}</NuxtLink>
                <span class="text-[var(--ui-text-dimmed)]"> ({{ t.role }}, {{ t.status }})</span>
              </div>
              <span v-if="u.teams.length === 0" class="text-xs text-[var(--ui-text-dimmed)]">No teams</span>
            </td>
            <td class="text-right py-2 pl-2">
              <UButton
                v-if="u.teams.length > 0"
                :icon="isAllDisabled(u) ? 'i-lucide-user-check' : 'i-lucide-user-x'"
                :variant="isAllDisabled(u) ? 'outline' : 'ghost'"
                size="xs"
                :loading="actionLoading === u.id"
                @click="toggleUser(u.id, isAllDisabled(u))"
              >
                {{ isAllDisabled(u) ? 'Enable' : 'Disable' }}
              </UButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </AdminLayout>
</template>
