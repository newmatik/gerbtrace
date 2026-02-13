import type { ImageTree, ImageGraphic, Shape, PathSegment } from '@lib/gerber/types'
import type { CanvasTransform } from '@lib/renderer/canvas-renderer'

export interface SnapPoint {
  x: number
  y: number
  type: 'center' | 'endpoint' | 'midpoint' | 'quadrant'
}

export interface MeasurePoint {
  x: number
  y: number
}

const SNAP_THRESHOLD_PX = 10

export function useMeasureTool() {
  const active = ref(false)
  const pointA = ref<MeasurePoint | null>(null)
  const pointB = ref<MeasurePoint | null>(null)
  const cursorGerber = ref<MeasurePoint>({ x: 0, y: 0 })
  const activeSnap = ref<SnapPoint | null>(null)
  const shiftHeld = ref(false)

  /** Conversion factor: multiply gerber distance by this to get mm */
  const unitsToMm = ref(1)

  const snapTargets = ref<SnapPoint[]>([])

  // ── Coordinate transforms ──

  function screenToGerber(sx: number, sy: number, t: CanvasTransform): MeasurePoint {
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

  // ── Snapping ──

  function findNearestSnap(gerberPos: MeasurePoint, transform: CanvasTransform): SnapPoint | null {
    const cursorScreen = gerberToScreen(gerberPos.x, gerberPos.y, transform)
    let best: SnapPoint | null = null
    let bestDist = SNAP_THRESHOLD_PX

    for (const sp of snapTargets.value) {
      const spScreen = gerberToScreen(sp.x, sp.y, transform)
      const dx = spScreen.sx - cursorScreen.sx
      const dy = spScreen.sy - cursorScreen.sy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < bestDist) {
        bestDist = dist
        best = sp
      }
    }

    return best
  }

  // ── Axis constraint ──

  function constrainToAxis(from: MeasurePoint, to: MeasurePoint): MeasurePoint {
    const dx = Math.abs(to.x - from.x)
    const dy = Math.abs(to.y - from.y)
    return dx > dy
      ? { x: to.x, y: from.y }
      : { x: from.x, y: to.y }
  }

  // ── Computed ──

  /** The live end point: pointB if placed, otherwise cursor position */
  const liveEnd = computed<MeasurePoint | null>(() => {
    if (pointB.value) return pointB.value
    if (pointA.value) return cursorGerber.value
    return null
  })

  /** Distance in mm between pointA and the live end */
  const liveDistanceMm = computed<number | null>(() => {
    if (!pointA.value || !liveEnd.value) return null
    const dx = liveEnd.value.x - pointA.value.x
    const dy = liveEnd.value.y - pointA.value.y
    return Math.sqrt(dx * dx + dy * dy) * unitsToMm.value
  })

  // ── Event handlers ──

  function toggle() {
    active.value = !active.value
    if (!active.value) clear()
  }

  function clear() {
    pointA.value = null
    pointB.value = null
    activeSnap.value = null
  }

  function handleMouseMove(e: MouseEvent, canvasEl: HTMLCanvasElement, transform: CanvasTransform) {
    const rect = canvasEl.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    shiftHeld.value = e.shiftKey

    let gerber = screenToGerber(sx, sy, transform)

    const snap = findNearestSnap(gerber, transform)
    if (snap) {
      gerber = { x: snap.x, y: snap.y }
      activeSnap.value = snap
    } else {
      activeSnap.value = null
    }

    if (shiftHeld.value && pointA.value) {
      gerber = constrainToAxis(pointA.value, gerber)
    }

    cursorGerber.value = gerber
  }

  function handleClick(e: MouseEvent, canvasEl: HTMLCanvasElement, transform: CanvasTransform) {
    const rect = canvasEl.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    let gerber = screenToGerber(sx, sy, transform)

    const snap = findNearestSnap(gerber, transform)
    if (snap) {
      gerber = { x: snap.x, y: snap.y }
    }

    if (e.shiftKey && pointA.value) {
      gerber = constrainToAxis(pointA.value, gerber)
    }

    if (!pointA.value) {
      pointA.value = gerber
    } else if (!pointB.value) {
      pointB.value = gerber
    } else {
      // Start a new measurement
      pointA.value = gerber
      pointB.value = null
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (pointA.value && !pointB.value) {
        pointA.value = null
      } else {
        active.value = false
        clear()
      }
    }
    shiftHeld.value = e.shiftKey
  }

  function handleKeyUp(e: KeyboardEvent) {
    shiftHeld.value = e.shiftKey
  }

  // ── Snap point collection from ImageTrees ──

  function collectSnapPoints(trees: ImageTree[]) {
    const points: SnapPoint[] = []
    for (const tree of trees) {
      // Determine unit conversion from tree
      if (tree.units === 'in') {
        unitsToMm.value = 25.4
      } else {
        unitsToMm.value = 1
      }
      for (const graphic of tree.children) {
        extractFromGraphic(graphic, points)
      }
    }
    snapTargets.value = points
  }

  function extractFromGraphic(graphic: ImageGraphic, out: SnapPoint[]) {
    switch (graphic.type) {
      case 'shape':
        extractFromShape(graphic.shape, out)
        break
      case 'path':
        extractFromSegments(graphic.segments, out)
        break
      case 'region':
        extractFromSegments(graphic.segments, out)
        break
    }
  }

  function extractFromShape(shape: Shape, out: SnapPoint[]) {
    switch (shape.type) {
      case 'circle':
        out.push({ x: shape.cx, y: shape.cy, type: 'center' })
        out.push({ x: shape.cx + shape.r, y: shape.cy, type: 'quadrant' })
        out.push({ x: shape.cx - shape.r, y: shape.cy, type: 'quadrant' })
        out.push({ x: shape.cx, y: shape.cy + shape.r, type: 'quadrant' })
        out.push({ x: shape.cx, y: shape.cy - shape.r, type: 'quadrant' })
        break
      case 'rect': {
        const cx = shape.x + shape.w / 2
        const cy = shape.y + shape.h / 2
        out.push({ x: cx, y: cy, type: 'center' })
        out.push({ x: shape.x, y: shape.y, type: 'endpoint' })
        out.push({ x: shape.x + shape.w, y: shape.y, type: 'endpoint' })
        out.push({ x: shape.x + shape.w, y: shape.y + shape.h, type: 'endpoint' })
        out.push({ x: shape.x, y: shape.y + shape.h, type: 'endpoint' })
        out.push({ x: cx, y: shape.y, type: 'midpoint' })
        out.push({ x: shape.x + shape.w, y: cy, type: 'midpoint' })
        out.push({ x: cx, y: shape.y + shape.h, type: 'midpoint' })
        out.push({ x: shape.x, y: cy, type: 'midpoint' })
        break
      }
      case 'polygon':
        for (const pt of shape.points) {
          out.push({ x: pt[0], y: pt[1], type: 'endpoint' })
        }
        for (let i = 0; i < shape.points.length; i++) {
          const a = shape.points[i]!
          const b = shape.points[(i + 1) % shape.points.length]!
          out.push({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, type: 'midpoint' })
        }
        break
      case 'outline':
        extractFromSegments(shape.segments, out)
        break
      case 'layered':
        for (const sub of shape.shapes) {
          extractFromShape(sub, out)
        }
        break
    }
  }

  function extractFromSegments(segments: PathSegment[], out: SnapPoint[]) {
    for (const seg of segments) {
      out.push({ x: seg.start[0], y: seg.start[1], type: 'endpoint' })
      out.push({ x: seg.end[0], y: seg.end[1], type: 'endpoint' })
      if (seg.type === 'line') {
        out.push({
          x: (seg.start[0] + seg.end[0]) / 2,
          y: (seg.start[1] + seg.end[1]) / 2,
          type: 'midpoint',
        })
      } else {
        out.push({ x: seg.center[0], y: seg.center[1], type: 'center' })
      }
    }
  }

  return {
    active,
    pointA,
    pointB,
    cursorGerber,
    activeSnap,
    shiftHeld,
    unitsToMm,
    liveEnd,
    liveDistanceMm,
    toggle,
    clear,
    handleMouseMove,
    handleClick,
    handleKeyDown,
    handleKeyUp,
    collectSnapPoints,
    gerberToScreen,
    screenToGerber,
  }
}
