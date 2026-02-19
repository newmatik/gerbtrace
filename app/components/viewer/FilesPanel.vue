<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <div class="flex-1 overflow-y-auto">
      <div class="p-3">
        <div v-if="layers.length === 0 && documents.length === 0" class="text-xs text-neutral-400 py-6 text-center">
          No files loaded
        </div>

        <div ref="listRef" class="space-y-0.5">
          <template v-for="group in groups" :key="group.key">
            <!-- Group header -->
            <div class="flex items-center gap-1.5 w-full px-2 py-1 mt-1 first:mt-0 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 rounded">
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
            </div>

            <!-- Group layers -->
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
                @pointerdown="onPointerDownLayer(entry.flatIndex, $event)"
              >
                <!-- Drop indicator line above this item -->
                <div
                  v-if="showIndicatorAt === entry.flatIndex"
                  class="h-0.5 bg-primary-400 rounded-full mb-0.5"
                />

                <div
                  class="group flex items-center gap-2 px-2 py-1.5 rounded text-xs select-none transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  :class="isLayerSelected(entry.layer.file.fileName, entry.flatIndex) ? 'bg-blue-50/80 dark:bg-blue-500/10' : ''"
                  @click="onLayerRowClick(entry.layer.file.fileName, entry.flatIndex)"
                >
                  <UIcon :name="getLayerIconName(entry.layer.type)" :class="getLayerIconClass(entry.layer.type)" />
                  <div class="flex-1 min-w-0">
                    <input
                      v-if="renamingIndex === entry.flatIndex"
                      ref="renameInputEl"
                      v-model="renameDraft"
                      class="w-full text-xs bg-transparent border border-primary rounded px-1 py-0.5 outline-none"
                      @keydown.enter.prevent="commitRename(entry.flatIndex)"
                      @keydown.escape.prevent="cancelRename"
                      @blur="commitRename(entry.flatIndex)"
                      @pointerdown.stop
                      @click.stop
                    />
                    <span
                      v-else
                      class="truncate block"
                      :class="isLayerSelected(entry.layer.file.fileName, entry.flatIndex) ? 'text-blue-700 dark:text-blue-300 font-medium' : ''"
                    >
                      {{ entry.layer.file.fileName }}
                    </span>
                  </div>

                  <UDropdownMenu :items="[layerMenuItems(entry.flatIndex)]" :content="{ side: 'bottom', align: 'end', sideOffset: 6 }">
                    <button
                      class="shrink-0 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors opacity-0 group-hover:opacity-100"
                      title="Actions"
                      :disabled="locked"
                      @pointerdown.stop
                      @click.stop
                    >
                      <UIcon name="i-lucide-ellipsis-vertical" class="text-sm" />
                    </button>
                  </UDropdownMenu>

                  <USelect
                    :model-value="entry.layer.type"
                    :items="layerTypeItems"
                    value-key="value"
                    label-key="label"
                    size="xs"
                    class="shrink-0 w-fit min-w-32 max-w-[18rem]"
                    :disabled="locked"
                    :ui="{
                      content: 'min-w-fit max-w-[22rem]',
                      value: 'whitespace-nowrap pointer-events-none',
                      placeholder: 'whitespace-nowrap text-dimmed',
                      itemLabel: 'whitespace-normal leading-tight',
                    }"
                    @click.stop
                    @pointerdown.stop
                    @update:model-value="(value) => emit('changeLayerType', entry.flatIndex, String(value))"
                  />
                </div>
              </div>
            </template>
          </template>

          <!-- Drop indicator at end -->
          <div
            v-if="showIndicatorAt === layers.length"
            class="h-0.5 bg-primary-400 rounded-full mt-0.5"
          />

          <!-- Documents group -->
          <template v-if="documents.length > 0">
            <div class="flex items-center gap-1.5 w-full px-2 py-1 mt-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 rounded">
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
                class="group flex items-center gap-2 px-2 py-1.5 rounded text-xs select-none transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                :class="isDocSelected(doc.id) ? 'bg-blue-50/80 dark:bg-blue-500/10' : ''"
                @click="selectDoc(doc.id)"
              >
                <UIcon :name="getDocumentIconName(doc.type)" class="text-sm text-neutral-400 shrink-0 w-4 h-4" />
                <span class="truncate flex-1 min-w-0" :class="isDocSelected(doc.id) ? 'text-blue-700 dark:text-blue-300 font-medium' : ''">
                  {{ doc.name }}
                </span>

                <UDropdownMenu :items="[docMenuItems(doc.id)]" :content="{ side: 'bottom', align: 'end', sideOffset: 6 }">
                  <button
                    class="shrink-0 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors opacity-0 group-hover:opacity-100"
                    title="Actions"
                    :disabled="locked"
                    @pointerdown.stop
                    @click.stop
                  >
                    <UIcon name="i-lucide-ellipsis-vertical" class="text-sm" />
                  </button>
                </UDropdownMenu>

                <USelect
                  :model-value="doc.type"
                  :items="documentTypeItems"
                  value-key="value"
                  label-key="label"
                  size="xs"
                  class="shrink-0 w-fit min-w-32 max-w-[18rem]"
                  :disabled="locked"
                  :ui="{
                    content: 'min-w-fit max-w-[22rem]',
                    value: 'whitespace-nowrap pointer-events-none',
                    placeholder: 'whitespace-nowrap text-dimmed',
                    itemLabel: 'whitespace-normal leading-tight',
                  }"
                  @click.stop
                  @pointerdown.stop
                  @update:model-value="emit('updateDocumentType', doc.id, String($event) as DocumentType)"
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
import type { LayerInfo } from '~/utils/gerber-helpers'
import { ALL_LAYER_TYPES, getLayerGroup, LAYER_GROUP_ORDER, LAYER_GROUP_LABELS, type LayerGroupKey } from '~/utils/gerber-helpers'
import type { DocumentType, ProjectDocument } from '~/utils/document-types'

const selectedLayerFileName = defineModel<string | null>('selectedLayerFileName', { default: null })
const selectedLayerIndex = defineModel<number | null>('selectedLayerIndex', { default: null })
const selectedDocId = defineModel<string | null>('selectedDocId', { default: null })

const props = defineProps<{
  layers: LayerInfo[]
  documents: ProjectDocument[]
  locked?: boolean
}>()

const locked = computed(() => !!props.locked)

const emit = defineEmits<{
  changeLayerType: [index: number, type: string]
  removeLayer: [index: number]
  renameLayer: [index: number, newName: string]
  duplicateLayer: [index: number]
  reorder: [fromIndex: number, toIndex: number]
  downloadLayer: [index: number]
  selectLayer: [payload: { index: number; fileName: string }]

  updateDocumentType: [id: string, type: DocumentType]
  removeDocument: [id: string]
  downloadDocument: [id: string]
  selectDoc: [id: string]
}>()

const layerTypeItems = ALL_LAYER_TYPES.map(t => ({ label: t, value: t }))
const documentTypes: DocumentType[] = ['Schematics', 'Drawings', 'Datasheets', 'Instructions']
const documentTypeItems = documentTypes.map(t => ({ label: t, value: t }))

interface LayerGroupData {
  key: LayerGroupKey
  label: string
  layers: { layer: LayerInfo; flatIndex: number }[]
}

// ── Collapsible groups ──
const collapsed = ref(new Set<LayerGroupKey>())

function toggleGroup(key: LayerGroupKey) {
  const next = new Set(collapsed.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsed.value = next
}

const groups = computed<LayerGroupData[]>(() => {
  const buckets = new Map<LayerGroupKey, { layer: LayerInfo; flatIndex: number }[]>()
  for (const key of LAYER_GROUP_ORDER) buckets.set(key, [])

  props.layers.forEach((layer, index) => {
    const group = getLayerGroup(layer.type, layer.file.fileName)
    buckets.get(group)!.push({ layer, flatIndex: index })
  })

  return LAYER_GROUP_ORDER
    .filter(key => (buckets.get(key)?.length ?? 0) > 0)
    .map(key => ({ key, label: LAYER_GROUP_LABELS[key], layers: buckets.get(key)! }))
})

// --- Pointer-based drag-to-reorder (same logic as LayerPanel) ---
const DRAG_THRESHOLD = 5
const listRef = ref<HTMLElement | null>(null)
const dragFrom = ref<number | null>(null)
const dragOver = ref<number | null>(null)
const isDragging = ref(false)
const startY = ref(0)

const showIndicatorAt = computed<number | null>(() => {
  if (!isDragging.value || dragFrom.value === null || dragOver.value === null) return null
  if (dragOver.value === dragFrom.value) return null
  if (dragOver.value === dragFrom.value + 1) return null
  return dragOver.value
})

function onPointerDownLayer(index: number, e: PointerEvent) {
  if (e.button !== 0) return
  const target = e.target as HTMLElement | null
  if (target?.closest('button, select, input, textarea, [role="button"]')) return

  if (locked.value) {
    // Locked files tab still allows read-only layer selection.
    const layer = props.layers[index]
    if (layer) selectLayer(layer.file.fileName, index)
    return
  }

  dragFrom.value = index
  startY.value = e.clientY
  isDragging.value = false
  dragOver.value = null

  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)

  let finished = false

  const onMove = (ev: PointerEvent) => {
    const dy = Math.abs(ev.clientY - startY.value)
    if (!isDragging.value && dy > DRAG_THRESHOLD) isDragging.value = true
    if (isDragging.value) updateDragOver(ev.clientY)
  }

  const onUp = () => {
    if (finished) return
    finished = true

    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp)
    el.removeEventListener('lostpointercapture', onUp)
    try { el.releasePointerCapture(e.pointerId) } catch { /* ignore */ }

    if (isDragging.value) {
      if (dragFrom.value !== null && dragOver.value !== null) {
        const from = dragFrom.value
        const to = from < dragOver.value ? dragOver.value - 1 : dragOver.value
        if (from !== to) emit('reorder', from, to)
      }
    } else {
      // Treat a non-drag pointer interaction as selection.
      const layer = props.layers[index]
      if (layer) selectLayer(layer.file.fileName, index)
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
  const items = Array.from(listRef.value.querySelectorAll<HTMLElement>('[data-layer-index]'))
  for (const item of items) {
    const rect = item.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    if (clientY < midY) {
      dragOver.value = Number(item.dataset.layerIndex)
      return
    }
  }
  dragOver.value = props.layers.length
}

// ── Layer row actions ──

const renamingIndex = ref<number | null>(null)
const renameDraft = ref('')
const renameInputEl = ref<HTMLInputElement | null>(null)

function startRename(index: number) {
  if (locked.value) return
  const layer = props.layers[index]
  if (!layer) return
  renamingIndex.value = index
  renameDraft.value = layer.file.fileName
  nextTick(() => {
    renameInputEl.value?.focus()
    renameInputEl.value?.select()
  })
}

function cancelRename() {
  renamingIndex.value = null
  renameDraft.value = ''
}

function commitRename(index: number) {
  if (renamingIndex.value !== index) return
  const nextName = renameDraft.value.trim()
  if (nextName) emit('renameLayer', index, nextName)
  cancelRename()
}

function layerMenuItems(index: number) {
  if (locked.value) {
    return [
      {
        label: 'Download',
        icon: 'i-lucide-download',
        onSelect: () => emit('downloadLayer', index),
      },
    ]
  }
  return [
    {
      label: 'Download',
      icon: 'i-lucide-download',
      onSelect: () => emit('downloadLayer', index),
    },
    {
      label: 'Rename',
      icon: 'i-lucide-pencil',
      onSelect: () => startRename(index),
    },
    {
      label: 'Duplicate',
      icon: 'i-lucide-copy',
      onSelect: () => emit('duplicateLayer', index),
    },
    {
      label: 'Remove',
      icon: 'i-lucide-trash-2',
      onSelect: () => emit('removeLayer', index),
    },
  ]
}

function docMenuItems(id: string) {
  if (locked.value) {
    return [
      {
        label: 'Download',
        icon: 'i-lucide-download',
        onSelect: () => emit('downloadDocument', id),
      },
    ]
  }
  return [
    {
      label: 'Download',
      icon: 'i-lucide-download',
      onSelect: () => emit('downloadDocument', id),
    },
    {
      label: 'Remove',
      icon: 'i-lucide-trash-2',
      onSelect: () => emit('removeDocument', id),
    },
  ]
}

function isLayerSelected(fileName: string, index: number) {
  if (selectedLayerIndex.value != null) return selectedLayerIndex.value === index
  return selectedLayerFileName.value === fileName
}

function isDocSelected(id: string) {
  return selectedDocId.value === id
}

function selectLayer(fileName: string, index: number) {
  selectedLayerFileName.value = fileName
  selectedLayerIndex.value = index
  selectedDocId.value = null
  emit('selectLayer', { index, fileName })
}

function onLayerRowClick(fileName: string, index: number) {
  if (isDragging.value) return
  selectLayer(fileName, index)
}

function selectDoc(id: string) {
  selectedDocId.value = id
  selectedLayerFileName.value = null
  selectedLayerIndex.value = null
  emit('selectDoc', id)
}

function getLayerIconName(type: string): string {
  switch (type) {
    case 'Drill':
      return 'i-lucide-drill'
    case 'Top Copper':
      return 'i-lucide-square-chevron-up'
    case 'Bottom Copper':
      return 'i-lucide-square-chevron-down'
    case 'Inner Layer':
      return 'i-lucide-layers'
    case 'Top Solder Mask':
      return 'i-lucide-shield-check'
    case 'Bottom Solder Mask':
      return 'i-lucide-shield'
    case 'Top Silkscreen':
      return 'i-lucide-pencil-line'
    case 'Bottom Silkscreen':
      return 'i-lucide-pen-line'
    case 'Top Paste':
      return 'i-lucide-paint-bucket'
    case 'Bottom Paste':
      return 'i-lucide-paintbrush'
    case 'Outline':
      return 'i-lucide-square'
    case 'Keep-Out':
      return 'i-lucide-octagon-alert'
    case 'PnP Top':
    case 'PnP Bottom':
    case 'PnP Top + Bot':
      return 'i-lucide-microchip'
    case 'PnP Top (THT)':
    case 'PnP Bottom (THT)':
    case 'PnP Top + Bot (THT)':
      return 'i-lucide-pin'
    case 'BOM':
      return 'i-lucide-file-spreadsheet'
    case 'Unmatched':
      return 'i-lucide-circle-help'
    default:
      return 'i-lucide-file'
  }
}

function getLayerIconClass(type: string): string {
  void type
  return 'text-sm text-neutral-400 shrink-0 w-4 h-4'
}

function getDocumentIconName(type: DocumentType): string {
  switch (type) {
    case 'Schematics':
      return 'i-lucide-circuit-board'
    case 'Drawings':
      return 'i-lucide-ruler'
    case 'Datasheets':
      return 'i-lucide-file-text'
    case 'Instructions':
      return 'i-lucide-list-checks'
    default:
      return 'i-lucide-file-text'
  }
}
</script>

