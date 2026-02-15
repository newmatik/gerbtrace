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
export type ImageExportFormat = 'png' | 'svg'
export type ImageExportComponentsMode = 'none' | 'with' | 'both'
export type ImageExportSideMode = 'top' | 'bottom' | 'both'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  hasPnP: boolean
}>()

const emit = defineEmits<{
  export: [options: { format: ImageExportFormat; componentsMode: ImageExportComponentsMode; sideMode: ImageExportSideMode }]
}>()

const hasPnP = computed(() => props.hasPnP)

const formatOptions: { label: string; value: ImageExportFormat }[] = [
  { label: 'PNG', value: 'png' },
  { label: 'SVG', value: 'svg' },
]

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

const willZip = computed(() =>
  selectedSide.value === 'both' || selectedComponents.value === 'both',
)

watch(open, (isOpen) => {
  if (!isOpen) return
  // If no PnP is available, force "none"
  if (!hasPnP.value) selectedComponents.value = 'none'
})

function handleExport() {
  const componentsMode = hasPnP.value ? selectedComponents.value : 'none'
  emit('export', {
    format: selectedFormat.value,
    componentsMode,
    sideMode: selectedSide.value,
  })
  open.value = false
}
</script>

