<template>
  <div
    class="group flex items-center gap-1.5 px-2 py-1.5 rounded text-xs select-none transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
    :class="{ 'opacity-40': !layer.visible }"
  >
    <UPopover :content="{ side: 'right', align: 'start', sideOffset: 8 }" @pointerdown.stop>
      <button
        class="w-4 h-4 rounded-full shrink-0 cursor-pointer ring-1 ring-white/20 hover:ring-white/50 transition-shadow"
        :class="{ 'border border-neutral-400': isWhiteLike(layer.color) }"
        :style="{ backgroundColor: layer.color }"
        @click.stop
      />

      <template #content>
        <div class="p-3 w-56" @click.stop>
          <p class="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-2">Presets</p>
          <div class="grid grid-cols-8 gap-1.5 mb-3">
            <button
              v-for="preset in PRESET_COLORS"
              :key="preset"
              class="w-5 h-5 rounded-full cursor-pointer ring-1 ring-white/10 hover:ring-white/60 hover:scale-110 transition-all"
              :class="{
                'ring-2 ring-white!': layer.color.toLowerCase() === preset.toLowerCase(),
                'border border-neutral-400': isWhiteLike(preset),
              }"
              :style="{ backgroundColor: preset }"
              @click="selectColor(preset)"
            />
          </div>
          <USeparator class="mb-3" />
          <p class="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-2">Custom</p>
          <UColorPicker v-model="localColor" size="xs" @update:model-value="onCustomColor" />
        </div>
      </template>
    </UPopover>

    <button
      class="shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-pointer"
      title="Toggle layer visibility"
      @pointerdown.stop
      @click.stop="emit('toggleVisibility')"
    >
      <UIcon
      :name="layer.visible ? 'i-lucide-eye' : 'i-lucide-eye-off'"
      />
    </button>
    <span class="truncate flex-1">{{ layer.file.fileName }}</span>
    <UIcon
      v-if="layer.type === 'Unmatched'"
      name="i-lucide-circle-help"
      class="text-amber-400 shrink-0"
      title="Unmatched file — select a layer type to render"
    />
    <select
      :value="layer.type"
      class="text-[10px] border rounded px-1 py-0.5 cursor-pointer outline-none transition-colors appearance-none shrink-0 max-w-[5.5rem]"
      :class="layer.type === 'Unmatched'
        ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300'
        : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500'"
      @click.stop
      @pointerdown.stop
      @change="(e) => $emit('typeChange', (e.target as HTMLSelectElement).value)"
    >
      <option v-for="t in ALL_LAYER_TYPES" :key="t" :value="t">{{ t }}</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import type { LayerInfo } from '~/utils/gerber-helpers'
import { ALL_LAYER_TYPES } from '~/utils/gerber-helpers'

/**
 * Predefined colors chosen to be vibrant and legible on a black background.
 * Organised roughly by hue: reds, oranges, yellows, greens, cyans, blues,
 * purples, pinks, plus white and a warm grey.
 */
const PRESET_COLORS = [
  // Row 1 — warm
  '#FF4444', '#FF6B35', '#FFA500', '#FFD700',
  '#FFFF66', '#BFFF00', '#66FF66', '#00E676',
  // Row 2 — cool
  '#00FFCC', '#00E5FF', '#448AFF', '#536DFE',
  '#B388FF', '#EA80FC', '#FF80AB', '#FFFFFF',
]

const props = defineProps<{
  layer: LayerInfo
}>()

const emit = defineEmits<{
  toggleVisibility: []
  colorChange: [color: string]
  typeChange: [type: string]
}>()

const localColor = ref(props.layer.color)

watch(() => props.layer.color, (val) => {
  localColor.value = val
})

function selectColor(color: string) {
  localColor.value = color
  emit('colorChange', color)
}

function onCustomColor(color: string | undefined) {
  if (color) emit('colorChange', color)
}

function isWhiteLike(color: string): boolean {
  const c = color.trim().toLowerCase()
  return c === '#fff' || c === '#ffffff' || c === 'white'
}
</script>
