import type { ImageTree, ImageGraphic, ImagePath, ImageRegion, Shape, PathSegment } from '@lib/gerber/types'
import type { CanvasTransform } from '@lib/renderer/canvas-renderer'
import {
  pointInCircle,
  pointInRect,
  pointInPolygon,
  pointNearSegment,
  segmentsToPoints,
} from '@lib/gerber/hit-test'

export interface InfoHitProperty {
  label: string
  value: string
}

export interface InfoHitResult {
  layerName: string
  layerType: string
  layerColor: string
  objectType: string
  properties: InfoHitProperty[]
}

export interface InfoLayerData {
  name: string
  type: string
  color: string
  tree: ImageTree
}

const CLICK_TOLERANCE_PX = 3

export function useInfoTool() {
  const active = ref(false)
  const hits = ref<InfoHitResult[]>([])
  const clickScreenPos = ref<{ x: number; y: number } | null>(null)

  /** Current unit conversion factor — set per‑layer during hit‑test */
  let unitsToMm = 1

  function toggle() {
    active.value = !active.value
    if (!active.value) clear()
  }

  function clear() {
    hits.value = []
    clickScreenPos.value = null
  }

  /**
   * Perform a hit‑test at the click location across all provided visible layers.
   * Layers should be ordered **top→bottom** so the top layer appears first in the results.
   */
  function handleClick(
    e: MouseEvent,
    canvasEl: HTMLCanvasElement,
    transform: CanvasTransform,
    layers: InfoLayerData[],
  ) {
    const rect = canvasEl.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top

    // Screen → Gerber
    const gx = (sx - transform.offsetX) / transform.scale
    const gy = (transform.offsetY - sy) / transform.scale

    // Tolerance in gerber units (a few screen pixels)
    const tolerance = CLICK_TOLERANCE_PX / transform.scale

    clickScreenPos.value = { x: sx, y: sy }

    const results: InfoHitResult[] = []

    for (const layer of layers) {
      unitsToMm = layer.tree.units === 'in' ? 25.4 : 1

      for (const graphic of layer.tree.children) {
        if ('erase' in graphic && graphic.erase) continue

        const hit = hitTestGraphic(gx, gy, graphic, tolerance)
        if (hit) {
          results.push({
            layerName: layer.name,
            layerType: layer.type,
            layerColor: layer.color,
            objectType: hit.type,
            properties: hit.properties,
          })
        }
      }
    }

    // Post‑process: rename "Circle" to "Drill" on drill layers
    for (const r of results) {
      if (r.layerType.toLowerCase().includes('drill') && r.objectType === 'Circle') {
        r.objectType = 'Drill'
      }
    }

    hits.value = results
  }

  // ── Hit testing ──────────────────────────────────────────────

  function hitTestGraphic(
    px: number,
    py: number,
    graphic: ImageGraphic,
    tolerance: number,
  ): { type: string; properties: InfoHitProperty[] } | null {
    switch (graphic.type) {
      case 'shape':
        return hitTestShape(px, py, graphic.shape, tolerance)
      case 'path':
        return hitTestPath(px, py, graphic as ImagePath, tolerance)
      case 'region':
        return hitTestRegion(px, py, graphic as ImageRegion)
    }
    return null
  }

  function hitTestShape(
    px: number,
    py: number,
    shape: Shape,
    tolerance: number,
  ): { type: string; properties: InfoHitProperty[] } | null {
    switch (shape.type) {
      case 'circle': {
        if (!pointInCircle(px, py, shape.cx, shape.cy, shape.r + tolerance)) return null
        return {
          type: 'Circle',
          properties: [
            { label: 'Diameter', value: fmtDim(shape.r * 2) },
            { label: 'Radius', value: fmtDim(shape.r) },
            { label: 'Center', value: `${fmtCoord(shape.cx)}, ${fmtCoord(shape.cy)}` },
          ],
        }
      }

      case 'rect': {
        if (!pointInRect(px, py, shape.x - tolerance, shape.y - tolerance, shape.w + tolerance * 2, shape.h + tolerance * 2)) return null
        const props: InfoHitProperty[] = [
          { label: 'Width', value: fmtDim(shape.w) },
          { label: 'Height', value: fmtDim(shape.h) },
          { label: 'Position', value: `${fmtCoord(shape.x)}, ${fmtCoord(shape.y)}` },
        ]
        if (shape.r) {
          props.push({ label: 'Corner Radius', value: fmtDim(shape.r) })
          return { type: 'Obround', properties: props }
        }
        return { type: 'Rectangle', properties: props }
      }

      case 'polygon': {
        if (!pointInPolygon(px, py, shape.points)) return null
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        for (const pt of shape.points) {
          if (pt[0] < minX) minX = pt[0]
          if (pt[1] < minY) minY = pt[1]
          if (pt[0] > maxX) maxX = pt[0]
          if (pt[1] > maxY) maxY = pt[1]
        }
        return {
          type: 'Polygon',
          properties: [
            { label: 'Vertices', value: String(shape.points.length) },
            { label: 'Width', value: fmtDim(maxX - minX) },
            { label: 'Height', value: fmtDim(maxY - minY) },
          ],
        }
      }

      case 'layered': {
        for (const sub of shape.shapes) {
          if (sub.erase) continue
          const hit = hitTestShape(px, py, sub, tolerance)
          if (hit) {
            // Check whether the click falls inside an erased hole
            const hole = shape.shapes.find(s => s.erase)
            if (hole) {
              if (hitTestShape(px, py, hole, 0)) return null // Inside the hole
              // Append hole dimensions
              if (hole.type === 'circle') {
                hit.properties.push({ label: 'Hole Diameter', value: fmtDim(hole.r * 2) })
              } else if (hole.type === 'rect') {
                hit.properties.push({ label: 'Hole Size', value: `${fmtDim(hole.w)} × ${fmtDim(hole.h)}` })
              }
              hit.type = 'Pad (with hole)'
            }
            return hit
          }
        }
        return null
      }

      case 'outline': {
        const pts = segmentsToPoints(shape.segments)
        if (!pointInPolygon(px, py, pts)) return null
        return {
          type: 'Outline Shape',
          properties: [
            { label: 'Segments', value: String(shape.segments.length) },
          ],
        }
      }
    }
    return null
  }

  function hitTestPath(
    px: number,
    py: number,
    path: ImagePath,
    tolerance: number,
  ): { type: string; properties: InfoHitProperty[] } | null {
    const halfWidth = path.width / 2 + tolerance
    let isHit = false
    for (const seg of path.segments) {
      if (pointNearSegment(px, py, seg, halfWidth)) {
        isHit = true
        break
      }
    }
    if (!isHit) return null

    // Total path length
    let totalLength = 0
    for (const seg of path.segments) {
      if (seg.type === 'line') {
        const dx = seg.end[0] - seg.start[0]
        const dy = seg.end[1] - seg.start[1]
        totalLength += Math.sqrt(dx * dx + dy * dy)
      } else {
        let sweep = Math.abs(seg.endAngle - seg.startAngle)
        if (sweep > Math.PI * 2) sweep = Math.PI * 2
        totalLength += seg.radius * sweep
      }
    }

    return {
      type: 'Trace',
      properties: [
        { label: 'Width', value: fmtDim(path.width) },
        { label: 'Length', value: fmtDim(totalLength) },
      ],
    }
  }

  function hitTestRegion(
    px: number,
    py: number,
    region: ImageRegion,
  ): { type: string; properties: InfoHitProperty[] } | null {
    const pts = segmentsToPoints(region.segments)
    if (!pointInPolygon(px, py, pts)) return null
    return {
      type: 'Region (copper fill)',
      properties: [],
    }
  }

  // ── Formatting ───────────────────────────────────────────────

  function fmtDim(value: number): string {
    const mm = value * unitsToMm
    if (mm < 0.01) return `${(mm * 1000).toFixed(1)} \u00B5m`
    if (mm < 1) return `${(mm * 1000).toFixed(0)} \u00B5m`
    return `${mm.toFixed(3)} mm`
  }

  function fmtCoord(value: number): string {
    return `${(value * unitsToMm).toFixed(3)}`
  }

  return {
    active,
    hits,
    clickScreenPos,
    toggle,
    clear,
    handleClick,
  }
}
