<template>
  <UModal v-model:open="open">
    <template #content>
      <div class="p-5 space-y-4">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">Download Image</h3>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-x"
            @click="open = false"
          />
        </div>

        <!-- Format selector -->
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Format</label>
          <div class="flex gap-1.5">
            <button
              v-for="fmt in formatOptions"
              :key="fmt.value"
              class="px-2.5 py-1 text-xs rounded border transition-colors"
              :class="selectedFormat === fmt.value
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500'"
              @click="selectedFormat = fmt.value"
            >
              {{ fmt.label }}
            </button>
          </div>
        </div>

        <!-- Resolution selector (PNG only) -->
        <div v-if="selectedFormat === 'png'" class="space-y-1.5">
          <label class="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Resolution</label>
          <div class="flex gap-1.5 flex-wrap items-center">
            <button
              v-for="preset in dpiPresets"
              :key="preset"
              class="px-2.5 py-1 text-xs rounded border transition-colors"
              :class="selectedDpi === preset && !customDpiActive
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500'"
              @click="selectPresetDpi(preset)"
            >
              {{ preset }} DPI
            </button>
            <button
              class="px-2.5 py-1 text-xs rounded border transition-colors"
              :class="customDpiActive
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500'"
              @click="activateCustomDpi"
            >
              Custom
            </button>
          </div>
          <div v-if="customDpiActive" class="flex items-center gap-2 mt-1">
            <input
              ref="customDpiInputRef"
              v-model.number="customDpiValue"
              type="number"
              min="72"
              max="4800"
              step="1"
              class="w-20 px-2 py-1 text-xs rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
              @input="onCustomDpiInput"
            />
            <span class="text-xs text-neutral-500 dark:text-neutral-400">DPI (72–4800)</span>
          </div>
          <div v-if="estimatedDimensions" class="text-[11px] text-neutral-500 dark:text-neutral-400">
            Estimated output: {{ estimatedDimensions.width }} &times; {{ estimatedDimensions.height }} px
          </div>
        </div>

        <!-- Components selector -->
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Components</label>
          <div class="flex gap-1.5 flex-wrap">
            <button
              v-for="opt in componentsOptions"
              :key="opt.value"
              class="px-2.5 py-1 text-xs rounded border transition-colors"
              :class="selectedComponents === opt.value
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500'"
              :disabled="opt.requiresPnP && !hasPnP"
              @click="() => { if (!opt.requiresPnP || hasPnP) selectedComponents = opt.value }"
            >
              {{ opt.label }}
            </button>
          </div>
          <div v-if="!hasPnP" class="text-[11px] text-neutral-500 dark:text-neutral-400">
            No Pick &amp; Place data loaded — component rendering is unavailable.
          </div>
        </div>

        <!-- Side selector -->
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Side</label>
          <div class="flex gap-1.5 flex-wrap">
            <button
              v-for="opt in sideOptions"
              :key="opt.value"
              class="px-2.5 py-1 text-xs rounded border transition-colors"
              :class="selectedSide === opt.value
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500'"
              @click="selectedSide = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Summary -->
        <div class="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/50 rounded-md px-3 py-2">
          <span v-if="willZip">Will download as ZIP</span>
          <span v-else>Will download a single file</span>
        </div>

        <!-- Download button -->
        <div class="flex justify-end pt-1">
          <UButton
            size="sm"
            color="primary"
            icon="i-lucide-download"
            @click="handleExport"
          >
            Download
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { EXPORT_DPI_PRESETS, useAppSettings } from '~/composables/useAppSettings'

export type ImageExportFormat = 'png' | 'svg'
export type ImageExportComponentsMode = 'none' | 'with' | 'both'
export type ImageExportSideMode = 'top' | 'bottom' | 'both'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  hasPnP: boolean
  /** Board physical dimensions in mm, used for estimated output size display */
  boardSizeMm?: { width: number; height: number }
}>()

const emit = defineEmits<{
  export: [options: { format: ImageExportFormat; componentsMode: ImageExportComponentsMode; sideMode: ImageExportSideMode; dpi: number }]
}>()

const { settings: appSettings } = useAppSettings()
const hasPnP = computed(() => props.hasPnP)

const formatOptions: { label: string; value: ImageExportFormat }[] = [
  { label: 'PNG', value: 'png' },
  { label: 'SVG', value: 'svg' },
]

const dpiPresets = EXPORT_DPI_PRESETS

const componentsOptions: { label: string; value: ImageExportComponentsMode; requiresPnP?: boolean }[] = [
  { label: 'No components', value: 'none' },
  { label: 'With components', value: 'with', requiresPnP: true },
  { label: 'Both (ZIP)', value: 'both', requiresPnP: true },
]

const sideOptions: { label: string; value: ImageExportSideMode }[] = [
  { label: 'Top only', value: 'top' },
  { label: 'Bottom only', value: 'bottom' },
  { label: 'Both (ZIP)', value: 'both' },
]

const selectedFormat = ref<ImageExportFormat>('png')
const selectedComponents = ref<ImageExportComponentsMode>('none')
const selectedSide = ref<ImageExportSideMode>('top')

const selectedDpi = ref(appSettings.exportDpi)
const customDpiActive = ref(false)
const customDpiValue = ref(appSettings.exportDpi)
const customDpiInputRef = ref<HTMLInputElement | null>(null)

function selectPresetDpi(preset: number) {
  customDpiActive.value = false
  selectedDpi.value = preset
}

function activateCustomDpi() {
  customDpiActive.value = true
  customDpiValue.value = selectedDpi.value
  nextTick(() => customDpiInputRef.value?.focus())
}

function onCustomDpiInput() {
  const v = customDpiValue.value
  if (typeof v === 'number' && v >= 72 && v <= 4800) {
    selectedDpi.value = Math.round(v)
  }
}

const estimatedDimensions = computed(() => {
  if (!props.boardSizeMm || selectedFormat.value !== 'png') return null
  const { width, height } = props.boardSizeMm
  if (width <= 0 || height <= 0) return null
  const dpi = selectedDpi.value
  const w = Math.ceil((width / 25.4) * dpi)
  const h = Math.ceil((height / 25.4) * dpi)
  return { width: w, height: h }
})

const willZip = computed(() =>
  selectedSide.value === 'both' || selectedComponents.value === 'both',
)

watch(open, (isOpen) => {
  if (!isOpen) return
  // Reset DPI to persisted setting when modal opens
  selectedDpi.value = appSettings.exportDpi
  customDpiActive.value = !(EXPORT_DPI_PRESETS as readonly number[]).includes(appSettings.exportDpi)
  if (customDpiActive.value) customDpiValue.value = appSettings.exportDpi
  // If no PnP is available, force "none"
  if (!hasPnP.value) selectedComponents.value = 'none'
})

function handleExport() {
  const componentsMode = hasPnP.value ? selectedComponents.value : 'none'
  const dpi = selectedDpi.value
  // Persist the chosen DPI for future exports
  appSettings.exportDpi = dpi
  emit('export', {
    format: selectedFormat.value,
    componentsMode,
    sideMode: selectedSide.value,
    dpi,
  })
  open.value = false
}
</script>

