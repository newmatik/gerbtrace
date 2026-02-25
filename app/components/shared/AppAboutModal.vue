<template>
  <UModal v-model:open="open">
    <template #content>
      <div class="p-5 space-y-5">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">About</h3>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-x"
            @click="open = false"
          />
        </div>

        <div class="space-y-1.5">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-circuit-board" class="text-primary text-base" />
            <span class="text-sm font-semibold text-neutral-900 dark:text-white">Gerbtrace</span>
            <span class="text-xs text-neutral-400 dark:text-neutral-500 font-mono">v{{ appVersion }}</span>
          </div>

          <p class="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Gerber PCB file viewer and&#x200B;&#x200C;&#x200D;&#xFEFF; comparison tool.
          </p>
        </div>

        <div class="space-y-1">
          <a
            href="https://www.newmatik.com"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-primary transition-colors"
            @click.prevent="openExternal('https://www.newmatik.com')"
          >
            <UIcon name="i-lucide-building-2" class="text-sm" />
            <span>Newmatik GmbH</span>
            <UIcon name="i-lucide-external-link" class="text-[10px] opacity-50" />
          </a>
          <a
            href="mailto:software@newmatik.com"
            class="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-primary transition-colors"
            @click.prevent="openExternal('mailto:software@newmatik.com')"
          >
            <UIcon name="i-lucide-mail" class="text-sm" />
            <span>software@newmatik.com</span>
          </a>
          <a
            href="https://github.com/newmatik/gerbtrace"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-primary transition-colors"
            @click.prevent="openExternal('https://github.com/newmatik/gerbtrace')"
          >
            <UIcon name="i-lucide-github" class="text-sm" />
            <span>GitHub</span>
            <UIcon name="i-lucide-external-link" class="text-[10px] opacity-50" />
          </a>
        </div>

        <NuxtLink
          to="/licensing"
          class="text-[11px] text-neutral-400 dark:text-neutral-500 hover:text-primary transition-colors"
          @click="open = false"
        >
          BUSL-1.1 License
        </NuxtLink>

        <!-- Update check (only in Tauri desktop app) -->
        <div v-if="isTauri" class="border-t border-neutral-200 dark:border-neutral-700 pt-3">
          <UButton
            size="xs"
            variant="soft"
            icon="i-lucide-rotate-cw"
            :loading="updaterStatus.checking || updaterStatus.downloading"
            @click="handleUpdateCheck"
          >
            {{ updateButtonLabel }}
          </UButton>
          <div class="mt-1 space-y-0.5">
            <p
              v-if="!updaterStatus.checking && !updaterStatus.downloading && updaterStatus.lastResult === 'up_to_date'"
              class="text-[11px] text-neutral-500 dark:text-neutral-400"
            >
              You’re up to date.
            </p>
            <p v-if="updaterStatus.lastCheckedAt" class="text-[11px] text-neutral-400 dark:text-neutral-500">
              Last checked: {{ formatLastChecked(updaterStatus.lastCheckedAt) }}
            </p>
          </div>
          <p v-if="updaterStatus.error" class="text-[11px] text-red-500 mt-1">
            {{ updaterStatus.error }}
          </p>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
const { status: updaterStatus, isTauri, checkForUpdate, downloadAndInstall } = useUpdater()

const appVersion = useRuntimeConfig().public.appVersion as string

async function openExternal(url: string) {
  // Try the native Tauri opener first; this is the canonical desktop behavior.
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
    return
  } catch (error) {
    console.warn('[about] Failed to open via Tauri opener, falling back to web behavior:', error)
  }

  // Web fallback (and desktop fallback if opener plugin fails).
  if (url.startsWith('mailto:')) {
    window.location.href = url
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

const updateButtonLabel = computed(() => {
  if (updaterStatus.downloading) return 'Installing...'
  if (updaterStatus.checking) return 'Checking...'
  if (updaterStatus.available) return `Update to v${updaterStatus.version}`
  return 'Check for updates'
})

function formatLastChecked(ts: number) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts))
  } catch {
    return new Date(ts).toLocaleString()
  }
}

async function handleUpdateCheck() {
  if (updaterStatus.available) {
    await downloadAndInstall()
  } else {
    await checkForUpdate()
  }
}
</script>
