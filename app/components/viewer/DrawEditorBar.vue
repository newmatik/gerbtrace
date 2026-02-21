<template>
  <div class="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/60 px-2 py-1.5 flex items-center gap-1.5 overflow-x-auto">
    <!-- Layer selector -->
    <div class="flex items-center gap-1 shrink-0">
      <span class="text-[10px] uppercase tracking-wide font-semibold text-neutral-500 dark:text-neutral-400 px-1">
        Layer
      </span>
      <USelectMenu
        v-model="selectedLayerName"
        :items="layerOptions"
        value-key="value"
        class="w-52"
        size="xs"
      >
        <template #leading>
          <span
            v-if="selectedLayerColor"
            class="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/20"
            :style="{ backgroundColor: selectedLayerColor }"
          />
        </template>
        <template #item="{ item }">
          <div class="flex items-center gap-2 w-full">
            <span
              class="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/20"
              :style="{ backgroundColor: getLayerColor(item) }"
            />
            <span class="truncate">{{ getItemLabel(item) }}</span>
          </div>
        </template>
      </USelectMenu>
    </div>

    <!-- Separator -->
    <div class="w-px h-5 bg-neutral-300 dark:bg-neutral-600 mx-0.5 shrink-0" />

    <!-- Shape tools -->
    <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700 shrink-0">
      <UButton
        v-for="t in shapeTools"
        :key="t.value"
        size="xs"
        color="neutral"
        variant="ghost"
        :icon="t.icon"
        :class="[tbBtnBase, draw.activeTool.value === t.value ? tbBtnActive : tbBtnIdle]"
        :title="t.title"
        @click="draw.setTool(t.value)"
      >
        <span class="max-[1100px]:hidden">{{ t.label }}</span>
      </UButton>
    </div>

    <!-- Separator -->
    <div class="w-px h-5 bg-neutral-300 dark:bg-neutral-600 mx-0.5 shrink-0" />

    <!-- Drill diameter -->
    <div v-if="draw.activeTool.value === 'drill'" class="flex items-center gap-1 shrink-0">
      <span class="text-[10px] text-neutral-500 dark:text-neutral-400 whitespace-nowrap">Diameter</span>
      <UInput
        v-model.number="draw.drillDiameterMm.value"
        type="number"
        size="xs"
        class="w-16"
        :min="0.1"
        :max="10"
        :step="0.1"
      />
      <span class="text-[10px] text-neutral-500 dark:text-neutral-400">mm</span>
    </div>

    <!-- Fill / Stroke toggle (Gerber shapes only) -->
    <div v-if="draw.activeTool.value !== 'text' && draw.activeTool.value !== 'drill'" class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700 shrink-0">
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-paint-bucket"
        :class="[tbBtnBase, draw.filled.value ? tbBtnActive : tbBtnIdle]"
        title="Filled shape"
        @click="draw.filled.value = true"
      >
        <span class="max-[1100px]:hidden">Fill</span>
      </UButton>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-pen-line"
        :class="[tbBtnBase, !draw.filled.value ? tbBtnActive : tbBtnIdle]"
        title="Stroke-only shape"
        @click="draw.filled.value = false"
      >
        <span class="max-[1100px]:hidden">Stroke</span>
      </UButton>
    </div>

    <!-- Stroke width (Gerber shapes only) -->
    <div v-if="draw.activeTool.value !== 'drill' && (!draw.filled.value || draw.activeTool.value === 'line' || draw.activeTool.value === 'text')" class="flex items-center gap-1 shrink-0">
      <span class="text-[10px] text-neutral-500 dark:text-neutral-400 whitespace-nowrap">Width</span>
      <UInput
        v-model.number="draw.strokeWidthMm.value"
        type="number"
        size="xs"
        class="w-16"
        :min="0.01"
        :max="10"
        :step="0.05"
      />
      <span class="text-[10px] text-neutral-500 dark:text-neutral-400">mm</span>
    </div>

    <!-- Separator -->
    <div class="w-px h-5 bg-neutral-300 dark:bg-neutral-600 mx-0.5 shrink-0" />

    <!-- Snap toggle -->
    <UButton
      size="xs"
      color="neutral"
      variant="ghost"
      icon="i-lucide-magnet"
      :class="[tbBtnBase, draw.snapEnabled.value ? tbBtnActive : tbBtnIdle]"
      title="Toggle grid and object snapping"
      @click="draw.snapEnabled.value = !draw.snapEnabled.value"
    >
      <span class="max-[1100px]:hidden">Snap</span>
    </UButton>

    <!-- Grid spacing -->
    <div v-if="draw.snapEnabled.value" class="flex items-center gap-1 shrink-0">
      <span class="text-[10px] text-neutral-500 dark:text-neutral-400 whitespace-nowrap">Grid</span>
      <UInput
        v-model.number="draw.gridSpacingMm.value"
        type="number"
        size="xs"
        class="w-14"
        :min="0.1"
        :max="10"
        :step="0.1"
      />
      <span class="text-[10px] text-neutral-500 dark:text-neutral-400">mm</span>
    </div>

    <!-- Precise mode (geometry tools only) -->
    <template v-if="draw.activeTool.value !== 'drill' && draw.activeTool.value !== 'text'">
      <!-- Separator -->
      <div class="w-px h-5 bg-neutral-300 dark:bg-neutral-600 mx-0.5 shrink-0" />

      <!-- Precise mode toggle -->
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-ruler"
        :class="[tbBtnBase, draw.preciseMode.value ? tbBtnPreciseActive : tbBtnIdle]"
        title="Toggle precise dimensions mode (type exact sizes, click to place)"
        @click="draw.preciseMode.value = !draw.preciseMode.value"
      >
        <span class="max-[1100px]:hidden">Precise</span>
      </UButton>
    </template>

    <!-- Precise dimension inputs -->
    <template v-if="draw.preciseMode.value && draw.activeTool.value !== 'drill' && draw.activeTool.value !== 'text'">
      <!-- Rect: width x height -->
      <template v-if="draw.activeTool.value === 'rect'">
        <div class="flex items-center gap-1 shrink-0">
          <span class="text-[10px] text-neutral-500 dark:text-neutral-400">W</span>
          <UInput
            v-model.number="draw.preciseWidthMm.value"
            type="number"
            size="xs"
            class="w-16"
            :min="0.1"
            :step="0.5"
          />
          <span class="text-[10px] text-neutral-500 dark:text-neutral-400 mx-0.5">x</span>
          <span class="text-[10px] text-neutral-500 dark:text-neutral-400">H</span>
          <UInput
            v-model.number="draw.preciseHeightMm.value"
            type="number"
            size="xs"
            class="w-16"
            :min="0.1"
            :step="0.5"
          />
          <span class="text-[10px] text-neutral-500 dark:text-neutral-400">mm</span>
        </div>
      </template>

      <!-- Circle: radius -->
      <template v-if="draw.activeTool.value === 'circle'">
        <div class="flex items-center gap-1 shrink-0">
          <span class="text-[10px] text-neutral-500 dark:text-neutral-400">R</span>
          <UInput
            v-model.number="draw.preciseRadiusMm.value"
            type="number"
            size="xs"
            class="w-16"
            :min="0.05"
            :step="0.25"
          />
          <span class="text-[10px] text-neutral-500 dark:text-neutral-400">mm</span>
        </div>
      </template>

      <!-- Line: length -->
      <template v-if="draw.activeTool.value === 'line'">
        <div class="flex items-center gap-1 shrink-0">
          <span class="text-[10px] text-neutral-500 dark:text-neutral-400">Length</span>
          <UInput
            v-model.number="draw.preciseWidthMm.value"
            type="number"
            size="xs"
            class="w-16"
            :min="0.1"
            :step="0.5"
          />
          <span class="text-[10px] text-neutral-500 dark:text-neutral-400">mm</span>
        </div>
      </template>

    </template>

    <!-- Text controls (always visible for text tool) -->
    <template v-if="draw.activeTool.value === 'text'">
      <div class="w-px h-5 bg-neutral-300 dark:bg-neutral-600 mx-0.5 shrink-0" />
      <div class="flex items-center gap-1 shrink-0">
        <span class="text-[10px] text-neutral-500 dark:text-neutral-400">Text</span>
        <UInput
          v-model="draw.preciseText.value"
          type="text"
          size="xs"
          class="w-28"
          placeholder="LABEL"
        />
        <span class="text-[10px] text-neutral-500 dark:text-neutral-400 ml-1">H</span>
        <UInput
          v-model.number="draw.preciseTextHeightMm.value"
          type="number"
          size="xs"
          class="w-14"
          :min="0.3"
          :step="0.25"
        />
        <span class="text-[10px] text-neutral-500 dark:text-neutral-400">mm</span>
      </div>
    </template>

    <!-- Live dimensions display -->
    <div v-if="draw.previewDimensionsMm.value && !draw.preciseMode.value" class="ml-auto flex items-center gap-2 shrink-0">
      <template v-if="draw.activeTool.value === 'rect' && draw.previewDimensionsMm.value.width != null">
        <span class="text-[10px] font-mono text-blue-600 dark:text-blue-400">
          {{ formatDim(draw.previewDimensionsMm.value.width) }} x {{ formatDim(draw.previewDimensionsMm.value.height) }} mm
        </span>
      </template>
      <template v-else-if="draw.activeTool.value === 'circle' && draw.previewDimensionsMm.value.radius != null">
        <span class="text-[10px] font-mono text-blue-600 dark:text-blue-400">
          r={{ formatDim(draw.previewDimensionsMm.value.radius) }} mm
        </span>
      </template>
      <template v-else-if="draw.activeTool.value === 'line' && draw.previewDimensionsMm.value.length != null">
        <span class="text-[10px] font-mono text-blue-600 dark:text-blue-400">
          {{ formatDim(draw.previewDimensionsMm.value.length) }} mm
        </span>
      </template>
    </div>

    <!-- Quick elements -->
    <div class="w-px h-5 bg-neutral-300 dark:bg-neutral-600 mx-0.5 shrink-0" />
    <div class="flex items-center gap-1 shrink-0">
      <span class="text-[10px] uppercase tracking-wide font-semibold text-neutral-500 dark:text-neutral-400 px-1">
        Quick
      </span>
      <UBadge size="xs" variant="subtle" color="neutral">{{ activeFilter.toUpperCase() }}</UBadge>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-target"
        :class="[tbBtnBase, quickPlacementKind === 'fiducial' ? tbBtnActive : tbBtnIdle]"
        :disabled="!canQuickPlace"
        title="Place fiducial (1mm copper, 3mm copper clear, 2mm mask opening)"
        @click="emitQuickFiducial"
      >
        <span class="max-[1100px]:hidden">Fiducial</span>
      </UButton>
      <div class="flex items-center gap-1">
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-square-dashed"
          :class="[tbBtnBase, quickPlacementKind === 'bc' ? tbBtnActive : tbBtnIdle]"
          :disabled="!canQuickPlace"
          title="Place barcode label box on silkscreen"
          @click="emitQuickBc"
        >
          <span class="max-[1100px]:hidden">BC</span>
        </UButton>
        <USelectMenu
          v-model="selectedBcSize"
          :items="bcSizeOptions"
          value-key="label"
          label-key="label"
          size="xs"
          class="w-20"
        />
      </div>
      <span v-if="!canQuickPlace" class="text-[10px] text-amber-600 dark:text-amber-400 ml-1">Select Top or Bot to place</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { useDrawTool, DrawShapeTool } from '~/composables/useDrawTool'

const props = defineProps<{
  draw: ReturnType<typeof useDrawTool>
  layers: { fileName: string; type: string; color: string }[]
  activeFilter: 'all' | 'top' | 'bot'
}>()

const DRAWABLE_LAYER_TYPES = new Set([
  'Top Copper', 'Bottom Copper', 'Inner Layer',
  'Top Solder Mask', 'Bottom Solder Mask',
  'Top Silkscreen', 'Bottom Silkscreen',
  'Top Paste', 'Bottom Paste',
  'Outline', 'Keep-Out', 'Unmatched',
  'Drill',
])

const layerOptions = computed(() =>
  props.layers
    .filter(l => DRAWABLE_LAYER_TYPES.has(l.type))
    .map(l => ({
      label: `${l.type} (${l.fileName})`,
      value: l.fileName,
      color: l.color,
    })),
)

const selectedLayerName = computed({
  get: () => props.draw.targetLayerName.value,
  set: (v: string) => { props.draw.targetLayerName.value = v },
})

const canQuickPlace = computed(() => props.activeFilter === 'top' || props.activeFilter === 'bot')
const quickPlacementKind = computed(() => props.draw.quickPlacement.value?.kind ?? null)

const bcSizeOptions = [
  { label: '5x5', w: 5, h: 5 },
  { label: '7x7', w: 7, h: 7 },
  { label: '8x25', w: 8, h: 25 },
  { label: '10x20', w: 10, h: 20 },
  { label: '10x30', w: 10, h: 30 },
]
const selectedBcSize = ref('7x7')

function emitQuickFiducial() {
  if (!canQuickPlace.value) return
  if (quickPlacementKind.value === 'fiducial') {
    props.draw.cancelQuickPlacement()
    return
  }
  props.draw.startQuickFiducialPlacement()
}

function emitQuickBc() {
  if (!canQuickPlace.value) return
  if (quickPlacementKind.value === 'bc') {
    props.draw.cancelQuickPlacement()
    return
  }
  const size = bcSizeOptions.find(s => s.label === selectedBcSize.value) ?? bcSizeOptions[1]!
  props.draw.startQuickBcPlacement(size.w, size.h)
}

watch(selectedBcSize, () => {
  if (!canQuickPlace.value) return
  const size = bcSizeOptions.find(s => s.label === selectedBcSize.value) ?? bcSizeOptions[1]!
  props.draw.startQuickBcPlacement(size.w, size.h)
})

const selectedLayerColor = computed(() =>
  layerOptions.value.find(o => o.value === selectedLayerName.value)?.color,
)

function getLayerColor(item: unknown): string {
  if (item && typeof item === 'object' && 'color' in item) return (item as { color: string }).color
  return '#888'
}

function getItemLabel(item: unknown): string {
  if (item && typeof item === 'object' && 'label' in item) return (item as { label: string }).label
  return String(item)
}

const isDrillLayer = computed(() => {
  const sel = props.layers.find(l => l.fileName === selectedLayerName.value)
  return sel?.type === 'Drill'
})

// Auto-select first layer if none selected
watch(layerOptions, (opts) => {
  if (!selectedLayerName.value && opts.length > 0) {
    selectedLayerName.value = opts[0]!.value
  }
}, { immediate: true })

// Auto-switch tool when layer type changes between drill and gerber
watch(isDrillLayer, (drill) => {
  if (drill && props.draw.activeTool.value !== 'drill') {
    props.draw.setTool('drill')
  } else if (!drill && props.draw.activeTool.value === 'drill') {
    props.draw.setTool('rect')
  }
})

const shapeTools = computed<{ label: string; value: DrawShapeTool; icon: string; title: string }[]>(() => {
  if (isDrillLayer.value) {
    return [
      { label: 'Drill', value: 'drill', icon: 'i-lucide-crosshair', title: 'Add a drill hit' },
    ]
  }
  return [
    { label: 'Line', value: 'line', icon: 'i-lucide-minus', title: 'Draw a line' },
    { label: 'Rect', value: 'rect', icon: 'i-lucide-square', title: 'Draw a rectangle' },
    { label: 'Circle', value: 'circle', icon: 'i-lucide-circle', title: 'Draw a circle' },
    { label: 'Text', value: 'text', icon: 'i-lucide-type', title: 'Draw text' },
  ]
})

function formatDim(v: number): string {
  if (v < 0.01) return (v * 1000).toFixed(1)
  return v.toFixed(3)
}

const tbBtnBase =
  '!rounded-md !px-2.5 !py-1 !text-xs !font-medium !border !shadow-none !transition-colors'
const tbBtnIdle =
  '!border-transparent hover:!border-neutral-300/80 hover:!bg-neutral-200/70 ' +
  'dark:!text-neutral-200 dark:hover:!bg-neutral-800/70 dark:hover:!border-neutral-600/70'
const tbBtnActive =
  '!border-blue-500/70 !text-blue-700 !bg-blue-50/90 ' +
  'dark:!border-blue-400/70 dark:!text-blue-200 dark:!bg-blue-500/15'
const tbBtnPreciseActive =
  '!border-green-500/70 !text-green-700 !bg-green-50/90 ' +
  'dark:!border-green-400/70 dark:!text-green-200 dark:!bg-green-500/15'
</script>
