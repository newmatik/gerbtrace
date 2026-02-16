<template>
  <UModal v-model:open="open">
    <template #content>
      <div class="p-5 space-y-4">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">Export Pick &amp; Place</h3>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-x"
            @click="open = false"
          />
        </div>

        <!-- Convention selector -->
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Convention</label>
          <div class="flex gap-1.5">
            <button
              v-for="[key, label] in conventionOptions"
              :key="key"
              class="px-2.5 py-1 text-xs rounded border transition-colors"
              :class="selectedConvention === key
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500'"
              @click="selectedConvention = key"
            >
              {{ label }}
            </button>
          </div>
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

        <!-- Component type selector -->
        <div v-if="componentModeOptions.length > 1" class="space-y-1.5">
          <label class="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Components</label>
          <div class="flex gap-1.5 flex-wrap">
            <button
              v-for="opt in componentModeOptions"
              :key="opt.value"
              class="px-2.5 py-1 text-xs rounded border transition-colors"
              :class="selectedComponentMode === opt.value
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500'"
              @click="selectedComponentMode = opt.value"
            >
              {{ opt.label }}
            </button>
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

        <!-- DNP option -->
        <div v-if="dnpCount > 0" class="flex items-center gap-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="excludeDnp"
              type="checkbox"
              class="rounded border-neutral-300 dark:border-neutral-600 text-primary focus:ring-primary/50 cursor-pointer"
            />
            <span class="text-xs text-neutral-600 dark:text-neutral-400">
              Exclude {{ dnpCount }} DNP component{{ dnpCount !== 1 ? 's' : '' }}
            </span>
          </label>
        </div>

        <!-- Summary -->
        <div class="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/50 rounded-md px-3 py-2">
          <template v-if="selectedComponentMode === 'separate'">
            {{ smdCount }} SMD + {{ thtCount }} THT component{{ (smdCount + thtCount) !== 1 ? 's' : '' }} — separate files
          </template>
          <template v-else>
            {{ exportCount }} component{{ exportCount !== 1 ? 's' : '' }}
            <span v-if="selectedComponentMode !== 'all'" class="text-neutral-400">({{ selectedComponentMode.toUpperCase() }})</span>
          </template>
          <span v-if="overrideCount > 0" class="text-amber-600 dark:text-amber-400">
            ({{ overrideCount }} with edits)
          </span>
          <span v-if="dnpCount > 0 && !excludeDnp" class="text-orange-500 dark:text-orange-400">
            ({{ dnpCount }} marked DNP)
          </span>
          <template v-if="willZip">
            — will download as ZIP
          </template>
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
import type { PnPConvention } from '~/utils/pnp-conventions'
import { PNP_CONVENTION_LABELS } from '~/utils/pnp-conventions'
import type { EditablePnPComponent } from '~/composables/usePickAndPlace'
import type { PnPExportFormat, PnPExportSideMode } from '~/utils/pnp-export'

export type PnPExportComponentMode = 'smd' | 'tht' | 'all' | 'separate'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  /** Default convention (from the component panel selection) */
  defaultConvention: PnPConvention
  /** All components to export */
  components: EditablePnPComponent[]
  /** Project name for the header */
  projectName: string
  /** Whether there are any SMD components */
  hasSmd?: boolean
  /** Whether there are any THT components */
  hasTht?: boolean
}>()

const emit = defineEmits<{
  export: [options: { convention: PnPConvention; format: PnPExportFormat; sideMode: PnPExportSideMode; componentMode: PnPExportComponentMode; excludeDnp: boolean }]
}>()

const conventionOptions = Object.entries(PNP_CONVENTION_LABELS) as [PnPConvention, string][]

const formatOptions: { label: string; value: PnPExportFormat }[] = [
  { label: 'Text (Tab)', value: 'tsv' },
  { label: 'CSV', value: 'csv' },
]

const sideOptions: { label: string; value: PnPExportSideMode }[] = [
  { label: 'Combined', value: 'combined' },
  { label: 'Top Only', value: 'top' },
  { label: 'Bottom Only', value: 'bottom' },
  { label: 'Separate (ZIP)', value: 'separate' },
]

const selectedConvention = ref<PnPConvention>(props.defaultConvention)
const selectedFormat = ref<PnPExportFormat>('tsv')
const selectedSide = ref<PnPExportSideMode>('combined')
const selectedComponentMode = ref<PnPExportComponentMode>('all')
const excludeDnp = ref(false)

const componentModeOptions = computed(() => {
  const opts: { label: string; value: PnPExportComponentMode }[] = []
  if (props.hasSmd && props.hasTht) {
    opts.push({ label: 'All', value: 'all' })
    opts.push({ label: 'SMD only', value: 'smd' })
    opts.push({ label: 'THT only', value: 'tht' })
    opts.push({ label: 'Separate SMD + THT', value: 'separate' })
  } else if (props.hasSmd) {
    opts.push({ label: 'SMD', value: 'smd' })
  } else if (props.hasTht) {
    opts.push({ label: 'THT', value: 'tht' })
  } else {
    opts.push({ label: 'All', value: 'all' })
  }
  return opts
})

/** Filtered components for counting, based on the selected component mode. */
const filteredByType = computed(() => {
  if (selectedComponentMode.value === 'smd') return props.components.filter(c => c.componentType === 'smd')
  if (selectedComponentMode.value === 'tht') return props.components.filter(c => c.componentType === 'tht')
  return props.components
})

const dnpCount = computed(() => filteredByType.value.filter(c => c.dnp).length)
const overrideCount = computed(() => filteredByType.value.filter(c => c.rotationOverridden).length)

const smdCount = computed(() => props.components.filter(c => c.componentType === 'smd').length)
const thtCount = computed(() => props.components.filter(c => c.componentType === 'tht').length)

const exportCount = computed(() => {
  let list = filteredByType.value
  if (selectedSide.value === 'top') list = list.filter(c => c.side === 'top')
  else if (selectedSide.value === 'bottom') list = list.filter(c => c.side === 'bottom')
  if (excludeDnp.value) list = list.filter(c => !c.dnp)
  return list.length
})

// Reset convention to current default when modal opens
watch(open, (isOpen) => {
  if (isOpen) {
    selectedConvention.value = props.defaultConvention
    // Default component mode based on what's available
    if (props.hasSmd && props.hasTht) selectedComponentMode.value = 'all'
    else if (props.hasSmd) selectedComponentMode.value = 'smd'
    else if (props.hasTht) selectedComponentMode.value = 'tht'
    else selectedComponentMode.value = 'all'
  }
})

const willZip = computed(() =>
  selectedSide.value === 'separate' || selectedComponentMode.value === 'separate',
)

function handleExport() {
  emit('export', {
    convention: selectedConvention.value,
    format: selectedFormat.value,
    sideMode: selectedSide.value,
    componentMode: selectedComponentMode.value,
    excludeDnp: excludeDnp.value,
  })
  open.value = false
}
</script>
