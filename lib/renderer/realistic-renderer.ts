/**
 * Realistic PCB Renderer
 *
 * Composites Gerber layers into a photo-realistic PCB appearance using
 * multi-pass Canvas 2D rendering with the following layer order:
 *
 *   1. Substrate      — FR4 base material inside the board outline
 *   2. Copper         — traces and pads in a copper/dark color
 *   3. Solder Mask    — covers everything except pad openings (semi-transparent)
 *   4. Surface Finish — exposed pads rendered in gold (ENIG) / silver (HASL) / etc.
 *   5. Solder Paste   — grey paste deposits on pads
 *   6. Silkscreen     — component markings on top of solder mask
 *   7. Drill          — through-holes punched through everything
 */

import type { ImageTree } from '../gerber/types'
import type { PcbPreset } from '../../app/utils/pcb-presets'
import { renderToCanvas, renderOutlineMask, renderOuterBoundaryOnly } from './canvas-renderer'
import type { CanvasTransform } from './canvas-renderer'

const SOLDER_PASTE_COLOR = '#B0B0B0'

function sampledMaskCoverage(canvas: HTMLCanvasElement, step = 8): { opaque: number; total: number; ratio: number } {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { opaque: 0, total: 0, ratio: 0 }
  const { width, height } = canvas
  if (width === 0 || height === 0) return { opaque: 0, total: 0, ratio: 0 }
  const data = ctx.getImageData(0, 0, width, height).data
  let opaque = 0
  let total = 0
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      total++
      const a = data[(y * width + x) * 4 + 3]
      if (a > 0) opaque++
    }
  }
  const ratio = total > 0 ? opaque / total : 0
  return { opaque, total, ratio }
}

export interface RealisticLayers {
  copper?: ImageTree
  solderMask?: ImageTree
  silkscreen?: ImageTree
  paste?: ImageTree
  drill?: ImageTree
  outline?: ImageTree
}

export interface RealisticRenderOptions {
  preset: PcbPreset
  transform: CanvasTransform
  dpr: number
  /** Side being rendered — affects nothing in the render itself but is useful for callers */
  side: 'top' | 'bottom'
  /** Override solder paste color (e.g. bright green for dot visibility) */
  pasteColor?: string
  /** Optional canvas pool functions to avoid per-frame allocations */
  acquireCanvas?: (w: number, h: number) => HTMLCanvasElement
  releaseCanvas?: (c: HTMLCanvasElement) => void
}

/**
 * Render a realistic PCB view onto the given canvas.
 *
 * The canvas must already be sized (width/height set including DPR).
 * The caller is responsible for clearing the canvas and applying mirroring.
 */
export function renderRealisticView(
  layers: RealisticLayers,
  canvas: HTMLCanvasElement,
  options: RealisticRenderOptions,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const { preset, transform, dpr } = options
  const w = canvas.width
  const h = canvas.height

  const pool = options.acquireCanvas && options.releaseCanvas
  const acquire = pool
    ? () => options.acquireCanvas!(w, h)
    : () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
  const release = pool
    ? (c: HTMLCanvasElement) => options.releaseCanvas!(c)
    : (_c: HTMLCanvasElement) => {}

  // Render the outline mask once and reuse across all passes that need it.
  let outlineMaskCanvas: HTMLCanvasElement | null = null
  let outlineMaskInvalid = false
  function getOutlineMask(): HTMLCanvasElement | null {
    if (outlineMaskInvalid) return null
    if (outlineMaskCanvas) return outlineMaskCanvas
    if (!layers.outline) return null
    const candidate = acquire()
    renderOutlineMask(layers.outline!, candidate, { color: '#ffffff', transform, dpr })
    const coverage = sampledMaskCoverage(candidate, 8)
    // Reject outline masks that are empty OR suspiciously sparse (typically
    // thin contour strokes rather than a filled board interior), because they
    // would erase nearly all realistic passes when used as destination-in.
    if (coverage.opaque < 8 || coverage.ratio < 0.005) {
      // Some outline files are contour-only. Try an outer-boundary-only mask
      // before giving up so we still follow the board outline shape.
      release(candidate)
      const outerMask = acquire()
      renderOuterBoundaryOnly(layers.outline!, outerMask, { color: '#ffffff', transform, dpr })
      const outerCoverage = sampledMaskCoverage(outerMask, 8)
      if (outerCoverage.opaque >= 8 && outerCoverage.ratio >= 0.005) {
        outlineMaskCanvas = outerMask
        return outerMask
      }
      release(outerMask)
      outlineMaskInvalid = true
      return null
    }
    outlineMaskCanvas = candidate
    return candidate
  }

  function clipToOutline(target: HTMLCanvasElement) {
    const mask = getOutlineMask()
    if (!mask) return
    const tCtx = target.getContext('2d')!
    tCtx.globalCompositeOperation = 'destination-in'
    tCtx.drawImage(mask, 0, 0)
    tCtx.globalCompositeOperation = 'source-over'
  }

  // Render solder mask openings once (reused by mask + surface finish steps).
  let openingsCanvas: HTMLCanvasElement | null = null
  function getOpenings(): HTMLCanvasElement | null {
    if (openingsCanvas) return openingsCanvas
    if (!layers.solderMask) return null
    openingsCanvas = acquire()
    renderToCanvas(layers.solderMask!, openingsCanvas, { color: '#ffffff', transform, dpr })
    return openingsCanvas
  }

  // ── 1. Substrate fill (inside outline) ──
  if (layers.outline) {
    const mask = getOutlineMask()
    if (mask) {
      const substrateCanvas = acquire()
      const subCtx = substrateCanvas.getContext('2d')!
      subCtx.drawImage(mask, 0, 0)
      subCtx.globalCompositeOperation = 'source-in'
      subCtx.fillStyle = preset.substrate
      subCtx.fillRect(0, 0, w, h)
      subCtx.globalCompositeOperation = 'source-over'
      ctx.drawImage(substrateCanvas, 0, 0)
      release(substrateCanvas)
    }
  }

  // ── 2. Copper layer ──
  if (layers.copper) {
    const copperCanvas = acquire()
    renderToCanvas(layers.copper, copperCanvas, { color: preset.copper, transform, dpr })
    clipToOutline(copperCanvas)
    ctx.drawImage(copperCanvas, 0, 0)
    release(copperCanvas)
  }

  // ── 3. Solder mask ──
  if (layers.outline) {
    const outlineMask = getOutlineMask()
    if (outlineMask) {
      const maskCanvas = acquire()
      const maskCtx = maskCanvas.getContext('2d')!
      maskCtx.drawImage(outlineMask, 0, 0)
      maskCtx.globalCompositeOperation = 'source-in'
      maskCtx.fillStyle = preset.solderMask
      maskCtx.fillRect(0, 0, w, h)
      maskCtx.globalCompositeOperation = 'source-over'

      const openings = getOpenings()
      if (openings) {
        maskCtx.globalCompositeOperation = 'destination-out'
        maskCtx.drawImage(openings, 0, 0)
        maskCtx.globalCompositeOperation = 'source-over'
      }

      ctx.globalAlpha = preset.solderMaskOpacity
      ctx.drawImage(maskCanvas, 0, 0)
      ctx.globalAlpha = 1.0
      release(maskCanvas)
    }
  }

  // ── 4. Surface finish on exposed pads ──
  if (layers.copper && layers.solderMask) {
    const finishCanvas = acquire()
    renderToCanvas(layers.copper, finishCanvas, { color: preset.surfaceFinish, transform, dpr })
    const openings = getOpenings()!
    const finishCtx = finishCanvas.getContext('2d')!
    finishCtx.globalCompositeOperation = 'destination-in'
    finishCtx.drawImage(openings, 0, 0)
    finishCtx.globalCompositeOperation = 'source-over'
    clipToOutline(finishCanvas)
    ctx.drawImage(finishCanvas, 0, 0)
    release(finishCanvas)
  } else if (layers.copper && !layers.solderMask) {
    const finishCanvas = acquire()
    renderToCanvas(layers.copper, finishCanvas, { color: preset.surfaceFinish, transform, dpr })
    clipToOutline(finishCanvas)
    ctx.drawImage(finishCanvas, 0, 0)
    release(finishCanvas)
  }

  // ── 5. Solder paste ──
  if (layers.paste) {
    const pasteCanvas = acquire()
    renderToCanvas(layers.paste, pasteCanvas, { color: options.pasteColor ?? SOLDER_PASTE_COLOR, transform, dpr })
    clipToOutline(pasteCanvas)
    ctx.drawImage(pasteCanvas, 0, 0)
    release(pasteCanvas)
  }

  // ── 6. Silkscreen ──
  if (layers.silkscreen) {
    const silkCanvas = acquire()
    renderToCanvas(layers.silkscreen, silkCanvas, { color: preset.silkscreen, transform, dpr })
    clipToOutline(silkCanvas)
    ctx.drawImage(silkCanvas, 0, 0)
    release(silkCanvas)
  }

  // ── 7. Drill holes ──
  if (layers.drill) {
    const drillCanvas = acquire()
    renderToCanvas(layers.drill, drillCanvas, { color: '#ffffff', transform, dpr })
    ctx.globalCompositeOperation = 'destination-out'
    ctx.drawImage(drillCanvas, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
    release(drillCanvas)
  }

  // Release cached intermediates
  if (openingsCanvas) release(openingsCanvas)
  if (outlineMaskCanvas) release(outlineMaskCanvas)
}
