<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <div class="flex-1 overflow-y-auto">
      <div class="p-4 space-y-4">
        <div class="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
          Board Parameters
        </div>

        <!-- PCB Size X -->
        <div class="space-y-1">
          <label class="text-[11px] text-neutral-500 dark:text-neutral-400">
            PCB Size X (mm)
          </label>
          <div class="flex items-center gap-1.5">
            <input
              :value="localData.sizeX ?? ''"
              type="number"
              min="0"
              step="0.1"
              placeholder="e.g. 80"
              class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2.5 py-1.5 outline-none placeholder:text-neutral-400 focus:border-primary transition-colors tabular-nums"
              @input="updateField('sizeX', parseNumber(($event.target as HTMLInputElement).value))"
            />
            <button
              v-if="boardSizeMm"
              class="shrink-0 text-[10px] px-1.5 py-1 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-primary hover:border-primary/30 transition-colors whitespace-nowrap"
              title="Use detected board width"
              @click="updateField('sizeX', roundMm(boardSizeMm.width))"
            >
              {{ roundMm(boardSizeMm.width) }}
            </button>
          </div>
        </div>

        <!-- PCB Size Y -->
        <div class="space-y-1">
          <label class="text-[11px] text-neutral-500 dark:text-neutral-400">
            PCB Size Y (mm)
          </label>
          <div class="flex items-center gap-1.5">
            <input
              :value="localData.sizeY ?? ''"
              type="number"
              min="0"
              step="0.1"
              placeholder="e.g. 60"
              class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2.5 py-1.5 outline-none placeholder:text-neutral-400 focus:border-primary transition-colors tabular-nums"
              @input="updateField('sizeY', parseNumber(($event.target as HTMLInputElement).value))"
            />
            <button
              v-if="boardSizeMm"
              class="shrink-0 text-[10px] px-1.5 py-1 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-primary hover:border-primary/30 transition-colors whitespace-nowrap"
              title="Use detected board height"
              @click="updateField('sizeY', roundMm(boardSizeMm.height))"
            >
              {{ roundMm(boardSizeMm.height) }}
            </button>
          </div>
        </div>

        <!-- Computed board area -->
        <div
          v-if="localData.sizeX && localData.sizeY"
          class="text-[10px] text-neutral-400 tabular-nums"
        >
          Board area: {{ ((localData.sizeX * localData.sizeY) / 100).toFixed(1) }} cm²
        </div>

        <!-- Layer Count -->
        <div class="space-y-1">
          <label class="text-[11px] text-neutral-500 dark:text-neutral-400">
            Layer Count
          </label>
          <div class="flex items-center gap-1.5">
            <select
              :value="localData.layerCount ?? ''"
              class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2.5 py-1.5 outline-none focus:border-primary transition-colors"
              @change="updateField('layerCount', parseInt(($event.target as HTMLSelectElement).value) || undefined)"
            >
              <option value="" disabled>Select layers...</option>
              <option v-for="n in LAYER_COUNT_OPTIONS" :key="n" :value="n">
                {{ n }} {{ n === 1 ? 'layer' : 'layers' }}
              </option>
            </select>
            <button
              v-if="detectedLayerCount && detectedLayerCount !== localData.layerCount"
              class="shrink-0 text-[10px] px-1.5 py-1 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-primary hover:border-primary/30 transition-colors whitespace-nowrap"
              :title="`Detected ${detectedLayerCount} copper layers from Gerber files`"
              @click="updateField('layerCount', detectedLayerCount)"
            >
              {{ detectedLayerCount }}L
            </button>
          </div>
        </div>

        <!-- Surface Finish -->
        <div class="space-y-1">
          <label class="text-[11px] text-neutral-500 dark:text-neutral-400">
            Surface Finish
          </label>
          <select
            :value="localData.surfaceFinish ?? ''"
            class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2.5 py-1.5 outline-none focus:border-primary transition-colors"
            @change="updateField('surfaceFinish', ($event.target as HTMLSelectElement).value || undefined)"
          >
            <option value="" disabled>Select finish...</option>
            <option v-for="opt in SURFACE_FINISH_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Copper Weight -->
        <div class="space-y-1">
          <label class="text-[11px] text-neutral-500 dark:text-neutral-400">
            Copper Weight (outer)
          </label>
          <select
            :value="localData.copperWeight ?? ''"
            class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2.5 py-1.5 outline-none focus:border-primary transition-colors"
            @change="updateField('copperWeight', ($event.target as HTMLSelectElement).value || undefined)"
          >
            <option value="" disabled>Select copper...</option>
            <option v-for="opt in COPPER_WEIGHT_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Completeness indicator -->
        <div class="pt-2 border-t border-neutral-200 dark:border-neutral-800">
          <div class="flex items-center gap-2 text-[11px]">
            <div
              class="w-1.5 h-1.5 rounded-full"
              :class="isComplete ? 'bg-green-500' : 'bg-amber-400'"
            />
            <span class="text-neutral-500 dark:text-neutral-400">
              {{ isComplete ? 'All parameters set — view Pricing tab' : `${filledCount}/5 parameters set` }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  LAYER_COUNT_OPTIONS,
  SURFACE_FINISH_OPTIONS,
  COPPER_WEIGHT_OPTIONS,
} from '~/utils/pcb-pricing'
import type { SurfaceFinish, CopperWeight } from '~/utils/pcb-pricing'

interface PcbData {
  sizeX?: number
  sizeY?: number
  layerCount?: number
  surfaceFinish?: SurfaceFinish
  copperWeight?: CopperWeight
}

const props = defineProps<{
  pcbData: PcbData | null | undefined
  boardSizeMm?: { width: number; height: number } | null
  /** Number of copper layers detected from loaded Gerber files */
  detectedLayerCount?: number | null
}>()

const emit = defineEmits<{
  'update:pcbData': [data: PcbData]
}>()

const localData = computed<PcbData>(() => props.pcbData ?? {})

const filledCount = computed(() => {
  let n = 0
  if (localData.value.sizeX) n++
  if (localData.value.sizeY) n++
  if (localData.value.layerCount) n++
  if (localData.value.surfaceFinish) n++
  if (localData.value.copperWeight) n++
  return n
})

const isComplete = computed(() => filledCount.value === 5)

function updateField(field: keyof PcbData, value: number | string | undefined) {
  const updated = { ...localData.value, [field]: value }
  emit('update:pcbData', updated)
}

function parseNumber(val: string): number | undefined {
  const n = parseFloat(val)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function roundMm(val: number): number {
  return Math.round(val * 100) / 100
}
</script>
