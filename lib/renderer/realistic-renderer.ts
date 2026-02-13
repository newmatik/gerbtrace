/**
 * Realistic PCB Renderer
 *
 * Composites Gerber layers into a photo-realistic PCB appearance using
 * multi-pass Canvas 2D rendering with the following layer order:
 *
 *   1. Substrate  — FR4 base material inside the board outline
 *   2. Copper     — traces and pads in a copper/dark color
 *   3. Solder Mask — covers everything except pad openings (semi-transparent)
 *   4. Surface Finish — exposed pads rendered in gold (ENIG) / silver (HASL) / etc.
 *   5. Silkscreen — component markings on top of solder mask
 *   6. Drill      — through-holes punched through everything
 */

import type { ImageTree } from '../gerber/types'
import type { PcbPreset } from '../../app/utils/pcb-presets'
import { renderToCanvas, renderOutlineMask } from './canvas-renderer'
import type { CanvasTransform } from './canvas-renderer'

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

  // Helper: create an offscreen canvas of the same size
  function createOffscreen(): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  }

  // ── 1. Substrate fill (inside outline) ──
  if (layers.outline) {
    const substrateCanvas = createOffscreen()
    // Render the outline as a filled mask in the substrate color
    renderOutlineMask(layers.outline, substrateCanvas, {
      color: preset.substrate,
      transform,
      dpr,
    })
    // The outline mask renders white — we need to tint it to substrate color
    const subCtx = substrateCanvas.getContext('2d')!
    subCtx.globalCompositeOperation = 'source-in'
    subCtx.fillStyle = preset.substrate
    subCtx.fillRect(0, 0, w, h)
    subCtx.globalCompositeOperation = 'source-over'

    ctx.drawImage(substrateCanvas, 0, 0)
  }

  // ── 2. Copper layer ──
  if (layers.copper) {
    const copperCanvas = createOffscreen()
    renderToCanvas(layers.copper, copperCanvas, {
      color: preset.copper,
      transform,
      dpr,
    })

    // Clip copper to outline if available
    if (layers.outline) {
      const maskCanvas = createOffscreen()
      renderOutlineMask(layers.outline, maskCanvas, { color: '#ffffff', transform, dpr })
      const copperCtx = copperCanvas.getContext('2d')!
      copperCtx.globalCompositeOperation = 'destination-in'
      copperCtx.drawImage(maskCanvas, 0, 0)
      copperCtx.globalCompositeOperation = 'source-over'
    }

    ctx.drawImage(copperCanvas, 0, 0)
  }

  // ── 3. Solder mask ──
  // The solder mask gerber shows OPENINGS (where mask is removed, i.e. pads).
  // We need to render the inverse: fill the board area with mask color, then
  // punch out the pad openings.
  if (layers.outline) {
    const maskCanvas = createOffscreen()
    const maskCtx = maskCanvas.getContext('2d')!

    // Start with the board outline filled in solder mask color
    renderOutlineMask(layers.outline, maskCanvas, { color: '#ffffff', transform, dpr })
    maskCtx.globalCompositeOperation = 'source-in'
    maskCtx.fillStyle = preset.solderMask
    maskCtx.fillRect(0, 0, w, h)
    maskCtx.globalCompositeOperation = 'source-over'

    // Punch out the solder mask openings
    if (layers.solderMask) {
      const openingsCanvas = createOffscreen()
      renderToCanvas(layers.solderMask, openingsCanvas, {
        color: '#ffffff',
        transform,
        dpr,
      })
      maskCtx.globalCompositeOperation = 'destination-out'
      maskCtx.drawImage(openingsCanvas, 0, 0)
      maskCtx.globalCompositeOperation = 'source-over'
    }

    // Draw the solder mask with opacity
    ctx.globalAlpha = preset.solderMaskOpacity
    ctx.drawImage(maskCanvas, 0, 0)
    ctx.globalAlpha = 1.0
  }

  // ── 4. Surface finish on exposed pads ──
  // Render copper in the surface finish color, then mask to only the
  // solder mask openings (where pads are exposed).
  if (layers.copper && layers.solderMask) {
    const finishCanvas = createOffscreen()

    // Render copper in surface finish color
    renderToCanvas(layers.copper, finishCanvas, {
      color: preset.surfaceFinish,
      transform,
      dpr,
    })

    // Create a mask from the solder mask openings
    const openingsCanvas = createOffscreen()
    renderToCanvas(layers.solderMask, openingsCanvas, {
      color: '#ffffff',
      transform,
      dpr,
    })

    // Keep only the parts where pads are exposed
    const finishCtx = finishCanvas.getContext('2d')!
    finishCtx.globalCompositeOperation = 'destination-in'
    finishCtx.drawImage(openingsCanvas, 0, 0)
    finishCtx.globalCompositeOperation = 'source-over'

    // Also clip to outline
    if (layers.outline) {
      const outlineMask = createOffscreen()
      renderOutlineMask(layers.outline, outlineMask, { color: '#ffffff', transform, dpr })
      finishCtx.globalCompositeOperation = 'destination-in'
      finishCtx.drawImage(outlineMask, 0, 0)
      finishCtx.globalCompositeOperation = 'source-over'
    }

    ctx.drawImage(finishCanvas, 0, 0)
  } else if (layers.copper && !layers.solderMask) {
    // No solder mask data — show all copper in surface finish color
    const finishCanvas = createOffscreen()
    renderToCanvas(layers.copper, finishCanvas, {
      color: preset.surfaceFinish,
      transform,
      dpr,
    })
    if (layers.outline) {
      const outlineMask = createOffscreen()
      renderOutlineMask(layers.outline, outlineMask, { color: '#ffffff', transform, dpr })
      const finishCtx = finishCanvas.getContext('2d')!
      finishCtx.globalCompositeOperation = 'destination-in'
      finishCtx.drawImage(outlineMask, 0, 0)
      finishCtx.globalCompositeOperation = 'source-over'
    }
    ctx.drawImage(finishCanvas, 0, 0)
  }

  // ── 5. Silkscreen ──
  if (layers.silkscreen) {
    const silkCanvas = createOffscreen()
    renderToCanvas(layers.silkscreen, silkCanvas, {
      color: preset.silkscreen,
      transform,
      dpr,
    })

    // Clip silkscreen to outline
    if (layers.outline) {
      const outlineMask = createOffscreen()
      renderOutlineMask(layers.outline, outlineMask, { color: '#ffffff', transform, dpr })
      const silkCtx = silkCanvas.getContext('2d')!
      silkCtx.globalCompositeOperation = 'destination-in'
      silkCtx.drawImage(outlineMask, 0, 0)
      silkCtx.globalCompositeOperation = 'source-over'
    }

    ctx.drawImage(silkCanvas, 0, 0)
  }

  // ── 6. Drill holes ──
  // Punch through everything — drill holes are transparent (show background)
  if (layers.drill) {
    const drillCanvas = createOffscreen()
    renderToCanvas(layers.drill, drillCanvas, {
      color: '#ffffff',
      transform,
      dpr,
    })

    ctx.globalCompositeOperation = 'destination-out'
    ctx.drawImage(drillCanvas, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
  }
}
