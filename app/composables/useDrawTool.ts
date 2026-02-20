import type { CanvasTransform } from '@lib/renderer/canvas-renderer'
import type { ImageTree } from '@lib/gerber/types'
import {
  parseFormatFromSource,
  findNextApertureCode,
  generateLine,
  generateRect,
  generateCircle,
  generateText,
  injectGerberCommands,
  mmToFileUnits,
  fileUnitsToMm,
  type GerberFormatSpec,
} from '@lib/gerber/generator'
import {
  extractSnapPoints,
  findBestDrawSnap,
  type AlignSnapPoint,
  type DrawSnapResult,
} from '~/utils/snap-points'

export type DrawShapeTool = 'line' | 'rect' | 'circle' | 'text'

export interface DrawPreviewShape {
  tool: DrawShapeTool
  /** Gerber coordinates */
  startX: number
  startY: number
  endX: number
  endY: number
  /** For circle: radius in Gerber units */
  radius?: number
  /** For text */
  text?: string
  textHeight?: number
  filled: boolean
  strokeWidth: number
}

export interface DrawToolLayerInfo {
  fileName: string
  type: string
  color: string
  content: string
  tree: ImageTree | null
}

const SNAP_THRESHOLD_PX = 12
const DEFAULT_STROKE_WIDTH_MM = 0.2
const DEFAULT_GRID_SPACING_MM = 0.5

export function useDrawTool() {
  const active = ref(false)
  const activeTool = ref<DrawShapeTool>('rect')
  const targetLayerName = ref<string>('')

  const strokeWidthMm = ref(DEFAULT_STROKE_WIDTH_MM)
  const filled = ref(true)
  const snapEnabled = ref(true)
  const gridSpacingMm = ref(DEFAULT_GRID_SPACING_MM)

  // Precise dimension input
  const preciseMode = ref(false)
  const preciseWidthMm = ref(5)
  const preciseHeightMm = ref(5)
  const preciseRadiusMm = ref(1)
  const preciseText = ref('LABEL')
  const preciseTextHeightMm = ref(1.5)

  // Drawing state
  const isDrawing = ref(false)
  const drawStart = ref<{ x: number; y: number } | null>(null)
  const cursorGerber = ref<{ x: number; y: number }>({ x: 0, y: 0 })
  const activeSnap = ref<DrawSnapResult | null>(null)
  const previewShape = ref<DrawPreviewShape | null>(null)

  // Snap targets from all visible layers
  const snapTargets = ref<AlignSnapPoint[]>([])
  const fileUnits = ref<'mm' | 'in'>('mm')

  // Undo support: last committed operation
  const lastCommit = ref<{
    layerName: string
    previousContent: string
  } | null>(null)

  function toggle() {
    active.value = !active.value
    if (!active.value) clear()
  }

  function clear() {
    isDrawing.value = false
    drawStart.value = null
    previewShape.value = null
    activeSnap.value = null
  }

  function setTool(tool: DrawShapeTool) {
    activeTool.value = tool
    clear()
  }

  // -- Coordinate transforms --

  function screenToGerber(sx: number, sy: number, t: CanvasTransform): { x: number; y: number } {
    return {
      x: (sx - t.offsetX) / t.scale,
      y: (t.offsetY - sy) / t.scale,
    }
  }

  function gerberToScreen(gx: number, gy: number, t: CanvasTransform): { sx: number; sy: number } {
    return {
      sx: t.offsetX + gx * t.scale,
      sy: t.offsetY - gy * t.scale,
    }
  }

  // -- Snapping --

  function applySnap(
    gerber: { x: number; y: number },
    transform: CanvasTransform,
  ): { x: number; y: number } {
    if (!snapEnabled.value) {
      activeSnap.value = null
      return gerber
    }

    const maxGerberDist = SNAP_THRESHOLD_PX / transform.scale
    const gridSpacing = fileUnits.value === 'in'
      ? gridSpacingMm.value / 25.4
      : gridSpacingMm.value

    const snap = findBestDrawSnap(
      gerber.x,
      gerber.y,
      snapTargets.value,
      gridSpacing,
      true,
      maxGerberDist,
    )

    if (snap) {
      activeSnap.value = snap
      return { x: snap.x, y: snap.y }
    }

    activeSnap.value = null
    return gerber
  }

  // -- Snap target collection --

  function collectSnapTargets(trees: ImageTree[]) {
    const points: AlignSnapPoint[] = []
    for (const tree of trees) {
      if (tree.units === 'in') fileUnits.value = 'in'
      else fileUnits.value = 'mm'
      points.push(...extractSnapPoints(tree))
    }
    snapTargets.value = points
  }

  // -- Mouse handlers --

  function handleMouseMove(e: MouseEvent, canvasEl: HTMLCanvasElement, transform: CanvasTransform) {
    if (!active.value) return

    const rect = canvasEl.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    let gerber = screenToGerber(sx, sy, transform)
    gerber = applySnap(gerber, transform)
    cursorGerber.value = gerber

    if (isDrawing.value && drawStart.value) {
      updatePreview(drawStart.value, gerber)
    }
  }

  function handleMouseDown(e: MouseEvent, canvasEl: HTMLCanvasElement, transform: CanvasTransform) {
    if (!active.value || e.button !== 0) return

    const rect = canvasEl.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    let gerber = screenToGerber(sx, sy, transform)
    gerber = applySnap(gerber, transform)

    if (preciseMode.value) {
      handlePrecisePlacement(gerber)
      return
    }

    if (activeTool.value === 'text') {
      handlePrecisePlacement(gerber)
      return
    }

    drawStart.value = gerber
    isDrawing.value = true
    updatePreview(gerber, gerber)
  }

  function handleMouseUp(
    _e: MouseEvent,
    _canvasEl: HTMLCanvasElement,
    _transform: CanvasTransform,
  ): DrawCommitRequest | null {
    if (!active.value || !isDrawing.value || !drawStart.value) return null

    const shape = previewShape.value
    isDrawing.value = false
    drawStart.value = null
    previewShape.value = null

    if (!shape) return null
    if (!hasMinimumSize(shape)) return null

    return buildCommitRequest(shape)
  }

  function handlePrecisePlacement(gerber: { x: number; y: number }): DrawCommitRequest | null {
    const toUnits = (mm: number) => mmToFileUnits(mm, fileUnits.value)

    let shape: DrawPreviewShape

    switch (activeTool.value) {
      case 'rect': {
        const w = toUnits(preciseWidthMm.value)
        const h = toUnits(preciseHeightMm.value)
        shape = {
          tool: 'rect',
          startX: gerber.x - w / 2,
          startY: gerber.y - h / 2,
          endX: gerber.x + w / 2,
          endY: gerber.y + h / 2,
          filled: filled.value,
          strokeWidth: toUnits(strokeWidthMm.value),
        }
        break
      }
      case 'circle': {
        const r = toUnits(preciseRadiusMm.value)
        shape = {
          tool: 'circle',
          startX: gerber.x,
          startY: gerber.y,
          endX: gerber.x + r,
          endY: gerber.y,
          radius: r,
          filled: filled.value,
          strokeWidth: toUnits(strokeWidthMm.value),
        }
        break
      }
      case 'line': {
        const len = toUnits(preciseWidthMm.value)
        shape = {
          tool: 'line',
          startX: gerber.x,
          startY: gerber.y,
          endX: gerber.x + len,
          endY: gerber.y,
          filled: false,
          strokeWidth: toUnits(strokeWidthMm.value),
        }
        break
      }
      case 'text': {
        const h = toUnits(preciseTextHeightMm.value)
        shape = {
          tool: 'text',
          startX: gerber.x,
          startY: gerber.y,
          endX: gerber.x,
          endY: gerber.y + h,
          text: preciseText.value,
          textHeight: h,
          filled: false,
          strokeWidth: toUnits(strokeWidthMm.value),
        }
        break
      }
    }

    return buildCommitRequest(shape)
  }

  // Expose handlePrecisePlacement for use in the toolbar "Place" button
  function commitPrecise(): DrawCommitRequest | null {
    if (!active.value) return null
    return handlePrecisePlacement(cursorGerber.value)
  }

  function updatePreview(start: { x: number; y: number }, end: { x: number; y: number }) {
    const toUnits = (mm: number) => mmToFileUnits(mm, fileUnits.value)
    const sw = toUnits(strokeWidthMm.value)

    switch (activeTool.value) {
      case 'rect':
        previewShape.value = {
          tool: 'rect',
          startX: Math.min(start.x, end.x),
          startY: Math.min(start.y, end.y),
          endX: Math.max(start.x, end.x),
          endY: Math.max(start.y, end.y),
          filled: filled.value,
          strokeWidth: sw,
        }
        break
      case 'circle': {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const r = Math.sqrt(dx * dx + dy * dy)
        previewShape.value = {
          tool: 'circle',
          startX: start.x,
          startY: start.y,
          endX: end.x,
          endY: end.y,
          radius: r,
          filled: filled.value,
          strokeWidth: sw,
        }
        break
      }
      case 'line':
        previewShape.value = {
          tool: 'line',
          startX: start.x,
          startY: start.y,
          endX: end.x,
          endY: end.y,
          filled: false,
          strokeWidth: sw,
        }
        break
      case 'text':
        previewShape.value = {
          tool: 'text',
          startX: start.x,
          startY: start.y,
          endX: end.x,
          endY: end.y,
          text: preciseText.value,
          textHeight: toUnits(preciseTextHeightMm.value),
          filled: false,
          strokeWidth: sw,
        }
        break
    }
  }

  function hasMinimumSize(shape: DrawPreviewShape): boolean {
    const minSize = 0.001
    if (shape.tool === 'line') {
      const dx = shape.endX - shape.startX
      const dy = shape.endY - shape.startY
      return Math.sqrt(dx * dx + dy * dy) > minSize
    }
    if (shape.tool === 'circle') {
      return (shape.radius ?? 0) > minSize
    }
    if (shape.tool === 'rect') {
      return Math.abs(shape.endX - shape.startX) > minSize
        && Math.abs(shape.endY - shape.startY) > minSize
    }
    return true
  }

  // -- Gerber generation --

  function buildCommitRequest(shape: DrawPreviewShape): DrawCommitRequest {
    return {
      shape,
      targetLayerName: targetLayerName.value,
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (isDrawing.value) {
        isDrawing.value = false
        drawStart.value = null
        previewShape.value = null
      } else {
        active.value = false
        clear()
      }
    }
  }

  /**
   * Generate Gerber source and inject it into the layer content.
   * Returns the new content string, or null if generation fails.
   */
  function generateAndInject(
    shape: DrawPreviewShape,
    layerContent: string,
  ): string | null {
    const spec = parseFormatFromSource(layerContent)
    const nextCode = findNextApertureCode(layerContent)

    let result: { apertureDef: string; commands: string }

    switch (shape.tool) {
      case 'line':
        result = generateLine(
          { start: [shape.startX, shape.startY], end: [shape.endX, shape.endY], width: shape.strokeWidth },
          spec,
          nextCode,
        )
        break
      case 'rect':
        result = generateRect(
          {
            x: shape.startX,
            y: shape.startY,
            w: shape.endX - shape.startX,
            h: shape.endY - shape.startY,
            filled: shape.filled,
            strokeWidth: shape.strokeWidth,
          },
          spec,
          nextCode,
        )
        break
      case 'circle':
        result = generateCircle(
          {
            cx: shape.startX,
            cy: shape.startY,
            r: shape.radius ?? 0,
            filled: shape.filled,
            strokeWidth: shape.strokeWidth,
          },
          spec,
          nextCode,
        )
        break
      case 'text':
        result = generateText(
          {
            text: shape.text ?? '',
            x: shape.startX,
            y: shape.startY,
            height: shape.textHeight ?? mmToFileUnits(1.5, spec.units),
            strokeWidth: shape.strokeWidth,
          },
          spec,
          nextCode,
        )
        break
      default:
        return null
    }

    return injectGerberCommands(layerContent, result.apertureDef, result.commands)
  }

  /** Get live dimension labels for the current preview (in mm). */
  const previewDimensionsMm = computed(() => {
    const shape = previewShape.value
    if (!shape) return null
    const toMm = (v: number) => fileUnitsToMm(v, fileUnits.value)

    switch (shape.tool) {
      case 'rect': {
        const w = toMm(Math.abs(shape.endX - shape.startX))
        const h = toMm(Math.abs(shape.endY - shape.startY))
        return { width: w, height: h }
      }
      case 'circle':
        return { radius: toMm(shape.radius ?? 0), diameter: toMm((shape.radius ?? 0) * 2) }
      case 'line': {
        const dx = shape.endX - shape.startX
        const dy = shape.endY - shape.startY
        return { length: toMm(Math.sqrt(dx * dx + dy * dy)) }
      }
      default:
        return null
    }
  })

  return {
    active,
    activeTool,
    targetLayerName,
    strokeWidthMm,
    filled,
    snapEnabled,
    gridSpacingMm,
    preciseMode,
    preciseWidthMm,
    preciseHeightMm,
    preciseRadiusMm,
    preciseText,
    preciseTextHeightMm,
    isDrawing,
    drawStart,
    cursorGerber,
    activeSnap,
    previewShape,
    previewDimensionsMm,
    lastCommit,
    fileUnits,
    toggle,
    clear,
    setTool,
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    commitPrecise,
    handleKeyDown,
    generateAndInject,
    collectSnapTargets,
    gerberToScreen,
    screenToGerber,
  }
}

export interface DrawCommitRequest {
  shape: DrawPreviewShape
  targetLayerName: string
}
