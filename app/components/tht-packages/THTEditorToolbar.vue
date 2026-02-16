<template>
  <div class="flex items-center gap-1 px-2 py-1.5 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
    <!-- Tool buttons -->
    <button
      v-for="tool in tools"
      :key="tool.id"
      class="p-1.5 rounded text-xs transition-colors"
      :class="activeTool === tool.id
        ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
        : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'"
      :title="tool.label"
      @click="emit('update:activeTool', tool.id)"
    >
      <UIcon :name="tool.icon" class="text-base" />
    </button>

    <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />

    <!-- Undo / Redo -->
    <button
      class="p-1.5 rounded text-xs text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-30"
      title="Undo"
      :disabled="!canUndo"
      @click="emit('undo')"
    >
      <UIcon name="i-lucide-undo-2" class="text-base" />
    </button>
    <button
      class="p-1.5 rounded text-xs text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-30"
      title="Redo"
      :disabled="!canRedo"
      @click="emit('redo')"
    >
      <UIcon name="i-lucide-redo-2" class="text-base" />
    </button>

    <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700 mx-1" />

    <!-- Grid snap toggle -->
    <button
      class="p-1.5 rounded text-xs transition-colors flex items-center gap-1"
      :class="snapToGrid
        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30'
        : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'"
      title="Snap to grid"
      @click="emit('update:snapToGrid', !snapToGrid)"
    >
      <UIcon name="i-lucide-grid-3x3" class="text-base" />
      <span class="text-[10px]">Snap</span>
    </button>

    <!-- Grid spacing -->
    <div class="flex items-center gap-1 ml-1">
      <span class="text-[10px] text-neutral-400">Grid:</span>
      <input
        :value="gridSpacing"
        type="number"
        min="0.1"
        max="10"
        step="0.1"
        class="w-14 px-1.5 py-0.5 text-[11px] rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
        @input="onGridInput"
      />
      <span class="text-[10px] text-neutral-400">mm</span>
    </div>

    <div class="flex-1" />

    <!-- Zoom controls -->
    <button
      class="p-1.5 rounded text-xs text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
      title="Zoom to fit"
      @click="emit('zoomToFit')"
    >
      <UIcon name="i-lucide-maximize-2" class="text-base" />
    </button>
    <span class="text-[10px] text-neutral-400 tabular-nums min-w-[3rem] text-center">
      {{ Math.round(zoom * 100) }}%
    </span>
  </div>
</template>

<script setup lang="ts">
export type THTEditorTool = 'select' | 'rect' | 'circle' | 'roundedRect' | 'line' | 'measure'

const props = defineProps<{
  activeTool: THTEditorTool
  snapToGrid: boolean
  gridSpacing: number
  zoom: number
  canUndo: boolean
  canRedo: boolean
}>()

const emit = defineEmits<{
  'update:activeTool': [tool: THTEditorTool]
  'update:snapToGrid': [snap: boolean]
  'update:gridSpacing': [spacing: number]
  undo: []
  redo: []
  zoomToFit: []
}>()

const tools: { id: THTEditorTool; label: string; icon: string }[] = [
  { id: 'select', label: 'Select (V)', icon: 'i-lucide-mouse-pointer-2' },
  { id: 'rect', label: 'Rectangle (R)', icon: 'i-lucide-square' },
  { id: 'circle', label: 'Circle (C)', icon: 'i-lucide-circle' },
  { id: 'roundedRect', label: 'Rounded Rectangle', icon: 'i-lucide-square' },
  { id: 'line', label: 'Line (L)', icon: 'i-lucide-minus' },
  { id: 'measure', label: 'Measure (M)', icon: 'i-lucide-ruler' },
]

function onGridInput(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  if (Number.isFinite(val) && val >= 0.1 && val <= 10) {
    emit('update:gridSpacing', val)
  }
}
</script>
