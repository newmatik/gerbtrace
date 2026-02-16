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

    <!-- Inline rename input -->
    <input
      v-if="isRenaming"
      ref="renameInput"
      v-model="renameDraft"
      class="flex-1 min-w-0 text-xs bg-transparent border border-primary rounded px-1 py-0.5 outline-none"
      @blur="commitRename"
      @keydown.enter.prevent="commitRename"
      @keydown.escape="cancelRename"
      @pointerdown.stop
      @click.stop
    />
    <span v-else class="truncate flex-1">{{ layer.file.fileName }}</span>

    <UIcon
      v-if="isEdited"
      name="i-lucide-pencil"
      class="text-amber-400 text-[11px] shrink-0"
      title="Layer has been modified"
    />
    <UIcon
      v-if="layer.type === 'Unmatched'"
      name="i-lucide-circle-help"
      class="text-amber-400 shrink-0"
      title="Unmatched file — select a layer type to render"
    />
    <UDropdownMenu :items="menuGroups" :content="{ side: 'right', align: 'start', sideOffset: 4 }">
      <button
        class="shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
        :class="{ '!opacity-100': isEdited }"
        @pointerdown.stop
        @click.stop
      >
        <UIcon name="i-lucide-ellipsis-vertical" class="text-sm" />
      </button>
    </UDropdownMenu>
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
  isEdited?: boolean
}>()

const emit = defineEmits<{
  toggleVisibility: []
  colorChange: [color: string]
  typeChange: [type: string]
  reset: []
  rename: [newName: string]
  duplicate: []
  remove: []
}>()

// ── Inline rename ──

const isRenaming = ref(false)
const renameDraft = ref('')
const renameInput = ref<HTMLInputElement | null>(null)

function startRename() {
  renameDraft.value = props.layer.file.fileName
  isRenaming.value = true
  nextTick(() => {
    renameInput.value?.focus()
    // Select up to the last dot (keep extension selected too for full control)
    const dot = renameDraft.value.lastIndexOf('.')
    renameInput.value?.setSelectionRange(0, dot > 0 ? dot : renameDraft.value.length)
  })
}

function commitRename() {
  isRenaming.value = false
  const trimmed = renameDraft.value.trim()
  if (trimmed && trimmed !== props.layer.file.fileName) {
    emit('rename', trimmed)
  }
}

function cancelRename() {
  isRenaming.value = false
}

// ── Dropdown menu ──

const menuGroups = computed(() => {
  const primary: { label: string; icon: string; onSelect: () => void }[] = [
    { label: 'Rename', icon: 'i-lucide-pencil', onSelect: () => startRename() },
    { label: 'Duplicate', icon: 'i-lucide-copy', onSelect: () => emit('duplicate') },
  ]

  const danger: { label: string; icon: string; color?: string; onSelect: () => void }[] = [
    { label: 'Remove', icon: 'i-lucide-trash-2', color: 'error' as any, onSelect: () => emit('remove') },
  ]

  if (props.isEdited) {
    primary.push({
      label: 'Reset to original',
      icon: 'i-lucide-undo-2',
      onSelect: () => emit('reset'),
    })
  }

  return [primary, danger]
})

// ── Color picker ──

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
