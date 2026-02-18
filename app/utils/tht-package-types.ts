/**
 * THT (Through-Hole Technology) package type definitions and geometry computation.
 *
 * Unlike SMD packages (which use TPSys parametric models), THT packages are
 * defined as simple collections of primitive shapes: rectangles, circles,
 * rounded rectangles, and lines. Each shape has a role (body, pin, pin1,
 * polarity-marker) and optional per-shape colors.
 *
 * ── Coordinate system ──
 *
 *   +X = right,  −X = left
 *   +Y = up,     −Y = down
 *   Component center is at (0, 0).
 *   All dimensions in mm.
 *
 * The visual editor works on a grid (default 2.54 mm / 0.1" pitch) and
 * stores exact mm coordinates. The center (0,0) is typically in the middle
 * of the component so that offset placement (e.g. a connector overhanging
 * a board edge) works naturally.
 */

import type { FootprintShape, RectShape, CircleShape, RoundedRectShape } from '~/utils/package-types'

// ── THT shape roles ──

export type THTShapeRole = 'body' | 'pin' | 'pin1' | 'polarity-marker'

// ── THT primitive shapes ──

export interface THTRectShape {
  kind: 'rect'
  role: THTShapeRole
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  color?: string
  strokeColor?: string
}

export interface THTCircleShape {
  kind: 'circle'
  role: THTShapeRole
  x: number
  y: number
  radius: number
  color?: string
  strokeColor?: string
}

export interface THTRoundedRectShape {
  kind: 'roundedRect'
  role: THTShapeRole
  x: number
  y: number
  width: number
  height: number
  cornerRadius: number
  rotation?: number
  color?: string
  strokeColor?: string
}

export interface THTLineShape {
  kind: 'line'
  role: THTShapeRole
  x1: number
  y1: number
  x2: number
  y2: number
  strokeWidth: number
  color?: string
}

export type THTShape = THTRectShape | THTCircleShape | THTRoundedRectShape | THTLineShape

// ── THT package definition (the JSON schema) ──

export interface THTPackageProvenance {
  owner?: string
  sourceLibrary?: string
  sourceType?: string
  sourceFile?: string
  sourceFootprint?: string
}

export interface THTPackageDefinition {
  name: string
  aliases?: string[]
  /** Default body fill color (CSS color string, e.g. '#1a1a1a') */
  bodyColor?: string
  /** Default body stroke/outline color */
  bodyStrokeColor?: string
  /** Default pin fill color */
  pinColor?: string
  /** Default pin stroke color */
  pinStrokeColor?: string
  /** All primitive shapes that make up this package */
  shapes: THTShape[]
  provenance?: THTPackageProvenance
}

// ── Footprint conversion ──

/**
 * Extended footprint shape that carries optional per-shape color overrides.
 * The base FootprintShape types from package-types.ts don't have color fields;
 * the renderer checks for these extended properties when drawing THT components.
 */
export interface ColoredRectShape extends RectShape {
  fillColor?: string
  strokeColorOverride?: string
}

export interface ColoredCircleShape extends CircleShape {
  fillColor?: string
  strokeColorOverride?: string
}

export interface ColoredRoundedRectShape extends RoundedRectShape {
  fillColor?: string
  strokeColorOverride?: string
}

export type ColoredFootprintShape = ColoredRectShape | ColoredCircleShape | ColoredRoundedRectShape

/**
 * Convert a THT package definition into FootprintShape[] for rendering.
 * Line shapes are converted to thin rectangles for compatibility with the
 * existing rendering pipeline.
 *
 * The returned shapes may include `fillColor` and `strokeColorOverride`
 * properties that the renderer should use instead of the default constants.
 */
export function computeThtFootprint(pkg: THTPackageDefinition): ColoredFootprintShape[] {
  const shapes: ColoredFootprintShape[] = []

  for (const s of pkg.shapes) {
    const role = mapRole(s.role)

    switch (s.kind) {
      case 'rect': {
        const shape: ColoredRectShape = {
          kind: 'rect',
          cx: s.x,
          cy: s.y,
          w: s.width,
          h: s.height,
          role,
        }
        applyColors(shape, s, pkg)
        shapes.push(shape)
        break
      }
      case 'circle': {
        const shape: ColoredCircleShape = {
          kind: 'circle',
          cx: s.x,
          cy: s.y,
          r: s.radius,
          role,
        }
        applyColors(shape, s, pkg)
        shapes.push(shape)
        break
      }
      case 'roundedRect': {
        const shape: ColoredRoundedRectShape = {
          kind: 'roundedRect',
          cx: s.x,
          cy: s.y,
          w: s.width,
          h: s.height,
          r: s.cornerRadius,
          role: role === 'pin1' ? 'pad' : role,
        }
        applyColors(shape, s, pkg)
        shapes.push(shape)
        break
      }
      case 'line': {
        // Convert line to a thin rectangle aligned along the line direction
        const dx = s.x2 - s.x1
        const dy = s.y2 - s.y1
        const length = Math.sqrt(dx * dx + dy * dy)
        if (length < 0.001) break

        const cx = (s.x1 + s.x2) / 2
        const cy = (s.y1 + s.y2) / 2

        const shape: ColoredRectShape = {
          kind: 'rect',
          cx,
          cy,
          w: length,
          h: s.strokeWidth,
          role,
        }
        if (s.color) shape.fillColor = s.color
        shapes.push(shape)
        break
      }
    }
  }

  return shapes
}

/**
 * Map THT shape roles to FootprintShape roles.
 * 'polarity-marker' maps to 'pin1' so it renders with the pin1 highlight color.
 */
function mapRole(role: THTShapeRole): 'body' | 'pad' | 'pin1' {
  switch (role) {
    case 'body': return 'body'
    case 'pin': return 'pad'
    case 'pin1': return 'pin1'
    case 'polarity-marker': return 'pin1'
  }
}

/** Apply color overrides from THT shape + package defaults */
function applyColors(
  target: ColoredFootprintShape,
  source: THTShape,
  pkg: THTPackageDefinition,
): void {
  const role = (source as THTShape).role
  const srcColor = 'color' in source ? source.color : undefined
  const srcStroke = 'strokeColor' in source ? source.strokeColor : undefined

  if (role === 'body') {
    target.fillColor = srcColor || pkg.bodyColor
    target.strokeColorOverride = srcStroke || pkg.bodyStrokeColor
  } else if (role === 'pin1') {
    target.fillColor = srcColor || '#dc2626'
    target.strokeColorOverride = srcStroke || '#991b1b'
  } else if (role === 'pin') {
    target.fillColor = srcColor || pkg.pinColor
    target.strokeColorOverride = srcStroke || pkg.pinStrokeColor
  } else if (role === 'polarity-marker') {
    target.fillColor = srcColor
    target.strokeColorOverride = srcStroke
  }
}

// ── Utility: Create default shapes for common THT packages ──

/**
 * Create a basic pin header package definition.
 * Pins are arranged in a single column with 2.54mm pitch.
 */
export function createPinHeader(pinCount: number, name?: string): THTPackageDefinition {
  const pitch = 2.54
  const pinDiameter = 0.64
  const bodyWidth = 2.54
  const bodyHeight = (pinCount - 1) * pitch + 2.54
  const shapes: THTShape[] = []

  // Body
  shapes.push({
    kind: 'roundedRect',
    role: 'body',
    x: 0,
    y: 0,
    width: bodyWidth,
    height: bodyHeight,
    cornerRadius: 0.3,
  })

  // Pins
  const topY = ((pinCount - 1) * pitch) / 2
  for (let i = 0; i < pinCount; i++) {
    shapes.push({
      kind: 'circle',
      role: i === 0 ? 'pin1' : 'pin',
      x: 0,
      y: topY - i * pitch,
      radius: pinDiameter / 2,
    })
  }

  return {
    name: name || `PinHeader-1x${pinCount}`,
    bodyColor: '#333333',
    bodyStrokeColor: '#555555',
    pinColor: '#c0c0c0',
    pinStrokeColor: '#808080',
    shapes,
  }
}

/**
 * Create a basic dual-row pin header package definition.
 */
export function createDualPinHeader(pinsPerRow: number, name?: string): THTPackageDefinition {
  const pitch = 2.54
  const pinDiameter = 0.64
  const bodyWidth = 2.54 * 2
  const bodyHeight = (pinsPerRow - 1) * pitch + 2.54
  const shapes: THTShape[] = []

  // Body
  shapes.push({
    kind: 'roundedRect',
    role: 'body',
    x: 0,
    y: 0,
    width: bodyWidth,
    height: bodyHeight,
    cornerRadius: 0.3,
  })

  // Pins (left column then right column)
  const topY = ((pinsPerRow - 1) * pitch) / 2
  const colX = pitch / 2
  for (let i = 0; i < pinsPerRow; i++) {
    // Left column
    shapes.push({
      kind: 'circle',
      role: i === 0 ? 'pin1' : 'pin',
      x: -colX,
      y: topY - i * pitch,
      radius: pinDiameter / 2,
    })
    // Right column
    shapes.push({
      kind: 'circle',
      role: 'pin',
      x: colX,
      y: topY - i * pitch,
      radius: pinDiameter / 2,
    })
  }

  return {
    name: name || `PinHeader-2x${pinsPerRow}`,
    bodyColor: '#333333',
    bodyStrokeColor: '#555555',
    pinColor: '#c0c0c0',
    pinStrokeColor: '#808080',
    shapes,
  }
}

/** Compute bounding box of a THT package in mm */
export function computeThtBounds(pkg: THTPackageDefinition): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const s of pkg.shapes) {
    switch (s.kind) {
      case 'rect':
      case 'roundedRect': {
        const hw = s.width / 2
        const hh = s.height / 2
        minX = Math.min(minX, s.x - hw)
        minY = Math.min(minY, s.y - hh)
        maxX = Math.max(maxX, s.x + hw)
        maxY = Math.max(maxY, s.y + hh)
        break
      }
      case 'circle': {
        minX = Math.min(minX, s.x - s.radius)
        minY = Math.min(minY, s.y - s.radius)
        maxX = Math.max(maxX, s.x + s.radius)
        maxY = Math.max(maxY, s.y + s.radius)
        break
      }
      case 'line': {
        const hw = s.strokeWidth / 2
        minX = Math.min(minX, s.x1 - hw, s.x2 - hw)
        minY = Math.min(minY, s.y1 - hw, s.y2 - hw)
        maxX = Math.max(maxX, s.x1 + hw, s.x2 + hw)
        maxY = Math.max(maxY, s.y1 + hw, s.y2 + hw)
        break
      }
    }
  }

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }
  return { minX, minY, maxX, maxY }
}

/**
 * Create a blank/empty THT package definition.
 */
export function createEmptyThtPackage(name: string = 'New Package'): THTPackageDefinition {
  return {
    name,
    bodyColor: '#333333',
    bodyStrokeColor: '#555555',
    pinColor: '#c0c0c0',
    pinStrokeColor: '#808080',
    shapes: [],
  }
}
