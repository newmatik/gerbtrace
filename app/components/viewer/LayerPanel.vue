<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <div class="flex-1 overflow-y-auto">
      <div class="p-3">
        <div v-if="!layers.length" class="text-xs text-neutral-400 py-4 text-center">
          No layers loaded
        </div>
        <div ref="listRef" class="space-y-0.5">
          <div
            v-for="(layer, index) in layers"
            :key="layer.file.fileName"
            :data-layer-index="index"
            class="rounded transition-all duration-100"
            :class="{
              'opacity-30 scale-95': isDragging && dragFrom === index,
              'cursor-grabbing': isDragging,
              'cursor-pointer': !isDragging,
            }"
            :style="{ touchAction: 'none' }"
            @pointerdown="onPointerDown(index, $event)"
          >
            <!-- Drop indicator line above this item -->
            <div
              v-if="showIndicatorAt === index"
              class="h-0.5 bg-primary-400 rounded-full mb-0.5"
            />
            <LayerToggle
              :layer="layer"
              @color-change="(color: string) => $emit('changeColor', index, color)"
              @type-change="(type: string) => $emit('changeType', index, type)"
            />
          </div>

          <!-- Drop indicator at the very end of the list -->
          <div
            v-if="showIndicatorAt === layers.length"
            class="h-0.5 bg-primary-400 rounded-full mt-0.5"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LayerInfo } from '~/utils/gerber-helpers'

const props = defineProps<{
  layers: LayerInfo[]
}>()

const emit = defineEmits<{
  toggleVisibility: [index: number]
  changeColor: [index: number, color: string]
  changeType: [index: number, type: string]
  reorder: [fromIndex: number, toIndex: number]
}>()

// --- Pointer-based drag-to-reorder ---

const DRAG_THRESHOLD = 5

const listRef = ref<HTMLElement | null>(null)
const dragFrom = ref<number | null>(null)
const dragOver = ref<number | null>(null)
const isDragging = ref(false)
const startY = ref(0)

/**
 * Index where the blue drop-indicator line should appear.
 * Returns null when the drop position is the same as the current position
 * (i.e. moving the item onto itself or right below itself).
 */
const showIndicatorAt = computed<number | null>(() => {
  if (!isDragging.value || dragFrom.value === null || dragOver.value === null) return null
  if (dragOver.value === dragFrom.value) return null
  // Dropping right after the dragged item is a no-op
  if (dragOver.value === dragFrom.value + 1) return null
  return dragOver.value
})

function onPointerDown(index: number, e: PointerEvent) {
  if (e.button !== 0) return

  dragFrom.value = index
  startY.value = e.clientY
  isDragging.value = false
  dragOver.value = null

  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)

  let finished = false

  const onMove = (ev: PointerEvent) => {
    const dy = Math.abs(ev.clientY - startY.value)
    if (!isDragging.value && dy > DRAG_THRESHOLD) {
      isDragging.value = true
    }
    if (isDragging.value) {
      updateDragOver(ev.clientY)
    }
  }

  const onUp = () => {
    if (finished) return
    finished = true

    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp)
    el.removeEventListener('lostpointercapture', onUp)
    try { el.releasePointerCapture(e.pointerId) } catch { /* already released */ }

    if (isDragging.value) {
      if (dragFrom.value !== null && dragOver.value !== null) {
        const from = dragFrom.value
        // Adjust: after splice(from, 1) indices above from shift down by 1
        const to = from < dragOver.value ? dragOver.value - 1 : dragOver.value
        if (from !== to) {
          emit('reorder', from, to)
        }
      }
    } else {
      // Short click — toggle layer visibility
      emit('toggleVisibility', index)
    }

    dragFrom.value = null
    dragOver.value = null
    isDragging.value = false
  }

  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('lostpointercapture', onUp)
}

function updateDragOver(clientY: number) {
  if (!listRef.value) return

  const items = Array.from(
    listRef.value.querySelectorAll<HTMLElement>('[data-layer-index]'),
  )

  for (const item of items) {
    const rect = item.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    if (clientY < midY) {
      dragOver.value = Number(item.dataset.layerIndex)
      return
    }
  }

  // Below all items → drop at the end
  dragOver.value = props.layers.length
}
</script>
