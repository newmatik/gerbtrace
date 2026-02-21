import type { ImageTree, ImageGraphic, Shape } from '@lib/gerber/types'

export interface AlignSnapPoint {
  x: number
  y: number
  /** Hint about the feature type for UI display */
  kind: 'pad' | 'endpoint' | 'center'
}

/**
 * Extract all snap-able points from a parsed Gerber ImageTree.
 * Snap targets are shape centers (pads, vias, fiducials) and path endpoints.
 */
export function extractSnapPoints(tree: ImageTree): AlignSnapPoint[] {
  const points: AlignSnapPoint[] = []
  const seen = new Set<string>()

  for (const graphic of tree.children) {
    collectFromGraphic(graphic, points, seen)
  }

  return points
}

function pointKey(x: number, y: number): string {
  return `${x.toFixed(6)},${y.toFixed(6)}`
}

function addPoint(points: AlignSnapPoint[], seen: Set<string>, x: number, y: number, kind: AlignSnapPoint['kind']) {
  const key = pointKey(x, y)
  if (seen.has(key)) return
  seen.add(key)
  points.push({ x, y, kind })
}

function collectFromGraphic(graphic: ImageGraphic, points: AlignSnapPoint[], seen: Set<string>) {
  if ('erase' in graphic && graphic.erase) return

  switch (graphic.type) {
    case 'shape':
      collectFromShape(graphic.shape, points, seen)
      break
    case 'path':
      for (const seg of graphic.segments) {
        addPoint(points, seen, seg.start[0], seg.start[1], 'endpoint')
        addPoint(points, seen, seg.end[0], seg.end[1], 'endpoint')
      }
      break
  }
}

function collectFromShape(shape: Shape, points: AlignSnapPoint[], seen: Set<string>) {
  switch (shape.type) {
    case 'circle':
      addPoint(points, seen, shape.cx, shape.cy, 'pad')
      break
    case 'rect':
      addPoint(points, seen, shape.x + shape.w / 2, shape.y + shape.h / 2, 'pad')
      break
    case 'polygon':
      if (shape.points.length > 0) {
        let cx = 0
        let cy = 0
        for (const [x, y] of shape.points) {
          cx += x
          cy += y
        }
        cx /= shape.points.length
        cy /= shape.points.length
        addPoint(points, seen, cx, cy, 'center')
      }
      break
    case 'layered':
      for (const s of shape.shapes) {
        if (!s.erase) {
          collectFromShape(s, points, seen)
          break
        }
      }
      break
  }
}

/**
 * Find the nearest snap point within a maximum Gerber-unit distance.
 * Returns null if no point is close enough.
 */
export function findNearestSnap(
  gerberX: number,
  gerberY: number,
  snapPoints: AlignSnapPoint[],
  maxGerberDistance: number,
): AlignSnapPoint | null {
  let nearest: AlignSnapPoint | null = null
  let nearestDistSq = maxGerberDistance * maxGerberDistance

  for (const sp of snapPoints) {
    const dx = sp.x - gerberX
    const dy = sp.y - gerberY
    const distSq = dx * dx + dy * dy
    if (distSq < nearestDistSq) {
      nearestDistSq = distSq
      nearest = sp
    }
  }

  return nearest
}

/**
 * Snap a coordinate to the nearest grid point.
 */
export function snapToGrid(x: number, y: number, spacing: number): { x: number; y: number } {
  if (spacing <= 0) return { x, y }
  return {
    x: Math.round(x / spacing) * spacing,
    y: Math.round(y / spacing) * spacing,
  }
}

export interface DrawSnapResult {
  x: number
  y: number
  kind: 'pad' | 'endpoint' | 'center' | 'grid'
}

/**
 * Find the best snap point for the draw tool, preferring object snaps over grid snaps.
 * Object snaps are tested in screen space; grid snaps in Gerber space.
 */
export function findBestDrawSnap(
  gerberX: number,
  gerberY: number,
  objectSnaps: AlignSnapPoint[],
  gridSpacing: number,
  enableGrid: boolean,
  maxGerberDistance: number,
): DrawSnapResult | null {
  const objSnap = findNearestSnap(gerberX, gerberY, objectSnaps, maxGerberDistance)
  if (objSnap) {
    return { x: objSnap.x, y: objSnap.y, kind: objSnap.kind }
  }

  if (enableGrid && gridSpacing > 0) {
    const gridPt = snapToGrid(gerberX, gerberY, gridSpacing)
    const dx = gridPt.x - gerberX
    const dy = gridPt.y - gerberY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < maxGerberDistance) {
      return { x: gridPt.x, y: gridPt.y, kind: 'grid' }
    }
  }

  return null
}
