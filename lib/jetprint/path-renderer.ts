/**
 * Renders JPSys SegmentOrder path data onto a Canvas2D context.
 *
 * Draws:
 *  - Jetting strokes as solid coloured lines
 *  - Travel moves between consecutive segments as thin dashed lines
 *
 * Coordinates in the SegmentOrder are in µm.  The caller must set up
 * the canvas transform so that 1 unit = 1 Gerber unit (mm or in).
 */

import type { SegmentOrder } from './jpsys-types'

export interface PathRenderOptions {
  /** Colour for jetting strokes */
  strokeColor?: string
  /** Colour for travel moves between segments */
  travelColor?: string
  /** Line width for jetting strokes in Gerber units */
  strokeWidth?: number
  /** Line width for travel moves in Gerber units */
  travelWidth?: number
  /** When true, colour-code strokes by dot diameter */
  colorByDiameter?: boolean
  /** Gerber unit scale: 'mm' → 1000 µm/unit, 'in' → 25400 µm/unit */
  units?: 'mm' | 'in'
}

const DIAMETER_COLORS: Record<number, string> = {}

function colorForDiameter(dia: number): string {
  if (DIAMETER_COLORS[dia]) return DIAMETER_COLORS[dia]!
  const hue = (dia * 137.508) % 360
  const c = `hsl(${hue}, 90%, 55%)`
  DIAMETER_COLORS[dia] = c
  return c
}

/**
 * Compute the end point of a segment in µm.
 */
function segmentEndPoint(seg: SegmentOrder): { x: number; y: number } {
  const spacing_x = seg.vx * seg.dotPeriod * 1e6
  const spacing_y = seg.vy * seg.dotPeriod * 1e6
  return {
    x: seg.x + spacing_x * (seg.dotCount - 1),
    y: seg.y + spacing_y * (seg.dotCount - 1),
  }
}

/**
 * Render the jetting path onto a canvas context.
 *
 * The context should already have a transform applied so that
 * drawing in Gerber units (mm or in) maps correctly to pixels.
 */
export function renderJetPath(
  ctx: CanvasRenderingContext2D,
  segments: SegmentOrder[],
  options: PathRenderOptions = {},
): void {
  if (segments.length === 0) return

  const umPerUnit = options.units === 'in' ? 25400 : 1000
  const strokeColor = options.strokeColor ?? '#a855f7'
  const travelColor = options.travelColor ?? 'rgba(168, 85, 247, 0.25)'
  const strokeWidth = options.strokeWidth ?? 0.05
  const travelWidth = options.travelWidth ?? 0.02

  const sorted = [...segments].sort((a, b) => a.orderNumber - b.orderNumber)

  let prevEnd: { x: number; y: number } | null = null

  for (const seg of sorted) {
    const startX = seg.x / umPerUnit
    const startY = seg.y / umPerUnit
    const end = segmentEndPoint(seg)
    const endX = end.x / umPerUnit
    const endY = end.y / umPerUnit

    if (prevEnd) {
      ctx.beginPath()
      ctx.strokeStyle = travelColor
      ctx.lineWidth = travelWidth
      ctx.setLineDash([0.1, 0.1])
      ctx.moveTo(prevEnd.x / umPerUnit, prevEnd.y / umPerUnit)
      ctx.lineTo(startX, startY)
      ctx.stroke()
      ctx.setLineDash([])
    }

    ctx.beginPath()
    ctx.strokeStyle = options.colorByDiameter ? colorForDiameter(seg.diameter) : strokeColor
    ctx.lineWidth = strokeWidth
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.stroke()

    prevEnd = end
  }
}

/**
 * Compute path statistics for display.
 */
export function computePathStats(segments: SegmentOrder[]): {
  totalDots: number
  totalSegments: number
  totalJettingDistanceUm: number
  totalTravelDistanceUm: number
  estimatedTimeS: number
} {
  let totalDots = 0
  let totalJettingDistanceUm = 0
  let totalTravelDistanceUm = 0
  let estimatedTimeS = 0

  const sorted = [...segments].sort((a, b) => a.orderNumber - b.orderNumber)
  let prevEnd: { x: number; y: number } | null = null

  for (const seg of sorted) {
    totalDots += seg.dotCount
    estimatedTimeS += seg.dotCount * seg.dotPeriod

    const end = segmentEndPoint(seg)
    const dx = end.x - seg.x
    const dy = end.y - seg.y
    totalJettingDistanceUm += Math.sqrt(dx * dx + dy * dy)

    if (prevEnd) {
      const tdx = seg.x - prevEnd.x
      const tdy = seg.y - prevEnd.y
      totalTravelDistanceUm += Math.sqrt(tdx * tdx + tdy * tdy)
    }

    prevEnd = end
  }

  return {
    totalDots,
    totalSegments: segments.length,
    totalJettingDistanceUm,
    totalTravelDistanceUm,
    estimatedTimeS,
  }
}
