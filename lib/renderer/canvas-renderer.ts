/**
 * Canvas 2D Renderer for Gerber ImageTree
 *
 * Renders the plotter's ImageTree drawing primitives to an HTML5 Canvas.
 * Avoids SVG entirely for performance (no DOM bloat, no <use> tag overhead).
 *
 * Transform model:
 *   screenX = offsetX + gerberX * scale
 *   screenY = offsetY - gerberY * scale    (Y axis flipped)
 *
 * All transform values (offsetX, offsetY, scale) are in CSS pixel space.
 * DPR scaling is handled separately by the canvas sizing + ctx.scale(dpr, dpr).
 */

import type {
  ImageTree,
  ImageGraphic,
  Shape,
  PathSegment,
} from '../gerber/types'

export interface CanvasTransform {
  offsetX: number
  offsetY: number
  scale: number
}

export interface RenderOptions {
  color: string
  transform: CanvasTransform
  /** Device pixel ratio — canvas must already be sized at cssSize * dpr */
  dpr?: number
  /** Optional background fill color (e.g. '#000000' or '#ffffff'). If omitted the canvas is cleared to transparent. */
  backgroundColor?: string
}

/**
 * Compute a transform that fits the given bounds into a canvas of the given
 * CSS dimensions with ~10% margin.
 */
export function computeAutoFitTransform(
  cssWidth: number,
  cssHeight: number,
  bounds: [number, number, number, number],
): CanvasTransform {
  const bw = bounds[2] - bounds[0]
  const bh = bounds[3] - bounds[1]
  if (bw <= 0 || bh <= 0) return { offsetX: 0, offsetY: 0, scale: 1 }

  const scale = Math.min((cssWidth * 0.9) / bw, (cssHeight * 0.9) / bh)
  const offsetX = cssWidth / 2 - ((bounds[0] + bounds[2]) / 2) * scale
  const offsetY = cssHeight / 2 + ((bounds[1] + bounds[3]) / 2) * scale
  return { offsetX, offsetY, scale }
}

export function renderToCanvas(
  imageTree: ImageTree,
  canvas: HTMLCanvasElement,
  options: RenderOptions,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { children } = imageTree
  const color = options.color || '#cc0000'
  const dpr = options.dpr ?? 1
  const { offsetX, offsetY, scale } = options.transform

  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Fill background if requested
  if (options.backgroundColor) {
    ctx.fillStyle = options.backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  if (children.length === 0 || scale <= 0) return

  ctx.save()

  // Scale for device pixel ratio (canvas backing store is cssSize * dpr)
  if (dpr !== 1) {
    ctx.scale(dpr, dpr)
  }

  // Apply the view transform: Gerber coords → CSS screen coords
  //   screenX = offsetX + gerberX * scale
  //   screenY = offsetY - gerberY * scale
  ctx.translate(offsetX, offsetY)
  ctx.scale(scale, -scale)

  // Base drawing style
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const graphic of children) {
    renderGraphic(ctx, graphic, color, scale)
  }

  ctx.restore()
}

function renderGraphic(
  ctx: CanvasRenderingContext2D,
  graphic: ImageGraphic,
  color: string,
  scale: number,
): void {
  const erase = 'erase' in graphic && graphic.erase

  if (erase) {
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
  }

  switch (graphic.type) {
    case 'shape':
      renderShape(ctx, graphic.shape, color)
      break
    case 'path':
      renderPath(ctx, graphic.segments, graphic.width, color, scale)
      break
    case 'region':
      renderRegion(ctx, graphic.segments, color)
      break
  }

  if (erase) {
    ctx.restore()
  }
}

function renderShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  color: string,
): void {
  switch (shape.type) {
    case 'circle':
      ctx.beginPath()
      ctx.arc(shape.cx, shape.cy, shape.r, 0, Math.PI * 2)
      ctx.fill()
      break

    case 'rect':
      if (shape.r && shape.r > 0) {
        drawRoundRect(ctx, shape.x, shape.y, shape.w, shape.h, shape.r)
        ctx.fill()
      } else {
        ctx.fillRect(shape.x, shape.y, shape.w, shape.h)
      }
      break

    case 'polygon': {
      if (shape.points.length < 2) break
      const first = shape.points[0]!
      ctx.beginPath()
      ctx.moveTo(first[0], first[1])
      for (let i = 1; i < shape.points.length; i++) {
        const pt = shape.points[i]!
        ctx.lineTo(pt[0], pt[1])
      }
      ctx.closePath()
      ctx.fill()
      break
    }

    case 'outline':
      ctx.beginPath()
      drawSegments(ctx, shape.segments)
      ctx.closePath()
      ctx.fill()
      break

    case 'layered':
      for (const subShape of shape.shapes) {
        if (subShape.erase) {
          ctx.save()
          ctx.globalCompositeOperation = 'destination-out'
          renderShape(ctx, subShape, color)
          ctx.restore()
        } else {
          renderShape(ctx, subShape, color)
        }
      }
      break
  }
}

function renderPath(
  ctx: CanvasRenderingContext2D,
  segments: PathSegment[],
  width: number,
  color: string,
  scale: number,
): void {
  if (segments.length === 0) return
  // Canvas spec: lineWidth = 0 is ignored (keeps previous value).
  // Zero-width apertures produce invisible outlines — skip them.
  if (width <= 0) return

  // Add a sub-pixel padding (0.5 screen pixels in Gerber units) to eliminate
  // anti-aliasing seams between adjacent strokes (e.g. copper pour raster lines).
  const padding = 0.5 / scale
  const renderWidth = width + padding

  ctx.save()
  ctx.lineWidth = renderWidth
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  drawSegments(ctx, segments)
  ctx.stroke()
  ctx.restore()
}

function renderRegion(
  ctx: CanvasRenderingContext2D,
  segments: PathSegment[],
  _color: string,
): void {
  if (segments.length === 0) return

  ctx.beginPath()
  drawSegments(ctx, segments)
  ctx.closePath()
  ctx.fill('evenodd')
}

function drawSegments(ctx: CanvasRenderingContext2D, segments: PathSegment[]): void {
  let needsMoveTo = true

  for (const seg of segments) {
    if (needsMoveTo) {
      ctx.moveTo(seg.start[0], seg.start[1])
      needsMoveTo = false
    }

    if (seg.type === 'line') {
      ctx.lineTo(seg.end[0], seg.end[1])
    } else {
      // Arc segment
      const { center, radius, startAngle, endAngle, counterclockwise } = seg
      ctx.arc(center[0], center[1], radius, startAngle, endAngle, counterclockwise)
    }
  }
}

/**
 * Render an outline ImageTree as a filled white mask on the given canvas.
 * Used for "crop to outline" — the filled interior becomes the clip region.
 * The outline's stroked paths are traced and filled (closed) rather than stroked.
 */
export function renderOutlineMask(
  outlineTree: ImageTree,
  canvas: HTMLCanvasElement,
  options: RenderOptions,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = options.dpr ?? 1
  const { offsetX, offsetY, scale } = options.transform

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (outlineTree.children.length === 0 || scale <= 0) return

  ctx.save()
  if (dpr !== 1) ctx.scale(dpr, dpr)
  ctx.translate(offsetX, offsetY)
  ctx.scale(scale, -scale)

  ctx.fillStyle = '#ffffff'
  ctx.beginPath()

  for (const graphic of outlineTree.children) {
    if (graphic.type === 'path') {
      drawSegments(ctx, graphic.segments)
    } else if (graphic.type === 'region') {
      drawSegments(ctx, graphic.segments)
    } else if (graphic.type === 'shape') {
      if (graphic.shape.type === 'outline') {
        drawSegments(ctx, graphic.shape.segments)
      } else if (graphic.shape.type === 'circle') {
        const s = graphic.shape
        ctx.moveTo(s.cx + s.r, s.cy)
        ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2)
      } else if (graphic.shape.type === 'rect') {
        const s = graphic.shape
        ctx.rect(s.x, s.y, s.w, s.h)
      } else if (graphic.shape.type === 'polygon') {
        const pts = graphic.shape.points
        if (pts.length >= 2) {
          ctx.moveTo(pts[0]![0], pts[0]![1])
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i]![0], pts[i]![1])
          }
        }
      }
    }
  }

  ctx.closePath()
  ctx.fill('evenodd')
  ctx.restore()
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0)
  ctx.lineTo(x + w, y + h - r)
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2)
  ctx.lineTo(x + r, y + h)
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI)
  ctx.lineTo(x, y + r)
  ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5)
  ctx.closePath()
}
