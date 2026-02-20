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
        class="w-44"
        size="xs"
      />
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
        {{ t.label }}
      </UButton>
    </div>

    <!-- Separator -->
    <div class="w-px h-5 bg-neutral-300 dark:bg-neutral-600 mx-0.5 shrink-0" />

    <!-- Fill / Stroke toggle -->
    <div v-if="draw.activeTool.value !== 'text'" class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700 shrink-0">
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        :class="[tbBtnBase, draw.filled.value ? tbBtnActive : tbBtnIdle]"
        title="Filled shape"
        @click="draw.filled.value = true"
      >
        Fill
      </UButton>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        :class="[tbBtnBase, !draw.filled.value ? tbBtnActive : tbBtnIdle]"
        title="Stroke-only shape"
        @click="draw.filled.value = false"
      >
        Stroke
      </UButton>
    </div>

    <!-- Stroke width -->
    <div v-if="!draw.filled.value || draw.activeTool.value === 'line' || draw.activeTool.value === 'text'" class="flex items-center gap-1 shrink-0">
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
      Snap
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
      Precise
    </UButton>

    <!-- Precise dimension inputs -->
    <template v-if="draw.preciseMode.value">
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

      <!-- Text: content + height -->
      <template v-if="draw.activeTool.value === 'text'">
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
  </div>
</template>

<script setup lang="ts">
import type { useDrawTool, DrawShapeTool } from '~/composables/useDrawTool'

const props = defineProps<{
  draw: ReturnType<typeof useDrawTool>
  layers: { fileName: string; type: string; color: string }[]
}>()

const GERBER_LAYER_TYPES = new Set([
  'Top Copper', 'Bottom Copper', 'Inner Layer',
  'Top Solder Mask', 'Bottom Solder Mask',
  'Top Silkscreen', 'Bottom Silkscreen',
  'Top Paste', 'Bottom Paste',
  'Outline', 'Keep-Out', 'Unmatched',
])

const layerOptions = computed(() =>
  props.layers
    .filter(l => GERBER_LAYER_TYPES.has(l.type))
    .map(l => ({
      label: `${l.type} (${l.fileName})`,
      value: l.fileName,
    })),
)

const selectedLayerName = computed({
  get: () => props.draw.targetLayerName.value,
  set: (v: string) => { props.draw.targetLayerName.value = v },
})

// Auto-select first layer if none selected
watch(layerOptions, (opts) => {
  if (!selectedLayerName.value && opts.length > 0) {
    selectedLayerName.value = opts[0]!.value
  }
}, { immediate: true })

const shapeTools: { label: string; value: DrawShapeTool; icon: string; title: string }[] = [
  { label: 'Line', value: 'line', icon: 'i-lucide-minus', title: 'Draw a line' },
  { label: 'Rect', value: 'rect', icon: 'i-lucide-square', title: 'Draw a rectangle' },
  { label: 'Circle', value: 'circle', icon: 'i-lucide-circle', title: 'Draw a circle' },
  { label: 'Text', value: 'text', icon: 'i-lucide-type', title: 'Draw text' },
]

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
