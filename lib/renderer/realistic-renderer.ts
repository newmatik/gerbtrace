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
import { renderToCanvas, renderOutlineMask } from './canvas-renderer'
import type { CanvasTransform } from './canvas-renderer'

const SOLDER_PASTE_COLOR = '#B0B0B0'

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
  function getOutlineMask(): HTMLCanvasElement | null {
    if (outlineMaskCanvas) return outlineMaskCanvas
    if (!layers.outline) return null
    outlineMaskCanvas = acquire()
    renderOutlineMask(layers.outline!, outlineMaskCanvas, { color: '#ffffff', transform, dpr })
    return outlineMaskCanvas
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
    const substrateCanvas = acquire()
    const mask = getOutlineMask()!
    const subCtx = substrateCanvas.getContext('2d')!
    subCtx.drawImage(mask, 0, 0)
    subCtx.globalCompositeOperation = 'source-in'
    subCtx.fillStyle = preset.substrate
    subCtx.fillRect(0, 0, w, h)
    subCtx.globalCompositeOperation = 'source-over'
    ctx.drawImage(substrateCanvas, 0, 0)
    release(substrateCanvas)
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
    const maskCanvas = acquire()
    const maskCtx = maskCanvas.getContext('2d')!
    const outlineMask = getOutlineMask()!
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
