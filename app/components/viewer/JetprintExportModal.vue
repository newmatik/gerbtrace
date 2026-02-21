<template>
  <UModal v-model:open="open">
    <template #content>
      <div class="p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">Export JPSys Program</h3>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-x"
            @click="open = false"
          />
        </div>

        <div class="space-y-3">
          <!-- Ejector type -->
          <div class="space-y-1">
            <label class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Ejector Type</label>
            <USelect
              v-model="ejectorType"
              :items="ejectorOptions"
              size="sm"
            />
          </div>

          <!-- Volume % -->
          <div class="space-y-1">
            <label class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Volume %</label>
            <USelect
              v-model="volumePercent"
              :items="volumeOptions"
              size="sm"
            />
          </div>

          <!-- Program name -->
          <div class="space-y-1">
            <label class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Program Name</label>
            <UInput
              v-model="programName"
              size="sm"
              placeholder="e.g. PCB-TOP-AG04-100"
            />
          </div>

          <!-- Machine type -->
          <div class="space-y-1">
            <label class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Machine Type</label>
            <UInput
              v-model="machineType"
              size="sm"
              placeholder="MY500_S3"
            />
          </div>

          <!-- Stencil height -->
          <div class="space-y-1">
            <label class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Stencil Height (µm)</label>
            <UInput
              v-model.number="stencilHeight"
              type="number"
              size="sm"
              :min="50"
              :max="300"
            />
          </div>

          <!-- Shrink factor -->
          <div class="space-y-1">
            <label class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Deposit Shrink Factor</label>
            <UInput
              v-model.number="shrinkFactor"
              type="number"
              size="sm"
              :min="0.80"
              :max="1.00"
              step="0.01"
            />
          </div>
        </div>

        <!-- Info -->
        <div v-if="padCount > 0" class="bg-neutral-50 dark:bg-neutral-800 rounded p-2.5 text-[10px] text-neutral-500 space-y-0.5">
          <div>Paste pads: {{ padCount }}</div>
          <div>Ejector: {{ ejectorType }} ({{ ejectorMedia }})</div>
        </div>

        <!-- Export -->
        <UButton
          block
          color="primary"
          size="sm"
          :disabled="!canExport"
          @click="doExport"
        >
          Export JPSys JSON
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { ImageTree } from '@lib/gerber/types'
import { EJECTOR_PROFILES, type EjectorType } from '@lib/jetprint/jpsys-types'
import { generateJpsysProgram, exportJpsysJson } from '@lib/jetprint/jpsys-export'
import { extractPastePads } from '@lib/jetprint/paste-extractor'

const props = defineProps<{
  pasteTree: ImageTree | null
  boardWidthMm: number
  boardHeightMm: number
  boardRotation?: number
  projectName?: string
}>()

const open = defineModel<boolean>('open', { default: false })

const ejectorType = ref<EjectorType>('AG04')
const volumePercent = ref('100')
const programName = ref('')
const machineType = ref('MY500_S3')
const stencilHeight = ref(127)
const shrinkFactor = ref(0.96)

const ejectorOptions = [
  { label: 'AG04 (Standard)', value: 'AG04' },
  { label: 'AR02 (Fine-Pitch)', value: 'AR02' },
]

const volumeOptions = [
  { label: '90%', value: '90' },
  { label: '100%', value: '100' },
  { label: '130%', value: '130' },
]

const ejectorMedia = computed(() => EJECTOR_PROFILES[ejectorType.value].media)

const padCount = computed(() => {
  if (!props.pasteTree) return 0
  return extractPastePads(props.pasteTree).length
})

const canExport = computed(() => padCount.value > 0 && programName.value.trim().length > 0)

watch(() => props.projectName, (name) => {
  if (name && !programName.value) {
    programName.value = `${name}-${ejectorType.value}-${volumePercent.value}`
  }
}, { immediate: true })

watch([ejectorType, volumePercent], () => {
  if (props.projectName) {
    programName.value = `${props.projectName}-${ejectorType.value}-${volumePercent.value}`
  }
})

function doExport() {
  if (!props.pasteTree) return

  const layout = generateJpsysProgram({
    pasteTree: props.pasteTree,
    boardWidthMm: props.boardWidthMm,
    boardHeightMm: props.boardHeightMm,
    boardRotationDeg: props.boardRotation ?? 0,
    config: {
      ejectorType: ejectorType.value,
      volumePercent: Number(volumePercent.value),
      stencilHeight: stencilHeight.value,
      shrinkFactor: shrinkFactor.value,
      machineType: machineType.value,
      programName: programName.value,
      creator: 'gerbtrace',
    },
  })

  const json = exportJpsysJson(layout)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${programName.value || 'jpsys-export'}.json`
  a.click()
  URL.revokeObjectURL(url)

  open.value = false
}
</script>
