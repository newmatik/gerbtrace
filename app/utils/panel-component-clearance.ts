import type { EditablePnPComponent } from '~/composables/usePickAndPlace'
import { computeFootprint, type FootprintShape, type PackageDefinition } from './package-types'
import { computeThtFootprint, type THTPackageDefinition, type ColoredFootprintShape } from './tht-package-types'
import type { PanelSuggestionEdgeConstraints } from './panel-suggestions'

interface RangeMm {
  startMm: number
  endMm: number
}

interface CompExtent {
  x: number
  y: number
  halfX: number
  halfY: number
  isTht: boolean
}

function mergeRanges(ranges: RangeMm[]): RangeMm[] {
  if (!ranges.length) return []
  const sorted = [...ranges].sort((a, b) => a.startMm - b.startMm)
  const out: RangeMm[] = [{ ...sorted[0]! }]
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!
    const last = out[out.length - 1]!
    if (cur.startMm <= last.endMm) {
      last.endMm = Math.max(last.endMm, cur.endMm)
    } else {
      out.push({ ...cur })
    }
  }
  return out
}

function computePkgHalfExtents(shapes: FootprintShape[] | ColoredFootprintShape[]): { hx: number, hy: number } {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const shape of shapes) {
    if (shape.kind === 'circle') {
      minX = Math.min(minX, shape.cx - shape.r)
      maxX = Math.max(maxX, shape.cx + shape.r)
      minY = Math.min(minY, shape.cy - shape.r)
      maxY = Math.max(maxY, shape.cy + shape.r)
    } else {
      const hw = shape.w / 2
      const hh = shape.h / 2
      minX = Math.min(minX, shape.cx - hw)
      maxX = Math.max(maxX, shape.cx + hw)
      minY = Math.min(minY, shape.cy - hh)
      maxY = Math.max(maxY, shape.cy + hh)
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return { hx: 0.2, hy: 0.2 }
  }
  return {
    hx: Math.max(0.2, (maxX - minX) / 2),
    hy: Math.max(0.2, (maxY - minY) / 2),
  }
}

function rotateHalfExtents(hx: number, hy: number, rotationDeg: number): { hx: number, hy: number } {
  const rad = (rotationDeg * Math.PI) / 180
  const c = Math.abs(Math.cos(rad))
  const s = Math.abs(Math.sin(rad))
  return {
    hx: c * hx + s * hy,
    hy: s * hx + c * hy,
  }
}

function chooseAlignmentShift(minMm: number, maxMm: number, boardMm: number): number {
  const low = -minMm
  const high = boardMm - maxMm
  if (low <= high) {
    if (0 >= low && 0 <= high) return 0
    return Math.abs(low) < Math.abs(high) ? low : high
  }
  // Interval is wider than board; choose closest value between [high, low] to 0.
  if (0 < high) return high
  if (0 > low) return low
  return 0
}

function clampRange(startMm: number, endMm: number, edgeLengthMm: number): RangeMm | null {
  const s = Math.max(0, Math.min(edgeLengthMm, startMm))
  const e = Math.max(0, Math.min(edgeLengthMm, endMm))
  if (e <= s) return null
  return { startMm: s, endMm: e }
}

export function derivePanelEdgeConstraintsFromComponents(input: {
  boardSizeMm: { width: number; height: number } | null | undefined
  components: EditablePnPComponent[]
  matchPackage?: (name: string) => PackageDefinition | undefined
  matchThtPackage?: (name: string) => THTPackageDefinition | undefined
  tabClearanceMm?: number
}): PanelSuggestionEdgeConstraints {
  const board = input.boardSizeMm
  if (!board || !(board.width > 0) || !(board.height > 0)) return {}

  const clearance = Math.max(0, input.tabClearanceMm ?? 20)
  const prohibitScoredEdges: PanelSuggestionEdgeConstraints['prohibitScoredEdges'] = {}
  const smdProtrudingEdges: NonNullable<PanelSuggestionEdgeConstraints['smdProtrudingEdges']> = {}
  const protrusionAny: Record<'top' | 'bottom' | 'left' | 'right', boolean> = {
    top: false,
    bottom: false,
    left: false,
    right: false,
  }
  const keepouts: Required<NonNullable<PanelSuggestionEdgeConstraints['tabKeepoutsMm']>> = {
    top: [],
    bottom: [],
    left: [],
    right: [],
  }

  const normalized: CompExtent[] = []
  for (const comp of input.components ?? []) {
    const pkgName = comp.matchedPackage || comp.package
    const isTht = comp.componentType === 'tht'
    let halfX = 0.2
    let halfY = 0.2

    if (pkgName) {
      if (isTht && input.matchThtPackage) {
        const pkg = input.matchThtPackage(pkgName)
        if (pkg) {
          const ext = computePkgHalfExtents(computeThtFootprint(pkg))
          halfX = Math.max(halfX, ext.hx)
          halfY = Math.max(halfY, ext.hy)
        }
      } else if (!isTht && input.matchPackage) {
        const pkg = input.matchPackage(pkgName)
        if (pkg) {
          const ext = computePkgHalfExtents(computeFootprint(pkg))
          halfX = Math.max(halfX, ext.hx)
          halfY = Math.max(halfY, ext.hy)
        }
      }
    }
    const rotated = rotateHalfExtents(halfX, halfY, comp.rotation)
    const extentX = rotated.hx
    const extentY = rotated.hy

    const x = comp.x
    const y = comp.y
    normalized.push({
      x,
      y,
      halfX: extentX,
      halfY: extentY,
      isTht,
    })
  }

  if (!normalized.length) {
    return {
      prohibitScoredEdges,
      smdProtrudingEdges,
      forceSupportBetweenPcbs: { x: false, y: false },
      tabKeepoutsMm: keepouts,
    }
  }

  const minX = Math.min(...normalized.map(c => c.x - c.halfX))
  const maxX = Math.max(...normalized.map(c => c.x + c.halfX))
  const minY = Math.min(...normalized.map(c => c.y - c.halfY))
  const maxY = Math.max(...normalized.map(c => c.y + c.halfY))
  const shiftX = chooseAlignmentShift(minX, maxX, board.width)
  const shiftY = chooseAlignmentShift(minY, maxY, board.height)

  for (const comp of normalized) {
    const x = comp.x + shiftX
    const y = comp.y + shiftY
    const extentX = comp.halfX
    const extentY = comp.halfY
    const isTht = comp.isTht

    if (x - extentX < 0) {
      protrusionAny.left = true
      prohibitScoredEdges.left = true
      if (!isTht) smdProtrudingEdges.left = true
      const range = clampRange(y - extentY - clearance, y + extentY + clearance, board.height)
      if (range) keepouts.left.push(range)
    }
    if (x + extentX > board.width) {
      protrusionAny.right = true
      prohibitScoredEdges.right = true
      if (!isTht) smdProtrudingEdges.right = true
      const range = clampRange(y - extentY - clearance, y + extentY + clearance, board.height)
      if (range) keepouts.right.push(range)
    }
    if (y - extentY < 0) {
      protrusionAny.bottom = true
      prohibitScoredEdges.bottom = true
      if (!isTht) smdProtrudingEdges.bottom = true
      const range = clampRange(x - extentX - clearance, x + extentX + clearance, board.width)
      if (range) keepouts.bottom.push(range)
    }
    if (y + extentY > board.height) {
      protrusionAny.top = true
      prohibitScoredEdges.top = true
      if (!isTht) smdProtrudingEdges.top = true
      const range = clampRange(x - extentX - clearance, x + extentX + clearance, board.width)
      if (range) keepouts.top.push(range)
    }
  }

  return {
    prohibitScoredEdges,
    smdProtrudingEdges,
    forceSupportBetweenPcbs: {
      x: protrusionAny.left || protrusionAny.right,
      y: protrusionAny.top || protrusionAny.bottom,
    },
    tabKeepoutsMm: {
      top: mergeRanges(keepouts.top),
      bottom: mergeRanges(keepouts.bottom),
      left: mergeRanges(keepouts.left),
      right: mergeRanges(keepouts.right),
    },
  }
}
