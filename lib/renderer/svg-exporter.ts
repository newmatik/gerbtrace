/**
 * SVG Exporter for Realistic PCB View
 *
 * Converts Gerber ImageTree layer data into a standalone SVG document
 * with realistic PCB appearance using SVG masks and compositing.
 *
 * Layer compositing strategy:
 *   1. Board outline defines the clip boundary
 *   2. Substrate fill inside the outline
 *   3. Copper traces/pads
 *   4. Solder mask (inverted: covers board except pad openings)
 *   5. Surface finish (copper intersected with mask openings)
 *   6. Silkscreen on top
 *   7. Drill holes punch through everything
 */

import type {
  ImageTree,
  ImageGraphic,
  Shape,
  PathSegment,
} from '../gerber/types'
import type { PcbPreset } from '../../app/utils/pcb-presets'
import type { RealisticLayers } from './realistic-renderer'

/**
 * Export a realistic PCB view as an SVG string.
 */
export function exportRealisticSvg(
  layers: RealisticLayers,
  preset: PcbPreset,
  side: 'top' | 'bottom',
): string {
  // Compute view bounds from all available layers
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const allTrees = [layers.copper, layers.solderMask, layers.silkscreen, layers.drill, layers.outline].filter(Boolean) as ImageTree[]

  for (const tree of allTrees) {
    const [x1, y1, x2, y2] = tree.bounds
    if (x1 < minX) minX = x1
    if (y1 < minY) minY = y1
    if (x2 > maxX) maxX = x2
    if (y2 > maxY) maxY = y2
  }

  if (!isFinite(minX)) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>'
  }

  // Use the outline bounds if available for a tight crop, otherwise use computed bounds
  if (layers.outline) {
    const [ox1, oy1, ox2, oy2] = layers.outline.bounds
    if (isFinite(ox1)) {
      minX = ox1
      minY = oy1
      maxX = ox2
      maxY = oy2
    }
  }

  // No margin — tight crop to content
  const bw = maxX - minX
  const bh = maxY - minY
  const vbX = minX
  const vbY = minY
  const vbW = bw
  const vbH = bh

  // Generous padding for internal fill rects and mask rects (must extend
  // beyond the outline clip so they fully cover the clipped area)
  const pad = Math.max(bw, bh) * 0.5

  // SVG coordinate system: Gerber Y is up, SVG Y is down.
  // We apply a transform to flip Y.
  const mirrorX = side === 'bottom'

  const parts: string[] = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(vbX)} ${fmt(-maxY)} ${fmt(vbW)} ${fmt(vbH)}" width="${fmt(vbW)}mm" height="${fmt(vbH)}mm">`)

  // Group with Y-flip (and optional X-mirror for bottom view)
  if (mirrorX) {
    const cx = (minX + maxX) / 2
    parts.push(`<g transform="scale(1,-1) translate(0,0)"><g transform="scale(-1,1) translate(${fmt(-2 * cx)},0)">`)
  } else {
    parts.push(`<g transform="scale(1,-1) translate(0,0)">`)
  }

  // ── Defs: masks and clip paths ──
  parts.push('<defs>')

  // Outline clip path
  if (layers.outline) {
    parts.push('<clipPath id="outline-clip">')
    parts.push(imageTreeToSvgPaths(layers.outline, '#ffffff'))
    parts.push('</clipPath>')
  }

  // Solder mask openings mask (white = opening, black = covered)
  if (layers.solderMask) {
    parts.push('<mask id="mask-openings">')
    parts.push(`<rect x="${fmt(minX - pad)}" y="${fmt(minY - pad)}" width="${fmt(bw + pad * 2)}" height="${fmt(bh + pad * 2)}" fill="black"/>`)
    parts.push(imageTreeToSvgPaths(layers.solderMask, '#ffffff'))
    parts.push('</mask>')
  }

  // Inverted solder mask (white = covered, black = opening) for the mask layer
  if (layers.solderMask) {
    parts.push('<mask id="mask-inverted">')
    parts.push(`<rect x="${fmt(minX - pad)}" y="${fmt(minY - pad)}" width="${fmt(bw + pad * 2)}" height="${fmt(bh + pad * 2)}" fill="white"/>`)
    parts.push(imageTreeToSvgPaths(layers.solderMask, '#000000'))
    parts.push('</mask>')
  }

  // Drill holes mask (white = solid, black = holes)
  if (layers.drill) {
    parts.push('<mask id="drill-mask">')
    parts.push(`<rect x="${fmt(minX - pad)}" y="${fmt(minY - pad)}" width="${fmt(bw + pad * 2)}" height="${fmt(bh + pad * 2)}" fill="white"/>`)
    parts.push(imageTreeToSvgPaths(layers.drill, '#000000'))
    parts.push('</mask>')
  }

  parts.push('</defs>')

  // Wrap everything in outline clip and drill mask
  const clipAttr = layers.outline ? ' clip-path="url(#outline-clip)"' : ''
  const drillAttr = layers.drill ? ' mask="url(#drill-mask)"' : ''
  parts.push(`<g${clipAttr}${drillAttr}>`)

  // 1. Substrate fill
  parts.push(`<rect x="${fmt(minX - pad)}" y="${fmt(minY - pad)}" width="${fmt(bw + pad * 2)}" height="${fmt(bh + pad * 2)}" fill="${preset.substrate}"/>`)

  // 2. Copper layer
  if (layers.copper) {
    parts.push(`<g opacity="1">`)
    parts.push(imageTreeToSvgPaths(layers.copper, preset.copper))
    parts.push('</g>')
  }

  // 3. Solder mask (covers everything except openings)
  if (layers.solderMask) {
    parts.push(`<g mask="url(#mask-inverted)" opacity="${preset.solderMaskOpacity}">`)
    parts.push(`<rect x="${fmt(minX - pad)}" y="${fmt(minY - pad)}" width="${fmt(bw + pad * 2)}" height="${fmt(bh + pad * 2)}" fill="${preset.solderMask}"/>`)
    parts.push('</g>')
  } else {
    // No mask data — fill entire board with solder mask color
    parts.push(`<rect x="${fmt(minX - pad)}" y="${fmt(minY - pad)}" width="${fmt(bw + pad * 2)}" height="${fmt(bh + pad * 2)}" fill="${preset.solderMask}" opacity="${preset.solderMaskOpacity}"/>`)
  }

  // 4. Surface finish on exposed pads
  if (layers.copper && layers.solderMask) {
    parts.push(`<g mask="url(#mask-openings)">`)
    parts.push(imageTreeToSvgPaths(layers.copper, preset.surfaceFinish))
    parts.push('</g>')
  } else if (layers.copper && !layers.solderMask) {
    // No mask — all copper gets surface finish
    parts.push(imageTreeToSvgPaths(layers.copper, preset.surfaceFinish))
  }

  // 5. Silkscreen
  if (layers.silkscreen) {
    parts.push(imageTreeToSvgPaths(layers.silkscreen, preset.silkscreen))
  }

  parts.push('</g>') // end clip+drill group

  // Close Y-flip group(s)
  if (mirrorX) {
    parts.push('</g></g>')
  } else {
    parts.push('</g>')
  }

  parts.push('</svg>')

  return parts.join('\n')
}

// ── ImageTree to SVG conversion ──

function imageTreeToSvgPaths(tree: ImageTree, color: string): string {
  const parts: string[] = []
  for (const graphic of tree.children) {
    parts.push(graphicToSvg(graphic, color))
  }
  return parts.join('\n')
}

function graphicToSvg(graphic: ImageGraphic, color: string): string {
  // Erase graphics are not supported in simple SVG export
  // (they would need nested masks, which gets very complex)
  const isErase = 'erase' in graphic && graphic.erase

  switch (graphic.type) {
    case 'shape':
      return shapeToSvg(graphic.shape, color, isErase)
    case 'path':
      return pathToSvg(graphic.segments, graphic.width, color, isErase)
    case 'region':
      return regionToSvg(graphic.segments, color, isErase)
    default:
      return ''
  }
}

function shapeToSvg(shape: Shape, color: string, erase?: boolean): string {
  const fill = erase ? 'black' : color
  switch (shape.type) {
    case 'circle':
      return `<circle cx="${fmt(shape.cx)}" cy="${fmt(shape.cy)}" r="${fmt(shape.r)}" fill="${fill}"/>`

    case 'rect':
      if (shape.r && shape.r > 0) {
        return `<rect x="${fmt(shape.x)}" y="${fmt(shape.y)}" width="${fmt(shape.w)}" height="${fmt(shape.h)}" rx="${fmt(shape.r)}" fill="${fill}"/>`
      }
      return `<rect x="${fmt(shape.x)}" y="${fmt(shape.y)}" width="${fmt(shape.w)}" height="${fmt(shape.h)}" fill="${fill}"/>`

    case 'polygon': {
      if (shape.points.length < 2) return ''
      const pts = shape.points.map(p => `${fmt(p[0])},${fmt(p[1])}`).join(' ')
      return `<polygon points="${pts}" fill="${fill}"/>`
    }

    case 'outline': {
      const d = segmentsToPathD(shape.segments)
      if (!d) return ''
      return `<path d="${d} Z" fill="${fill}"/>`
    }

    case 'layered': {
      // For layered shapes, render non-erase shapes first, then apply erase
      // This is a simplification — proper support would need nested masks
      const parts: string[] = []
      for (const sub of shape.shapes) {
        if (!sub.erase) {
          parts.push(shapeToSvg(sub, color, false))
        }
      }
      // Erase shapes rendered with black in a mask context
      for (const sub of shape.shapes) {
        if (sub.erase) {
          parts.push(shapeToSvg(sub, color, true))
        }
      }
      return parts.join('\n')
    }

    default:
      return ''
  }
}

function pathToSvg(segments: PathSegment[], width: number, color: string, erase?: boolean): string {
  if (segments.length === 0 || width <= 0) return ''
  const d = segmentsToPathD(segments)
  if (!d) return ''
  const stroke = erase ? 'black' : color
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${fmt(width)}" stroke-linecap="round" stroke-linejoin="round"/>`
}

function regionToSvg(segments: PathSegment[], color: string, erase?: boolean): string {
  if (segments.length === 0) return ''
  const d = segmentsToPathD(segments)
  if (!d) return ''
  const fill = erase ? 'black' : color
  return `<path d="${d} Z" fill="${fill}" fill-rule="evenodd"/>`
}

/**
 * Convert an array of PathSegments to an SVG path `d` attribute string.
 */
function segmentsToPathD(segments: PathSegment[]): string {
  if (segments.length === 0) return ''

  const parts: string[] = []
  let needsMoveTo = true

  for (const seg of segments) {
    if (needsMoveTo) {
      parts.push(`M ${fmt(seg.start[0])} ${fmt(seg.start[1])}`)
      needsMoveTo = false
    }

    if (seg.type === 'line') {
      parts.push(`L ${fmt(seg.end[0])} ${fmt(seg.end[1])}`)
    } else {
      // Arc segment — convert to SVG arc command
      // SVG arc: A rx ry x-rotation large-arc-flag sweep-flag x y
      const { radius, startAngle, endAngle, counterclockwise } = seg

      // Compute the angular span
      let sweep = endAngle - startAngle
      if (counterclockwise) {
        // CCW in canvas = negative direction
        if (sweep > 0) sweep -= Math.PI * 2
      } else {
        // CW in canvas = positive direction
        if (sweep < 0) sweep += Math.PI * 2
      }

      const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0
      // SVG sweep-flag: 1 = clockwise (positive y), 0 = counter-clockwise
      // In our Gerber coordinate system (Y up), we need to consider the flip
      const sweepFlag = counterclockwise ? 0 : 1

      parts.push(`A ${fmt(radius)} ${fmt(radius)} 0 ${largeArc} ${sweepFlag} ${fmt(seg.end[0])} ${fmt(seg.end[1])}`)
    }
  }

  return parts.join(' ')
}

/**
 * Format a number for SVG output (compact, max 6 decimal places).
 */
function fmt(n: number): string {
  // Round to 6 decimal places to avoid floating point noise
  const rounded = Math.round(n * 1000000) / 1000000
  return String(rounded)
}
