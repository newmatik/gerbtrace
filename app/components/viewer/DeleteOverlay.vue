<template>
  <!-- Selection rectangle during drag -->
  <svg
    v-if="deleteTool.active.value && deleteTool.selectionBox.value"
    class="absolute inset-0 w-full h-full pointer-events-none z-10"
  >
    <rect
      :x="Math.min(deleteTool.selectionBox.value.startX, deleteTool.selectionBox.value.endX)"
      :y="Math.min(deleteTool.selectionBox.value.startY, deleteTool.selectionBox.value.endY)"
      :width="Math.abs(deleteTool.selectionBox.value.endX - deleteTool.selectionBox.value.startX)"
      :height="Math.abs(deleteTool.selectionBox.value.endY - deleteTool.selectionBox.value.startY)"
      fill="rgba(239, 68, 68, 0.12)"
      stroke="rgba(239, 68, 68, 0.7)"
      stroke-width="1.5"
      stroke-dasharray="6 3"
    />
  </svg>

  <!-- Confirmation panel — anchored top-right -->
  <div
    v-if="deleteTool.active.value && deleteTool.pendingDeletion.value"
    class="absolute top-3 right-3 z-20 w-64 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-sm border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl overflow-hidden"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-neutral-200/60 dark:border-neutral-700/60">
      <span class="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
        Delete {{ deleteTool.totalSelectedCount.value }} object{{ deleteTool.totalSelectedCount.value !== 1 ? 's' : '' }}?
      </span>
      <button
        class="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors p-0.5 -mr-1"
        @click="deleteTool.cancelDeletion()"
      >
        <UIcon name="i-lucide-x" class="text-sm" />
      </button>
    </div>

    <!-- Layer list -->
    <div class="max-h-[40vh] overflow-y-auto">
      <div
        v-for="(layer, li) in deleteTool.pendingDeletion.value.layers"
        :key="li"
        class="flex items-center gap-2 px-3 py-2 border-b border-neutral-100 dark:border-neutral-700/50 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-700/30 transition-colors cursor-pointer"
        @click="deleteTool.toggleLayerSelection(li)"
      >
        <input
          type="checkbox"
          :checked="layer.selected"
          class="rounded border-neutral-300 dark:border-neutral-600 text-red-500 focus:ring-red-500/30 cursor-pointer"
          @click.stop="deleteTool.toggleLayerSelection(li)"
        />
        <span
          class="w-2.5 h-2.5 rounded-full shrink-0"
          :style="{ backgroundColor: layer.layerColor }"
        />
        <div class="flex-1 min-w-0">
          <div class="text-[11px] font-medium text-neutral-700 dark:text-neutral-200 truncate">
            {{ layer.layerType }}
          </div>
          <div class="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">
            {{ layer.layerName }}
          </div>
        </div>
        <span class="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0">
          {{ layer.graphicIndices.length }}
        </span>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex gap-2 px-3 py-2 border-t border-neutral-200/60 dark:border-neutral-700/60">
      <button
        class="flex-1 text-[11px] font-medium px-3 py-1.5 rounded transition-colors bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600"
        @click="deleteTool.cancelDeletion()"
      >
        Cancel
      </button>
      <button
        class="flex-1 text-[11px] font-medium px-3 py-1.5 rounded transition-colors bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
        :disabled="deleteTool.totalSelectedCount.value === 0"
        @click="$emit('confirmDelete')"
      >
        Delete
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  deleteTool: ReturnType<typeof useDeleteTool>
}>()

const emit = defineEmits<{
  confirmDelete: []
}>()
</script>
