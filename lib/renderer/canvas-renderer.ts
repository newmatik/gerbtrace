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
  /** Optional Gerber-space translation applied after the view transform (for alignment) */
  gerberOffset?: { x: number; y: number }
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

  // Per-packet Gerber-space offset (for reference-point alignment)
  if (options.gerberOffset) {
    ctx.translate(options.gerberOffset.x, options.gerberOffset.y)
  }

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

/**
 * Render a subset of graphics from an ImageTree onto an already-transformed
 * context.  The caller must set up the Gerber→screen transform (translate +
 * scale) before calling — this function only draws the specified children.
 *
 * Used for highlighting selected objects (e.g. delete-tool pending deletion).
 */
export function renderGraphicSubset(
  imageTree: ImageTree,
  indices: number[],
  ctx: CanvasRenderingContext2D,
  color: string,
  scale: number,
): void {
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const idx of indices) {
    const graphic = imageTree.children[idx]
    if (graphic) {
      renderGraphic(ctx, graphic, color, scale)
    }
  }
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
      // Gerber uses math convention (Y-up): CCW = increasing angles.
      // Canvas ctx.arc() defines counterclockwise in screen coords (Y-down),
      // where increasing angles go CW.  Since our CTM includes a Y-flip
      // (scale(s, -s)), the visual direction is correct but the arc *selection*
      // (short vs long arc) is determined before the CTM is applied.
      // We must negate the flag so the correct arc (short/long) is chosen.
      const { center, radius, startAngle, endAngle, counterclockwise } = seg
      ctx.arc(center[0], center[1], radius, startAngle, endAngle, !counterclockwise)
    }
  }
}

/**
 * Render an outline ImageTree as a filled white mask on the given canvas.
 * Used for "crop to outline" — the filled interior becomes the clip region.
 *
 * Strategy:
 *   1. Collect all closed contours from path / region / shape graphics,
 *      partitioned by polarity (dark vs erase).
 *   2. Identify the outer board boundary (the dark contour with the largest
 *      bounding-box area) and fill it as a solid white mask.
 *   3. Erase all remaining dark contours (same-polarity cutouts) and all
 *      erase-polarity contours using `destination-out`.
 *
 * Single-segment path graphics (some CAD tools emit D02 + D01 per edge) are
 * chained by matching endpoints into closed contours before processing.
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

  if (options.gerberOffset) {
    ctx.translate(options.gerberOffset.x, options.gerberOffset.y)
  }

  // ── Collect path/region fragments and shapes, partitioned by polarity ──
  const darkFragments: PathSegment[][] = []
  const eraseFragments: PathSegment[][] = []

  type ShapeDrawFn = () => void
  const darkShapes: ShapeDrawFn[] = []
  const eraseShapes: ShapeDrawFn[] = []

  for (const graphic of outlineTree.children) {
    const isErase = 'erase' in graphic && graphic.erase
    const fragments = isErase ? eraseFragments : darkFragments
    const shapes = isErase ? eraseShapes : darkShapes

    if (graphic.type === 'path' || graphic.type === 'region') {
      if (graphic.segments.length > 0) {
        fragments.push(graphic.segments)
      }
    } else if (graphic.type === 'shape') {
      if (graphic.shape.type === 'outline') {
        fragments.push(graphic.shape.segments)
      } else if (graphic.shape.type === 'circle') {
        const s = graphic.shape
        shapes.push(() => {
          ctx.moveTo(s.cx + s.r, s.cy)
          ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2)
        })
      } else if (graphic.shape.type === 'rect') {
        const s = graphic.shape
        shapes.push(() => { ctx.rect(s.x, s.y, s.w, s.h) })
      } else if (graphic.shape.type === 'polygon') {
        const pts = graphic.shape.points
        if (pts.length >= 2) {
          shapes.push(() => {
            ctx.moveTo(pts[0]![0], pts[0]![1])
            for (let k = 1; k < pts.length; k++) {
              ctx.lineTo(pts[k]![0], pts[k]![1])
            }
          })
        }
      }
    }
  }

  // Merge all fragments into closed contours (handles arbitrary segment order,
  // reversed segments, and mixed single/multi-segment paths)
  const darkContours = chainFragmentsIntoContours(darkFragments)
  const eraseContours = chainFragmentsIntoContours(eraseFragments)

  // ── Identify the outer boundary (largest bounding-box area) ──
  let outerIdx = 0
  let outerArea = 0
  for (let i = 0; i < darkContours.length; i++) {
    const a = contourBBoxArea(darkContours[i]!)
    if (a > outerArea) { outerArea = a; outerIdx = i }
  }
  // Also consider dark shapes — compare with largest contour
  // (shapes are rare for boundaries, but handle for completeness)

  // ── Phase 1: Fill the outer boundary ──
  ctx.fillStyle = '#ffffff'
  if (darkContours.length > 0) {
    ctx.beginPath()
    drawContour(ctx, darkContours[outerIdx]!)
    ctx.fill()
  } else if (darkShapes.length > 0) {
    // Fallback: fill the first dark shape
    ctx.beginPath()
    darkShapes[0]!()
    ctx.fill()
  }

  // ── Phase 2: Punch out all cutout contours ──
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = '#ffffff'

  // Dark contours that are NOT the outer boundary → same-polarity cutouts
  for (let i = 0; i < darkContours.length; i++) {
    if (i === outerIdx) continue
    ctx.beginPath()
    drawContour(ctx, darkContours[i]!)
    ctx.fill()
  }
  // Dark shapes that are NOT the outer boundary (if boundary was a contour)
  if (darkContours.length > 0) {
    for (const fn of darkShapes) {
      ctx.beginPath()
      fn()
      ctx.fill()
    }
  }

  // Erase-polarity contours and shapes → polarity-based cutouts
  for (const contour of eraseContours) {
    ctx.beginPath()
    drawContour(ctx, contour)
    ctx.fill()
  }
  for (const fn of eraseShapes) {
    ctx.beginPath()
    fn()
    ctx.fill()
  }

  ctx.globalCompositeOperation = 'source-over'
  ctx.restore()
}

/** Compute the bounding-box area of a contour (for identifying the outer boundary). */
function contourBBoxArea(segments: PathSegment[]): number {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const seg of segments) {
    for (const pt of [seg.start, seg.end]) {
      if (pt[0] < minX) minX = pt[0]
      if (pt[1] < minY) minY = pt[1]
      if (pt[0] > maxX) maxX = pt[0]
      if (pt[1] > maxY) maxY = pt[1]
    }
  }
  return (maxX - minX) * (maxY - minY)
}

/** Reverse a path segment (swap start↔end, flip arc direction). */
function reverseSegment(seg: PathSegment): PathSegment {
  if (seg.type === 'line') {
    return { type: 'line', start: seg.end, end: seg.start }
  }
  return {
    type: 'arc',
    start: seg.end,
    end: seg.start,
    center: seg.center,
    radius: seg.radius,
    startAngle: seg.endAngle,
    endAngle: seg.startAngle,
    counterclockwise: !seg.counterclockwise,
  }
}

/** Squared-distance helper for endpoint matching. */
function ptDistSq(a: [number, number], b: [number, number]): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  return dx * dx + dy * dy
}

/**
 * Merge an array of path fragments (each an ordered sub-chain of segments)
 * into closed contours by matching endpoints bidirectionally.
 *
 * Handles:
 *  - Single-segment fragments (loose D02+D01 pairs)
 *  - Multi-segment fragments (already partially chained by the plotter)
 *  - Reversed fragments (CAD tools may emit edges in arbitrary direction)
 *  - Mixed combinations of all the above
 *
 * Each resulting array is a closed (or nearly-closed) contour suitable for
 * filling as an outline mask.
 */
function chainFragmentsIntoContours(fragments: PathSegment[][]): PathSegment[][] {
  if (fragments.length === 0) return []

  const EPS_SQ = 0.01 * 0.01 // 10 µm tolerance squared
  const remaining = fragments.map(f => f.slice()) // mutable shallow copies
  const result: PathSegment[][] = []

  while (remaining.length > 0) {
    const chain = remaining.splice(0, 1)[0]!

    let extended = true
    while (extended) {
      extended = false

      const tailPt = chain[chain.length - 1]!.end
      const headPt = chain[0]!.start

      // Stop extending if the chain is already closed
      if (chain.length > 1 && ptDistSq(tailPt, headPt) < EPS_SQ) break

      for (let i = 0; i < remaining.length; i++) {
        const frag = remaining[i]!
        const fragHead = frag[0]!.start
        const fragTail = frag[frag.length - 1]!.end

        // Append forward: chain.tail → frag.head
        if (ptDistSq(tailPt, fragHead) < EPS_SQ) {
          chain.push(...remaining.splice(i, 1)[0]!)
          extended = true
          break
        }

        // Append reversed: chain.tail → frag.tail
        if (ptDistSq(tailPt, fragTail) < EPS_SQ) {
          const removed = remaining.splice(i, 1)[0]!
          for (let k = removed.length - 1; k >= 0; k--) {
            chain.push(reverseSegment(removed[k]!))
          }
          extended = true
          break
        }

        // Prepend forward: frag.tail → chain.head
        if (ptDistSq(headPt, fragTail) < EPS_SQ) {
          chain.unshift(...remaining.splice(i, 1)[0]!)
          extended = true
          break
        }

        // Prepend reversed: frag.head → chain.head
        if (ptDistSq(headPt, fragHead) < EPS_SQ) {
          const removed = remaining.splice(i, 1)[0]!
          const reversed: PathSegment[] = []
          for (let k = removed.length - 1; k >= 0; k--) {
            reversed.push(reverseSegment(removed[k]!))
          }
          chain.unshift(...reversed)
          extended = true
          break
        }
      }
    }

    result.push(chain)
  }

  return result
}

/**
 * Draw a contour (array of chained segments) as a single Canvas sub-path.
 * Handles full-circle arcs and applies the Y-flip arc direction correction.
 */
function drawContour(ctx: CanvasRenderingContext2D, segments: PathSegment[]): void {
  if (segments.length === 0) return

  ctx.moveTo(segments[0]!.start[0], segments[0]!.start[1])

  for (const seg of segments) {
    if (seg.type === 'line') {
      ctx.lineTo(seg.end[0], seg.end[1])
    } else {
      // Arc — see drawSegments() for the !counterclockwise rationale
      ctx.arc(seg.center[0], seg.center[1], seg.radius, seg.startAngle, seg.endAngle, !seg.counterclockwise)
    }
  }
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
