<template>
  <canvas
    ref="canvasEl"
    class="w-full h-full"
    :class="{
      'cursor-crosshair': measure?.active.value || info?.active.value || deleteTool?.active.value,
    }"
    @wheel.prevent="onWheel"
    @mousedown="onMouseDown"
    @mousemove="onMouseMove"
    @mouseup="onMouseUp"
    @mouseleave="onMouseLeave"
    @contextmenu.prevent
  />
</template>

<script setup lang="ts">
import type { LayerInfo } from '~/utils/gerber-helpers'
import type { PcbPreset } from '~/utils/pcb-presets'
import type { ImageTree, BoundingBox } from '@lib/gerber/types'
import { renderToCanvas, renderOutlineMask, computeAutoFitTransform } from '@lib/renderer/canvas-renderer'
import { renderRealisticView } from '@lib/renderer/realistic-renderer'
import type { RealisticLayers } from '@lib/renderer/realistic-renderer'
import { parseGerber } from '@lib/gerber'
import { plotImageTree } from '@lib/gerber/plotter'
import { mergeBounds, emptyBounds, isEmpty } from '@lib/gerber/bounding-box'

export type ViewMode = 'layers' | 'realistic'

const props = defineProps<{
  layers: LayerInfo[]
  interaction: ReturnType<typeof useCanvasInteraction>
  mirrored?: boolean
  cropToOutline?: boolean
  outlineLayer?: LayerInfo
  measure?: ReturnType<typeof useMeasureTool>
  info?: ReturnType<typeof useInfoTool>
  deleteTool?: ReturnType<typeof useDeleteTool>
  /** View mode: 'layers' (default flat colors) or 'realistic' (photo-realistic compositing) */
  viewMode?: ViewMode
  /** PCB appearance preset (used when viewMode is 'realistic') */
  preset?: PcbPreset
  /** All layers (including hidden ones) — needed for realistic mode to find layers by type */
  allLayers?: LayerInfo[]
}>()

const canvasEl = ref<HTMLCanvasElement | null>(null)
const autoFitDone = ref(false)
const currentBounds = ref<[number, number, number, number] | null>(null)
const { backgroundColor: bgColor, isLight } = useBackgroundColor()
const { settings: appSettings } = useAppSettings()

// Cache parsed image trees
const imageTreeCache = new Map<string, ImageTree>()

function getImageTree(layer: LayerInfo): ImageTree | null {
  const key = layer.file.fileName
  if (imageTreeCache.has(key)) return imageTreeCache.get(key)!

  try {
    const ast = parseGerber(layer.file.content)
    const tree = plotImageTree(ast)
    imageTreeCache.set(key, tree)
    return tree
  } catch (e) {
    console.warn(`Failed to parse ${layer.file.fileName}:`, e)
    return null
  }
}

// ── Mouse event routing ──

function onWheel(e: WheelEvent) {
  if (canvasEl.value) {
    props.interaction.handleWheel(e, canvasEl.value)
  }
}

/** Build layer data array (top→bottom) for hit-testing tools */
function buildLayerData(): { name: string; type: string; color: string; tree: ImageTree }[] {
  const layerData: { name: string; type: string; color: string; tree: ImageTree }[] = []
  for (let i = props.layers.length - 1; i >= 0; i--) {
    const layer = props.layers[i]!
    const tree = getImageTree(layer)
    if (tree && tree.children.length > 0) {
      layerData.push({ name: layer.file.fileName, type: layer.type, color: layer.color, tree })
    }
  }
  return layerData
}

function onMouseDown(e: MouseEvent) {
  // Right-click: always pan (regardless of active tool)
  if (e.button === 2) {
    props.interaction.handleMouseDown(e)
    return
  }
  // Left-click: route to active tool
  if (e.button === 0 && canvasEl.value) {
    if (props.deleteTool?.active.value) {
      props.deleteTool.handleMouseDown(e, canvasEl.value)
    } else if (props.measure?.active.value) {
      props.measure.handleClick(e, canvasEl.value, props.interaction.transform.value)
    } else if (props.info?.active.value) {
      const layerData = buildLayerData()
      props.info.handleClick(e, canvasEl.value, props.interaction.transform.value, layerData)
    }
  }
}

function onMouseMove(e: MouseEvent) {
  // Always update pan if dragging (right-click drag)
  props.interaction.handleMouseMove(e, { invertPanX: !!props.mirrored })
  // Route to active tool
  if (props.deleteTool?.active.value && canvasEl.value) {
    props.deleteTool.handleMouseMove(e, canvasEl.value)
  }
  if (props.measure?.active.value && canvasEl.value) {
    props.measure.handleMouseMove(e, canvasEl.value, props.interaction.transform.value)
  }
}

function onMouseUp(e: MouseEvent) {
  props.interaction.handleMouseUp()
  if (props.deleteTool?.active.value && canvasEl.value) {
    const layerData = buildLayerData()
    props.deleteTool.handleMouseUp(e, canvasEl.value, props.interaction.transform.value, layerData)
  }
}

function onMouseLeave(e: MouseEvent) {
  props.interaction.handleMouseUp()
}

// ── Collect snap points when layers change ──

watch(
  () => props.layers,
  () => {
    if (!props.measure) return
    const trees: ImageTree[] = []
    for (const layer of props.layers) {
      const tree = getImageTree(layer)
      if (tree) trees.push(tree)
    }
    props.measure.collectSnapPoints(trees)
  },
  { deep: true, immediate: true },
)

// ── Canvas rendering ──

function getCssDimensions(): { cssWidth: number; cssHeight: number } {
  const canvas = canvasEl.value
  const parent = canvas?.parentElement
  if (!parent) return { cssWidth: 800, cssHeight: 600 }
  return { cssWidth: parent.clientWidth, cssHeight: parent.clientHeight }
}

function sizeCanvas(): number {
  const canvas = canvasEl.value
  if (!canvas) return 1

  const { cssWidth, cssHeight } = getCssDimensions()
  const dpr = window.devicePixelRatio || 1

  canvas.width = cssWidth * dpr
  canvas.height = cssHeight * dpr
  canvas.style.width = cssWidth + 'px'
  canvas.style.height = cssHeight + 'px'

  return dpr
}

/**
 * Gather categorized ImageTrees for realistic rendering.
 * Uses allLayers (all project layers) to find each layer type.
 */
function gatherRealisticLayers(side: 'top' | 'bottom'): RealisticLayers {
  const source = props.allLayers ?? props.layers
  const result: RealisticLayers = {}

  const copperType = side === 'top' ? 'Top Copper' : 'Bottom Copper'
  const maskType = side === 'top' ? 'Top Solder Mask' : 'Bottom Solder Mask'
  const silkType = side === 'top' ? 'Top Silkscreen' : 'Bottom Silkscreen'
  const pasteType = side === 'top' ? 'Top Paste' : 'Bottom Paste'

  for (const layer of source) {
    const tree = getImageTree(layer)
    if (!tree) continue

    if (layer.type === copperType) result.copper = tree
    else if (layer.type === maskType) result.solderMask = tree
    else if (layer.type === silkType) result.silkscreen = tree
    else if (layer.type === pasteType) result.paste = tree
    else if (layer.type === 'Drill') result.drill = tree
    else if (layer.type === 'Outline' || layer.type === 'Keep-Out') result.outline = tree
  }

  return result
}

/**
 * Detect the Gerber coordinate unit from the first parseable layer.
 * Returns 'mm' or 'in'. Defaults to 'mm' if nothing is available.
 */
function detectUnits(): 'mm' | 'in' {
  const source = props.allLayers ?? props.layers
  for (const layer of source) {
    const tree = getImageTree(layer)
    if (tree) return tree.units
  }
  return 'mm'
}

/**
 * Draw a background grid in Gerber coordinate space.
 * The grid spacing is in mm (converted to Gerber units if needed).
 * Uses subtle colors appropriate for the current background.
 */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  transform: { offsetX: number; offsetY: number; scale: number },
  mirrored: boolean,
) {
  const spacingMm = appSettings.gridSpacingMm
  const units = detectUnits()
  // Convert mm spacing to Gerber coordinate units
  const spacing = units === 'in' ? spacingMm / 25.4 : spacingMm

  const { offsetX, offsetY, scale } = transform
  if (scale <= 0 || spacing <= 0) return

  // Compute the visible Gerber coordinate range
  // Transform model: screenX = offsetX + gerberX * scale
  //                  screenY = offsetY - gerberY * scale
  const gerberXAtScreenLeft = mirrored
    ? (cssWidth - 0 - offsetX) / scale
    : (0 - offsetX) / scale
  const gerberXAtScreenRight = mirrored
    ? (cssWidth - cssWidth - offsetX) / scale
    : (cssWidth - offsetX) / scale
  const gerberXMin = Math.min(gerberXAtScreenLeft, gerberXAtScreenRight)
  const gerberXMax = Math.max(gerberXAtScreenLeft, gerberXAtScreenRight)
  const gerberYMin = (offsetY - cssHeight) / scale
  const gerberYMax = (offsetY - 0) / scale

  // Snap to grid lines
  const firstX = Math.floor(gerberXMin / spacing) * spacing
  const lastX = Math.ceil(gerberXMax / spacing) * spacing
  const firstY = Math.floor(gerberYMin / spacing) * spacing
  const lastY = Math.ceil(gerberYMax / spacing) * spacing

  // Limit to avoid performance issues at extreme zoom out
  const lineCountX = (lastX - firstX) / spacing
  const lineCountY = (lastY - firstY) / spacing
  if (lineCountX > 500 || lineCountY > 500) return

  // Choose grid colors based on background
  const light = isLight.value
  const minorColor = light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'
  const majorColor = light ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)'
  // Major grid every 5 intervals
  const majorEvery = 5

  ctx.save()
  if (dpr !== 1) ctx.scale(dpr, dpr)

  // Draw in screen coordinates for crisp 1px lines
  ctx.lineWidth = 1

  // Vertical lines (along X axis)
  for (let gx = firstX; gx <= lastX; gx += spacing) {
    const screenX = mirrored
      ? cssWidth - (offsetX + gx * scale)
      : offsetX + gx * scale
    // Determine if this is a major line
    const gridIndex = Math.round(gx / spacing)
    const isMajor = gridIndex % majorEvery === 0
    ctx.strokeStyle = isMajor ? majorColor : minorColor
    ctx.beginPath()
    ctx.moveTo(Math.round(screenX) + 0.5, 0)
    ctx.lineTo(Math.round(screenX) + 0.5, cssHeight)
    ctx.stroke()
  }

  // Horizontal lines (along Y axis)
  for (let gy = firstY; gy <= lastY; gy += spacing) {
    const screenY = offsetY - gy * scale
    const gridIndex = Math.round(gy / spacing)
    const isMajor = gridIndex % majorEvery === 0
    ctx.strokeStyle = isMajor ? majorColor : minorColor
    ctx.beginPath()
    ctx.moveTo(0, Math.round(screenY) + 0.5)
    ctx.lineTo(cssWidth, Math.round(screenY) + 0.5)
    ctx.stroke()
  }

  ctx.restore()
}

function draw() {
  const canvas = canvasEl.value
  if (!canvas) return

  const dpr = sizeCanvas()
  const { cssWidth, cssHeight } = getCssDimensions()

  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Fill background
  ctx.fillStyle = bgColor.value
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const isRealistic = props.viewMode === 'realistic' && props.preset

  // Collect all image trees and compute unified bounds
  // For realistic mode, use allLayers for bounds computation
  const boundsSource = isRealistic ? (props.allLayers ?? props.layers) : props.layers
  const layerTrees: { layer: LayerInfo; tree: ImageTree }[] = []
  let unifiedBounds: BoundingBox = emptyBounds()

  for (const layer of boundsSource) {
    const tree = getImageTree(layer)
    if (!tree || tree.children.length === 0) continue
    layerTrees.push({ layer, tree })
    unifiedBounds = mergeBounds(unifiedBounds, tree.bounds as BoundingBox)
  }

  if (isEmpty(unifiedBounds) || layerTrees.length === 0) return

  // When crop-to-outline is active (or realistic mode), fit to the outline bounds
  const shouldCrop = props.cropToOutline || isRealistic
  let fitBounds: [number, number, number, number]
  const outlineSource = props.outlineLayer ?? (isRealistic ? (props.allLayers ?? props.layers).find(l => l.type === 'Outline') : undefined)

  if (shouldCrop && outlineSource) {
    const outlineTree = getImageTree(outlineSource as LayerInfo)
    if (outlineTree && !isEmpty(outlineTree.bounds as BoundingBox)) {
      const ob = outlineTree.bounds as BoundingBox
      fitBounds = [ob[0], ob[1], ob[2], ob[3]]
    } else {
      fitBounds = [unifiedBounds[0], unifiedBounds[1], unifiedBounds[2], unifiedBounds[3]]
    }
  } else {
    fitBounds = [unifiedBounds[0], unifiedBounds[1], unifiedBounds[2], unifiedBounds[3]]
  }

  // Auto-fit on first render, when bounds change, or when reset is requested (scale <= 0)
  const boundsKey = fitBounds.join(',')
  const prevKey = currentBounds.value?.join(',')
  const needsAutoFit = !autoFitDone.value || boundsKey !== prevKey || props.interaction.transform.value.scale <= 0
  if (needsAutoFit) {
    const fit = computeAutoFitTransform(cssWidth, cssHeight, fitBounds)
    props.interaction.transform.value = fit
    autoFitDone.value = true
    currentBounds.value = fitBounds
  }

  const transform = props.interaction.transform.value

  // Draw background grid (only in layers view)
  if (!isRealistic && appSettings.gridEnabled) {
    drawGrid(ctx, cssWidth, cssHeight, dpr, transform, !!props.mirrored)
  }

  if (isRealistic) {
    // ── Realistic rendering mode ──
    const side = props.mirrored ? 'bottom' : 'top'
    const realisticLayers = gatherRealisticLayers(side)

    const sceneCanvas = document.createElement('canvas')
    sceneCanvas.width = canvas.width
    sceneCanvas.height = canvas.height

    renderRealisticView(realisticLayers, sceneCanvas, {
      preset: props.preset!,
      transform,
      dpr,
      side,
    })

    // Apply horizontal mirror if viewing bottom layers
    if (props.mirrored) {
      ctx.save()
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }

    ctx.drawImage(sceneCanvas, 0, 0)

    if (props.mirrored) {
      ctx.restore()
    }
  } else {
    // ── Standard layer rendering mode ──
    const sceneCanvas = document.createElement('canvas')
    sceneCanvas.width = canvas.width
    sceneCanvas.height = canvas.height
    const sceneCtx = sceneCanvas.getContext('2d')!

    for (const { layer, tree } of layerTrees) {
      // In standard mode, only render visible layers (props.layers is already filtered)
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = canvas.width
      tempCanvas.height = canvas.height

      renderToCanvas(tree, tempCanvas, {
        color: layer.color,
        transform,
        dpr,
      })

      sceneCtx.drawImage(tempCanvas, 0, 0)
    }

    // If cropping to outline, apply the outline as a mask
    if (props.cropToOutline && props.outlineLayer) {
      const outlineTree = getImageTree(props.outlineLayer)
      if (outlineTree && outlineTree.children.length > 0) {
        const maskCanvas = document.createElement('canvas')
        maskCanvas.width = canvas.width
        maskCanvas.height = canvas.height

        renderOutlineMask(outlineTree, maskCanvas, {
          color: '#ffffff',
          transform,
          dpr,
        })

        // Clip: keep only the parts of the scene inside the outline
        sceneCtx.globalCompositeOperation = 'destination-in'
        sceneCtx.drawImage(maskCanvas, 0, 0)
        sceneCtx.globalCompositeOperation = 'source-over'
      }
    }

    // Apply horizontal mirror if viewing bottom layers
    if (props.mirrored) {
      ctx.save()
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }

    ctx.drawImage(sceneCanvas, 0, 0)

    if (props.mirrored) {
      ctx.restore()
    }
  }
}

// Watch for layer or transform changes and redraw
watch(
  () => [props.layers, props.allLayers, props.interaction.transform.value, props.mirrored, props.cropToOutline, props.outlineLayer, props.viewMode, props.preset, bgColor.value, appSettings.gridEnabled, appSettings.gridSpacingMm],
  () => draw(),
  { deep: true },
)

onMounted(() => {
  draw()
  const observer = new ResizeObserver(() => {
    // On resize, re-fit if user hasn't manually zoomed/panned
    autoFitDone.value = false
    draw()
  })
  if (canvasEl.value?.parentElement) {
    observer.observe(canvasEl.value.parentElement)
  }
  onUnmounted(() => observer.disconnect())
})

/**
 * Compute tight-fit bounds for export (outline bounds if available, else unified).
 */
function getExportBounds(): [number, number, number, number] | null {
  const isRealistic = props.viewMode === 'realistic' && props.preset
  const source = isRealistic ? (props.allLayers ?? props.layers) : props.layers

  // Prefer outline bounds for tight crop
  const outlineSrc = props.outlineLayer ?? source.find(l => l.type === 'Outline')
  if (outlineSrc) {
    const tree = getImageTree(outlineSrc as LayerInfo)
    if (tree && !isEmpty(tree.bounds as BoundingBox)) {
      return tree.bounds as [number, number, number, number]
    }
  }

  // Fallback to unified bounds
  let bounds: BoundingBox = emptyBounds()
  for (const layer of source) {
    const tree = getImageTree(layer)
    if (!tree || tree.children.length === 0) continue
    bounds = mergeBounds(bounds, tree.bounds as BoundingBox)
  }
  return isEmpty(bounds) ? null : (bounds as [number, number, number, number])
}

/**
 * Export the realistic (or layer) view as a PNG blob.
 * Renders to a dedicated offscreen canvas tightly cropped to the board
 * with a transparent background.
 */
function exportPng(targetMaxPx: number = 4096): Promise<Blob | null> {
  return new Promise((resolve) => {
    const bounds = getExportBounds()
    if (!bounds) return resolve(null)

    const bw = bounds[2] - bounds[0]
    const bh = bounds[3] - bounds[1]
    if (bw <= 0 || bh <= 0) return resolve(null)

    // Size the export canvas to fit exactly, up to targetMaxPx on the longest side
    const scaleFactor = Math.min(targetMaxPx / bw, targetMaxPx / bh)
    const canvasW = Math.ceil(bw * scaleFactor)
    const canvasH = Math.ceil(bh * scaleFactor)

    // Tight-fit transform: maps gerber bounds exactly to [0,0]–[canvasW,canvasH]
    //   screenX = offsetX + gerberX * scale  → gerberX=bounds[0] → 0
    //   screenY = offsetY - gerberY * scale  → gerberY=bounds[3] → 0 (top)
    const exportTransform = {
      offsetX: -bounds[0] * scaleFactor,
      offsetY: bounds[3] * scaleFactor,
      scale: scaleFactor,
    }

    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = canvasW
    exportCanvas.height = canvasH

    const isRealistic = props.viewMode === 'realistic' && props.preset

    if (isRealistic) {
      const side = props.mirrored ? 'bottom' : 'top'
      const realisticLayers = gatherRealisticLayers(side)

      const sceneCanvas = document.createElement('canvas')
      sceneCanvas.width = canvasW
      sceneCanvas.height = canvasH

      renderRealisticView(realisticLayers, sceneCanvas, {
        preset: props.preset!,
        transform: exportTransform,
        dpr: 1,
        side,
      })

      const ctx = exportCanvas.getContext('2d')!
      if (props.mirrored) {
        ctx.translate(canvasW, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(sceneCanvas, 0, 0)
    } else {
      // Layer view export
      const ctx = exportCanvas.getContext('2d')!
      const source = props.layers
      for (const layer of source) {
        const tree = getImageTree(layer)
        if (!tree || tree.children.length === 0) continue
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = canvasW
        tempCanvas.height = canvasH
        renderToCanvas(tree, tempCanvas, {
          color: layer.color,
          transform: exportTransform,
          dpr: 1,
        })
        ctx.drawImage(tempCanvas, 0, 0)
      }

      // Outline crop
      if (props.cropToOutline && props.outlineLayer) {
        const outlineTree = getImageTree(props.outlineLayer)
        if (outlineTree && outlineTree.children.length > 0) {
          const maskCanvas = document.createElement('canvas')
          maskCanvas.width = canvasW
          maskCanvas.height = canvasH
          renderOutlineMask(outlineTree, maskCanvas, {
            color: '#ffffff',
            transform: exportTransform,
            dpr: 1,
          })
          ctx.globalCompositeOperation = 'destination-in'
          ctx.drawImage(maskCanvas, 0, 0)
          ctx.globalCompositeOperation = 'source-over'
        }
      }

      if (props.mirrored) {
        const flipCanvas = document.createElement('canvas')
        flipCanvas.width = canvasW
        flipCanvas.height = canvasH
        const flipCtx = flipCanvas.getContext('2d')!
        flipCtx.translate(canvasW, 0)
        flipCtx.scale(-1, 1)
        flipCtx.drawImage(exportCanvas, 0, 0)
        const origCtx = exportCanvas.getContext('2d')!
        origCtx.clearRect(0, 0, canvasW, canvasH)
        origCtx.drawImage(flipCanvas, 0, 0)
      }
    }

    exportCanvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

/**
 * Get the current canvas element (for external use like SVG export).
 */
function getCanvas(): HTMLCanvasElement | null {
  return canvasEl.value
}

/**
 * Get categorized image trees for SVG export.
 */
function getRealisticLayersForExport(side: 'top' | 'bottom'): RealisticLayers {
  return gatherRealisticLayers(side)
}

/** Invalidate the cached ImageTree for a specific file so it gets re-parsed on next render. */
function invalidateCache(fileName: string) {
  imageTreeCache.delete(fileName)
}

// Expose resetView and export helpers for external use
defineExpose({
  resetView() {
    autoFitDone.value = false
    draw()
  },
  exportPng,
  getCanvas,
  getRealisticLayersForExport,
  getImageTree,
  invalidateCache,
})
</script>
