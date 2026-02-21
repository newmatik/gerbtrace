<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { isPlatformAdmin, isLoading } = useAdminGuard()
const { isAuthenticated } = useAuth()

watch([isLoading, isAuthenticated, isPlatformAdmin], () => {
  if (isLoading.value) return
  if (!isAuthenticated.value) { router.replace('/auth/login'); return }
  if (!isPlatformAdmin.value) router.replace('/')
}, { immediate: true })

const navItems = [
  { label: 'Overview', icon: 'i-lucide-layout-dashboard', to: '/admin' },
  { label: 'Teams', icon: 'i-lucide-building-2', to: '/admin/teams' },
  { label: 'Users', icon: 'i-lucide-users', to: '/admin/users' },
  { label: 'Subscriptions', icon: 'i-lucide-credit-card', to: '/admin/subscriptions' },
  { label: 'Usage Logs', icon: 'i-lucide-scroll-text', to: '/admin/usage-logs' },
]

function isActive(item: { to: string }) {
  if (item.to === '/admin') return route.path === '/admin'
  return route.path.startsWith(item.to)
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main v-if="isLoading" class="flex-1 flex items-center justify-center">
      <p class="text-[var(--ui-text-dimmed)]">Loading...</p>
    </main>
    <main v-else-if="isPlatformAdmin" class="flex-1 px-4 py-10">
      <div class="w-full max-w-7xl mx-auto">
        <NuxtLink to="/" class="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 flex items-center gap-1 mb-4">
          <UIcon name="i-lucide-arrow-left" class="text-sm" />
          Back to app
        </NuxtLink>

        <h1 class="text-2xl font-bold mb-6">Admin</h1>

        <div class="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
          <aside>
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
            <slot />
          </section>
        </div>
      </div>
    </main>
    <main v-else class="flex-1 flex items-center justify-center">
      <p class="text-[var(--ui-text-dimmed)]">Access denied.</p>
    </main>
  </div>
</template>
