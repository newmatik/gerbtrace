/**
 * Jetprint Dot Generator
 *
 * Transforms a solid-paste ImageTree into a dotted ImageTree that simulates
 * MY600-style jet printing.  Each solid pad shape is decomposed into an
 * array of small circles laid out in a grid or hexagonal pattern.
 *
 * The generator is a pure function on the ImageTree — the downstream
 * renderers (canvas and SVG) need no special handling.
 */

import type {
  ImageTree,
  ImageGraphic,
  ImageShape,
  ImagePath,
  Shape,
  CircleShape,
  PathSegment,
  BoundingBox,
} from '../gerber/types'

export interface JetprintSettings {
  dotDiameter: number  // mm
  dotSpacing: number   // mm center-to-center
  pattern: 'grid' | 'hex'
  dynamicDots?: boolean
}

const DYNAMIC_MIN_DIAMETER = 0.33 // mm
const DYNAMIC_MIN_SPACING = 0.35  // mm

// ── Cache ──────────────────────────────────────────────────────
// WeakMap keyed on source ImageTree so multiple trees (top/bottom) can be
// cached simultaneously without memory leaks.

const cache = new WeakMap<ImageTree, { key: string; result: ImageTree }>()

function settingsKey(s: JetprintSettings): string {
  return `${s.dotDiameter}|${s.dotSpacing}|${s.pattern}|${s.dynamicDots ? 1 : 0}`
}

export function clearJetprintCache(): void {
  // WeakMap entries are GC'd automatically; nothing to clear explicitly.
}

// ── Public API ─────────────────────────────────────────────────

export function generateJetprintDots(
  pasteTree: ImageTree,
  settings: JetprintSettings,
): ImageTree {
  const key = settingsKey(settings)
  const cached = cache.get(pasteTree)
  if (cached && cached.key === key) {
    return cached.result
  }

  const dotR = settings.dotDiameter / 2
  const toGerber = pasteTree.units === 'in' ? 1 / 25.4 : 1
  const spacingG = settings.dotSpacing * toGerber
  const dotRG = dotR * toGerber

  const dynamic = !!settings.dynamicDots
  const minSpacingG = DYNAMIC_MIN_SPACING * toGerber
  const minDotRG = (DYNAMIC_MIN_DIAMETER / 2) * toGerber

  const children: ImageGraphic[] = []

  for (const graphic of pasteTree.children) {
    if (graphic.erase) {
      children.push(graphic)
      continue
    }

    let dots = generateDotsForGraphic(graphic, spacingG, dotRG, settings.pattern)

    // Dynamic dot control: if only 0–1 dots fit at the configured spacing,
    // retry with minimum spacing and minimum dot size to maximize coverage.
    if (dynamic && dots.length <= 1) {
      const retry = generateDotsForGraphic(graphic, minSpacingG, minDotRG, settings.pattern)
      if (retry.length > dots.length) {
        dots = retry
      }
    }

    // Fallback: guarantee at least one dot at the shape center
    if (dots.length === 0) {
      const fallbackR = dynamic ? minDotRG : dotRG
      const c = graphicCenter(graphic)
      if (c) dots = [makeDot(c[0], c[1], fallbackR)]
    }

    for (const dot of dots) {
      children.push(dot)
    }
  }

  const result: ImageTree = {
    units: pasteTree.units,
    bounds: pasteTree.bounds,
    children,
  }

  cache.set(pasteTree, { key, result })
  return result
}

// ── Per-graphic dot generation ──────────────────────────────────

function generateDotsForGraphic(
  graphic: ImageGraphic,
  spacing: number,
  dotR: number,
  pattern: 'grid' | 'hex',
): ImageShape[] {
  if (graphic.type === 'shape') {
    return dotsForShape(graphic.shape, spacing, dotR, pattern)
  }
  if (graphic.type === 'path') {
    return dotsForPath(graphic as ImagePath, spacing, dotR, pattern)
  }
  if (graphic.type === 'region') {
    return dotsForRegion(graphic.segments, spacing, dotR, pattern)
  }
  return []
}

function graphicCenter(graphic: ImageGraphic): [number, number] | null {
  if (graphic.type === 'shape') return shapeCenter(graphic.shape)
  if ((graphic.type === 'path' || graphic.type === 'region') && graphic.segments.length > 0) {
    return graphic.segments[0]!.start
  }
  return null
}

// ── Shape decomposition ────────────────────────────────────────

function dotsForShape(
  shape: Shape,
  spacing: number,
  dotR: number,
  pattern: 'grid' | 'hex',
): ImageShape[] {
  switch (shape.type) {
    case 'circle':
      return dotsInCircle(shape.cx, shape.cy, shape.r, spacing, dotR, pattern)
    case 'rect':
      return dotsInRect(shape.x, shape.y, shape.w, shape.h, shape.r ?? 0, spacing, dotR, pattern)
    case 'polygon':
      return dotsInPolygon(shape.points, spacing, dotR, pattern)
    case 'outline':
      return dotsInOutline(shape.segments, spacing, dotR, pattern)
    case 'layered': {
      // Painter's algorithm: sub-shapes are composited in order.
      // A positive sub-shape adds area, an erase sub-shape removes it.
      // We generate a uniform grid over the full bounds and test each
      // point against the composite in order.
      const bbox = layeredBBox(shape.shapes, spacing)
      if (!bbox) return []
      const results: ImageShape[] = []
      generateDotsInBBox(bbox, spacing, pattern, (x, y) => {
        let inside = false
        for (const sub of shape.shapes) {
          if (pointInShape(x, y, sub)) {
            inside = !sub.erase
          }
        }
        if (inside) results.push(makeDot(x, y, dotR))
      })
      return results
    }
  }
}

// ── Dot generators per primitive ───────────────────────────────

function dotsInCircle(
  cx: number,
  cy: number,
  r: number,
  spacing: number,
  dotR: number,
  pattern: 'grid' | 'hex',
): ImageShape[] {
  const results: ImageShape[] = []
  const r2 = r * r
  const bbox: BoundingBox = [cx - r, cy - r, cx + r, cy + r]

  generateDotsInBBox(bbox, spacing, pattern, (x, y) => {
    const dx = x - cx
    const dy = y - cy
    if (dx * dx + dy * dy <= r2) {
      results.push(makeDot(x, y, dotR))
    }
  })
  return results
}

function dotsInRect(
  x: number,
  y: number,
  w: number,
  h: number,
  cornerR: number,
  spacing: number,
  dotR: number,
  pattern: 'grid' | 'hex',
): ImageShape[] {
  const results: ImageShape[] = []
  const bbox: BoundingBox = [x, y, x + w, y + h]

  if (cornerR <= 0) {
    generateDotsInBBox(bbox, spacing, pattern, (px, py) => {
      if (px >= x && px <= x + w && py >= y && py <= y + h) {
        results.push(makeDot(px, py, dotR))
      }
    })
  } else {
    const cr = Math.min(cornerR, w / 2, h / 2)
    generateDotsInBBox(bbox, spacing, pattern, (px, py) => {
      if (pointInRoundedRect(px, py, x, y, w, h, cr)) {
        results.push(makeDot(px, py, dotR))
      }
    })
  }
  return results
}

function dotsInPolygon(
  points: [number, number][],
  spacing: number,
  dotR: number,
  pattern: 'grid' | 'hex',
): ImageShape[] {
  if (points.length < 3) return []
  const results: ImageShape[] = []
  const bbox = polygonBBox(points)

  generateDotsInBBox(bbox, spacing, pattern, (x, y) => {
    if (pointInPolygonTest(x, y, points)) {
      results.push(makeDot(x, y, dotR))
    }
  })
  return results
}

function dotsInOutline(
  segments: PathSegment[],
  spacing: number,
  dotR: number,
  pattern: 'grid' | 'hex',
): ImageShape[] {
  if (segments.length === 0) return []
  const points = segmentsToPolyline(segments)
  return dotsInPolygon(points, spacing, dotR, pattern)
}

function dotsForRegion(
  segments: PathSegment[],
  spacing: number,
  dotR: number,
  pattern: 'grid' | 'hex',
): ImageShape[] {
  if (segments.length === 0) return []
  const points = segmentsToPolyline(segments)
  return dotsInPolygon(points, spacing, dotR, pattern)
}

// ── Path decomposition ─────────────────────────────────────────
// Gerber paste pads can be defined as stroked paths (D01 with wide aperture)
// rather than flashed shapes (D03). Convert the path swept area into dots.

function dotsForPath(
  path: ImagePath,
  spacing: number,
  dotR: number,
  pattern: 'grid' | 'hex',
): ImageShape[] {
  const w = path.width
  if (!w || w <= 0 || path.segments.length === 0) return []
  const halfW = w / 2

  const results: ImageShape[] = []

  for (const seg of path.segments) {
    const [x1, y1] = seg.start
    const [x2, y2] = seg.end

    if (seg.type === 'line') {
      const dx = x2 - x1
      const dy = y2 - y1
      const len = Math.sqrt(dx * dx + dy * dy)

      if (len < spacing * 0.01) {
        results.push(...dotsInRect(x1 - halfW, y1 - halfW, w, w, 0, spacing, dotR, pattern))
      } else {
        const ux = dx / len
        const uy = dy / len
        const nx = -uy * halfW
        const ny = ux * halfW
        const ex = ux * halfW
        const ey = uy * halfW
        const poly: [number, number][] = [
          [x1 - ex + nx, y1 - ey + ny],
          [x2 + ex + nx, y2 + ey + ny],
          [x2 + ex - nx, y2 + ey - ny],
          [x1 - ex - nx, y1 - ey - ny],
        ]
        results.push(...dotsInPolygon(poly, spacing, dotR, pattern))
      }
    } else {
      const dx = x2 - x1
      const dy = y2 - y1
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len < spacing * 0.01) {
        results.push(...dotsInRect(x1 - halfW, y1 - halfW, w, w, 0, spacing, dotR, pattern))
      } else {
        const ux = dx / len
        const uy = dy / len
        const nx = -uy * halfW
        const ny = ux * halfW
        const ex = ux * halfW
        const ey = uy * halfW
        const poly: [number, number][] = [
          [x1 - ex + nx, y1 - ey + ny],
          [x2 + ex + nx, y2 + ey + ny],
          [x2 + ex - nx, y2 + ey - ny],
          [x1 - ex - nx, y1 - ey - ny],
        ]
        results.push(...dotsInPolygon(poly, spacing, dotR, pattern))
      }
    }
  }

  return results
}

// ── Shape center helper ────────────────────────────────────────

function shapeCenter(shape: Shape): [number, number] | null {
  switch (shape.type) {
    case 'circle':
      return [shape.cx, shape.cy]
    case 'rect':
      return [shape.x + shape.w / 2, shape.y + shape.h / 2]
    case 'polygon': {
      if (shape.points.length === 0) return null
      let sx = 0, sy = 0
      for (const [x, y] of shape.points) { sx += x; sy += y }
      return [sx / shape.points.length, sy / shape.points.length]
    }
    case 'outline': {
      const pts = segmentsToPolyline(shape.segments)
      if (pts.length === 0) return null
      let sx = 0, sy = 0
      for (const [x, y] of pts) { sx += x; sy += y }
      return [sx / pts.length, sy / pts.length]
    }
    case 'layered': {
      for (const sub of shape.shapes) {
        if (!sub.erase) {
          const c = shapeCenter(sub)
          if (c) return c
        }
      }
      return null
    }
  }
}

// ── Grid / hex dot placement ───────────────────────────────────

function generateDotsInBBox(
  bbox: BoundingBox,
  spacing: number,
  pattern: 'grid' | 'hex',
  emit: (x: number, y: number) => void,
): void {
  const [x1, y1, x2, y2] = bbox
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2

  if (pattern === 'grid') {
    const startX = cx - Math.ceil((cx - x1) / spacing) * spacing
    const startY = cy - Math.ceil((cy - y1) / spacing) * spacing
    for (let y = startY; y <= y2; y += spacing) {
      for (let x = startX; x <= x2; x += spacing) {
        emit(x, y)
      }
    }
  } else {
    // Hex: offset every other row by spacing/2
    const rowH = spacing * 0.8660254037844387 // sin(60°)
    const startY = cy - Math.ceil((cy - y1) / rowH) * rowH
    let rowIdx = 0
    for (let y = startY; y <= y2; y += rowH, rowIdx++) {
      const offset = (rowIdx & 1) ? spacing * 0.5 : 0
      const startX = cx - Math.ceil((cx - x1) / spacing) * spacing + offset
      for (let x = startX; x <= x2; x += spacing) {
        emit(x, y)
      }
    }
  }
}

// ── Bounding box for layered shapes ────────────────────────────

function layeredBBox(shapes: Shape[], padding: number): BoundingBox | null {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
  let hasPositive = false

  for (const sub of shapes) {
    if ((sub as { erase?: boolean }).erase) continue
    hasPositive = true
    const b = shapeBBox(sub)
    if (!b) continue
    if (b[0] < x1) x1 = b[0]
    if (b[1] < y1) y1 = b[1]
    if (b[2] > x2) x2 = b[2]
    if (b[3] > y2) y2 = b[3]
  }

  if (!hasPositive || !isFinite(x1)) return null
  return [x1 - padding, y1 - padding, x2 + padding, y2 + padding]
}

function shapeBBox(shape: Shape): BoundingBox | null {
  switch (shape.type) {
    case 'circle':
      return [shape.cx - shape.r, shape.cy - shape.r, shape.cx + shape.r, shape.cy + shape.r]
    case 'rect':
      return [shape.x, shape.y, shape.x + shape.w, shape.y + shape.h]
    case 'polygon':
      return shape.points.length > 0 ? polygonBBox(shape.points) : null
    case 'outline': {
      const pts = segmentsToPolyline(shape.segments)
      return pts.length > 0 ? polygonBBox(pts) : null
    }
    case 'layered': {
      const inner = layeredBBox(shape.shapes, 0)
      return inner
    }
  }
}

// ── Geometry helpers ───────────────────────────────────────────

function makeDot(cx: number, cy: number, r: number): ImageShape {
  return {
    type: 'shape',
    shape: { type: 'circle', cx, cy, r },
  }
}

function pointInRoundedRect(
  px: number,
  py: number,
  x: number,
  y: number,
  w: number,
  h: number,
  cr: number,
): boolean {
  if (px < x || px > x + w || py < y || py > y + h) return false
  // Check corners
  const corners: [number, number][] = [
    [x + cr, y + cr],
    [x + w - cr, y + cr],
    [x + w - cr, y + h - cr],
    [x + cr, y + h - cr],
  ]
  for (const [ccx, ccy] of corners) {
    const dx = Math.abs(px - ccx)
    const dy = Math.abs(py - ccy)
    if (dx > cr || dy > cr) continue
    // Inside the corner square — check against the arc
    if (px < x + cr || px > x + w - cr) {
      if (py < y + cr || py > y + h - cr) {
        if (dx * dx + dy * dy > cr * cr) return false
      }
    }
  }
  return true
}

function pointInShape(px: number, py: number, shape: Shape): boolean {
  switch (shape.type) {
    case 'circle': {
      const dx = px - shape.cx
      const dy = py - shape.cy
      return dx * dx + dy * dy <= shape.r * shape.r
    }
    case 'rect':
      return pointInRoundedRect(px, py, shape.x, shape.y, shape.w, shape.h, shape.r ?? 0)
    case 'polygon':
      return pointInPolygonTest(px, py, shape.points)
    case 'outline':
      return pointInPolygonTest(px, py, segmentsToPolyline(shape.segments))
    default:
      return false
  }
}

function pointInPolygonTest(px: number, py: number, pts: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!
    const [xj, yj] = pts[j]!
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function polygonBBox(pts: [number, number][]): BoundingBox {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
  for (const [x, y] of pts) {
    if (x < x1) x1 = x
    if (y < y1) y1 = y
    if (x > x2) x2 = x
    if (y > y2) y2 = y
  }
  return [x1, y1, x2, y2]
}

function segmentsToPolyline(segments: PathSegment[]): [number, number][] {
  const pts: [number, number][] = []
  for (const seg of segments) {
    if (pts.length === 0) pts.push(seg.start)
    if (seg.type === 'line') {
      pts.push(seg.end)
    } else {
      // Approximate arc with line segments
      const { center, radius, startAngle, endAngle, counterclockwise } = seg
      let sweep = endAngle - startAngle
      if (counterclockwise) {
        if (sweep < 0) sweep += Math.PI * 2
      } else {
        if (sweep > 0) sweep -= Math.PI * 2
      }
      const steps = Math.max(8, Math.ceil(Math.abs(sweep) / (Math.PI / 16)))
      for (let i = 1; i <= steps; i++) {
        const a = startAngle + (sweep * i) / steps
        pts.push([center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)])
      }
    }
  }
  return pts
}
