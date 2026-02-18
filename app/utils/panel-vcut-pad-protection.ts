import type { ImageTree } from '@lib/gerber/types'
import type { PanelConfig, AddedRoutingPath } from './panel-types'
import { computePanelLayout, type PanelLayout } from './panel-geometry'

export interface SmdPadRect {
  xMm: number
  yMm: number
  wMm: number
  hMm: number
}

interface EdgePadRange {
  startMm: number
  endMm: number
}

export const DANGER_INSET_MM = 2.0
const ROUTE_MARGIN_MM = 1.0

/**
 * Extract rectangular SMD pad bounding boxes from a Gerber copper ImageTree.
 * Only rect shapes qualify (square/rectangular aperture flashes, including
 * obrounds). Circles, polygons, and layered (THT) shapes are excluded.
 */
export function extractSmdPads(tree: ImageTree): SmdPadRect[] {
  const pads: SmdPadRect[] = []
  const toMm = tree.units === 'in' ? 25.4 : 1

  for (const graphic of tree.children) {
    if (graphic.type !== 'shape' || graphic.erase) continue
    const shape = graphic.shape

    let resolved = shape
    if (shape.type === 'layered') {
      const sub = shape.shapes.find(s => !(s as any).erase)
      if (!sub) continue
      resolved = sub
    }

    if (resolved.type === 'rect') {
      const w = resolved.w * toMm
      const h = resolved.h * toMm
      if (w < 0.1 || h < 0.1 || w > 10 || h > 10) continue
      if (Math.max(w, h) / Math.min(w, h) > 8) continue
      pads.push({ xMm: resolved.x * toMm, yMm: resolved.y * toMm, wMm: w, hMm: h })
    } else if (resolved.type === 'polygon') {
      const pts = resolved.points
      if (pts.length < 3 || pts.length > 8) continue
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const [px, py] of pts) {
        if (px < minX) minX = px
        if (py < minY) minY = py
        if (px > maxX) maxX = px
        if (py > maxY) maxY = py
      }
      const w = (maxX - minX) * toMm
      const h = (maxY - minY) * toMm
      if (w < 0.1 || h < 0.1 || w > 10 || h > 10) continue
      if (Math.max(w, h) / Math.min(w, h) > 8) continue
      const bboxArea = w * h
      let crossSum = 0
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i]
        const [x2, y2] = pts[(i + 1) % pts.length]
        crossSum += (x1 * y2 - x2 * y1)
      }
      const polyArea = Math.abs(crossSum) * 0.5 * toMm * toMm
      if (polyArea < bboxArea * 0.7) continue
      pads.push({ xMm: minX * toMm, yMm: minY * toMm, wMm: w, hMm: h })
    }
  }
  return pads
}

type Edge = 'top' | 'bottom' | 'left' | 'right'

/**
 * Find SMD pads that are within the danger zone of each board edge.
 * Returns ranges along each edge where pads are at risk.
 */
function findPadsNearEdges(
  pads: SmdPadRect[],
  boardW: number,
  boardH: number,
  insetMm: number,
): Record<Edge, EdgePadRange[]> {
  const result: Record<Edge, EdgePadRange[]> = { top: [], bottom: [], left: [], right: [] }

  for (const pad of pads) {
    const padLeft = pad.xMm
    const padRight = pad.xMm + pad.wMm
    const padBottom = pad.yMm
    const padTop = pad.yMm + pad.hMm

    if (padBottom < insetMm) {
      result.bottom.push({ startMm: padLeft - ROUTE_MARGIN_MM, endMm: padRight + ROUTE_MARGIN_MM })
    }
    if (padTop > boardH - insetMm) {
      result.top.push({ startMm: padLeft - ROUTE_MARGIN_MM, endMm: padRight + ROUTE_MARGIN_MM })
    }
    if (padLeft < insetMm) {
      result.left.push({ startMm: padBottom - ROUTE_MARGIN_MM, endMm: padTop + ROUTE_MARGIN_MM })
    }
    if (padRight > boardW - insetMm) {
      result.right.push({ startMm: padBottom - ROUTE_MARGIN_MM, endMm: padTop + ROUTE_MARGIN_MM })
    }
  }

  for (const edge of ['top', 'bottom', 'left', 'right'] as Edge[]) {
    result[edge] = mergeRanges(result[edge])
  }
  return result
}

function mergeRanges(ranges: EdgePadRange[]): EdgePadRange[] {
  if (!ranges.length) return []
  const sorted = [...ranges].sort((a, b) => a.startMm - b.startMm)
  const out: EdgePadRange[] = [{ ...sorted[0]! }]
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!
    const last = out[out.length - 1]!
    if (cur.startMm <= last.endMm + 0.5) {
      last.endMm = Math.max(last.endMm, cur.endMm)
    } else {
      out.push({ ...cur })
    }
  }
  return out
}

/**
 * Given a panel config and copper layer trees, detect SMD pads near V-cut
 * edges and generate added routing paths on the adjacent frame/support bars
 * to protect them.
 *
 * Returns the routing paths to append to panelConfig.addedRoutings.
 */
export function generateVcutPadProtectionRoutes(
  config: PanelConfig,
  boardWidthMm: number,
  boardHeightMm: number,
  copperTrees: ImageTree[],
  outlineOriginMm?: { x: number; y: number },
): AddedRoutingPath[] {
  const ox = outlineOriginMm?.x ?? 0
  const oy = outlineOriginMm?.y ?? 0

  const allPads: SmdPadRect[] = []
  for (const tree of copperTrees) {
    for (const raw of extractSmdPads(tree)) {
      allPads.push({
        xMm: raw.xMm - ox,
        yMm: raw.yMm - oy,
        wMm: raw.wMm,
        hMm: raw.hMm,
      })
    }
  }
  if (!allPads.length) return []

  const edgePads = findPadsNearEdges(allPads, boardWidthMm, boardHeightMm, DANGER_INSET_MM)

  const isScoredSep = config.separationType === 'scored'
  const vcutEdges: Record<Edge, boolean> = {
    top: isScoredSep || config.edges?.top?.type === 'scored',
    bottom: isScoredSep || config.edges?.bottom?.type === 'scored',
    left: isScoredSep || config.edges?.left?.type === 'scored',
    right: isScoredSep || config.edges?.right?.type === 'scored',
  }

  const layout = computePanelLayout(config, boardWidthMm, boardHeightMm)
  if (!layout) return []

  const routes: AddedRoutingPath[] = []
  let idx = 0
  const mkId = () => `vcut-protect-${Date.now()}-${idx++}`

  const frameW = config.frame.enabled ? config.frame.width : 0
  const toolR = Math.max(0.1, config.routingToolDiameter / 2)

  const colXs = [...new Set(layout.pcbs.map(p => p.x))].sort((a, b) => a - b)
  const rowYs = [...new Set(layout.pcbs.map(p => p.y))].sort((a, b) => a - b)
  const pcbW = layout.pcbLayoutWidth
  const pcbH = layout.pcbLayoutHeight
  const countX = colXs.length
  const countY = rowYs.length

  const addRoute = (x1: number, y1: number, x2: number, y2: number) => {
    if (Math.hypot(x2 - x1, y2 - y1) < 0.5) return
    routes.push({ id: mkId(), x1, y1, x2, y2 })
  }

  // For each V-cut edge with endangered pads, generate routing on the
  // adjacent frame/support bar for every PCB instance.
  for (const edge of ['top', 'bottom', 'left', 'right'] as Edge[]) {
    if (!vcutEdges[edge]) continue
    const ranges = edgePads[edge]
    if (!ranges.length) continue

    if (edge === 'bottom' || edge === 'top') {
      for (let col = 0; col < countX; col++) {
        const pcbX = colXs[col]
        for (let row = 0; row < countY; row++) {
          const pcbY = rowYs[row]

          let routeY: number
          if (edge === 'bottom') {
            // Route on support bar or frame BELOW this PCB
            if (row === countY - 1) {
              if (!config.frame.enabled || frameW < toolR * 2) continue
              routeY = pcbY + pcbH + toolR + (config.routingToolDiameter / 2)
            } else {
              const rail = layout.supportRails.find(r => r.direction === 'horizontal' && r.gapIndex === row)
              if (!rail) continue
              routeY = rail.y + rail.height / 2
            }
          } else {
            // Route on support bar or frame ABOVE this PCB
            if (row === 0) {
              if (!config.frame.enabled || frameW < toolR * 2) continue
              routeY = pcbY - toolR - (config.routingToolDiameter / 2)
            } else {
              const rail = layout.supportRails.find(r => r.direction === 'horizontal' && r.gapIndex === row - 1)
              if (!rail) continue
              routeY = rail.y + rail.height / 2
            }
          }

          for (const range of ranges) {
            const x1 = pcbX + Math.max(0, range.startMm)
            const x2 = pcbX + Math.min(pcbW, range.endMm)
            addRoute(x1, routeY, x2, routeY)
          }
        }
      }
    } else {
      for (let row = 0; row < countY; row++) {
        const pcbY = rowYs[row]
        for (let col = 0; col < countX; col++) {
          const pcbX = colXs[col]

          let routeX: number
          if (edge === 'right') {
            if (col === countX - 1) {
              if (!config.frame.enabled || frameW < toolR * 2) continue
              routeX = pcbX + pcbW + toolR + (config.routingToolDiameter / 2)
            } else {
              const rail = layout.supportRails.find(r => r.direction === 'vertical' && r.gapIndex === col)
              if (!rail) continue
              routeX = rail.x + rail.width / 2
            }
          } else {
            if (col === 0) {
              if (!config.frame.enabled || frameW < toolR * 2) continue
              routeX = pcbX - toolR - (config.routingToolDiameter / 2)
            } else {
              const rail = layout.supportRails.find(r => r.direction === 'vertical' && r.gapIndex === col - 1)
              if (!rail) continue
              routeX = rail.x + rail.width / 2
            }
          }

          for (const range of ranges) {
            const y1 = pcbY + Math.max(0, range.startMm)
            const y2 = pcbY + Math.min(pcbH, range.endMm)
            addRoute(routeX, y1, routeX, y2)
          }
        }
      }
    }
  }

  return routes
}
