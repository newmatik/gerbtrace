<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <div class="flex-1 overflow-y-auto">
      <!-- Section 1: Board Parameters (compact two-column) -->
      <div class="p-4 pb-2">
        <div class="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
          Board Parameters
        </div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-2">
          <!-- Size X -->
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Size X (mm)</label>
            <div class="flex items-center gap-1">
              <input
                :value="localData.sizeX ?? ''"
                type="number"
                min="0"
                step="0.1"
                placeholder="80"
                class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none placeholder:text-neutral-400 focus:border-primary transition-colors tabular-nums"
                @input="updateField('sizeX', parseNumber(($event.target as HTMLInputElement).value))"
              />
              <button
                v-if="boardSizeMm"
                class="shrink-0 text-[9px] px-1 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-primary hover:border-primary/30 transition-colors whitespace-nowrap"
                title="Use detected board width"
                @click="updateField('sizeX', roundMm(boardSizeMm.width))"
              >
                {{ roundMm(boardSizeMm.width) }}
              </button>
            </div>
          </div>

          <!-- Size Y -->
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Size Y (mm)</label>
            <div class="flex items-center gap-1">
              <input
                :value="localData.sizeY ?? ''"
                type="number"
                min="0"
                step="0.1"
                placeholder="60"
                class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none placeholder:text-neutral-400 focus:border-primary transition-colors tabular-nums"
                @input="updateField('sizeY', parseNumber(($event.target as HTMLInputElement).value))"
              />
              <button
                v-if="boardSizeMm"
                class="shrink-0 text-[9px] px-1 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-primary hover:border-primary/30 transition-colors whitespace-nowrap"
                title="Use detected board height"
                @click="updateField('sizeY', roundMm(boardSizeMm.height))"
              >
                {{ roundMm(boardSizeMm.height) }}
              </button>
            </div>
          </div>

          <!-- Layer Count -->
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Layers</label>
            <div class="flex items-center gap-1">
              <USelect
                :model-value="localData.layerCount"
                size="xs"
                class="w-full"
                :items="layerCountOptions"
                value-key="value"
                label-key="label"
                placeholder="Select..."
                @update:model-value="updateLayerCount(($event as number | undefined))"
              />
              <button
                v-if="detectedLayerCount && detectedLayerCount !== localData.layerCount"
                class="shrink-0 text-[9px] px-1 py-0.5 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-primary hover:border-primary/30 transition-colors whitespace-nowrap"
                :title="`Detected ${detectedLayerCount} copper layers`"
                @click="updateLayerCount(detectedLayerCount)"
              >
                {{ detectedLayerCount }}L
              </button>
            </div>
          </div>

          <!-- Surface Finish -->
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Surface Finish</label>
            <USelect
              :model-value="localData.surfaceFinish"
              size="xs"
              class="w-full"
              :items="SURFACE_FINISH_OPTIONS"
              value-key="value"
              label-key="label"
              placeholder="Select..."
              @update:model-value="updateField('surfaceFinish', ($event as SurfaceFinish | undefined))"
            />
          </div>

          <!-- Copper Weight -->
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Copper Weight</label>
            <USelect
              :model-value="localData.copperWeight"
              size="xs"
              class="w-full"
              :items="COPPER_WEIGHT_OPTIONS"
              value-key="value"
              label-key="label"
              placeholder="Select..."
              @update:model-value="updateField('copperWeight', ($event as CopperWeight | undefined))"
            />
          </div>

          <!-- Thickness -->
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Thickness</label>
            <USelect
              :model-value="localData.thicknessMm ?? 1.6"
              size="xs"
              class="w-full"
              :items="PCB_THICKNESS_OPTIONS"
              value-key="value"
              label-key="label"
              @update:model-value="updateField('thicknessMm', (($event as PcbThicknessMm | undefined) ?? 1.6))"
            />
          </div>

          <!-- Inner Copper Weight (only for multilayer boards) -->
          <div v-if="(localData.layerCount ?? 0) > 2" class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Inner Copper</label>
            <USelect
              :model-value="localData.innerCopperWeight ?? '0.5oz'"
              size="xs"
              class="w-full"
              :items="INNER_COPPER_WEIGHT_OPTIONS"
              value-key="value"
              label-key="label"
              @update:model-value="updateField('innerCopperWeight', ($event as '0.5oz' | '1oz' | '2oz' | undefined))"
            />
          </div>

          <!-- Solder Mask Color -->
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Solder Mask Color</label>
            <UPopover v-model:open="showSolderMaskDropdown" :content="{ align: 'start', sideOffset: 6 }">
              <button
                class="w-full flex items-center gap-2 text-xs px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors cursor-pointer"
              >
                <span
                  class="inline-block w-2.5 h-2.5 rounded-full border border-neutral-300/60 dark:border-neutral-600/70 shrink-0"
                  :style="{ backgroundColor: selectedSolderMaskOption.hex }"
                />
                <span class="truncate">{{ selectedSolderMaskOption.label }}</span>
                <UIcon name="i-lucide-chevron-down" class="ml-auto text-[10px] opacity-60 shrink-0" />
              </button>
              <template #content>
                <div class="p-1.5 min-w-44 bg-white dark:bg-neutral-900 rounded-md border border-neutral-200 dark:border-neutral-700 shadow-lg">
                  <button
                    v-for="opt in solderMaskOptions"
                    :key="opt.value"
                    class="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                    :class="localData.solderMaskColor === opt.value || (!localData.solderMaskColor && opt.value === 'green')
                      ? 'bg-primary/10 text-primary'
                      : 'text-neutral-700 dark:text-neutral-200'"
                    @click="setSolderMaskColor(opt.value)"
                  >
                    <span
                      class="inline-block w-2.5 h-2.5 rounded-full border border-neutral-300/60 dark:border-neutral-600/70 shrink-0"
                      :style="{ backgroundColor: opt.hex }"
                    />
                    <span class="flex-1 text-left">{{ opt.label }}</span>
                    <UIcon
                      v-if="localData.solderMaskColor === opt.value || (!localData.solderMaskColor && opt.value === 'green')"
                      name="i-lucide-check"
                      class="text-[11px] shrink-0"
                    />
                  </button>
                </div>
              </template>
            </UPopover>
          </div>

          <!-- Panelization -->
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Panelization</label>
            <USelect
              :model-value="localData.panelizationMode ?? 'single'"
              size="xs"
              class="w-full"
              :items="panelizationOptions"
              value-key="value"
              label-key="label"
              @update:model-value="updateField('panelizationMode', ($event as 'single' | 'panelized' | undefined))"
            />
          </div>

          <!-- Board Area (computed) -->
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Board Area</label>
            <div class="text-xs tabular-nums text-neutral-500 dark:text-neutral-400 px-2 py-1">
              {{ localData.sizeX && localData.sizeY ? ((localData.sizeX * localData.sizeY) / 100).toFixed(1) + ' cm²' : '—' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Section 2: Gerber & Drill Files -->
      <div class="px-3 py-2 border-t border-neutral-200 dark:border-neutral-800">
        <div v-if="gerberDrillGroups.length === 0" class="text-xs text-neutral-400 py-4 text-center">
          No Gerber or drill files loaded
        </div>
        <div class="space-y-0.5">
          <template v-for="group in gerberDrillGroups" :key="group.key">
            <!-- Group header -->
            <div
              class="flex items-center gap-1.5 w-full px-2 py-1 mt-1 first:mt-0 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 rounded"
            >
              <button
                class="flex items-center gap-1.5 flex-1 min-w-0 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors cursor-pointer"
                @click="toggleGroup(group.key)"
              >
                <UIcon
                  :name="collapsed.has(group.key) ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
                  class="text-[10px] shrink-0"
                />
                <span>{{ group.label }}</span>
                <span class="text-neutral-300 dark:text-neutral-600 font-normal">{{ group.layers.length }}</span>
              </button>
              <button
                class="shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                title="Toggle all layers in this section"
                @click.stop="$emit('toggleGroupVisibility', group.layers.map(e => e.flatIndex))"
              >
                <UIcon
                  :name="group.layers.some(e => e.layer.visible) ? 'i-lucide-eye' : 'i-lucide-eye-off'"
                  class="text-xs"
                />
              </button>
            </div>

            <!-- Group layers -->
            <template v-if="!collapsed.has(group.key)">
              <div
                v-for="entry in group.layers"
                :key="entry.layer.file.fileName"
              >
                <LayerToggle
                  :layer="entry.layer"
                  :is-edited="editedLayers?.has(entry.layer.file.fileName) ?? false"
                  @toggle-visibility="$emit('toggleVisibility', entry.flatIndex)"
                  @color-change="(color: string) => $emit('changeColor', entry.flatIndex, color)"
                  @type-change="(type: string) => $emit('changeType', entry.flatIndex, type)"
                  @reset="$emit('resetLayer', entry.flatIndex)"
                  @rename="(name: string) => $emit('renameLayer', entry.flatIndex, name)"
                  @duplicate="$emit('duplicateLayer', entry.flatIndex)"
                  @remove="$emit('removeLayer', entry.flatIndex)"
                />
              </div>
            </template>
          </template>
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
  PCB_THICKNESS_OPTIONS,
} from '~/utils/pcb-pricing'
import type { SurfaceFinish, CopperWeight, PcbThicknessMm } from '~/utils/pcb-pricing'
import type { LayerInfo } from '~/utils/gerber-helpers'
import { getLayerGroup, LAYER_GROUP_LABELS, type LayerGroupKey } from '~/utils/gerber-helpers'
import { SOLDER_MASK_COLOR_OPTIONS, type SolderMaskColor } from '~/utils/pcb-presets'

interface PcbData {
  sizeX?: number
  sizeY?: number
  layerCount?: number
  surfaceFinish?: SurfaceFinish
  copperWeight?: CopperWeight
  innerCopperWeight?: '0.5oz' | '1oz' | '2oz'
  thicknessMm?: PcbThicknessMm
  solderMaskColor?: SolderMaskColor
  panelizationMode?: 'single' | 'panelized'
}

interface LayerGroupData {
  key: LayerGroupKey
  label: string
  layers: { layer: LayerInfo; flatIndex: number }[]
}

const props = defineProps<{
  pcbData: PcbData | null | undefined
  boardSizeMm?: { width: number; height: number } | null
  detectedLayerCount?: number | null
  layers: LayerInfo[]
  editedLayers?: Set<string>
}>()

const emit = defineEmits<{
  'update:pcbData': [data: PcbData]
  'toggleVisibility': [index: number]
  'toggleGroupVisibility': [indices: number[]]
  'changeColor': [index: number, color: string]
  'changeType': [index: number, type: string]
  'resetLayer': [index: number]
  'renameLayer': [index: number, newName: string]
  'duplicateLayer': [index: number]
  'removeLayer': [index: number]
}>()

const localData = computed<PcbData>(() => props.pcbData ?? {})
const showSolderMaskDropdown = ref(false)

function updateField(field: keyof PcbData, value: number | string | undefined) {
  const updated = { ...localData.value, [field]: value }
  emit('update:pcbData', updated)
}

function updateLayerCount(value: number | undefined) {
  const updated: PcbData = { ...localData.value, layerCount: value }
  if ((value ?? 0) > 2) {
    if (!updated.innerCopperWeight) updated.innerCopperWeight = '0.5oz'
  } else {
    updated.innerCopperWeight = undefined
  }
  emit('update:pcbData', updated)
}

function parseNumber(val: string): number | undefined {
  const n = parseFloat(val)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function roundMm(val: number): number {
  return Math.round(val * 100) / 100
}

const SOLDER_MASK_SWATCHES: Record<SolderMaskColor, string> = {
  green: '#146b3a',
  black: '#1a1a1a',
  blue: '#1a3a6b',
  red: '#8b1a1a',
  white: '#e8e8e8',
  purple: '#4a1a6b',
}

const solderMaskOptions = computed(() =>
  SOLDER_MASK_COLOR_OPTIONS.map(opt => ({
    ...opt,
    hex: SOLDER_MASK_SWATCHES[opt.value],
  })),
)

const selectedSolderMaskOption = computed(() => {
  const selected = localData.value.solderMaskColor ?? 'green'
  return solderMaskOptions.value.find(opt => opt.value === selected) ?? solderMaskOptions.value[0]
})

function setSolderMaskColor(value: SolderMaskColor) {
  updateField('solderMaskColor', value)
  showSolderMaskDropdown.value = false
}

const INNER_COPPER_WEIGHT_OPTIONS: { value: '0.5oz' | '1oz' | '2oz'; label: string }[] = [
  { value: '0.5oz', label: '0.5 oz (18 µm)' },
  { value: '1oz', label: '1 oz (35 µm)' },
  { value: '2oz', label: '2 oz (70 µm)' },
]

const layerCountOptions: { label: string; value: number }[] = LAYER_COUNT_OPTIONS.map(n => ({
  label: `${n}L`,
  value: n as number,
}))

const panelizationOptions: { label: string; value: 'single' | 'panelized' }[] = [
  { label: 'Single PCB', value: 'single' },
  { label: 'Panelized PCB', value: 'panelized' },
]

// Collapsible groups — only gerber and drill
const collapsed = ref(new Set<LayerGroupKey>())

function toggleGroup(key: LayerGroupKey) {
  const next = new Set(collapsed.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  collapsed.value = next
}

const PCB_LAYER_GROUPS: LayerGroupKey[] = ['gerber', 'drill']

const gerberDrillGroups = computed<LayerGroupData[]>(() => {
  const buckets = new Map<LayerGroupKey, { layer: LayerInfo; flatIndex: number }[]>()
  for (const key of PCB_LAYER_GROUPS) {
    buckets.set(key, [])
  }

  props.layers.forEach((layer, index) => {
    const group = getLayerGroup(layer.type, layer.file.fileName)
    if (PCB_LAYER_GROUPS.includes(group)) {
      buckets.get(group)!.push({ layer, flatIndex: index })
    }
  })

  return PCB_LAYER_GROUPS
    .filter(key => (buckets.get(key)?.length ?? 0) > 0)
    .map(key => ({
      key,
      label: LAYER_GROUP_LABELS[key],
      layers: buckets.get(key)!,
    }))
})
</script>
