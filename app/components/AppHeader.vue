<template>
  <header :class="['h-11 border-b border-neutral-200 dark:border-neutral-800 flex items-center shrink-0 bg-white dark:bg-neutral-900', compact ? 'px-2 gap-1.5' : 'px-3 gap-2']">
    <NuxtLink to="/" class="flex items-center gap-1.5 font-semibold text-sm shrink-0" :title="compact ? 'Gerbtrace – Home' : undefined">
      <img
        :src="isDark ? '/icon-black.png' : '/icon-blue.png'"
        alt="Gerbtrace"
        class="size-5 rounded"
      >
      <span v-if="!compact">Gerbtrace</span>
    </NuxtLink>

    <!-- Toolbar slot for page-specific tools -->
    <slot />

    <div class="flex-1" />

    <!-- Right-side slot (before team selector) -->
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

const { compact = false, showPerformanceMonitorItem = false } = defineProps<{
  compact?: boolean
  showPerformanceMonitorItem?: boolean
}>()
const emit = defineEmits<{ openPerformanceMonitor: [] }>()

const router = useRouter()
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
const { openDocs } = useDocsLink()

const isTauri = import.meta.client && coreIsTauri()
const { isAuthenticated, signOut } = useAuth()
const { profile } = useCurrentUser()
const { unreadCount } = useNotifications()
const { teams, currentTeam, currentTeamRole, hasTeam, switchTeam } = useTeam()

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
const userMenuItems = computed(() => [
  [
    {
      label: profile.value?.name ?? profile.value?.email ?? 'Account',
      icon: 'i-lucide-user',
      onSelect: () => router.push('/profile'),
    },
  ],
  [
    {
      label: 'Profile',
      icon: 'i-lucide-user-cog',
      onSelect: () => router.push('/profile'),
    },
    {
      label: 'Sign Out',
      icon: 'i-lucide-log-out',
      onSelect: async () => {
        await signOut({ force: true })
        await router.replace('/auth/login')
        if (import.meta.client) window.location.reload()
      },
    },
  ],
])

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
