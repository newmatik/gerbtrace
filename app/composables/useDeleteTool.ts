import type { ImageTree, ImageGraphic, SourceRange } from '@lib/gerber/types'
import type { CanvasTransform } from '@lib/renderer/canvas-renderer'
import { hitTestGraphicPoint, graphicIntersectsRect } from '@lib/gerber/hit-test'
import type { BoundingBox } from '@lib/gerber/types'

export interface DeleteLayerData {
  name: string
  type: string
  color: string
  tree: ImageTree
}

export interface PendingDeletionLayer {
  layerName: string
  layerType: string
  layerColor: string
  /** Indices into tree.children of the graphics selected for deletion */
  graphicIndices: number[]
  /** Whether this layer is selected for deletion (user can uncheck) */
  selected: boolean
}

export interface PendingDeletion {
  layers: PendingDeletionLayer[]
}

const DRAG_THRESHOLD_PX = 5
const CLICK_TOLERANCE_PX = 3

export function useDeleteTool() {
  const active = ref(false)

  /** Selection box in screen coordinates while dragging */
  const selectionBox = ref<{ startX: number; startY: number; endX: number; endY: number } | null>(null)

  /** Pending deletion awaiting user confirmation */
  const pendingDeletion = ref<PendingDeletion | null>(null)

  /** Whether a drag is in progress */
  const isDragging = ref(false)

  // Internal state for tracking mousedown
  let mouseDownPos: { x: number; y: number } | null = null
  let dragStarted = false

  function toggle() {
    active.value = !active.value
    if (!active.value) clear()
  }

  function clear() {
    selectionBox.value = null
    pendingDeletion.value = null
    isDragging.value = false
    mouseDownPos = null
    dragStarted = false
  }

  function handleMouseDown(e: MouseEvent, canvasEl: HTMLCanvasElement) {
    if (!active.value || pendingDeletion.value) return

    const rect = canvasEl.getBoundingClientRect()
    mouseDownPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
    dragStarted = false
  }

  function handleMouseMove(e: MouseEvent, canvasEl: HTMLCanvasElement) {
    if (!active.value || !mouseDownPos || pendingDeletion.value) return

    const rect = canvasEl.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    const dx = sx - mouseDownPos.x
    const dy = sy - mouseDownPos.y

    if (!dragStarted && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX) {
      dragStarted = true
      isDragging.value = true
    }

    if (dragStarted) {
      selectionBox.value = {
        startX: mouseDownPos.x,
        startY: mouseDownPos.y,
        endX: sx,
        endY: sy,
      }
    }
  }

  function handleMouseUp(
    e: MouseEvent,
    canvasEl: HTMLCanvasElement,
    transform: CanvasTransform,
    layers: DeleteLayerData[],
  ) {
    if (!active.value || !mouseDownPos || pendingDeletion.value) return

    const rect = canvasEl.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    if (dragStarted) {
      // Box selection
      performBoxSelection(transform, layers)
    } else {
      // Click selection (point hit-test)
      performPointSelection(sx, sy, transform, layers)
    }

    // Reset drag state
    selectionBox.value = null
    isDragging.value = false
    mouseDownPos = null
    dragStarted = false
  }

  function performPointSelection(
    sx: number,
    sy: number,
    transform: CanvasTransform,
    layers: DeleteLayerData[],
  ) {
    // Screen → Gerber
    const gx = (sx - transform.offsetX) / transform.scale
    const gy = (transform.offsetY - sy) / transform.scale
    const tolerance = CLICK_TOLERANCE_PX / transform.scale

    const result: PendingDeletionLayer[] = []

    for (const layer of layers) {
      const indices: number[] = []

      for (let i = 0; i < layer.tree.children.length; i++) {
        const graphic = layer.tree.children[i]!
        if (graphic.erase) continue
        if (hitTestGraphicPoint(gx, gy, graphic, tolerance)) {
          indices.push(i)
        }
      }

      if (indices.length > 0) {
        result.push({
          layerName: layer.name,
          layerType: layer.type,
          layerColor: layer.color,
          graphicIndices: indices,
          selected: true,
        })
      }
    }

    if (result.length > 0) {
      pendingDeletion.value = { layers: result }
    }
  }

  function performBoxSelection(
    transform: CanvasTransform,
    layers: DeleteLayerData[],
  ) {
    const box = selectionBox.value
    if (!box) return

    // Convert screen selection box to Gerber coordinates
    const x1 = (Math.min(box.startX, box.endX) - transform.offsetX) / transform.scale
    const x2 = (Math.max(box.startX, box.endX) - transform.offsetX) / transform.scale
    // Note: Y is flipped
    const y1 = (transform.offsetY - Math.max(box.startY, box.endY)) / transform.scale
    const y2 = (transform.offsetY - Math.min(box.startY, box.endY)) / transform.scale

    const gerberRect: BoundingBox = [x1, y1, x2, y2]

    const result: PendingDeletionLayer[] = []

    for (const layer of layers) {
      const indices: number[] = []

      for (let i = 0; i < layer.tree.children.length; i++) {
        const graphic = layer.tree.children[i]!
        if (graphic.erase) continue
        if (graphicIntersectsRect(graphic, gerberRect)) {
          indices.push(i)
        }
      }

      if (indices.length > 0) {
        result.push({
          layerName: layer.name,
          layerType: layer.type,
          layerColor: layer.color,
          graphicIndices: indices,
          selected: true,
        })
      }
    }

    if (result.length > 0) {
      pendingDeletion.value = { layers: result }
    }
  }

  /** Toggle selection state for a specific layer in the pending deletion */
  function toggleLayerSelection(layerIndex: number) {
    if (!pendingDeletion.value) return
    const layer = pendingDeletion.value.layers[layerIndex]
    if (layer) {
      layer.selected = !layer.selected
    }
  }

  /** Cancel the pending deletion */
  function cancelDeletion() {
    pendingDeletion.value = null
  }

  /** Get the confirmed layers (selected = true) and their source ranges */
  function getConfirmedDeletions(): Array<{
    layerName: string
    sourceRanges: SourceRange[]
    graphicIndices: number[]
  }> {
    if (!pendingDeletion.value) return []

    // We need the tree data to get sourceRanges from graphics
    // This will be called from the viewer page which has access to the trees
    return pendingDeletion.value.layers
      .filter(l => l.selected && l.graphicIndices.length > 0)
      .map(l => ({
        layerName: l.layerName,
        sourceRanges: [], // Will be populated by the caller using the tree
        graphicIndices: l.graphicIndices,
      }))
  }

  /** Total number of objects across all selected layers */
  const totalSelectedCount = computed(() => {
    if (!pendingDeletion.value) return 0
    return pendingDeletion.value.layers
      .filter(l => l.selected)
      .reduce((sum, l) => sum + l.graphicIndices.length, 0)
  })

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (pendingDeletion.value) {
        cancelDeletion()
      } else {
        active.value = false
        clear()
      }
    }
  }

  return {
    active,
    selectionBox,
    pendingDeletion,
    isDragging,
    totalSelectedCount,
    toggle,
    clear,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    toggleLayerSelection,
    cancelDeletion,
    getConfirmedDeletions,
    handleKeyDown,
  }
}
