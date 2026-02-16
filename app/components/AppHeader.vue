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

    <!-- Team selector (when user has teams) -->
    <UDropdownMenu v-if="isAuthenticated && hasTeam" :items="teamSelectorItems">
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

    <!-- Settings / Packages dropdown -->
    <UDropdownMenu :items="settingsMenuItems">
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-settings"
        title="Settings & Packages"
      />
    </UDropdownMenu>

    <!-- Theme toggle -->
    <UButton
      size="xs"
      color="neutral"
      variant="ghost"
      :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
      title="Toggle color mode"
      @click="toggleColorMode"
    />

    <!-- User menu or Sign In -->
    <UDropdownMenu v-if="isAuthenticated" :items="userMenuItems">
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        class="rounded-full"
      >
        <div class="size-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
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
  </header>
</template>

<script setup lang="ts">
import { useColorMode } from '#imports'
import { isTauri as coreIsTauri } from '@tauri-apps/api/core'

const { compact = false } = defineProps<{ compact?: boolean }>()

const router = useRouter()
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const isTauri = import.meta.client && coreIsTauri()
const { isAuthenticated, signOut } = useAuth()
const { profile } = useCurrentUser()
const { teams, currentTeam, hasTeam, isAdmin, switchTeam } = useTeam()

const userInitials = computed(() => {
  const name = profile.value?.name ?? profile.value?.email ?? ''
  return name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2) || '?'
})

// Team selector dropdown items
const teamSelectorItems = computed(() => {
  const items = teams.value.map(t => ({
    label: t.name,
    icon: t.id === currentTeam.value?.id ? 'i-lucide-check' : undefined,
    onSelect: () => switchTeam(t.id),
  }))
  return [
    items,
    [{ label: 'Create Team', icon: 'i-lucide-plus', onSelect: () => router.push('/team/create') }],
  ]
})

// Settings menu items (packages, team settings)
const settingsMenuItems = computed(() => {
  const items: any[][] = [
    [
      { label: 'Local Packages', icon: 'i-lucide-package', onSelect: () => router.push('/packages') },
    ],
  ]

  if (isAuthenticated.value && hasTeam.value) {
    items[0]!.push({
      label: 'Team Packages',
      icon: 'i-lucide-package-check',
      onSelect: () => router.push('/team/packages'),
    })
  }

  if (isAdmin.value) {
    items.push([
      { label: 'Team Settings', icon: 'i-lucide-settings-2', onSelect: () => router.push('/team/settings') },
      { label: 'Team Members', icon: 'i-lucide-users', onSelect: () => router.push('/team/members') },
    ])
  }

  return items
})

// User menu items
const userMenuItems = computed(() => [
  [
    {
      label: profile.value?.name ?? profile.value?.email ?? 'Account',
      icon: 'i-lucide-user',
      type: 'label' as const,
    },
  ],
  [
    {
      label: 'Sign Out',
      icon: 'i-lucide-log-out',
      onSelect: async () => {
        await signOut()
        router.replace('/')
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
</script>
