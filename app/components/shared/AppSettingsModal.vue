<template>
  <UModal v-model:open="open">
    <template #content>
      <div class="p-5 space-y-5">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">Settings</h3>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-x"
            @click="open = false"
          />
        </div>

        <!-- Grid section -->
        <div class="space-y-3">
          <h4 class="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Grid</h4>

          <div class="flex items-center justify-between">
            <label class="text-sm text-neutral-700 dark:text-neutral-300">Show grid in layer view</label>
            <USwitch v-model="settings.gridEnabled" size="sm" />
          </div>

          <div class="flex items-center justify-between gap-4">
            <label class="text-sm text-neutral-700 dark:text-neutral-300 shrink-0">Grid spacing</label>
            <div class="flex items-center gap-2">
              <UInput
                v-model.number="gridSpacingInput"
                type="number"
                size="sm"
                class="w-20"
                :min="0.1"
                :step="1"
                @blur="commitGridSpacing"
                @keydown.enter="commitGridSpacing"
              />
              <span class="text-xs text-neutral-500">mm</span>
            </div>
          </div>

          <!-- Quick preset buttons -->
          <div class="flex gap-1.5">
            <button
              v-for="preset in gridPresets"
              :key="preset"
              class="px-2 py-0.5 text-[11px] rounded border transition-colors"
              :class="settings.gridSpacingMm === preset
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500'"
              @click="setGridSpacing(preset)"
            >
              {{ preset }}mm
            </button>
          </div>
        </div>

        <div class="border-t border-neutral-200 dark:border-neutral-700 pt-3">
          <button
            class="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            @click="resetDefaults"
          >
            Reset to defaults
          </button>
        </div>

        <!-- About section -->
        <div class="border-t border-neutral-200 dark:border-neutral-700 pt-4 space-y-3">
          <h4 class="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">About</h4>

          <div class="space-y-1.5">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-circuit-board" class="text-primary text-base" />
              <span class="text-sm font-semibold text-neutral-900 dark:text-white">Gerbtrace</span>
              <span class="text-xs text-neutral-400 dark:text-neutral-500 font-mono">v{{ appVersion }}</span>
            </div>

            <p class="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Gerber PCB file viewer and comparison tool.
            </p>
          </div>

          <div class="space-y-1">
            <a
              href="https://www.newmatik.com"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-primary transition-colors"
            >
              <UIcon name="i-lucide-building-2" class="text-sm" />
              <span>Newmatik GmbH</span>
              <UIcon name="i-lucide-external-link" class="text-[10px] opacity-50" />
            </a>
            <a
              href="mailto:software@newmatik.com"
              class="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-primary transition-colors"
            >
              <UIcon name="i-lucide-mail" class="text-sm" />
              <span>software@newmatik.com</span>
            </a>
            <a
              href="https://github.com/newmatik/gerbtrace"
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-primary transition-colors"
            >
              <UIcon name="i-lucide-github" class="text-sm" />
              <span>GitHub</span>
              <UIcon name="i-lucide-external-link" class="text-[10px] opacity-50" />
            </a>
          </div>

          <p class="text-[11px] text-neutral-400 dark:text-neutral-500">
            MIT License
          </p>

          <!-- Update check (only in Tauri desktop app) -->
          <div v-if="isTauri" class="pt-1">
            <UButton
              size="xs"
              variant="soft"
              icon="i-lucide-refresh-cw"
              :loading="updaterStatus.checking || updaterStatus.downloading"
              @click="handleUpdateCheck"
            >
              {{ updateButtonLabel }}
            </UButton>
            <p v-if="updaterStatus.error" class="text-[11px] text-red-500 mt-1">
              {{ updaterStatus.error }}
            </p>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
const { settings, resetDefaults } = useAppSettings()
const { status: updaterStatus, isTauri, checkForUpdate, downloadAndInstall } = useUpdater()

const config = useRuntimeConfig()
const appVersion = config.public.appVersion as string

const gridPresets = [1, 2.54, 5, 10, 25]

const gridSpacingInput = ref(settings.gridSpacingMm)

// Keep the input in sync when settings change externally
watch(() => settings.gridSpacingMm, (val) => {
  gridSpacingInput.value = val
})

function commitGridSpacing() {
  const val = Number(gridSpacingInput.value)
  if (val > 0 && isFinite(val)) {
    settings.gridSpacingMm = val
  } else {
    gridSpacingInput.value = settings.gridSpacingMm
  }
}

function setGridSpacing(mm: number) {
  settings.gridSpacingMm = mm
  gridSpacingInput.value = mm
}

const updateButtonLabel = computed(() => {
  if (updaterStatus.downloading) return 'Installing...'
  if (updaterStatus.checking) return 'Checking...'
  if (updaterStatus.available) return `Update to v${updaterStatus.version}`
  return 'Check for updates'
})

async function handleUpdateCheck() {
  if (updaterStatus.available) {
    await downloadAndInstall()
  } else {
    await checkForUpdate()
  }
}
</script>
