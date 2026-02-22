<template>
  <!-- ── Marketing header ─────────────────────────────────────────────── -->
  <header v-if="marketing" class="border-b border-neutral-200 dark:border-neutral-800 shrink-0 bg-white dark:bg-neutral-900">
    <div class="h-16 max-w-7xl mx-auto px-6 flex items-center gap-4">
      <NuxtLink to="/" class="flex items-center gap-2.5 shrink-0">
        <img
          :src="isDark ? '/icon-black.png' : '/icon-blue.png'"
          alt="Gerbtrace"
          class="size-7 rounded-lg"
        >
        <span class="text-base font-bold tracking-tight">Gerbtrace</span>
      </NuxtLink>

      <nav class="hidden sm:flex items-center gap-1 ml-6">
        <NuxtLink
          to="/"
          class="px-3 py-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          Home
        </NuxtLink>

        <UPopover v-model:open="featuresMenuOpen">
          <button
            :class="[
              'flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              featuresMenuOpen
                ? 'text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800'
                : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
            ]"
          >
            Features
            <UIcon name="i-lucide-chevron-down" class="size-3.5" />
          </button>
          <template #content>
            <div class="w-[26rem] p-3">
              <NuxtLink
                v-for="item in featureMenuItems"
                :key="item.to"
                :to="item.to"
                class="flex items-start gap-3 rounded-lg p-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors group"
                @click="featuresMenuOpen = false"
              >
                <div class="mt-0.5 shrink-0 p-2 rounded-md bg-neutral-100 dark:bg-neutral-800 group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700 transition-colors">
                  <UIcon :name="item.icon" class="text-lg text-[var(--ui-primary)]" />
                </div>
                <div class="min-w-0">
                  <div class="text-sm font-medium text-neutral-900 dark:text-white">{{ item.label }}</div>
                  <div class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 leading-relaxed">{{ item.description }}</div>
                </div>
              </NuxtLink>
            </div>
          </template>
        </UPopover>

        <NuxtLink
          to="/pricing"
          class="px-3 py-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          Pricing
        </NuxtLink>

        <NuxtLink
          to="/docs"
          class="px-3 py-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          Docs
        </NuxtLink>
      </nav>

      <div class="flex-1" />

      <div class="flex items-center gap-2">
        <UButton
          v-if="isAuthenticated"
          to="/dashboard"
          size="sm"
          icon="i-lucide-layout-dashboard"
        >
          Dashboard
        </UButton>

        <UDropdownMenu v-if="isAuthenticated" :items="userMenuItems">
          <UButton
            size="sm"
            color="neutral"
            variant="ghost"
            class="rounded-full"
          >
            <img
              v-if="profile?.avatar_url"
              :src="profile.avatar_url"
              alt="User avatar"
              class="size-6 rounded-full object-cover"
            >
            <div v-else class="size-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              {{ userInitials }}
            </div>
          </UButton>
        </UDropdownMenu>

        <UButton
          v-if="!isAuthenticated"
          to="/auth/login"
          size="sm"
          variant="ghost"
          color="neutral"
        >
          Sign In
        </UButton>
        <UButton
          v-if="!isAuthenticated"
          to="/dashboard"
          size="sm"
        >
          Open Dashboard
        </UButton>
      </div>
    </div>
    <BugReportModal v-model:open="bugReportOpen" />
  </header>

  <!-- ── App header (compact / default) ───────────────────────────────── -->
  <header v-else :class="['border-b border-neutral-200 dark:border-neutral-800 flex items-center shrink-0 bg-white dark:bg-neutral-900', compact ? 'h-11 px-2 gap-1.5' : 'h-11 px-3 gap-2']">
    <NuxtLink to="/dashboard" class="flex items-center gap-1.5 shrink-0 font-semibold text-sm" :title="compact ? 'Gerbtrace – Dashboard' : undefined">
      <img
        :src="isDark ? '/icon-black.png' : '/icon-blue.png'"
        alt="Gerbtrace"
        class="size-5 rounded"
      >
      <span v-if="!compact">Gerbtrace Dashboard</span>
    </NuxtLink>

    <slot />

    <div class="flex-1" />

    <template v-if="$slots.right">
      <slot name="right" />
      <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />
    </template>

    <!-- Team selector (when user has teams) -->
    <div v-if="isAuthenticated && hasTeam" class="flex items-center gap-1">
      <UDropdownMenu :items="teamSelectorItems">
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          class="max-w-[160px]"
        >
          <span class="truncate text-xs font-medium">{{ currentTeam?.name ?? 'Select Team' }}</span>
          <UIcon name="i-lucide-chevron-down" class="text-xs shrink-0" />
        </UButton>
      </UDropdownMenu>
    </div>

    <NuxtLink
      v-if="!isTauri && !compact"
      to="/?site"
      class="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors flex items-center gap-1"
    >
      <UIcon name="i-lucide-arrow-left" class="size-3" />
      Website
    </NuxtLink>

    <UButton
      size="xs"
      color="neutral"
      variant="ghost"
      icon="i-lucide-book-open-text"
      title="Docs / Help"
      @click="openDocumentation"
    />

    <!-- Settings / Packages dropdown -->
    <UDropdownMenu :items="settingsMenuItems">
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-settings"
        title="Settings"
      />
    </UDropdownMenu>

    <UButton
      v-if="isAuthenticated"
      size="xs"
      color="neutral"
      variant="ghost"
      class="relative"
      icon="i-lucide-bell"
      title="Inbox"
      @click="openInbox"
    >
      <UBadge
        v-if="unreadCount > 0"
        size="xs"
        color="error"
        variant="solid"
        class="absolute -top-1 -right-1 min-w-[1rem] h-4 px-1 flex items-center justify-center pointer-events-none"
      >
        {{ unreadCount > 9 ? '9+' : unreadCount }}
      </UBadge>
    </UButton>

    <!-- User menu or Sign In -->
    <UDropdownMenu v-if="isAuthenticated" :items="userMenuItems">
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        class="rounded-full"
      >
        <img
          v-if="profile?.avatar_url"
          :src="profile.avatar_url"
          alt="User avatar"
          class="size-5 rounded-full object-cover"
        >
        <div v-else class="size-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
          {{ userInitials }}
        </div>
      </UButton>
    </UDropdownMenu>
    <UButton
      v-else
      to="/auth/login"
      size="xs"
      variant="ghost"
      icon="i-lucide-log-in"
    >
      Sign In
    </UButton>

    <BugReportModal v-model:open="bugReportOpen" />
  </header>
</template>

<script setup lang="ts">
import { useColorMode } from '#imports'
import { isTauri as coreIsTauri } from '@tauri-apps/api/core'

const { compact = false, marketing = false, showPerformanceMonitorItem = false } = defineProps<{
  compact?: boolean
  marketing?: boolean
  showPerformanceMonitorItem?: boolean
}>()
const emit = defineEmits<{ openPerformanceMonitor: [] }>()

const router = useRouter()
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const { openDocs } = useDocsLink()

const featuresMenuOpen = ref(false)

const featureMenuItems = [
  {
    label: 'Gerber Viewer',
    description: 'View, measure, and inspect PCB layouts in your browser',
    icon: 'i-lucide-eye',
    to: '/features/gerber-viewer',
  },
  {
    label: 'NPI Suite',
    description: 'CAD/CAM data preparation for PCB manufacturing',
    icon: 'i-lucide-settings-2',
    to: '/features/npi-suite',
  },
  {
    label: 'Spark AI',
    description: 'AI-powered BOM enrichment and part matching',
    icon: 'i-lucide-sparkles',
    to: '/features/spark-ai',
  },
  {
    label: 'Part Search',
    description: 'Live component pricing from global distributors',
    icon: 'i-lucide-search',
    to: '/features/part-search',
  },
  {
    label: 'Desktop App',
    description: 'Native app for macOS and Windows with offline access',
    icon: 'i-lucide-monitor',
    to: '/features/desktop-app',
  },
]

const isTauri = import.meta.client && coreIsTauri()
const { isAuthenticated, signOut } = useAuth()
const { profile } = useCurrentUser()
const { unreadCount } = useNotifications()
const { teams, currentTeam, currentTeamRole, hasTeam, switchTeam } = useTeam()
const { isPlatformAdmin } = useAdminGuard()

const userInitials = computed(() => {
  const name = profile.value?.name ?? profile.value?.email ?? ''
  return name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2) || '?'
})

// Team selector dropdown items
const teamSelectorItems = computed(() => {
  const items = teams.value.map((t) => ({
    label: t.name,
    icon: t.id === currentTeam.value?.id ? 'i-lucide-check' : undefined,
    onSelect: () => switchTeam(t.id),
  }))

  const actionItems: any[] = []
  if (currentTeamRole.value !== 'guest') {
    actionItems.push({ label: 'Team Settings', icon: 'i-lucide-settings-2', onSelect: () => router.push('/team/spaces') })
  }
  actionItems.push({ label: 'Create Team', icon: 'i-lucide-plus', onSelect: () => router.push('/team/create') })

  return [
    items,
    actionItems,
  ]
})

const bugReportOpen = ref(false)

// Settings menu items
const settingsMenuItems = computed(() => {
  const items: any[][] = [
    [
      { label: 'Package Manager', icon: 'i-lucide-package', onSelect: () => router.push('/packages') },
    ],
  ]

  items.push([
    ...(showPerformanceMonitorItem
      ? [{
          label: 'Performance Monitor',
          icon: 'i-lucide-activity',
          onSelect: () => emit('openPerformanceMonitor'),
        }]
      : []),
    { label: 'Report a Bug', icon: 'i-lucide-bug', onSelect: () => { bugReportOpen.value = true } },
    {
      label: isDark.value ? 'Light Mode' : 'Dark Mode',
      icon: isDark.value ? 'i-lucide-sun' : 'i-lucide-moon',
      onSelect: () => toggleColorMode(),
    },
  ])

  return items
})

// User menu items
const userMenuItems = computed(() => {
  const profileGroup = [
    {
      label: profile.value?.name ?? profile.value?.email ?? 'Account',
      icon: 'i-lucide-user',
      onSelect: () => router.push('/profile'),
    },
  ]

  const actionGroup: any[] = [
    {
      label: 'Profile',
      icon: 'i-lucide-user-cog',
      onSelect: () => router.push('/profile'),
    },
  ]

  if (isPlatformAdmin.value) {
    actionGroup.push({
      label: 'Platform Admin',
      icon: 'i-lucide-shield',
      onSelect: () => router.push('/admin'),
    })
  }

  actionGroup.push({
    label: 'Sign Out',
    icon: 'i-lucide-log-out',
    onSelect: async () => {
      await signOut({ force: true })
      await router.replace('/auth/login')
      if (import.meta.client) window.location.reload()
    },
  })

  return [profileGroup, actionGroup]
})

// Sync native window titlebar theme with web app color mode
async function syncWindowTheme(dark: boolean) {
  if (!isTauri) return
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().setTheme(dark ? 'dark' : 'light')
  } catch {
    // Ignore if not available
  }
}

watch(isDark, (dark) => syncWindowTheme(dark), { immediate: true })

function toggleColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

function openDocumentation() {
  void openDocs()
}

function openInbox() {
  void router.push('/inbox')
}
</script>
