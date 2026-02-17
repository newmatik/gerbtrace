/**
 * Panel layout geometry calculations.
 *
 * All dimensions are in mm. The layout origin (0, 0) is at the top-left
 * corner of the panel (including frame if enabled).
 */

import type { PanelConfig, FiducialPosition, ToolingHolePosition } from './panel-types'
import { evenTabPositions } from './panel-types'

export interface PcbInstance {
  /** Index in the grid (col * countY + row) */
  index: number
  /** Column (0-based) */
  col: number
  /** Row (0-based) */
  row: number
  /** X offset of the PCB origin (top-left of the PCB bounding box) in mm */
  x: number
  /** Y offset of the PCB origin in mm */
  y: number
  /** Rotation of this PCB instance in degrees */
  rotation: number
}

export interface RoutingChannel {
  /** Start X in mm */
  x1: number
  /** Start Y in mm */
  y1: number
  /** End X in mm */
  x2: number
  /** End Y in mm */
  y2: number
  /** Channel width in mm (routing tool diameter) */
  width: number
}

export interface VCutLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface TabMarker {
  /** Top-left X in mm */
  x: number
  /** Top-left Y in mm */
  y: number
  /** Width in mm (along the gap direction) */
  width: number
  /** Height in mm (along the gap direction) */
  height: number
  /** Center X in mm */
  cx: number
  /** Center Y in mm */
  cy: number
  /** The gap/channel runs in this direction. 'vertical' = gap along X, tab spans X. */
  direction: 'vertical' | 'horizontal'
  /** Depth of the routing channel this tab bridges (mm) */
  gapDepth: number
  /** Width of the tab along the edge (mm) */
  tabWidth: number
  /** Grid column of the PCB this tab belongs to */
  col: number
  /** Grid row of the PCB this tab belongs to */
  row: number
  /** Edge of the PCB this tab is on */
  edge: string
  /** Index within the edge's position array */
  posIndex: number
  /** Normalized position (0-1) along the edge */
  normalizedPos: number
  /** Start of the edge in mm (for converting back from mm to normalized) */
  edgeStart: number
  /** Length of the edge in mm */
  edgeLength: number
  /** Override key used to persist this tab channel's positions */
  overrideKey: string
  /** Channel identifier (main or split support channels) */
  channelId: 'main' | 'pcb-side' | 'opposite-side'
}

export interface FiducialMarker {
  /** Center X in mm */
  cx: number
  /** Center Y in mm */
  cy: number
  /** Copper pad diameter in mm */
  diameter: number
  position: FiducialPosition
}

export interface ToolingHoleMarker {
  /** Center X in mm */
  cx: number
  /** Center Y in mm */
  cy: number
  /** Hole diameter in mm */
  diameter: number
  position: ToolingHolePosition
}

export interface SupportRail {
  /** Top-left X in mm */
  x: number
  /** Top-left Y in mm */
  y: number
  /** Width in mm */
  width: number
  /** Height in mm */
  height: number
  /** Direction of the rail */
  direction: 'vertical' | 'horizontal'
  /** Gap index this rail occupies */
  gapIndex: number
}

export interface FrameGeometry {
  /** Outer rectangle */
  outerX: number
  outerY: number
  outerWidth: number
  outerHeight: number
  /** Inner cutout rectangle (where PCBs + routing sit) */
  innerX: number
  innerY: number
  innerWidth: number
  innerHeight: number
  /** Corner radius */
  cornerRadius: number
  /** Frame rail width */
  railWidth: number
}

export interface PanelLayout {
  /** Total panel width in mm */
  totalWidth: number
  /** Total panel height in mm */
  totalHeight: number
  /** Individual PCB width used for layout (after rotation) */
  pcbLayoutWidth: number
  /** Individual PCB height used for layout (after rotation) */
  pcbLayoutHeight: number
  /** All PCB instances in the grid */
  pcbs: PcbInstance[]
  /** Frame geometry (null if frame disabled) */
  frame: FrameGeometry | null
  /** Routing channels between PCBs and between PCBs and frame */
  routingChannels: RoutingChannel[]
  /** V-cut score lines */
  vcutLines: VCutLine[]
  /** Tab bridges across routing channels */
  tabs: TabMarker[]
  /** Fiducial markers on the frame */
  fiducials: FiducialMarker[]
  /** Tooling hole markers on the frame */
  toolingHoles: ToolingHoleMarker[]
  /** Support bar rails */
  supportRails: SupportRail[]
}

/**
 * Compute the full panel layout from config and board dimensions.
 */
export function computePanelLayout(
  config: PanelConfig,
  boardWidth: number,
  boardHeight: number,
): PanelLayout {
  const rot = config.pcbRotation % 360
  const isRotated = rot === 90 || rot === 270
  const pcbW = isRotated ? boardHeight : boardWidth
  const pcbH = isRotated ? boardWidth : boardHeight

  const { countX, countY } = config
  const toolD = config.routingToolDiameter
  const isScored = config.separationType === 'scored'

  // Determine routing gap for frame edges
  const frameRoutingGap = (isScored ? 0 : toolD)

  // Compute gap for each column gap (between col i and col i+1).
  // supports.width is the actual FR4 rail material width.
  // Routed channels flank that rail with one tool diameter on each side.
  const colGaps: number[] = []
  for (let i = 0; i < countX - 1; i++) {
    if (isScored) {
      colGaps.push(0)
    } else if (config.supports.xGaps.includes(i)) {
      colGaps.push(config.supports.width + 2 * toolD)
    } else {
      colGaps.push(toolD)
    }
  }

  // Compute gap for each row gap (between row i and row i+1)
  const rowGaps: number[] = []
  for (let i = 0; i < countY - 1; i++) {
    if (isScored) {
      rowGaps.push(0)
    } else if (config.supports.yGaps.includes(i)) {
      rowGaps.push(config.supports.width + 2 * toolD)
    } else {
      rowGaps.push(toolD)
    }
  }

  const frameW = config.frame.enabled ? config.frame.width : 0

  // Inner area = frame routing gap + PCBs + gaps + frame routing gap
  const innerWidth = frameRoutingGap + countX * pcbW + colGaps.reduce((a, b) => a + b, 0) + frameRoutingGap
  const innerHeight = frameRoutingGap + countY * pcbH + rowGaps.reduce((a, b) => a + b, 0) + frameRoutingGap

  const totalWidth = innerWidth + 2 * frameW
  const totalHeight = innerHeight + 2 * frameW

  // Compute X positions for each column
  const colX: number[] = []
  let cx = frameW + frameRoutingGap
  for (let col = 0; col < countX; col++) {
    colX.push(cx)
    if (col < countX - 1) cx += pcbW + colGaps[col]
  }

  // Compute Y positions for each row
  const rowY: number[] = []
  let cy = frameW + frameRoutingGap
  for (let row = 0; row < countY; row++) {
    rowY.push(cy)
    if (row < countY - 1) cy += pcbH + rowGaps[row]
  }

  // PCB instances
  const pcbs: PcbInstance[] = []
  for (let col = 0; col < countX; col++) {
    for (let row = 0; row < countY; row++) {
      pcbs.push({
        index: col * countY + row,
        col,
        row,
        x: colX[col],
        y: rowY[row],
        rotation: config.pcbRotation,
      })
    }
  }

  // Frame
  let frame: FrameGeometry | null = null
  if (config.frame.enabled) {
    frame = {
      outerX: 0,
      outerY: 0,
      outerWidth: totalWidth,
      outerHeight: totalHeight,
      innerX: frameW,
      innerY: frameW,
      innerWidth,
      innerHeight,
      cornerRadius: config.frame.cornerRadius,
      railWidth: frameW,
    }
  }

  // Routing channels & v-cut lines
  const routingChannels: RoutingChannel[] = []
  const vcutLines: VCutLine[] = []

  const isRoutedSep = config.separationType === 'routed'
  const isScoredSep = config.separationType === 'scored'

  // Helper: does a given separation act as routed?
  const isEdgeRouted = (edge: 'top' | 'bottom' | 'left' | 'right') => {
    if (isRoutedSep) return true
    if (isScoredSep) return false
    return config.edges[edge].type === 'routed'
  }

  // Ranges occupied by support-rail material, used to prevent routing
  // channels from cutting through rails.
  const railMaterialForCuts = Math.max(0, config.supports.width)
  const verticalRailRanges = config.supports.xGaps
    .filter(gi => gi >= 0 && gi < countX - 1)
    .map(gi => {
      const railX = colX[gi] + pcbW + toolD
      return { start: railX, end: railX + railMaterialForCuts }
    })
    .filter(r => r.end > r.start)
  const horizontalRailRanges = config.supports.yGaps
    .filter(gi => gi >= 0 && gi < countY - 1)
    .map(gi => {
      const railY = rowY[gi] + pcbH + toolD
      return { start: railY, end: railY + railMaterialForCuts }
    })
    .filter(r => r.end > r.start)

  const subtractRanges = (ranges: Array<{ start: number; end: number }>, start: number, end: number) => {
    const sorted = [...ranges]
      .map(r => ({ start: Math.max(start, r.start), end: Math.min(end, r.end) }))
      .filter(r => r.end > r.start)
      .sort((a, b) => a.start - b.start)
    const segs: Array<{ start: number; end: number }> = []
    let cursor = start
    for (const r of sorted) {
      if (r.start > cursor) segs.push({ start: cursor, end: r.start })
      cursor = Math.max(cursor, r.end)
    }
    if (cursor < end) segs.push({ start: cursor, end })
    return segs
  }

  // Vertical channels between columns
  for (let i = 0; i < countX - 1; i++) {
    const gapStart = colX[i] + pcbW
    const gapWidth = colGaps[i]
    const y1Full = frameW
    const y2Full = frameW + innerHeight

    if (isScoredSep) {
      vcutLines.push({ x1: gapStart, y1: y1Full, x2: gapStart, y2: y2Full })
    } else if (config.supports.xGaps.includes(i)) {
      // Two routing channels flanking the support bar.
      // Only run between PCB rows, not into the frame (support bar connects to frame directly).
      const chX1 = gapStart + toolD / 2
      const chX2 = gapStart + gapWidth - toolD / 2
      for (let row = 0; row < countY; row++) {
        const segY1 = rowY[row]
        const segY2 = rowY[row] + pcbH
        routingChannels.push({ x1: chX1, y1: segY1, x2: chX1, y2: segY2, width: toolD })
        routingChannels.push({ x1: chX2, y1: segY1, x2: chX2, y2: segY2, width: toolD })
      }
    } else {
      const chX = gapStart + gapWidth / 2
      for (const seg of subtractRanges(horizontalRailRanges, y1Full, y2Full)) {
        routingChannels.push({ x1: chX, y1: seg.start, x2: chX, y2: seg.end, width: toolD })
      }
    }
  }

  // Horizontal channels between rows
  for (let i = 0; i < countY - 1; i++) {
    const gapStart = rowY[i] + pcbH
    const gapHeight = rowGaps[i]
    const x1Full = frameW
    const x2Full = frameW + innerWidth

    if (isScoredSep) {
      vcutLines.push({ x1: x1Full, y1: gapStart, x2: x2Full, y2: gapStart })
    } else if (config.supports.yGaps.includes(i)) {
      // Two routing channels flanking the support bar.
      // Only run between PCB columns, not into the frame.
      const chY1 = gapStart + toolD / 2
      const chY2 = gapStart + gapHeight - toolD / 2
      for (let col = 0; col < countX; col++) {
        const segX1 = colX[col]
        const segX2 = colX[col] + pcbW
        routingChannels.push({ x1: segX1, y1: chY1, x2: segX2, y2: chY1, width: toolD })
        routingChannels.push({ x1: segX1, y1: chY2, x2: segX2, y2: chY2, width: toolD })
      }
    } else {
      const chY = gapStart + gapHeight / 2
      for (const seg of subtractRanges(verticalRailRanges, x1Full, x2Full)) {
        routingChannels.push({ x1: seg.start, y1: chY, x2: seg.end, y2: chY, width: toolD })
      }
    }
  }

  // Frame-to-PCB routing channels (all four sides)
  if (config.frame.enabled && !isScoredSep) {
    const innerLeft = frameW + frameRoutingGap / 2
    const innerRight = totalWidth - frameW - frameRoutingGap / 2
    const innerTop = frameW + frameRoutingGap / 2
    const innerBottom = totalHeight - frameW - frameRoutingGap / 2
    const edgeStartX = frameW
    const edgeEndX = totalWidth - frameW
    const edgeStartY = frameW
    const edgeEndY = totalHeight - frameW

    // Left edge
    if (isEdgeRouted('left')) {
      for (const seg of subtractRanges(horizontalRailRanges, edgeStartY, edgeEndY)) {
        routingChannels.push({ x1: innerLeft, y1: seg.start, x2: innerLeft, y2: seg.end, width: toolD })
      }
    }
    // Right edge
    if (isEdgeRouted('right')) {
      for (const seg of subtractRanges(horizontalRailRanges, edgeStartY, edgeEndY)) {
        routingChannels.push({ x1: innerRight, y1: seg.start, x2: innerRight, y2: seg.end, width: toolD })
      }
    }
    // Top edge
    if (isEdgeRouted('top')) {
      for (const seg of subtractRanges(verticalRailRanges, edgeStartX, edgeEndX)) {
        routingChannels.push({ x1: seg.start, y1: innerTop, x2: seg.end, y2: innerTop, width: toolD })
      }
    }
    // Bottom edge
    if (isEdgeRouted('bottom')) {
      for (const seg of subtractRanges(verticalRailRanges, edgeStartX, edgeEndX)) {
        routingChannels.push({ x1: seg.start, y1: innerBottom, x2: seg.end, y2: innerBottom, width: toolD })
      }
    }
  }

  // V-cut lines at frame edges (scored)
  if (config.frame.enabled && !isRoutedSep) {
    const topScored = isScoredSep || config.edges.top.type === 'scored'
    const bottomScored = isScoredSep || config.edges.bottom.type === 'scored'
    const leftScored = isScoredSep || config.edges.left.type === 'scored'
    const rightScored = isScoredSep || config.edges.right.type === 'scored'

    if (topScored) vcutLines.push({ x1: 0, y1: frameW, x2: totalWidth, y2: frameW })
    if (bottomScored) vcutLines.push({ x1: 0, y1: totalHeight - frameW, x2: totalWidth, y2: totalHeight - frameW })
    if (leftScored) vcutLines.push({ x1: frameW, y1: 0, x2: frameW, y2: totalHeight })
    if (rightScored) vcutLines.push({ x1: totalWidth - frameW, y1: 0, x2: totalWidth - frameW, y2: totalHeight })
  }

  // Support rails
  // The rail FR4 material directly uses supports.width (routing lanes are outside it).
  const railMaterial = Math.max(0, config.supports.width)
  const supportRails: SupportRail[] = []
  for (const gi of config.supports.xGaps) {
    if (gi < 0 || gi >= countX - 1) continue
    const railX = colX[gi] + pcbW + toolD
    supportRails.push({
      x: railX,
      y: 0,
      width: railMaterial,
      height: totalHeight,
      direction: 'vertical',
      gapIndex: gi,
    })
  }
  for (const gi of config.supports.yGaps) {
    if (gi < 0 || gi >= countY - 1) continue
    const railY = rowY[gi] + pcbH + toolD
    supportRails.push({
      x: 0,
      y: railY,
      width: totalWidth,
      height: railMaterial,
      direction: 'horizontal',
      gapIndex: gi,
    })
  }

  // Tabs
  const tabs: TabMarker[] = []
  if (!isScoredSep) {
    const tabW = config.tabs.width
    const syncTabs = config.tabs.syncAcrossPanel ?? true
    const getOverrideKey = (
      col: number,
      row: number,
      edge: string,
      channelId: string = 'main',
    ) => syncTabs ? `sync-${edge}-${channelId}` : `${col}-${row}-${edge}-${channelId}`
    const getDefaultCount = (edge: string): number => {
      switch (edge) {
        case 'top': return config.tabs.defaultCountTop ?? config.tabs.defaultCountPerEdge
        case 'bottom': return config.tabs.defaultCountBottom ?? config.tabs.defaultCountPerEdge
        case 'left': return config.tabs.defaultCountLeft ?? config.tabs.defaultCountPerEdge
        case 'right': return config.tabs.defaultCountRight ?? config.tabs.defaultCountPerEdge
        default: return config.tabs.defaultCountPerEdge
      }
    }
    const getTabPositions = (col: number, row: number, edge: string, channelId: string = 'main'): number[] => {
      const key = getOverrideKey(col, row, edge, channelId)
      if (key in config.tabs.edgeOverrides) return config.tabs.edgeOverrides[key]
      // Backwards compatibility: legacy keys had no channel suffix.
      const legacyKey = `${col}-${row}-${edge}`
      if (legacyKey in config.tabs.edgeOverrides) return config.tabs.edgeOverrides[legacyKey]
      return evenTabPositions(getDefaultCount(edge))
    }

    for (let col = 0; col < countX; col++) {
      for (let row = 0; row < countY; row++) {
        const px = colX[col]
        const py = rowY[row]

        // Right edge -> connects to next column or frame
        if (col < countX - 1) {
          const positionsMain = getTabPositions(col, row, 'right', 'main')
          const gapX = px + pcbW
          const gapW = colGaps[col]
          if (config.supports.xGaps.includes(col)) {
            const positionsNear = getTabPositions(col, row, 'right', 'pcb-side')
            const positionsFar = getTabPositions(col, row, 'right', 'opposite-side')
            placeTabsAtPositions(tabs, positionsNear, tabW, py, pcbH, gapX, toolD, 'vertical', col, row, 'right', getOverrideKey(col, row, 'right', 'pcb-side'), 'pcb-side')
            placeTabsAtPositions(tabs, positionsFar, tabW, py, pcbH, gapX + gapW - toolD, toolD, 'vertical', col, row, 'right', getOverrideKey(col, row, 'right', 'opposite-side'), 'opposite-side')
          } else {
            placeTabsAtPositions(tabs, positionsMain, tabW, py, pcbH, gapX, gapW, 'vertical', col, row, 'right', getOverrideKey(col, row, 'right', 'main'), 'main')
          }
        }

        // Bottom edge -> connects to next row or frame
        if (row < countY - 1) {
          const positionsMain = getTabPositions(col, row, 'bottom', 'main')
          const gapY = py + pcbH
          const gapH = rowGaps[row]
          if (config.supports.yGaps.includes(row)) {
            const positionsNear = getTabPositions(col, row, 'bottom', 'pcb-side')
            const positionsFar = getTabPositions(col, row, 'bottom', 'opposite-side')
            placeTabsAtPositions(tabs, positionsNear, tabW, px, pcbW, gapY, toolD, 'horizontal', col, row, 'bottom', getOverrideKey(col, row, 'bottom', 'pcb-side'), 'pcb-side')
            placeTabsAtPositions(tabs, positionsFar, tabW, px, pcbW, gapY + gapH - toolD, toolD, 'horizontal', col, row, 'bottom', getOverrideKey(col, row, 'bottom', 'opposite-side'), 'opposite-side')
          } else {
            placeTabsAtPositions(tabs, positionsMain, tabW, px, pcbW, gapY, gapH, 'horizontal', col, row, 'bottom', getOverrideKey(col, row, 'bottom', 'main'), 'main')
          }
        }

        // Left edge -> connects to frame (only first column)
        if (col === 0 && config.frame.enabled && frameRoutingGap > 0) {
          const positions = getTabPositions(col, row, 'left', 'main')
          placeTabsAtPositions(tabs, positions, tabW, py, pcbH, frameW, frameRoutingGap, 'vertical', col, row, 'left', getOverrideKey(col, row, 'left', 'main'), 'main')
        }

        // Top edge -> connects to frame (only first row)
        if (row === 0 && config.frame.enabled && frameRoutingGap > 0) {
          const positions = getTabPositions(col, row, 'top', 'main')
          placeTabsAtPositions(tabs, positions, tabW, px, pcbW, frameW, frameRoutingGap, 'horizontal', col, row, 'top', getOverrideKey(col, row, 'top', 'main'), 'main')
        }

        // Right edge -> connects to frame (only last column)
        if (col === countX - 1 && config.frame.enabled && frameRoutingGap > 0) {
          const positions = getTabPositions(col, row, 'right', 'main')
          const gapX = px + pcbW
          placeTabsAtPositions(tabs, positions, tabW, py, pcbH, gapX, frameRoutingGap, 'vertical', col, row, 'right', getOverrideKey(col, row, 'right', 'main'), 'main')
        }

        // Bottom edge -> connects to frame (only last row)
        if (row === countY - 1 && config.frame.enabled && frameRoutingGap > 0) {
          const positions = getTabPositions(col, row, 'bottom', 'main')
          const gapY = py + pcbH
          placeTabsAtPositions(tabs, positions, tabW, px, pcbW, gapY, frameRoutingGap, 'horizontal', col, row, 'bottom', getOverrideKey(col, row, 'bottom', 'main'), 'main')
        }
      }
    }
  }

  // Fiducials
  const fiducials: FiducialMarker[] = []
  if (config.fiducials.enabled && config.frame.enabled) {
    const d = config.fiducials.diameter
    const inset = frameW / 2

    for (const pos of config.fiducials.positions) {
      let fx: number
      let fy: number

      switch (pos) {
        case 'top-left':
          fx = inset
          fy = inset
          break
        case 'bottom-left':
          fx = inset
          fy = totalHeight - inset
          break
        case 'bottom-right':
          fx = totalWidth - inset
          fy = totalHeight - inset
          break
      }

      fiducials.push({ cx: fx!, cy: fy!, diameter: d, position: pos })
    }
  }

  // Tooling Holes
  const toolingHoles: ToolingHoleMarker[] = []
  if (config.toolingHoles?.enabled && config.frame.enabled) {
    const d = config.toolingHoles.diameter
    const offset = config.toolingHoles.offsetMm ?? 5
    const inset = frameW / 2

    for (const pos of config.toolingHoles.positions) {
      let tx: number
      let ty: number

      switch (pos) {
        case 'top-left':
          tx = inset
          ty = inset + offset
          break
        case 'top-right':
          tx = totalWidth - inset
          ty = inset + offset
          break
        case 'bottom-left':
          tx = inset
          ty = totalHeight - inset - offset
          break
        case 'bottom-right':
          tx = totalWidth - inset
          ty = totalHeight - inset - offset
          break
      }

      toolingHoles.push({ cx: tx!, cy: ty!, diameter: d, position: pos })
    }
  }

  return {
    totalWidth,
    totalHeight,
    pcbLayoutWidth: pcbW,
    pcbLayoutHeight: pcbH,
    pcbs,
    frame,
    routingChannels,
    vcutLines,
    tabs,
    fiducials,
    toolingHoles,
    supportRails,
  }
}

/**
 * Place tab markers at specific normalized positions along a PCB edge.
 *
 * @param tabs - output array to push to
 * @param positions - normalized positions (0-1) along the edge
 * @param tabWidth - tab width along the edge (mm)
 * @param edgeStart - start position along the PCB edge (mm)
 * @param edgeLength - length of the PCB edge (mm)
 * @param gapStart - start position of the gap perpendicular to the edge (mm)
 * @param gapDepth - depth of the gap (routing channel width, mm)
 * @param direction - 'vertical' = gap is along X, edge along Y; 'horizontal' = gap along Y, edge along X
 */
function placeTabsAtPositions(
  tabs: TabMarker[],
  positions: number[],
  tabWidth: number,
  edgeStart: number,
  edgeLength: number,
  gapStart: number,
  gapDepth: number,
  direction: 'vertical' | 'horizontal',
  col: number,
  row: number,
  edge: string,
  overrideKey: string,
  channelId: 'main' | 'pcb-side' | 'opposite-side',
) {
  if (positions.length === 0 || edgeLength <= 0 || gapDepth <= 0) return

  const clampedTabW = Math.min(tabWidth, edgeLength)

  for (let posIndex = 0; posIndex < positions.length; posIndex++) {
    const t = positions[posIndex]
    const clamped = Math.max(0, Math.min(1, t))
    const centerAlongEdge = edgeStart + clamped * edgeLength

    if (direction === 'vertical') {
      const x = gapStart
      const y = centerAlongEdge - clampedTabW / 2
      tabs.push({
        x, y,
        width: gapDepth,
        height: clampedTabW,
        cx: x + gapDepth / 2,
        cy: y + clampedTabW / 2,
        direction, gapDepth, tabWidth: clampedTabW,
        col, row, edge, posIndex,
        normalizedPos: clamped,
        edgeStart, edgeLength,
        overrideKey,
        channelId,
      })
    } else {
      const x = centerAlongEdge - clampedTabW / 2
      const y = gapStart
      tabs.push({
        x, y,
        width: clampedTabW,
        height: gapDepth,
        cx: x + clampedTabW / 2,
        cy: y + gapDepth / 2,
        direction, gapDepth, tabWidth: clampedTabW,
        col, row, edge, posIndex,
        normalizedPos: clamped,
        edgeStart, edgeLength,
        overrideKey,
        channelId,
      })
    }
  }
}
