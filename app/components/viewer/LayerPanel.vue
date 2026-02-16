<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <div class="flex-1 overflow-y-auto">
      <div class="p-3">
        <div v-if="!layers.length" class="text-xs text-neutral-400 py-4 text-center">
          No layers loaded
        </div>
        <div ref="listRef" class="space-y-0.5">
          <template v-for="group in groups" :key="group.key">
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
                v-if="group.key !== 'bom'"
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

            <!-- Group layers (when not collapsed) -->
            <template v-if="!collapsed.has(group.key)">
              <div
                v-for="entry in group.layers"
                :key="entry.layer.file.fileName"
                :data-layer-index="entry.flatIndex"
                class="rounded transition-all duration-100"
                :class="{
                  'opacity-30 scale-95': isDragging && dragFrom === entry.flatIndex,
                  'cursor-grabbing': isDragging,
                  'cursor-pointer': !isDragging,
                }"
                :style="{ touchAction: 'none' }"
                @pointerdown="onPointerDown(entry.flatIndex, $event)"
              >
                <!-- Drop indicator line above this item -->
                <div
                  v-if="showIndicatorAt === entry.flatIndex"
                  class="h-0.5 bg-primary-400 rounded-full mb-0.5"
                />
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

          <!-- Drop indicator at the very end of the list -->
          <div
            v-if="showIndicatorAt === layers.length"
            class="h-0.5 bg-primary-400 rounded-full mt-0.5"
          />

          <!-- Documents group -->
          <template v-if="documents && documents.length > 0">
            <div
              class="flex items-center gap-1.5 w-full px-2 py-1 mt-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 rounded"
            >
              <button
                class="flex items-center gap-1.5 flex-1 min-w-0 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors cursor-pointer"
                @click="toggleGroup('docs')"
              >
                <UIcon
                  :name="collapsed.has('docs') ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
                  class="text-[10px] shrink-0"
                />
                <span>{{ LAYER_GROUP_LABELS.docs }}</span>
                <span class="text-neutral-300 dark:text-neutral-600 font-normal">{{ documents.length }}</span>
              </button>
            </div>
            <template v-if="!collapsed.has('docs')">
              <div
                v-for="doc in documents"
                :key="doc.id"
                class="group flex items-center gap-1.5 px-2 py-1.5 rounded text-xs select-none transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                :class="selectedDocumentId === doc.id
                  ? 'bg-blue-50/80 dark:bg-blue-500/10'
                  : ''"
                @click="emit('selectDocument', doc.id)"
              >
                <UIcon name="i-lucide-file-text" class="text-sm text-neutral-400 shrink-0 w-4 h-4" />
                <span class="truncate flex-1" :class="selectedDocumentId === doc.id ? 'text-blue-700 dark:text-blue-300 font-medium' : ''">{{ doc.name }}</span>
                <button
                  class="shrink-0 text-neutral-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                  title="Remove document"
                  @pointerdown.stop
                  @click.stop="emit('removeDocument', doc.id)"
                >
                  <UIcon name="i-lucide-x" class="text-xs" />
                </button>
              </div>
            </template>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LayerInfo } from '~/utils/gerber-helpers'
import { getLayerGroup, LAYER_GROUP_ORDER, LAYER_GROUP_LABELS, type LayerGroupKey } from '~/utils/gerber-helpers'
import type { ProjectDocument } from '~/utils/document-types'

interface LayerGroupData {
  key: LayerGroupKey
  label: string
  layers: { layer: LayerInfo; flatIndex: number }[]
}

const props = defineProps<{
  layers: LayerInfo[]
  editedLayers?: Set<string>
  documents?: ProjectDocument[]
  selectedDocumentId?: string | null
}>()

const emit = defineEmits<{
  toggleVisibility: [index: number]
  toggleGroupVisibility: [indices: number[]]
  changeColor: [index: number, color: string]
  changeType: [index: number, type: string]
  reorder: [fromIndex: number, toIndex: number]
  resetLayer: [index: number]
  renameLayer: [index: number, newName: string]
  duplicateLayer: [index: number]
  removeLayer: [index: number]
  selectDocument: [id: string]
  removeDocument: [id: string]
}>()

// ── Collapsible groups ──

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

const groups = computed<LayerGroupData[]>(() => {
  const buckets = new Map<LayerGroupKey, { layer: LayerInfo; flatIndex: number }[]>()
  for (const key of LAYER_GROUP_ORDER) {
    buckets.set(key, [])
  }

  props.layers.forEach((layer, index) => {
    const group = getLayerGroup(layer.type, layer.file.fileName)
    buckets.get(group)!.push({ layer, flatIndex: index })
  })

  return LAYER_GROUP_ORDER
    .filter(key => (buckets.get(key)?.length ?? 0) > 0)
    .map(key => ({
      key,
      label: LAYER_GROUP_LABELS[key],
      layers: buckets.get(key)!,
    }))
})

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
  const target = e.target as HTMLElement | null
  // Let interactive controls (color popover trigger, eye button, type select)
  // handle pointer events without starting row drag logic.
  if (target?.closest('button, select, input, textarea, [role="button"]')) return

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
