/**
 * Gerber Plotter
 *
 * Walks the parser AST and converts it into an ImageTree of drawing primitives.
 * Maintains state: current tool, position, interpolation mode, polarity, region mode.
 *
 * Inspired by @tracespace/plotter by @mcous (MIT license).
 */

import type {
  GerberAST,
  ASTNode,
  ImageTree,
  ImageGraphic,
  ImageShape,
  ImagePath,
  ImageRegion,
  Shape,
  CircleShape,
  RectShape,
  PolygonShape,
  OutlineShape,
  LayeredShape,
  ErasableShape,
  PathSegment,
  LineSegment,
  ArcSegment,
  Format,
  ZeroSuppression,
  UnitsType,
  InterpolateMode,
  QuadrantMode as QuadrantModeType,
  Polarity,
  ToolShape,
  HoleShape,
  MacroBlock,
  MacroValue,
  BoundingBox,
  SourceRange,
} from './types'
import { parseCoordinate, PI, TWO_PI, limitAngle, degreesToRadians, rotatePoint } from './coordinate'
import { boundsFromGraphics } from './bounding-box'
import { evaluateExpression } from './macro'

interface ToolDef {
  shape: ToolShape
  hole?: HoleShape
  macro?: MacroBlock[]
  macroParams?: number[]
}

interface PlotterState {
  units: UnitsType
  format: Format
  zeroSuppression: ZeroSuppression
  position: [number, number]
  currentTool?: ToolDef
  interpolateMode: InterpolateMode
  quadrantMode: QuadrantModeType
  regionMode: boolean
  polarity: Polarity
  tools: Map<string, ToolDef>
  macros: Map<string, MacroBlock[]>
  currentPath: PathSegment[]
  currentPathTool?: ToolDef
  /** Accumulated source ranges for the current path/region being built */
  currentPathSourceRanges: SourceRange[]
}

export function plotImageTree(ast: GerberAST): ImageTree {
  const state: PlotterState = {
    units: 'in',
    format: [2, 4],
    zeroSuppression: 'leading',
    position: [0, 0],
    interpolateMode: 'line',
    quadrantMode: 'multi',
    regionMode: false,
    polarity: 'dark',
    tools: new Map(),
    macros: new Map(),
    currentPath: [],
    currentPathSourceRanges: [],
  }

  const graphics: ImageGraphic[] = []

  // First pass: extract format info
  for (const node of ast.children) {
    if (node.type === 'units') state.units = node.units
    if (node.type === 'format') {
      if (node.format) state.format = node.format
      if (node.zeroSuppression) state.zeroSuppression = node.zeroSuppression
    }
    // Also scan comments for format info (drill files)
    if (node.type === 'comment') {
      const fmtMatch = /FORMAT[=:\s]*\{?(\d)[:\.](\d)/i.exec(node.text)
      if (fmtMatch && !ast.children.some(n => n.type === 'format' && n.format)) {
        state.format = [parseInt(fmtMatch[1]), parseInt(fmtMatch[2])]
      }
    }
  }

  // Second pass: process commands
  for (const node of ast.children) {
    processNode(node, state, graphics)
  }

  // Flush any remaining path
  flushPath(state, graphics)

  const bounds = boundsFromGraphics(graphics)

  return {
    units: state.units,
    bounds: bounds[0] === Infinity ? [0, 0, 0, 0] : bounds,
    children: graphics,
  }
}

/** Extract a SourceRange from an AST node if it has source position info */
function nodeSourceRange(node: ASTNode): SourceRange | null {
  if ('sourceStart' in node && 'sourceEnd' in node &&
      node.sourceStart !== undefined && node.sourceEnd !== undefined) {
    return [node.sourceStart, node.sourceEnd]
  }
  return null
}

function processNode(node: ASTNode, state: PlotterState, graphics: ImageGraphic[]): void {
  switch (node.type) {
    case 'units':
      state.units = node.units
      break

    case 'format':
      if (node.format) state.format = node.format
      if (node.zeroSuppression) state.zeroSuppression = node.zeroSuppression
      break

    case 'toolDef': {
      const def: ToolDef = { shape: node.shape, hole: node.hole }
      if (node.shape.type === 'macroShape' && node.shape.macroName) {
        def.macro = state.macros.get(node.shape.macroName)
        def.macroParams = node.shape.params
      }
      state.tools.set(node.code, def)
      // Auto-select first tool defined (Gerber convention)
      if (!state.currentTool) {
        state.currentTool = def
      }
      break
    }

    case 'toolMacro':
      state.macros.set(node.name, node.blocks)
      break

    case 'toolChange': {
      flushPath(state, graphics)
      const tool = state.tools.get(node.code)
      if (tool) {
        state.currentTool = tool
      }
      break
    }

    case 'polarity':
      flushPath(state, graphics)
      state.polarity = node.polarity
      break

    case 'interpolateMode':
      state.interpolateMode = node.mode
      break

    case 'quadrantMode':
      state.quadrantMode = node.quadrant
      break

    case 'regionMode':
      flushPath(state, graphics)
      state.regionMode = node.region
      break

    case 'graphic':
      processGraphic(node, state, graphics)
      break

    case 'done':
      flushPath(state, graphics)
      break
  }
}

function processGraphic(
  node: ASTNode & { graphic?: string; coordinates: Record<string, string> },
  state: PlotterState,
  graphics: ImageGraphic[],
): void {
  const coords = node.coordinates
  const startX = state.position[0]
  const startY = state.position[1]

  // Parse new position
  const endX = parseCoordinate(coords.x, startX, state.format, state.zeroSuppression)
  const endY = parseCoordinate(coords.y, startY, state.format, state.zeroSuppression)

  // For drill files, handle x0/y0 (route start position)
  const x0 = coords.x0 !== undefined
    ? parseCoordinate(coords.x0, startX, state.format, state.zeroSuppression)
    : startX
  const y0 = coords.y0 !== undefined
    ? parseCoordinate(coords.y0, startY, state.format, state.zeroSuppression)
    : startY

  const arcI = parseCoordinate(coords.i, 0, state.format, state.zeroSuppression)
  const arcJ = parseCoordinate(coords.j, 0, state.format, state.zeroSuppression)

  const graphicType = node.graphic || (state.regionMode ? 'segment' : undefined)
  const erase = state.polarity === 'clear'
  const sr = nodeSourceRange(node)

  if (graphicType === 'shape') {
    flushPath(state, graphics)
    const tool = state.currentTool
    if (tool) {
      const shape = toolToShape(tool, endX, endY)
      if (shape) {
        const sourceRanges = sr ? [sr] : undefined
        graphics.push({ type: 'shape', shape, erase, sourceRanges })
      }
    }
    state.position = [endX, endY]
  } else if (graphicType === 'move') {
    // Only flush if the position actually changes.  Some CAD tools emit
    // D02 without coordinates (pen-up at same position) which would
    // otherwise fragment a continuous path into disconnected pieces.
    if (endX !== startX || endY !== startY) {
      flushPath(state, graphics)
    }
    // Include move's source range in the next path's ranges
    if (sr) state.currentPathSourceRanges.push(sr)
    state.position = [endX, endY]
  } else if (graphicType === 'segment') {
    if (sr) state.currentPathSourceRanges.push(sr)
    const segment = createSegment(
      [x0 !== startX ? x0 : startX, y0 !== startY ? y0 : startY],
      [endX, endY],
      arcI, arcJ,
      state.interpolateMode,
      state.quadrantMode,
    )
    if (segment) {
      state.currentPath.push(segment)
      state.currentPathTool = state.currentTool
    }
    state.position = [endX, endY]
  } else if (graphicType === 'slot') {
    // Drill slot: line from start to end with current tool width
    const tool = state.currentTool
    if (tool) {
      const width = tool.shape.params[0] || 0
      const seg: LineSegment = {
        type: 'line',
        start: [startX, startY],
        end: [endX, endY],
      }
      const sourceRanges = sr ? [sr] : undefined
      graphics.push({ type: 'path', width, segments: [seg], erase, sourceRanges })
    }
    state.position = [endX, endY]
  } else {
    // No explicit graphic type - just update position for coordinate-only nodes
    state.position = [endX, endY]
  }
}

function flushPath(state: PlotterState, graphics: ImageGraphic[]): void {
  if (state.currentPath.length === 0) {
    // No path to flush, but clear any accumulated source ranges
    state.currentPathSourceRanges = []
    return
  }

  const erase = state.polarity === 'clear'
  const sourceRanges = state.currentPathSourceRanges.length > 0
    ? [...state.currentPathSourceRanges]
    : undefined

  if (state.regionMode) {
    graphics.push({ type: 'region', segments: [...state.currentPath], erase, sourceRanges })
  } else {
    const tool = state.currentPathTool
    const width = tool ? tool.shape.params[0] || 0 : 0
    graphics.push({ type: 'path', width, segments: [...state.currentPath], erase, sourceRanges })
  }

  state.currentPath = []
  state.currentPathTool = undefined
  state.currentPathSourceRanges = []
}

function toolToShape(tool: ToolDef, cx: number, cy: number): Shape | null {
  const { shape, hole } = tool

  if (tool.macro && tool.macroParams !== undefined) {
    return macroToShape(tool.macro, tool.macroParams, cx, cy)
  }

  let baseShape: Shape | null = null

  switch (shape.type) {
    case 'circle': {
      const r = (shape.params[0] || 0) / 2
      baseShape = { type: 'circle', cx, cy, r }
      break
    }
    case 'rectangle': {
      const w = shape.params[0] || 0
      const h = shape.params[1] || 0
      baseShape = { type: 'rect', x: cx - w / 2, y: cy - h / 2, w, h }
      break
    }
    case 'obround': {
      const w = shape.params[0] || 0
      const h = shape.params[1] || 0
      const r = Math.min(w, h) / 2
      baseShape = { type: 'rect', x: cx - w / 2, y: cy - h / 2, w, h, r }
      break
    }
    case 'polygon': {
      const diameter = shape.params[0] || 0
      const vertices = shape.params[1] || 4
      const rotation = shape.params[2] || 0
      const r = diameter / 2
      const points: [number, number][] = []
      for (let i = 0; i < vertices; i++) {
        const angle = degreesToRadians(rotation) + (TWO_PI * i) / vertices
        points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)])
      }
      baseShape = { type: 'polygon', points }
      break
    }
    default:
      return null
  }

  if (!baseShape) return null

  // Add hole if present
  if (hole && hole.params[0] > 0) {
    const holeShape: ErasableShape = hole.type === 'circle'
      ? { type: 'circle', cx, cy, r: hole.params[0] / 2, erase: true }
      : { type: 'rect', x: cx - hole.params[0] / 2, y: cy - (hole.params[1] || hole.params[0]) / 2, w: hole.params[0], h: hole.params[1] || hole.params[0], erase: true }

    return {
      type: 'layered',
      shapes: [baseShape as ErasableShape, holeShape],
    }
  }

  return baseShape
}

function macroToShape(blocks: MacroBlock[], params: number[], cx: number, cy: number): Shape | null {
  const variables = new Map<string, number>()
  // Set parameter variables ($1, $2, ...)
  for (let i = 0; i < params.length; i++) {
    variables.set(`$${i + 1}`, params[i])
  }

  const shapes: ErasableShape[] = []

  for (const block of blocks) {
    if (block.type === 'variable') {
      const val = evaluateExpression(block.value, variables)
      variables.set(block.name, val)
      continue
    }

    if (block.type !== 'primitive') continue

    const p = block.params.map(v => evaluateExpression(v, variables))
    const exposure = p[0] !== 0 // 0 = off (erase), 1 = on (dark)
    const erase = !exposure

    switch (block.code) {
      case '1': {
        // Circle: exposure, diameter, centerX, centerY[, rotation]
        const r = (p[1] || 0) / 2
        const px = (p[2] || 0) + cx
        const py = (p[3] || 0) + cy
        shapes.push({ type: 'circle', cx: px, cy: py, r, erase })
        break
      }
      case '20':
      case '2': {
        // Vector line: exposure, width, startX, startY, endX, endY, rotation
        const w = p[1] || 0
        const hw = w / 2
        const sx = p[2] || 0
        const sy = p[3] || 0
        const ex = p[4] || 0
        const ey = p[5] || 0
        const rot = p[6] || 0
        // Create a rectangle from start to end
        const dx = ex - sx
        const dy = ey - sy
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len > 0) {
          const nx = -dy / len * hw
          const ny = dx / len * hw
          let pts: [number, number][] = [
            [sx + nx, sy + ny],
            [ex + nx, ey + ny],
            [ex - nx, ey - ny],
            [sx - nx, sy - ny],
          ]
          if (rot !== 0) {
            pts = pts.map(([x, y]) => rotatePoint(x, y, rot))
          }
          pts = pts.map(([x, y]) => [x + cx, y + cy] as [number, number])
          shapes.push({ type: 'polygon', points: pts, erase })
        }
        break
      }
      case '21': {
        // Center line: exposure, width, height, centerX, centerY, rotation
        const w = p[1] || 0
        const h = p[2] || 0
        const pcx = (p[3] || 0)
        const pcy = (p[4] || 0)
        const rot = p[5] || 0
        let pts: [number, number][] = [
          [pcx - w / 2, pcy - h / 2],
          [pcx + w / 2, pcy - h / 2],
          [pcx + w / 2, pcy + h / 2],
          [pcx - w / 2, pcy + h / 2],
        ]
        if (rot !== 0) {
          pts = pts.map(([x, y]) => rotatePoint(x, y, rot))
        }
        pts = pts.map(([x, y]) => [x + cx, y + cy] as [number, number])
        shapes.push({ type: 'polygon', points: pts, erase })
        break
      }
      case '4': {
        // Outline: exposure, numVertices, startX, startY, ...vertices..., rotation
        const numVerts = p[1] || 0
        const pts: [number, number][] = []
        for (let i = 0; i <= numVerts; i++) {
          pts.push([p[2 + i * 2] || 0, p[3 + i * 2] || 0])
        }
        const rot = p[2 + (numVerts + 1) * 2] || 0
        let finalPts = pts
        if (rot !== 0) {
          finalPts = pts.map(([x, y]) => rotatePoint(x, y, rot))
        }
        finalPts = finalPts.map(([x, y]) => [x + cx, y + cy] as [number, number])
        shapes.push({ type: 'polygon', points: finalPts, erase })
        break
      }
      case '5': {
        // Polygon: exposure, numVertices, centerX, centerY, diameter, rotation
        const nv = p[1] || 3
        const pcx = (p[2] || 0) + cx
        const pcy = (p[3] || 0) + cy
        const r = (p[4] || 0) / 2
        const rot = p[5] || 0
        const pts: [number, number][] = []
        for (let i = 0; i < nv; i++) {
          const angle = degreesToRadians(rot) + (TWO_PI * i) / nv
          pts.push([pcx + r * Math.cos(angle), pcy + r * Math.sin(angle)])
        }
        shapes.push({ type: 'polygon', points: pts, erase })
        break
      }
      case '7': {
        // Thermal: centerX, centerY, outerDiam, innerDiam, gap, rotation
        const tcx = (p[0] || 0) + cx
        const tcy = (p[1] || 0) + cy
        const outerR = (p[2] || 0) / 2
        const innerR = (p[3] || 0) / 2
        // Simplified: just render as outer circle with inner circle erased
        shapes.push({ type: 'circle', cx: tcx, cy: tcy, r: outerR })
        shapes.push({ type: 'circle', cx: tcx, cy: tcy, r: innerR, erase: true })
        break
      }
      // Moire (6) - deprecated, skip
    }
  }

  if (shapes.length === 0) return null
  if (shapes.length === 1 && !shapes[0].erase) return shapes[0]
  return { type: 'layered', shapes }
}

function createSegment(
  start: [number, number],
  end: [number, number],
  i: number,
  j: number,
  mode: InterpolateMode,
  quadrant: QuadrantModeType,
): PathSegment | null {
  if (mode === 'line') {
    return { type: 'line', start, end }
  }

  // Arc
  const counterclockwise = mode === 'ccwArc'
  const centerX = start[0] + i
  const centerY = start[1] + j

  const dx1 = start[0] - centerX
  const dy1 = start[1] - centerY
  const dx2 = end[0] - centerX
  const dy2 = end[1] - centerY
  const radius = Math.sqrt(dx1 * dx1 + dy1 * dy1)

  if (radius < 1e-10) {
    // Degenerate arc, treat as line
    return { type: 'line', start, end }
  }

  let startAngle = Math.atan2(dy1, dx1)
  let endAngle = Math.atan2(dy2, dx2)

  // Normalize angles
  startAngle = limitAngle(startAngle)
  endAngle = limitAngle(endAngle)

  // Handle single-quadrant mode: offsets are always positive magnitude
  // and the arc is always < 90 degrees
  if (quadrant === 'single') {
    // In single-quadrant mode, i and j are unsigned (magnitudes)
    // We need to find the correct center among 4 candidates
    const candidates: [number, number][] = [
      [start[0] + Math.abs(i), start[1] + Math.abs(j)],
      [start[0] - Math.abs(i), start[1] + Math.abs(j)],
      [start[0] + Math.abs(i), start[1] - Math.abs(j)],
      [start[0] - Math.abs(i), start[1] - Math.abs(j)],
    ]

    let bestCenter = candidates[0]
    let bestError = Infinity

    for (const c of candidates) {
      const r1 = Math.sqrt((start[0] - c[0]) ** 2 + (start[1] - c[1]) ** 2)
      const r2 = Math.sqrt((end[0] - c[0]) ** 2 + (end[1] - c[1]) ** 2)
      const error = Math.abs(r1 - r2)

      // Also check that the arc sweep is < 90 degrees
      const sa = Math.atan2(start[1] - c[1], start[0] - c[0])
      const ea = Math.atan2(end[1] - c[1], end[0] - c[0])
      let sweep = counterclockwise ? ea - sa : sa - ea
      while (sweep < 0) sweep += TWO_PI
      if (sweep > PI / 2 + 0.01) continue // Skip if > 90 degrees

      if (error < bestError) {
        bestError = error
        bestCenter = c
      }
    }

    const cx = bestCenter[0]
    const cy = bestCenter[1]
    const r = Math.sqrt((start[0] - cx) ** 2 + (start[1] - cy) ** 2)
    const sa = limitAngle(Math.atan2(start[1] - cy, start[0] - cx))
    const ea = limitAngle(Math.atan2(end[1] - cy, end[0] - cx))

    return {
      type: 'arc',
      start, end,
      center: [cx, cy],
      radius: r,
      startAngle: sa,
      endAngle: ea,
      counterclockwise,
    }
  }

  // In multi-quadrant mode, when start ≈ end the Gerber spec defines a full
  // 360° circle.  Without this adjustment startAngle == endAngle and
  // ctx.arc() would draw nothing (zero sweep).
  if (quadrant === 'multi') {
    const dist = Math.sqrt((end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2)
    if (dist < radius * 1e-4) {
      if (counterclockwise) {
        endAngle = startAngle + TWO_PI
      } else {
        endAngle = startAngle - TWO_PI
      }
    }
  }

  return {
    type: 'arc',
    start, end,
    center: [centerX, centerY],
    radius,
    startAngle,
    endAngle,
    counterclockwise,
  }
}
