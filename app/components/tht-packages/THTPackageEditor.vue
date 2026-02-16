<template>
  <div class="flex flex-col h-full">
    <THTEditorToolbar
      :active-tool="activeTool"
      :snap-to-grid="snapToGrid"
      :grid-spacing="gridSpacing"
      :zoom="zoom"
      :can-undo="historyIdx > 0"
      :can-redo="historyIdx < history.length - 1"
      @update:active-tool="activeTool = $event"
      @update:snap-to-grid="snapToGrid = $event"
      @update:grid-spacing="gridSpacing = $event"
      @undo="undo"
      @redo="redo"
      @zoom-to-fit="zoomToFit"
    />
    <div class="flex flex-1 overflow-hidden">
      <!-- Canvas -->
      <div
        ref="canvasContainer"
        class="flex-1 relative overflow-hidden bg-neutral-100 dark:bg-neutral-900 cursor-crosshair"
        @wheel.prevent="onWheel"
        @mousedown="onMouseDown"
        @mousemove="onMouseMove"
        @mouseup="onMouseUp"
        @mouseleave="onMouseLeave"
        @dblclick="onDblClick"
        @contextmenu.prevent="onContextMenu"
      >
        <canvas
          ref="canvasEl"
          class="absolute inset-0"
          :style="{ width: '100%', height: '100%' }"
        />

        <!-- Cursor position display -->
        <div
          class="absolute bottom-2 left-2 px-2 py-1 bg-neutral-800/80 text-neutral-200 text-[10px] rounded tabular-nums font-mono"
        >
          {{ cursorMm.x.toFixed(3) }}, {{ cursorMm.y.toFixed(3) }} mm
          <template v-if="measureStart && activeTool === 'measure'">
            | d={{ measureDistance.toFixed(3) }} mm
          </template>
        </div>

        <!-- Right-click context menu -->
        <Teleport to="body">
          <div
            v-if="ctxMenu.visible"
            ref="ctxMenuEl"
            class="fixed z-[9999] min-w-[160px] py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-xl text-[11px]"
            :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
          >
            <button
              class="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center gap-2 disabled:opacity-30 disabled:pointer-events-none"
              :disabled="selectedIndices.size !== 1 || ctxMenu.shapeIdx == null || ctxMenu.shapeIdx >= modelValue.shapes.length - 1"
              @click="ctxBringToFront"
            >
              <UIcon name="i-lucide-arrow-up-to-line" class="w-3.5 h-3.5" />
              Bring to Front
            </button>
            <button
              class="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center gap-2 disabled:opacity-30 disabled:pointer-events-none"
              :disabled="selectedIndices.size !== 1 || ctxMenu.shapeIdx == null || ctxMenu.shapeIdx >= modelValue.shapes.length - 1"
              @click="ctxBringForward"
            >
              <UIcon name="i-lucide-arrow-up" class="w-3.5 h-3.5" />
              Bring Forward
            </button>
            <button
              class="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center gap-2 disabled:opacity-30 disabled:pointer-events-none"
              :disabled="selectedIndices.size !== 1 || ctxMenu.shapeIdx == null || ctxMenu.shapeIdx <= 0"
              @click="ctxSendBackward"
            >
              <UIcon name="i-lucide-arrow-down" class="w-3.5 h-3.5" />
              Send Backward
            </button>
            <button
              class="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center gap-2 disabled:opacity-30 disabled:pointer-events-none"
              :disabled="selectedIndices.size !== 1 || ctxMenu.shapeIdx == null || ctxMenu.shapeIdx <= 0"
              @click="ctxSendToBack"
            >
              <UIcon name="i-lucide-arrow-down-to-line" class="w-3.5 h-3.5" />
              Send to Back
            </button>
            <div class="my-1 border-t border-neutral-200 dark:border-neutral-700" />
            <button
              class="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center gap-2 disabled:opacity-30 disabled:pointer-events-none"
              :disabled="!hasSelection"
              @click="ctxCopy"
            >
              <UIcon name="i-lucide-copy" class="w-3.5 h-3.5" />
              Copy{{ selectedIndices.size > 1 ? ` (${selectedIndices.size})` : '' }}
            </button>
            <button
              class="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center gap-2 disabled:opacity-30 disabled:pointer-events-none"
              :disabled="clipboard.length === 0"
              @click="ctxPaste"
            >
              <UIcon name="i-lucide-clipboard-paste" class="w-3.5 h-3.5" />
              Paste{{ clipboard.length > 1 ? ` (${clipboard.length})` : '' }}
            </button>
            <button
              class="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center gap-2 disabled:opacity-30 disabled:pointer-events-none"
              :disabled="!hasSelection"
              @click="ctxDuplicate"
            >
              <UIcon name="i-lucide-copy-plus" class="w-3.5 h-3.5" />
              Duplicate{{ selectedIndices.size > 1 ? ` (${selectedIndices.size})` : '' }}
            </button>
            <div class="my-1 border-t border-neutral-200 dark:border-neutral-700" />
            <button
              class="w-full px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-2"
              :disabled="!hasSelection"
              :class="hasSelection ? 'text-red-600 dark:text-red-400' : 'opacity-30 pointer-events-none text-neutral-400'"
              @click="ctxDelete"
            >
              <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
              Delete{{ selectedIndices.size > 1 ? ` (${selectedIndices.size})` : '' }}
            </button>
          </div>
        </Teleport>
      </div>

      <!-- Properties panel -->
      <div class="w-56 border-l border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-y-auto shrink-0">
        <THTShapePropertiesPanel
          :shape="selectedShapeData"
          :selected-count="selectedIndices.size"
          :measure-start="measureStart"
          :measure-end="measureEnd"
          @update:shape="updateSelectedShape"
          @delete="deleteSelectedShapes"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { THTPackageDefinition, THTShape, THTShapeRole } from '~/utils/tht-package-types'
import type { THTEditorTool } from './THTEditorToolbar.vue'

const props = defineProps<{
  modelValue: THTPackageDefinition
}>()

const emit = defineEmits<{
  'update:modelValue': [pkg: THTPackageDefinition]
}>()

// ── State ──

const canvasContainer = ref<HTMLDivElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)

const activeTool = ref<THTEditorTool>('select')
const snapToGrid = ref(true)
const gridSpacing = ref(2.54)
const zoom = ref(40) // pixels per mm
const panX = ref(0) // canvas center offset in pixels
const panY = ref(0)

const selectedIndices = ref<Set<number>>(new Set())
const isDragging = ref(false)
const isPanning = ref(false)
const isDrawing = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const drawStart = ref({ x: 0, y: 0 })
const panStart = ref({ x: 0, y: 0 })
const panStartOffset = ref({ x: 0, y: 0 })

// Measurement tool
const measureStart = ref<{ x: number; y: number } | null>(null)
const measureEnd = ref<{ x: number; y: number } | null>(null)

// Context menu
const ctxMenuEl = ref<HTMLDivElement | null>(null)
const ctxMenu = reactive({
  visible: false,
  x: 0,
  y: 0,
  shapeIdx: null as number | null,
})

// Cursor in mm
const cursorMm = ref({ x: 0, y: 0 })

// ── History (undo/redo) ──

const history = ref<THTPackageDefinition[]>([])
const historyIdx = ref(-1)

function pushHistory() {
  const snap = JSON.parse(JSON.stringify(props.modelValue)) as THTPackageDefinition
  // Truncate any redo states
  history.value = history.value.slice(0, historyIdx.value + 1)
  history.value.push(snap)
  historyIdx.value = history.value.length - 1
}

function undo() {
  if (historyIdx.value <= 0) return
  historyIdx.value--
  emit('update:modelValue', JSON.parse(JSON.stringify(history.value[historyIdx.value]!)))
}

function redo() {
  if (historyIdx.value >= history.value.length - 1) return
  historyIdx.value++
  emit('update:modelValue', JSON.parse(JSON.stringify(history.value[historyIdx.value]!)))
}

// Initialize history
onMounted(() => {
  pushHistory()
})

// ── Computed ──

/** The "primary" selected index — the first (or only) element. Used by the properties panel. */
const primarySelectedIndex = computed<number | null>(() => {
  if (selectedIndices.value.size === 0) return null
  return [...selectedIndices.value][0]!
})

const selectedShapeData = computed<THTShape | null>(() => {
  // Show properties only when exactly one shape is selected
  if (selectedIndices.value.size !== 1) return null
  const idx = primarySelectedIndex.value
  if (idx == null) return null
  return props.modelValue.shapes[idx] ?? null
})

const hasSelection = computed(() => selectedIndices.value.size > 0)

function clearSelection() {
  selectedIndices.value = new Set()
}

function selectOnly(idx: number) {
  selectedIndices.value = new Set([idx])
}

function toggleSelection(idx: number) {
  const next = new Set(selectedIndices.value)
  if (next.has(idx)) next.delete(idx)
  else next.add(idx)
  selectedIndices.value = next
}

function addToSelection(idx: number) {
  const next = new Set(selectedIndices.value)
  next.add(idx)
  selectedIndices.value = next
}

function selectAll() {
  selectedIndices.value = new Set(props.modelValue.shapes.map((_, i) => i))
}

const measureDistance = computed(() => {
  if (!measureStart.value || !measureEnd.value) return 0
  const dx = measureEnd.value.x - measureStart.value.x
  const dy = measureEnd.value.y - measureStart.value.y
  return Math.sqrt(dx * dx + dy * dy)
})

// ── Coordinate transforms ──

function getCanvasSize(): { w: number; h: number } {
  const el = canvasContainer.value
  if (!el) return { w: 800, h: 600 }
  return { w: el.clientWidth, h: el.clientHeight }
}

function mmToCanvas(mx: number, my: number): { x: number; y: number } {
  const { w, h } = getCanvasSize()
  return {
    x: w / 2 + panX.value + mx * zoom.value,
    y: h / 2 + panY.value - my * zoom.value, // Y flipped: +Y is up
  }
}

function canvasToMm(cx: number, cy: number): { x: number; y: number } {
  const { w, h } = getCanvasSize()
  return {
    x: (cx - w / 2 - panX.value) / zoom.value,
    y: -(cy - h / 2 - panY.value) / zoom.value,
  }
}

function snapMm(x: number, y: number): { x: number; y: number } {
  if (!snapToGrid.value) return { x, y }
  const g = gridSpacing.value
  return {
    x: Math.round(x / g) * g,
    y: Math.round(y / g) * g,
  }
}

// ── Shape helpers ──

function emitShapes(shapes: THTShape[]) {
  emit('update:modelValue', { ...props.modelValue, shapes })
}

function updateSelectedShape(shape: THTShape) {
  const idx = primarySelectedIndex.value
  if (idx == null) return
  const shapes = [...props.modelValue.shapes]
  shapes[idx] = shape
  pushHistory()
  emitShapes(shapes)
}

function deleteSelectedShapes() {
  if (selectedIndices.value.size === 0) return
  const toRemove = selectedIndices.value
  const shapes = props.modelValue.shapes.filter((_, i) => !toRemove.has(i))
  pushHistory()
  clearSelection()
  emitShapes(shapes)
}

function addShape(shape: THTShape) {
  pushHistory()
  emitShapes([...props.modelValue.shapes, shape])
  selectOnly(props.modelValue.shapes.length) // will be the new last index
}

function addShapes(newShapes: THTShape[]) {
  if (newShapes.length === 0) return
  pushHistory()
  const baseIdx = props.modelValue.shapes.length
  emitShapes([...props.modelValue.shapes, ...newShapes])
  selectedIndices.value = new Set(newShapes.map((_, i) => baseIdx + i))
}

// ── Z-order helpers ──

function moveShapeToIndex(fromIdx: number, toIdx: number) {
  const shapes = [...props.modelValue.shapes]
  const [moved] = shapes.splice(fromIdx, 1)
  shapes.splice(toIdx, 0, moved!)
  pushHistory()
  emitShapes(shapes)
  selectOnly(toIdx)
}

// ── Context menu ──

function onContextMenu(e: MouseEvent) {
  const mm = getMouseMm(e)
  const hit = hitTest(mm.x, mm.y)

  ctxMenu.shapeIdx = hit
  // If right-clicked on a shape not in the selection, select only that shape
  if (hit != null && !selectedIndices.value.has(hit)) {
    selectOnly(hit)
  }

  ctxMenu.x = e.clientX
  ctxMenu.y = e.clientY
  ctxMenu.visible = true
}

function closeCtxMenu() {
  ctxMenu.visible = false
}

function ctxBringToFront() {
  if (ctxMenu.shapeIdx == null) return
  moveShapeToIndex(ctxMenu.shapeIdx, props.modelValue.shapes.length - 1)
  closeCtxMenu()
}

function ctxBringForward() {
  if (ctxMenu.shapeIdx == null || ctxMenu.shapeIdx >= props.modelValue.shapes.length - 1) return
  moveShapeToIndex(ctxMenu.shapeIdx, ctxMenu.shapeIdx + 1)
  closeCtxMenu()
}

function ctxSendBackward() {
  if (ctxMenu.shapeIdx == null || ctxMenu.shapeIdx <= 0) return
  moveShapeToIndex(ctxMenu.shapeIdx, ctxMenu.shapeIdx - 1)
  closeCtxMenu()
}

function ctxSendToBack() {
  if (ctxMenu.shapeIdx == null) return
  moveShapeToIndex(ctxMenu.shapeIdx, 0)
  closeCtxMenu()
}

function ctxCopy() {
  if (!hasSelection.value) return
  copySelectedShapes()
  closeCtxMenu()
}

function ctxPaste() {
  pasteShapes()
  closeCtxMenu()
}

function ctxDuplicate() {
  if (!hasSelection.value) return
  duplicateSelectedShapes()
  closeCtxMenu()
}

function ctxDelete() {
  if (!hasSelection.value) return
  deleteSelectedShapes()
  closeCtxMenu()
}

function hitTest(mx: number, my: number): number | null {
  // Iterate in reverse to hit top shapes first
  for (let i = props.modelValue.shapes.length - 1; i >= 0; i--) {
    const s = props.modelValue.shapes[i]!
    if (isPointInShape(mx, my, s)) return i
  }
  return null
}

function isPointInShape(mx: number, my: number, s: THTShape): boolean {
  switch (s.kind) {
    case 'rect':
    case 'roundedRect': {
      const hw = s.width / 2
      const hh = s.height / 2
      return mx >= s.x - hw && mx <= s.x + hw && my >= s.y - hh && my <= s.y + hh
    }
    case 'circle': {
      const dx = mx - s.x
      const dy = my - s.y
      return dx * dx + dy * dy <= s.radius * s.radius
    }
    case 'line': {
      // Distance from point to line segment
      const dx = s.x2 - s.x1
      const dy = s.y2 - s.y1
      const len2 = dx * dx + dy * dy
      if (len2 < 0.001) return false
      let t = ((mx - s.x1) * dx + (my - s.y1) * dy) / len2
      t = Math.max(0, Math.min(1, t))
      const px = s.x1 + t * dx
      const py = s.y1 + t * dy
      const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2)
      return dist <= Math.max(s.strokeWidth / 2, 0.3)
    }
  }
}

// ── Mouse handlers ──

function getMouseMm(e: MouseEvent): { x: number; y: number } {
  const rect = canvasContainer.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  return canvasToMm(e.clientX - rect.left, e.clientY - rect.top)
}

function onWheel(e: WheelEvent) {
  const rect = canvasContainer.value?.getBoundingClientRect()
  if (!rect) return

  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top
  const mmBefore = canvasToMm(mouseX, mouseY)

  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
  zoom.value = Math.max(2, Math.min(400, zoom.value * factor))

  // Keep the point under the cursor fixed
  const { w, h } = getCanvasSize()
  panX.value = mouseX - w / 2 - mmBefore.x * zoom.value
  panY.value = mouseY - h / 2 + mmBefore.y * zoom.value

  draw()
}

function onMouseDown(e: MouseEvent) {
  if (ctxMenu.visible) { closeCtxMenu(); return }

  const mm = getMouseMm(e)
  const snapped = snapMm(mm.x, mm.y)

  // Middle click or space+click for panning
  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    isPanning.value = true
    panStart.value = { x: e.clientX, y: e.clientY }
    panStartOffset.value = { x: panX.value, y: panY.value }
    return
  }

  if (e.button !== 0) return

  if (activeTool.value === 'select') {
    const hit = hitTest(mm.x, mm.y)
    if (hit != null) {
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        // Shift/Cmd click: toggle this shape in the selection
        toggleSelection(hit)
      } else if (!selectedIndices.value.has(hit)) {
        // Click on an unselected shape: select only it
        selectOnly(hit)
      }
      // Start dragging all selected shapes
      isDragging.value = true
      dragStart.value = { x: snapped.x, y: snapped.y }
    } else {
      // Click on empty space: clear selection
      clearSelection()
    }
  } else if (activeTool.value === 'measure') {
    measureStart.value = { ...snapped }
    measureEnd.value = { ...snapped }
  } else {
    // Drawing tools
    isDrawing.value = true
    drawStart.value = { ...snapped }
  }
}

function onMouseMove(e: MouseEvent) {
  const mm = getMouseMm(e)
  const snapped = snapMm(mm.x, mm.y)
  cursorMm.value = snapped

  if (isPanning.value) {
    panX.value = panStartOffset.value.x + (e.clientX - panStart.value.x)
    panY.value = panStartOffset.value.y + (e.clientY - panStart.value.y)
    draw()
    return
  }

  if (isDragging.value && selectedIndices.value.size > 0) {
    const dx = snapped.x - dragStart.value.x
    const dy = snapped.y - dragStart.value.y
    if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
      const shapes = [...props.modelValue.shapes]
      for (const idx of selectedIndices.value) {
        if (shapes[idx]) shapes[idx] = moveShape(shapes[idx], dx, dy)
      }
      dragStart.value = { ...snapped }
      emitShapes(shapes)
    }
  }

  if (activeTool.value === 'measure' && measureStart.value) {
    measureEnd.value = { ...snapped }
  }

  draw()
}

function onMouseUp(e: MouseEvent) {
  if (isPanning.value) {
    isPanning.value = false
    return
  }

  if (isDragging.value) {
    isDragging.value = false
    pushHistory()
    return
  }

  if (isDrawing.value) {
    isDrawing.value = false
    const mm = getMouseMm(e)
    const snapped = snapMm(mm.x, mm.y)
    finishDrawing(snapped)
    return
  }

  if (activeTool.value === 'measure' && measureStart.value) {
    const snapped = snapMm(getMouseMm(e).x, getMouseMm(e).y)
    measureEnd.value = { ...snapped }
  }
}

function onMouseLeave() {
  if (isPanning.value) isPanning.value = false
  if (isDragging.value) {
    isDragging.value = false
    pushHistory()
  }
  isDrawing.value = false
}

function onDblClick(e: MouseEvent) {
  if (activeTool.value !== 'select') return
  const mm = getMouseMm(e)
  const hit = hitTest(mm.x, mm.y)
  if (hit != null) {
    selectOnly(hit)
  }
}

function finishDrawing(endMm: { x: number; y: number }) {
  const sx = drawStart.value.x
  const sy = drawStart.value.y
  const ex = endMm.x
  const ey = endMm.y

  const defaultRole: THTShapeRole = 'body'

  switch (activeTool.value) {
    case 'rect': {
      const w = Math.abs(ex - sx)
      const h = Math.abs(ey - sy)
      if (w < 0.01 && h < 0.01) {
        // Single click: create a default 2.54x2.54 rect at cursor
        addShape({ kind: 'rect', role: defaultRole, x: sx, y: sy, width: 2.54, height: 2.54 })
      } else {
        addShape({
          kind: 'rect', role: defaultRole,
          x: (sx + ex) / 2, y: (sy + ey) / 2,
          width: Math.max(w, 0.1), height: Math.max(h, 0.1),
        })
      }
      break
    }
    case 'circle': {
      const r = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2)
      addShape({
        kind: 'circle', role: 'pin',
        x: sx, y: sy,
        radius: r < 0.05 ? 0.5 : r,
      })
      break
    }
    case 'roundedRect': {
      const w = Math.abs(ex - sx)
      const h = Math.abs(ey - sy)
      if (w < 0.01 && h < 0.01) {
        addShape({ kind: 'roundedRect', role: defaultRole, x: sx, y: sy, width: 2.54, height: 2.54, cornerRadius: 0.3 })
      } else {
        addShape({
          kind: 'roundedRect', role: defaultRole,
          x: (sx + ex) / 2, y: (sy + ey) / 2,
          width: Math.max(w, 0.1), height: Math.max(h, 0.1),
          cornerRadius: Math.min(w, h) * 0.15,
        })
      }
      break
    }
    case 'line': {
      const len = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2)
      if (len < 0.05) return
      addShape({
        kind: 'line', role: 'polarity-marker',
        x1: sx, y1: sy, x2: ex, y2: ey,
        strokeWidth: 0.2,
      })
      break
    }
  }
}

function moveShape(s: THTShape, dx: number, dy: number): THTShape {
  switch (s.kind) {
    case 'rect': return { ...s, x: s.x + dx, y: s.y + dy }
    case 'circle': return { ...s, x: s.x + dx, y: s.y + dy }
    case 'roundedRect': return { ...s, x: s.x + dx, y: s.y + dy }
    case 'line': return { ...s, x1: s.x1 + dx, y1: s.y1 + dy, x2: s.x2 + dx, y2: s.y2 + dy }
  }
}

// ── Clipboard (copy / paste / duplicate) ──

const clipboard = ref<THTShape[]>([])
const PASTE_OFFSET = 1.27 // mm offset so the pasted shape is visually distinct

function offsetShape(s: THTShape, dx: number, dy: number): THTShape {
  return moveShape(s, dx, dy)
}

function copySelectedShapes() {
  if (selectedIndices.value.size === 0) return
  const shapes = [...selectedIndices.value]
    .sort((a, b) => a - b)
    .map(i => props.modelValue.shapes[i]!)
    .filter(Boolean)
  clipboard.value = JSON.parse(JSON.stringify(shapes))
}

function pasteShapes() {
  if (clipboard.value.length === 0) return
  const clones: THTShape[] = JSON.parse(JSON.stringify(clipboard.value))
  const offset = PASTE_OFFSET
  for (let i = 0; i < clones.length; i++) {
    clones[i] = offsetShape(clones[i]!, offset, offset)
  }
  addShapes(clones)
  // Update clipboard to the new positions so repeated pastes cascade
  clipboard.value = JSON.parse(JSON.stringify(clones))
}

function duplicateSelectedShapes() {
  copySelectedShapes()
  pasteShapes()
}

// ── Keyboard shortcuts ──

function onKeyDown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    undo()
    return
  }
  if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    redo()
    return
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
    e.preventDefault()
    copySelectedShapes()
    return
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
    e.preventDefault()
    pasteShapes()
    return
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
    e.preventDefault()
    duplicateSelectedShapes()
    return
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
    e.preventDefault()
    selectAll()
    draw()
    return
  }

  switch (e.key) {
    case 'Delete': case 'Backspace':
      if (hasSelection.value) deleteSelectedShapes()
      break
    case 'Escape':
      if (ctxMenu.visible) { closeCtxMenu(); break }
      clearSelection()
      measureStart.value = null
      measureEnd.value = null
      break
  }

  // Tool shortcuts — only when no modifier is held (so Ctrl+C doesn't trigger circle tool)
  if (!e.metaKey && !e.ctrlKey && !e.altKey) {
    switch (e.key) {
      case 'v': case 'V': activeTool.value = 'select'; break
      case 'r': case 'R': activeTool.value = 'rect'; break
      case 'c': case 'C': activeTool.value = 'circle'; break
      case 'l': case 'L': activeTool.value = 'line'; break
      case 'm': case 'M': activeTool.value = 'measure'; break
    }
  }
}

function onDocumentClick(e: MouseEvent) {
  if (ctxMenu.visible && ctxMenuEl.value && !ctxMenuEl.value.contains(e.target as Node)) {
    closeCtxMenu()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  document.addEventListener('mousedown', onDocumentClick, true)
  requestAnimationFrame(draw)
  zoomToFit()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('mousedown', onDocumentClick, true)
})

// ── Zoom to fit ──

function zoomToFit() {
  const { w, h } = getCanvasSize()
  if (props.modelValue.shapes.length === 0) {
    zoom.value = 40
    panX.value = 0
    panY.value = 0
    draw()
    return
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of props.modelValue.shapes) {
    switch (s.kind) {
      case 'rect':
      case 'roundedRect': {
        minX = Math.min(minX, s.x - s.width / 2)
        minY = Math.min(minY, s.y - s.height / 2)
        maxX = Math.max(maxX, s.x + s.width / 2)
        maxY = Math.max(maxY, s.y + s.height / 2)
        break
      }
      case 'circle': {
        minX = Math.min(minX, s.x - s.radius)
        minY = Math.min(minY, s.y - s.radius)
        maxX = Math.max(maxX, s.x + s.radius)
        maxY = Math.max(maxY, s.y + s.radius)
        break
      }
      case 'line': {
        minX = Math.min(minX, s.x1, s.x2)
        minY = Math.min(minY, s.y1, s.y2)
        maxX = Math.max(maxX, s.x1, s.x2)
        maxY = Math.max(maxY, s.y1, s.y2)
        break
      }
    }
  }

  if (!Number.isFinite(minX)) {
    zoom.value = 40
    panX.value = 0
    panY.value = 0
    draw()
    return
  }

  const padMm = 3
  const boundsW = maxX - minX + padMm * 2
  const boundsH = maxY - minY + padMm * 2
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  zoom.value = Math.min(w / boundsW, h / boundsH, 200)
  panX.value = -centerX * zoom.value
  panY.value = centerY * zoom.value
  draw()
}

// ── Drawing ──

const colorMode = useColorMode()

function draw() {
  const canvas = canvasEl.value
  const container = canvasContainer.value
  if (!canvas || !container) return

  const dpr = window.devicePixelRatio || 1
  const w = container.clientWidth
  const h = container.clientHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`

  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, w, h)

  const isDark = colorMode.value === 'dark'

  // Background
  ctx.fillStyle = isDark ? '#171717' : '#f5f5f5'
  ctx.fillRect(0, 0, w, h)

  // Draw grid
  drawGrid(ctx, w, h, isDark)

  // Draw shapes
  for (let i = 0; i < props.modelValue.shapes.length; i++) {
    const s = props.modelValue.shapes[i]!
    const isSelected = selectedIndices.value.has(i)
    drawShape(ctx, s, isSelected, isDark)
  }

  // Draw crosshair at origin
  drawOriginCrosshair(ctx, w, h, isDark)

  // Draw measurement line
  if (measureStart.value && measureEnd.value && activeTool.value === 'measure') {
    drawMeasurement(ctx, measureStart.value, measureEnd.value, isDark)
  }

  // Draw preview for drawing tool
  if (isDrawing.value) {
    drawPreview(ctx, isDark)
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, isDark: boolean) {
  const g = gridSpacing.value
  const { x: minX, y: maxY } = canvasToMm(0, 0)
  const { x: maxX, y: minY } = canvasToMm(w, h)

  const startX = Math.floor(minX / g) * g
  const startY = Math.floor(minY / g) * g
  const endX = Math.ceil(maxX / g) * g
  const endY = Math.ceil(maxY / g) * g

  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  ctx.lineWidth = 0.5

  for (let x = startX; x <= endX; x += g) {
    const cx = mmToCanvas(x, 0).x
    ctx.beginPath()
    ctx.moveTo(cx, 0)
    ctx.lineTo(cx, h)
    ctx.stroke()
  }
  for (let y = startY; y <= endY; y += g) {
    const cy = mmToCanvas(0, y).y
    ctx.beginPath()
    ctx.moveTo(0, cy)
    ctx.lineTo(w, cy)
    ctx.stroke()
  }
}

function drawOriginCrosshair(ctx: CanvasRenderingContext2D, w: number, h: number, isDark: boolean) {
  const { x: ox, y: oy } = mmToCanvas(0, 0)

  ctx.strokeStyle = isDark ? 'rgba(100,200,255,0.3)' : 'rgba(0,100,200,0.2)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])

  ctx.beginPath()
  ctx.moveTo(ox, 0)
  ctx.lineTo(ox, h)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(0, oy)
  ctx.lineTo(w, oy)
  ctx.stroke()

  ctx.setLineDash([])

  // Small cross
  const s = 6
  ctx.strokeStyle = isDark ? 'rgba(100,200,255,0.6)' : 'rgba(0,100,200,0.5)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(ox - s, oy)
  ctx.lineTo(ox + s, oy)
  ctx.moveTo(ox, oy - s)
  ctx.lineTo(ox, oy + s)
  ctx.stroke()
}

function drawShape(ctx: CanvasRenderingContext2D, s: THTShape, isSelected: boolean, isDark: boolean) {
  const pkg = props.modelValue

  switch (s.kind) {
    case 'rect': {
      const { x: cx, y: cy } = mmToCanvas(s.x, s.y)
      const w = s.width * zoom.value
      const h = s.height * zoom.value

      ctx.fillStyle = resolveColor(s.role, s.color, pkg, isDark)
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h)

      ctx.strokeStyle = resolveStroke(s.role, s.strokeColor, pkg, isDark)
      ctx.lineWidth = isSelected ? 2 : 1
      ctx.strokeRect(cx - w / 2, cy - h / 2, w, h)
      break
    }
    case 'circle': {
      const { x: cx, y: cy } = mmToCanvas(s.x, s.y)
      const r = s.radius * zoom.value

      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = resolveColor(s.role, s.color, pkg, isDark)
      ctx.fill()
      ctx.strokeStyle = resolveStroke(s.role, s.strokeColor, pkg, isDark)
      ctx.lineWidth = isSelected ? 2 : 1
      ctx.stroke()
      break
    }
    case 'roundedRect': {
      const { x: cx, y: cy } = mmToCanvas(s.x, s.y)
      const w = s.width * zoom.value
      const h = s.height * zoom.value
      const r = Math.min(s.cornerRadius * zoom.value, w / 2, h / 2)

      ctx.beginPath()
      roundRect(ctx, cx - w / 2, cy - h / 2, w, h, r)
      ctx.fillStyle = resolveColor(s.role, s.color, pkg, isDark)
      ctx.fill()
      ctx.strokeStyle = resolveStroke(s.role, s.strokeColor, pkg, isDark)
      ctx.lineWidth = isSelected ? 2 : 1
      ctx.stroke()
      break
    }
    case 'line': {
      const p1 = mmToCanvas(s.x1, s.y1)
      const p2 = mmToCanvas(s.x2, s.y2)

      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.strokeStyle = s.color || (isDark ? '#ff6666' : '#cc3333')
      ctx.lineWidth = Math.max(s.strokeWidth * zoom.value, 1)
      ctx.stroke()
      break
    }
  }

  // Selection highlight
  if (isSelected) {
    ctx.strokeStyle = '#00bcd4'
    ctx.lineWidth = 2
    ctx.setLineDash([4, 3])
    drawSelectionBounds(ctx, s)
    ctx.setLineDash([])
  }
}

function drawSelectionBounds(ctx: CanvasRenderingContext2D, s: THTShape) {
  const pad = 3
  switch (s.kind) {
    case 'rect':
    case 'roundedRect': {
      const { x: cx, y: cy } = mmToCanvas(s.x, s.y)
      const w = s.width * zoom.value + pad * 2
      const h = s.height * zoom.value + pad * 2
      ctx.strokeRect(cx - w / 2, cy - h / 2, w, h)
      break
    }
    case 'circle': {
      const { x: cx, y: cy } = mmToCanvas(s.x, s.y)
      const r = s.radius * zoom.value + pad
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    case 'line': {
      const p1 = mmToCanvas(s.x1, s.y1)
      const p2 = mmToCanvas(s.x2, s.y2)
      ctx.beginPath()
      ctx.arc(p1.x, p1.y, 4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(p2.x, p2.y, 4, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
  }
}

function drawMeasurement(ctx: CanvasRenderingContext2D, start: { x: number; y: number }, end: { x: number; y: number }, isDark: boolean) {
  const p1 = mmToCanvas(start.x, start.y)
  const p2 = mmToCanvas(end.x, end.y)

  ctx.strokeStyle = isDark ? '#4fc3f7' : '#0288d1'
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 3])
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.stroke()
  ctx.setLineDash([])

  // Distance label
  const dx = end.x - start.x
  const dy = end.y - start.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const mx = (p1.x + p2.x) / 2
  const my = (p1.y + p2.y) / 2
  const label = `${dist.toFixed(3)} mm`

  ctx.font = '11px system-ui, sans-serif'
  ctx.fillStyle = isDark ? '#4fc3f7' : '#0288d1'
  ctx.textAlign = 'center'
  ctx.fillText(label, mx, my - 6)
  ctx.textAlign = 'start'
}

function drawPreview(ctx: CanvasRenderingContext2D, isDark: boolean) {
  const sx = drawStart.value.x
  const sy = drawStart.value.y
  const ex = cursorMm.value.x
  const ey = cursorMm.value.y

  ctx.strokeStyle = isDark ? 'rgba(0,188,212,0.6)' : 'rgba(0,150,180,0.5)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 3])

  if (activeTool.value === 'rect' || activeTool.value === 'roundedRect') {
    const p1 = mmToCanvas(Math.min(sx, ex), Math.max(sy, ey))
    const p2 = mmToCanvas(Math.max(sx, ex), Math.min(sy, ey))
    ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y)
  } else if (activeTool.value === 'circle') {
    const { x: cx, y: cy } = mmToCanvas(sx, sy)
    const r = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2) * zoom.value
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  } else if (activeTool.value === 'line') {
    const p1 = mmToCanvas(sx, sy)
    const p2 = mmToCanvas(ex, ey)
    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.stroke()
  }

  ctx.setLineDash([])
}

function resolveColor(role: THTShapeRole, override: string | undefined, pkg: THTPackageDefinition, isDark: boolean): string {
  if (override) return override
  if (role === 'body') return pkg.bodyColor || (isDark ? 'rgba(50,50,50,0.85)' : 'rgba(60,60,60,0.85)')
  if (role === 'pin' || role === 'pin1') return pkg.pinColor || (isDark ? 'rgba(200,200,200,0.9)' : 'rgba(180,180,180,0.9)')
  if (role === 'polarity-marker') return isDark ? 'rgba(255,80,80,0.9)' : 'rgba(220,50,50,0.9)'
  return isDark ? '#666' : '#999'
}

function resolveStroke(role: THTShapeRole, override: string | undefined, pkg: THTPackageDefinition, isDark: boolean): string {
  if (override) return override
  if (role === 'body') return pkg.bodyStrokeColor || (isDark ? 'rgba(80,80,80,0.9)' : 'rgba(100,100,100,0.9)')
  if (role === 'pin' || role === 'pin1') return pkg.pinStrokeColor || (isDark ? 'rgba(150,150,150,0.8)' : 'rgba(120,120,120,0.8)')
  return isDark ? '#888' : '#aaa'
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
}

// Re-draw on model change
watch(() => props.modelValue, () => draw(), { deep: true })

// Re-draw on container resize
const resizeObserver = ref<ResizeObserver | null>(null)
onMounted(() => {
  if (canvasContainer.value) {
    resizeObserver.value = new ResizeObserver(() => draw())
    resizeObserver.value.observe(canvasContainer.value)
  }
})
onUnmounted(() => {
  resizeObserver.value?.disconnect()
})
</script>
