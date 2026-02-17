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

        <!-- Diagnostics section -->
        <div class="space-y-3 border-t border-neutral-200 dark:border-neutral-700 pt-3">
          <h4 class="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Diagnostics</h4>
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            icon="i-lucide-activity"
            class="justify-start"
            @click="$emit('openPerformance')"
          >
            Performance Monitor
          </UButton>
        </div>

        <div class="border-t border-neutral-200 dark:border-neutral-700 pt-3">
          <button
            class="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
            @click="resetDefaults"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
defineEmits<{ openPerformance: [] }>()
const { settings, resetDefaults } = useAppSettings()

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
</script>
