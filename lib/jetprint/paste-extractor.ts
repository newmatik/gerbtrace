/**
 * Extracts rectangular pad regions from a Gerber paste-layer ImageTree
 * and converts them to JPSys-compatible coordinate data (µm).
 */

import type { ImageTree, ImageGraphic, Shape } from '../gerber/types'

export interface ExtractedPad {
  /** Center X in µm (JPSys coordinate system) */
  cx: number
  /** Center Y in µm (JPSys coordinate system) */
  cy: number
  /** Width in µm */
  sizeX: number
  /** Height in µm */
  sizeY: number
  /** true if the original shape was circular */
  isCircular: boolean
}

/**
 * Converts a Gerber paste-layer ImageTree into an array of rectangular
 * pad descriptions in micrometers.
 *
 * Gerber files may be in mm or inches; we normalise to µm for JPSys.
 */
export function extractPastePads(pasteTree: ImageTree): ExtractedPad[] {
  const toUm = pasteTree.units === 'in' ? 25400 : 1000 // in→µm or mm→µm
  const pads: ExtractedPad[] = []

  for (const graphic of pasteTree.children) {
    if (graphic.erase) continue
    const extracted = extractFromGraphic(graphic, toUm)
    if (extracted) pads.push(extracted)
  }

  return pads
}

function extractFromGraphic(
  graphic: ImageGraphic,
  toUm: number,
): ExtractedPad | null {
  if (graphic.type === 'shape') {
    return extractFromShape(graphic.shape, toUm)
  }
  if (graphic.type === 'path' && graphic.segments.length > 0) {
    const seg = graphic.segments[0]!
    const [x1, y1] = seg.start
    const [x2, y2] = seg.end
    const w = graphic.width
    const cx = ((x1 + x2) / 2) * toUm
    const cy = ((y1 + y2) / 2) * toUm
    const dx = Math.abs(x2 - x1)
    const dy = Math.abs(y2 - y1)
    return {
      cx: Math.round(cx),
      cy: Math.round(cy),
      sizeX: Math.round((dx + w) * toUm),
      sizeY: Math.round((dy + w) * toUm),
      isCircular: false,
    }
  }
  if (graphic.type === 'region') {
    return extractFromRegion(graphic.segments, toUm)
  }
  return null
}

function extractFromShape(shape: Shape, toUm: number): ExtractedPad | null {
  switch (shape.type) {
    case 'circle':
      return {
        cx: Math.round(shape.cx * toUm),
        cy: Math.round(shape.cy * toUm),
        sizeX: Math.round(shape.r * 2 * toUm),
        sizeY: Math.round(shape.r * 2 * toUm),
        isCircular: true,
      }
    case 'rect':
      return {
        cx: Math.round((shape.x + shape.w / 2) * toUm),
        cy: Math.round((shape.y + shape.h / 2) * toUm),
        sizeX: Math.round(shape.w * toUm),
        sizeY: Math.round(shape.h * toUm),
        isCircular: false,
      }
    case 'polygon': {
      if (shape.points.length < 3) return null
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const [x, y] of shape.points) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
      return {
        cx: Math.round(((minX + maxX) / 2) * toUm),
        cy: Math.round(((minY + maxY) / 2) * toUm),
        sizeX: Math.round((maxX - minX) * toUm),
        sizeY: Math.round((maxY - minY) * toUm),
        isCircular: false,
      }
    }
    case 'outline':
      return extractFromRegion(shape.segments, toUm)
    case 'layered': {
      for (const sub of shape.shapes) {
        if (!sub.erase) {
          const result = extractFromShape(sub, toUm)
          if (result) return result
        }
      }
      return null
    }
  }
}

function extractFromRegion(
  segments: import('../gerber/types').PathSegment[],
  toUm: number,
): ExtractedPad | null {
  if (segments.length === 0) return null
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const seg of segments) {
    for (const pt of [seg.start, seg.end]) {
      if (pt[0] < minX) minX = pt[0]
      if (pt[0] > maxX) maxX = pt[0]
      if (pt[1] < minY) minY = pt[1]
      if (pt[1] > maxY) maxY = pt[1]
    }
  }
  return {
    cx: Math.round(((minX + maxX) / 2) * toUm),
    cy: Math.round(((minY + maxY) / 2) * toUm),
    sizeX: Math.round((maxX - minX) * toUm),
    sizeY: Math.round((maxY - minY) * toUm),
    isCircular: false,
  }
}
