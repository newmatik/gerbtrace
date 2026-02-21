<template>
  <UModal v-model:open="open">
    <template #content>
      <div class="p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">Export DXF</h3>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-x"
            @click="open = false"
          />
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Output</label>
          <div class="flex gap-1.5">
            <button
              v-for="mode in modeOptions"
              :key="mode.value"
              class="px-2.5 py-1 text-xs rounded border transition-colors"
              :class="selectedMode === mode.value
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500'"
              @click="selectedMode = mode.value"
            >
              {{ mode.label }}
            </button>
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">DXF variant</label>
          <div class="flex gap-1.5">
            <button
              v-for="variant in variantOptions"
              :key="variant.value"
              class="px-2.5 py-1 text-xs rounded border transition-colors"
              :class="selectedVariant === variant.value
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500'"
              @click="selectedVariant = variant.value"
            >
              {{ variant.label }}
            </button>
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Layers</label>
            <div class="flex gap-1">
              <UButton size="xs" color="neutral" variant="ghost" @click="selectAll">
                All
              </UButton>
              <UButton size="xs" color="neutral" variant="ghost" @click="selectNone">
                None
              </UButton>
            </div>
          </div>

          <div class="max-h-56 overflow-auto rounded-md border border-neutral-200 dark:border-neutral-700 px-2 py-1.5">
            <div
              v-for="layer in props.layers"
              :key="`${layer.index}:${layer.fileName}`"
              class="py-1"
            >
              <label class="flex items-start gap-2 cursor-pointer">
                <UCheckbox
                  :model-value="selectedLayerSet.has(layer.index)"
                  @update:model-value="toggleLayer(layer.index, !!$event)"
                />
                <span class="min-w-0">
                  <span class="block text-xs text-neutral-900 dark:text-white truncate">
                    {{ layer.fileName }}
                  </span>
                  <span class="block text-[11px] text-neutral-500 dark:text-neutral-400">
                    {{ layer.type }}
                  </span>
                </span>
              </label>
            </div>
            <div v-if="props.layers.length === 0" class="text-xs text-neutral-500 dark:text-neutral-400 py-1">
              No exportable Gerber layers available.
            </div>
          </div>
        </div>

        <div class="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/50 rounded-md px-3 py-2">
          <span>{{ selectedCount }} selected layer{{ selectedCount === 1 ? '' : 's' }}</span>
          <span class="text-neutral-400"> - {{ selectedMode === 'combined' ? 'one DXF file' : 'ZIP with one DXF per layer' }}</span>
          <span class="text-neutral-400"> - {{ selectedVariantLabel }}</span>
        </div>

        <div class="flex justify-end pt-1">
          <UButton
            size="sm"
            color="primary"
            icon="i-lucide-download"
            :disabled="selectedCount === 0 || props.layers.length === 0"
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
export type DxfExportMode = 'combined' | 'zip'
export type DxfExportVariant = 'r12' | 'r2000'

interface DxfLayerOption {
  index: number
  fileName: string
  type: string
}

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  layers: DxfLayerOption[]
}>()

const emit = defineEmits<{
  export: [options: { selectedLayerIndices: number[]; mode: DxfExportMode; variant: DxfExportVariant }]
}>()

const modeOptions: Array<{ label: string; value: DxfExportMode }> = [
  { label: 'Combined DXF', value: 'combined' },
  { label: 'ZIP per layer', value: 'zip' },
]

const variantOptions: Array<{ label: string; value: DxfExportVariant }> = [
  { label: 'POLYLINE (R12)', value: 'r12' },
  { label: 'LWPOLYLINE (R2000+)', value: 'r2000' },
]

const selectedMode = ref<DxfExportMode>('combined')
const selectedVariant = ref<DxfExportVariant>('r2000')
const selectedLayerSet = ref<Set<number>>(new Set())

const selectedCount = computed(() => selectedLayerSet.value.size)
const selectedVariantLabel = computed(() =>
  selectedVariant.value === 'r12' ? 'POLYLINE (R12)' : 'LWPOLYLINE (R2000+)',
)

function selectAll() {
  selectedLayerSet.value = new Set(props.layers.map(layer => layer.index))
}

function selectNone() {
  selectedLayerSet.value = new Set()
}

function toggleLayer(index: number, checked: boolean) {
  const next = new Set(selectedLayerSet.value)
  if (checked) next.add(index)
  else next.delete(index)
  selectedLayerSet.value = next
}

watch(open, (isOpen) => {
  if (!isOpen) return
  selectedMode.value = 'combined'
  selectedVariant.value = 'r2000'
  selectAll()
})

function handleExport() {
  if (selectedLayerSet.value.size === 0) return
  emit('export', {
    selectedLayerIndices: Array.from(selectedLayerSet.value).sort((a, b) => a - b),
    mode: selectedMode.value,
    variant: selectedVariant.value,
  })
  open.value = false
}
</script>
