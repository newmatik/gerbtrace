/**
 * Shared geometry hit-testing utilities for Gerber objects.
 *
 * Used by both the Info tool (point inspection) and the Delete tool (box selection).
 */

import type {
  ImageGraphic,
  ImagePath,
  ImageRegion,
  Shape,
  PathSegment,
  BoundingBox,
} from './types'

// ── Point-in-shape tests ─────────────────────────────────────

export function pointInCircle(px: number, py: number, cx: number, cy: number, r: number): boolean {
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= r * r
}

export function pointInRect(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
  return px >= x && px <= x + w && py >= y && py <= y + h
}

export function pointInPolygon(px: number, py: number, points: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i]![0], yi = points[i]![1]
    const xj = points[j]![0], yj = points[j]![1]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

export function distToLineSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x1, py - y1)
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

export function pointNearSegment(px: number, py: number, seg: PathSegment, threshold: number): boolean {
  if (seg.type === 'line') {
    return distToLineSegment(px, py, seg.start[0], seg.start[1], seg.end[0], seg.end[1]) <= threshold
  }
  // Arc — check radial distance then angular range
  const dx = px - seg.center[0]
  const dy = py - seg.center[1]
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (Math.abs(dist - seg.radius) > threshold) return false
  const angle = Math.atan2(dy, dx)
  return isAngleInArc(angle, seg.startAngle, seg.endAngle, seg.counterclockwise)
}

export function isAngleInArc(angle: number, start: number, end: number, ccw: boolean): boolean {
  const TWO_PI = Math.PI * 2
  const norm = (a: number) => ((a % TWO_PI) + TWO_PI) % TWO_PI
  const a = norm(angle)
  const s = norm(start)
  const e = norm(end)
  if (ccw) {
    return s >= e ? (a >= e && a <= s) : (a >= e || a <= s)
  }
  return s <= e ? (a >= s && a <= e) : (a >= s || a <= e)
}

export function segmentsToPoints(segments: PathSegment[]): [number, number][] {
  const points: [number, number][] = []
  for (const seg of segments) {
    points.push(seg.start)
    if (seg.type === 'arc') {
      const steps = Math.max(4, Math.ceil(Math.abs(seg.endAngle - seg.startAngle) / (Math.PI / 8)))
      for (let i = 1; i < steps; i++) {
        const t = i / steps
        const angle = seg.startAngle + (seg.endAngle - seg.startAngle) * t
        points.push([
          seg.center[0] + seg.radius * Math.cos(angle),
          seg.center[1] + seg.radius * Math.sin(angle),
        ])
      }
    }
  }
  return points
}

// ── Point hit-test for a single ImageGraphic ────────────────

/** Returns true if the point (px,py) hits the graphic within the given tolerance. */
export function hitTestGraphicPoint(
  px: number,
  py: number,
  graphic: ImageGraphic,
  tolerance: number,
): boolean {
  switch (graphic.type) {
    case 'shape':
      return hitTestShapePoint(px, py, graphic.shape, tolerance)
    case 'path':
      return hitTestPathPoint(px, py, graphic, tolerance)
    case 'region':
      return hitTestRegionPoint(px, py, graphic)
  }
  return false
}

function hitTestShapePoint(px: number, py: number, shape: Shape, tolerance: number): boolean {
  switch (shape.type) {
    case 'circle':
      return pointInCircle(px, py, shape.cx, shape.cy, shape.r + tolerance)
    case 'rect':
      return pointInRect(px, py, shape.x - tolerance, shape.y - tolerance, shape.w + tolerance * 2, shape.h + tolerance * 2)
    case 'polygon':
      return pointInPolygon(px, py, shape.points)
    case 'layered':
      for (const sub of shape.shapes) {
        if (sub.erase) continue
        if (hitTestShapePoint(px, py, sub, tolerance)) {
          // Check if inside a hole
          const hole = shape.shapes.find(s => s.erase)
          if (hole && hitTestShapePoint(px, py, hole, 0)) return false
          return true
        }
      }
      return false
    case 'outline': {
      const pts = segmentsToPoints(shape.segments)
      return pointInPolygon(px, py, pts)
    }
  }
  return false
}

function hitTestPathPoint(px: number, py: number, path: ImagePath, tolerance: number): boolean {
  const halfWidth = path.width / 2 + tolerance
  for (const seg of path.segments) {
    if (pointNearSegment(px, py, seg, halfWidth)) return true
  }
  return false
}

function hitTestRegionPoint(px: number, py: number, region: ImageRegion): boolean {
  const pts = segmentsToPoints(region.segments)
  return pointInPolygon(px, py, pts)
}

// ── Bounding box computation for a single ImageGraphic ──────

/** Compute axis-aligned bounding box for an ImageGraphic */
export function graphicBounds(graphic: ImageGraphic): BoundingBox {
  switch (graphic.type) {
    case 'shape':
      return shapeBounds(graphic.shape)
    case 'path':
      return pathBounds(graphic)
    case 'region':
      return segmentsBounds(graphic.segments)
  }
}

function shapeBounds(shape: Shape): BoundingBox {
  switch (shape.type) {
    case 'circle':
      return [shape.cx - shape.r, shape.cy - shape.r, shape.cx + shape.r, shape.cy + shape.r]
    case 'rect':
      return [shape.x, shape.y, shape.x + shape.w, shape.y + shape.h]
    case 'polygon': {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const pt of shape.points) {
        if (pt[0] < minX) minX = pt[0]
        if (pt[1] < minY) minY = pt[1]
        if (pt[0] > maxX) maxX = pt[0]
        if (pt[1] > maxY) maxY = pt[1]
      }
      return [minX, minY, maxX, maxY]
    }
    case 'layered': {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const sub of shape.shapes) {
        if (sub.erase) continue
        const b = shapeBounds(sub)
        if (b[0] < minX) minX = b[0]
        if (b[1] < minY) minY = b[1]
        if (b[2] > maxX) maxX = b[2]
        if (b[3] > maxY) maxY = b[3]
      }
      return [minX, minY, maxX, maxY]
    }
    case 'outline':
      return segmentsBounds(shape.segments)
  }
}

function pathBounds(path: ImagePath): BoundingBox {
  const hw = path.width / 2
  const b = segmentsBounds(path.segments)
  return [b[0] - hw, b[1] - hw, b[2] + hw, b[3] + hw]
}

function segmentsBounds(segments: PathSegment[]): BoundingBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const seg of segments) {
    if (seg.start[0] < minX) minX = seg.start[0]
    if (seg.start[1] < minY) minY = seg.start[1]
    if (seg.start[0] > maxX) maxX = seg.start[0]
    if (seg.start[1] > maxY) maxY = seg.start[1]
    if (seg.end[0] < minX) minX = seg.end[0]
    if (seg.end[1] < minY) minY = seg.end[1]
    if (seg.end[0] > maxX) maxX = seg.end[0]
    if (seg.end[1] > maxY) maxY = seg.end[1]
    if (seg.type === 'arc') {
      // Include arc extents
      const cx = seg.center[0], cy = seg.center[1], r = seg.radius
      if (cx - r < minX) minX = cx - r
      if (cy - r < minY) minY = cy - r
      if (cx + r > maxX) maxX = cx + r
      if (cy + r > maxY) maxY = cy + r
    }
  }
  return [minX, minY, maxX, maxY]
}

// ── Box intersection test ───────────────────────────────────

/** Rectangles in Gerber coordinates: [x1, y1, x2, y2] where x1<=x2, y1<=y2 */
function rectsIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
}

/** Check if a point is inside an axis-aligned rectangle */
function pointInAABB(px: number, py: number, r: BoundingBox): boolean {
  return px >= r[0] && px <= r[2] && py >= r[1] && py <= r[3]
}

/**
 * Liang-Barsky line segment vs axis-aligned rectangle intersection.
 * Returns true if the line segment from (x1,y1) to (x2,y2) crosses or is inside the rect.
 */
function lineSegmentIntersectsAABB(
  x1: number, y1: number, x2: number, y2: number,
  minX: number, minY: number, maxX: number, maxY: number,
): boolean {
  let t0 = 0
  let t1 = 1
  const dx = x2 - x1
  const dy = y2 - y1

  const p = [-dx, dx, -dy, dy]
  const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1]

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i]! < 0) return false
    } else {
      const r = q[i]! / p[i]!
      if (p[i]! < 0) {
        t0 = Math.max(t0, r)
      } else {
        t1 = Math.min(t1, r)
      }
      if (t0 > t1) return false
    }
  }

  return true
}

/**
 * Check if a PathSegment (line or arc) intersects the selection rectangle.
 * For paths with width, expand the rect by halfWidth before testing the centerline.
 */
function pathSegmentIntersectsRect(seg: PathSegment, rect: BoundingBox, halfWidth: number): boolean {
  const rx1 = rect[0] - halfWidth
  const ry1 = rect[1] - halfWidth
  const rx2 = rect[2] + halfWidth
  const ry2 = rect[3] + halfWidth

  if (seg.type === 'line') {
    return lineSegmentIntersectsAABB(
      seg.start[0], seg.start[1], seg.end[0], seg.end[1],
      rx1, ry1, rx2, ry2,
    )
  }

  // Arc: approximate by checking multiple points along the arc + endpoints
  if (pointInAABB(seg.start[0], seg.start[1], [rx1, ry1, rx2, ry2])) return true
  if (pointInAABB(seg.end[0], seg.end[1], [rx1, ry1, rx2, ry2])) return true

  // Sample points along the arc
  const sweepAngle = seg.endAngle - seg.startAngle
  const steps = Math.max(8, Math.ceil(Math.abs(sweepAngle) / (Math.PI / 16)))
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    const angle = seg.startAngle + sweepAngle * t
    const px = seg.center[0] + seg.radius * Math.cos(angle)
    const py = seg.center[1] + seg.radius * Math.sin(angle)
    if (pointInAABB(px, py, [rx1, ry1, rx2, ry2])) return true
  }

  // Also check if any line between consecutive sampled points crosses the rect
  let prevX = seg.start[0]
  let prevY = seg.start[1]
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const angle = seg.startAngle + sweepAngle * t
    const px = i < steps
      ? seg.center[0] + seg.radius * Math.cos(angle)
      : seg.end[0]
    const py = i < steps
      ? seg.center[1] + seg.radius * Math.sin(angle)
      : seg.end[1]
    if (lineSegmentIntersectsAABB(prevX, prevY, px, py, rx1, ry1, rx2, ry2)) return true
    prevX = px
    prevY = py
  }

  return false
}

/** Precise check: does a shape intersect the selection rect? */
function shapeIntersectsRect(shape: Shape, rect: BoundingBox): boolean {
  // Quick bounding-box pre-check
  const sb = shapeBounds(shape)
  if (!rectsIntersect(sb, rect)) return false

  switch (shape.type) {
    case 'circle': {
      // Circle vs rect: find closest point on rect to circle center
      const cx = shape.cx, cy = shape.cy, r = shape.r
      const closestX = Math.max(rect[0], Math.min(cx, rect[2]))
      const closestY = Math.max(rect[1], Math.min(cy, rect[3]))
      const dx = cx - closestX, dy = cy - closestY
      return dx * dx + dy * dy <= r * r
    }
    case 'rect':
      // Rect vs rect is just AABB intersection (already passed pre-check)
      return true
    case 'polygon': {
      // Check if any polygon vertex is inside the selection rect
      for (const pt of shape.points) {
        if (pointInAABB(pt[0], pt[1], rect)) return true
      }
      // Check if any polygon edge crosses the selection rect
      for (let i = 0; i < shape.points.length; i++) {
        const a = shape.points[i]!
        const b = shape.points[(i + 1) % shape.points.length]!
        if (lineSegmentIntersectsAABB(a[0], a[1], b[0], b[1], rect[0], rect[1], rect[2], rect[3])) return true
      }
      // Check if the rect is entirely inside the polygon
      if (pointInPolygon(rect[0], rect[1], shape.points)) return true
      return false
    }
    case 'layered': {
      for (const sub of shape.shapes) {
        if (sub.erase) continue
        if (shapeIntersectsRect(sub, rect)) return true
      }
      return false
    }
    case 'outline': {
      const pts = segmentsToPoints(shape.segments)
      for (const pt of pts) {
        if (pointInAABB(pt[0], pt[1], rect)) return true
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!, b = pts[i + 1]!
        if (lineSegmentIntersectsAABB(a[0], a[1], b[0], b[1], rect[0], rect[1], rect[2], rect[3])) return true
      }
      if (pts.length > 0 && pointInPolygon(rect[0], rect[1], pts)) return true
      return false
    }
  }
}

/** Precise check: does a path (stroked segments) intersect the selection rect? */
function pathIntersectsRect(path: ImagePath, rect: BoundingBox): boolean {
  // Quick bounding-box pre-check
  const pb = pathBounds(path)
  if (!rectsIntersect(pb, rect)) return false

  const hw = path.width / 2
  for (const seg of path.segments) {
    if (pathSegmentIntersectsRect(seg, rect, hw)) return true
  }
  return false
}

/** Precise check: does a filled region intersect the selection rect? */
function regionIntersectsRect(region: ImageRegion, rect: BoundingBox): boolean {
  // Quick bounding-box pre-check
  const rb = segmentsBounds(region.segments)
  if (!rectsIntersect(rb, rect)) return false

  // Check if any segment crosses the selection rect (treat as zero-width lines)
  for (const seg of region.segments) {
    if (pathSegmentIntersectsRect(seg, rect, 0)) return true
  }

  // Check if the selection rect is entirely inside the region (filled polygon)
  const pts = segmentsToPoints(region.segments)
  if (pts.length > 2 && pointInPolygon(
    (rect[0] + rect[2]) / 2,
    (rect[1] + rect[3]) / 2,
    pts,
  )) return true

  return false
}

/**
 * Test if an ImageGraphic intersects a selection rectangle (in Gerber coordinates).
 * Uses precise geometric intersection — not just bounding boxes.
 */
export function graphicIntersectsRect(
  graphic: ImageGraphic,
  selectionRect: BoundingBox,
): boolean {
  switch (graphic.type) {
    case 'shape':
      return shapeIntersectsRect(graphic.shape, selectionRect)
    case 'path':
      return pathIntersectsRect(graphic, selectionRect)
    case 'region':
      return regionIntersectsRect(graphic, selectionRect)
  }
}
