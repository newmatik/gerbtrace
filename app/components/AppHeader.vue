<template>
  <header class="h-11 border-b border-neutral-200 dark:border-neutral-800 flex items-center px-3 shrink-0 gap-2 bg-white dark:bg-neutral-900">
    <NuxtLink to="/" class="flex items-center gap-1.5 font-semibold text-sm shrink-0">
      <img
        :src="isDark ? '/icon-black.png' : '/icon-blue.png'"
        alt="Gerbtrace"
        class="size-5 rounded"
      >
      <span>Gerbtrace</span>
    </NuxtLink>

    <!-- Toolbar slot for page-specific tools -->
    <slot />

    <div class="flex-1" />
    <UButton
      to="/packages"
      size="xs"
      color="neutral"
      variant="ghost"
      icon="i-lucide-package"
      title="Package Manager"
    />
    <UButton
      size="xs"
      color="neutral"
      variant="ghost"
      :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
      title="Toggle color mode"
      @click="toggleColorMode"
    />
  </header>
</template>

<script setup lang="ts">
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

const isTauri = import.meta.client && !!(window as any).__TAURI_INTERNALS__

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

// Sync on initial load and whenever color mode changes
watch(isDark, (dark) => syncWindowTheme(dark), { immediate: true })

function toggleColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>
