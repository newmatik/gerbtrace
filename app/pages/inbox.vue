<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 px-4 py-8">
      <div class="mx-auto max-w-3xl space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold">Inbox</h1>
            <p class="text-sm text-neutral-500">Mentions and workflow updates for your team projects.</p>
          </div>
          <UButton size="xs" variant="outline" color="neutral" @click="markAllAsRead">
            Mark all read
          </UButton>
        </div>

        <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-800">
          <div
            v-for="item in notifications"
            :key="item.id"
            class="p-4 flex items-start gap-3"
            :class="{ 'bg-primary-50/40 dark:bg-primary-950/20': !item.read_at }"
          >
            <UIcon :name="notificationIcon(item.type)" class="mt-0.5 text-primary-500" />
            <div class="flex-1 min-w-0 space-y-1">
              <div class="text-sm font-medium">{{ notificationTitle(item.type) }}</div>
              <div class="text-xs text-neutral-500">{{ formatDate(item.created_at) }}</div>
              <div class="text-sm text-neutral-700 dark:text-neutral-300">
                {{ notificationDescription(item) }}
              </div>
              <div class="pt-1">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :to="notificationLink(item)"
                  @click="markAsRead(item.id)"
                >
                  Open
                </UButton>
              </div>
            </div>
          </div>
          <div v-if="!loading && notifications.length === 0" class="p-8 text-sm text-neutral-500 text-center">
            No notifications yet.
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const { notifications, loading, markAsRead, markAllAsRead } = useNotifications()

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function notificationIcon(type: string) {
  if (type === 'mention') return 'i-lucide-at-sign'
  if (type === 'approval_requested') return 'i-lucide-hourglass'
  if (type === 'approved') return 'i-lucide-check-circle'
  if (type === 'changes_requested') return 'i-lucide-message-square-warning'
  return 'i-lucide-bell'
}

function notificationTitle(type: string) {
  if (type === 'mention') return 'You were mentioned'
  if (type === 'approval_requested') return 'Approval requested'
  if (type === 'approved') return 'Project approved'
  if (type === 'changes_requested') return 'Changes requested'
  return 'Project update'
}

function notificationDescription(item: { payload: Record<string, any> | null }) {
  return item.payload?.project_name ? `Project: ${item.payload.project_name}` : 'Open to view details.'
}

function notificationLink(item: { project_id: string | null }) {
  if (!item.project_id) return '/inbox'
  return `/viewer/team-${item.project_id}/conversation`
}
</script>
