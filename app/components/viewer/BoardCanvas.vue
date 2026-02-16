<template>
  <canvas
    ref="canvasEl"
    class="w-full h-full"
    :class="{
      'cursor-crosshair': measure?.active.value || info?.active.value || deleteTool?.active.value || (alignMode && alignMode !== 'idle'),
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
import { isPnPLayer } from '~/utils/gerber-helpers'
import { drawCanvasGrid } from '~/utils/canvas-grid'
import type { PcbPreset } from '~/utils/pcb-presets'
import type { ImageTree, BoundingBox } from '@lib/gerber/types'
import { renderToCanvas, renderOutlineMask, computeAutoFitTransform } from '@lib/renderer/canvas-renderer'
import { renderRealisticView } from '@lib/renderer/realistic-renderer'
import type { RealisticLayers } from '@lib/renderer/realistic-renderer'
import { parseGerber } from '@lib/gerber'
import { plotImageTree } from '@lib/gerber/plotter'
import { mergeBounds, emptyBounds, isEmpty } from '@lib/gerber/bounding-box'
import type { EditablePnPComponent } from '~/composables/usePickAndPlace'
import type { AlignMode, AlignPoint } from '~/composables/usePickAndPlace'
import type { PackageDefinition, FootprintShape } from '~/utils/package-types'
import type { PnPConvention } from '~/utils/pnp-conventions'
import { computeFootprint, getConventionRotationTransform } from '~/utils/package-types'

export type ViewMode = 'layers' | 'realistic'

const props = defineProps<{
  layers: LayerInfo[]
  interaction: ReturnType<typeof useCanvasInteraction>
  mirrored?: boolean
  /** Active layer filter — used to determine which side to render in realistic mode */
  activeFilter?: 'all' | 'top' | 'bot'
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
  /** Visible PnP components to render as dots */
  pnpComponents?: EditablePnPComponent[]
  /** Currently selected PnP component designator */
  selectedPnpDesignator?: string | null
  /** PnP origin in Gerber coordinate space (null = use default outline bottom-left) */
  pnpOriginX?: number | null
  pnpOriginY?: number | null
  /** Current alignment mode */
  alignMode?: AlignMode
  /** First alignment click for 2-pad mode */
  alignClickA?: AlignPoint | null
  /** Package lookup function — returns definition for a package name */
  matchPackage?: (name: string) => PackageDefinition | undefined
  /** Reactive package-library version token to trigger redraw when package data loads */
  packageLibraryVersion?: number
  /** Whether to render package footprints */
  showPackages?: boolean
  /** PnP orientation convention used in the PnP file */
  pnpConvention?: PnPConvention
}>()

const emit = defineEmits<{
  pnpClick: [designator: string | null]
  alignClick: [gerberX: number, gerberY: number]
}>()

const canvasEl = ref<HTMLCanvasElement | null>(null)
const autoFitDone = ref(false)
const currentBounds = ref<[number, number, number, number] | null>(null)
const { backgroundColor: bgColor, isLight } = useBackgroundColor()
const { settings: appSettings } = useAppSettings()

// ── Interaction tracking (skip heavy overlays during pan/zoom) ──
let wheelSettleTimer = 0
const isZooming = ref(false)

function markWheelActivity() {
  isZooming.value = true
  clearTimeout(wheelSettleTimer)
  wheelSettleTimer = window.setTimeout(() => {
    isZooming.value = false
    scheduleRedraw()
  }, 120)
}

const isInteracting = computed(() => props.interaction.isDragging.value || isZooming.value)

// ── Layer-composite cache ──
// Stores the last fully-rendered gerber scene so pan/zoom can reproject it
// with a single drawImage call instead of re-rendering every layer.
interface SceneCache {
  canvas: HTMLCanvasElement
  transform: { offsetX: number; offsetY: number; scale: number }
  dpr: number
  width: number
  height: number
  key: string
}

let sceneCache: SceneCache | null = null

function computeSceneCacheKey(): string {
  const parts: string[] = []
  for (const l of props.layers) parts.push(l.file.fileName, l.color)
  parts.push(
    props.viewMode ?? 'layers',
    props.preset?.name ?? '',
    props.cropToOutline ? '1' : '0',
    props.outlineLayer?.file.fileName ?? '',
    props.mirrored ? 'M' : '',
    props.activeFilter ?? 'all',
    bgColor.value,
  )
  if (props.viewMode === 'realistic') {
    const al = props.allLayers ?? props.layers
    for (const l of al) parts.push(l.file.fileName, l.color)
  }
  return parts.join('|')
}

function invalidateSceneCache() {
  sceneCache = null
}

// ── Reusable offscreen-canvas pool ──
const _canvasPool: HTMLCanvasElement[] = []

function acquireCanvas(w: number, h: number): HTMLCanvasElement {
  const c = _canvasPool.pop() || document.createElement('canvas')
  if (c.width !== w || c.height !== h) {
    c.width = w
    c.height = h
  } else {
    c.getContext('2d')!.clearRect(0, 0, w, h)
  }
  return c
}

function releaseCanvas(c: HTMLCanvasElement) {
  _canvasPool.push(c)
}

// Cache parsed image trees
const imageTreeCache = new Map<string, ImageTree>()

function getImageTree(layer: LayerInfo): ImageTree | null {
  // PnP layers are not Gerber — skip parsing
  if (isPnPLayer(layer.type)) return null

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
    markWheelActivity()
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
  // Left-click: route to active tool or mode
  if (e.button === 0 && canvasEl.value) {
    // Alignment mode: click with snap
    if (props.alignMode && props.alignMode !== 'idle') {
      const rect = canvasEl.value.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      let gerber = screenToGerber(sx, sy, props.interaction.transform.value)
      const snap = findSnapForOrigin(gerber, props.interaction.transform.value)
      if (snap) gerber = snap
      emit('alignClick', gerber.x, gerber.y)
      return
    }
    if (props.deleteTool?.active.value) {
      props.deleteTool.handleMouseDown(e, canvasEl.value)
    } else if (props.measure?.active.value) {
      props.measure.handleClick(e, canvasEl.value, props.interaction.transform.value)
    } else if (props.info?.active.value) {
      const layerData = buildLayerData()
      props.info.handleClick(e, canvasEl.value, props.interaction.transform.value, layerData)
    } else if (props.pnpComponents && props.pnpComponents.length > 0) {
      // In cursor mode, check for PnP dot clicks
      const rect = canvasEl.value.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const clickY = e.clientY - rect.top
      const { cssWidth } = getCssDimensions()
      const hit = hitTestPnP(
        clickX,
        clickY,
        cssWidth,
        props.interaction.transform.value,
        !!props.mirrored,
      )
      // Emit the clicked designator (or null to deselect)
      emit('pnpClick', hit)
    }
  }
}

function onMouseMove(e: MouseEvent) {
  // Always update pan if dragging (right-click drag)
  props.interaction.handleMouseMove(e, { invertPanX: !!props.mirrored })

  // Alignment mode: track cursor with snap
  if (props.alignMode && props.alignMode !== 'idle' && canvasEl.value) {
    const rect = canvasEl.value.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    let gerber = screenToGerber(sx, sy, props.interaction.transform.value)
    const snap = findSnapForOrigin(gerber, props.interaction.transform.value)
    if (snap) {
      gerber = snap
      originActiveSnap.value = snap
    } else {
      originActiveSnap.value = null
    }
    originCursorGerber.value = gerber
  }

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
  if (props.alignMode && props.alignMode !== 'idle') {
    originCursorGerber.value = null
    originActiveSnap.value = null
  }
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

  const drillTrees: ImageTree[] = []
  let outlineTree: ImageTree | undefined
  let detectedUnits: 'mm' | 'in' | undefined
  const usedTrees: ImageTree[] = []

  for (const layer of source) {
    const tree = getImageTree(layer)
    if (!tree || tree.children.length === 0) continue

    if (layer.type === copperType) { result.copper = tree; usedTrees.push(tree) }
    else if (layer.type === maskType) { result.solderMask = tree; usedTrees.push(tree) }
    else if (layer.type === silkType) { result.silkscreen = tree; usedTrees.push(tree) }
    else if (layer.type === pasteType) { result.paste = tree; usedTrees.push(tree) }
    else if (layer.type === 'Drill') drillTrees.push(tree)
    else if (layer.type === 'Outline') outlineTree = tree
    else if (layer.type === 'Keep-Out' && !outlineTree) outlineTree = tree

    if (!detectedUnits) detectedUnits = tree.units
  }

  // Merge all drill sources (round holes + slots, etc.)
  if (drillTrees.length > 0) {
    const units = drillTrees[0]!.units
    let bounds: BoundingBox = emptyBounds()
    const children = drillTrees
      .filter(t => t.units === units)
      .flatMap(t => {
        bounds = mergeBounds(bounds, t.bounds as BoundingBox)
        return t.children
      })
    result.drill = {
      units,
      bounds: isEmpty(bounds) ? ([0, 0, 0, 0] as BoundingBox) : bounds,
      children,
    }
  }

  if (outlineTree) {
    result.outline = outlineTree
  } else if (detectedUnits) {
    // No outline layer available — synthesize a rectangular outline from the
    // bounding box of the layers actually used for this side's realistic view.
    let fallbackBounds: BoundingBox = emptyBounds()
    for (const t of usedTrees) fallbackBounds = mergeBounds(fallbackBounds, t.bounds as BoundingBox)
    for (const t of drillTrees) fallbackBounds = mergeBounds(fallbackBounds, t.bounds as BoundingBox)

    if (!isEmpty(fallbackBounds)) {
      const [minX, minY, maxX, maxY] = fallbackBounds
      result.outline = {
        units: detectedUnits,
        bounds: fallbackBounds,
        children: [{
          type: 'shape',
          shape: {
            type: 'rect',
            x: minX,
            y: minY,
            w: maxX - minX,
            h: maxY - minY,
          },
        }],
      }
    }
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


// ── PnP marker rendering ──

/** Radius of PnP center dots in CSS pixels */
const PNP_DOT_RADIUS = 3
/** Hit-test radius for clicking PnP dots (CSS px) */
const PNP_HIT_RADIUS = 8
/** Extra slop for clicking footprint shapes (CSS px) */
const PNP_FOOTPRINT_HIT_TOLERANCE = 6
/** Highlight ring colour for the selected component */
const PNP_HIGHLIGHT_COLOR = '#00FFFF'
/** Default PnP dot color (shown when no package footprint is rendered) */
const PNP_DOT_COLOR = '#FF69B4'

/**
 * Convert PnP mm coordinate to Gerber coordinate space,
 * offset by the PnP origin.
 */
function pnpToGerber(mmVal: number, originGerber: number, units: 'mm' | 'in'): number {
  const inGerberUnits = units === 'in' ? mmVal / 25.4 : mmVal
  return originGerber + inGerberUnits
}

/**
 * Compute the effective PnP origin in Gerber coordinate space.
 * If the user has manually set an origin, use that.
 * Otherwise, default to the bottom-left corner of the outline bounding box.
 */
function getEffectiveOrigin(): { ox: number; oy: number } {
  if (props.pnpOriginX != null && props.pnpOriginY != null) {
    return { ox: props.pnpOriginX, oy: props.pnpOriginY }
  }
  // Default: bottom-left of outline bounds
  const source = props.allLayers ?? props.layers
  const outlineSrc = source.find(l => l.type === 'Outline' || l.type === 'Keep-Out')
  if (outlineSrc) {
    const tree = getImageTree(outlineSrc)
    if (tree && !isEmpty(tree.bounds as BoundingBox)) {
      const b = tree.bounds as BoundingBox
      return { ox: b[0], oy: b[1] } // minX, minY = bottom-left
    }
  }
  // Fallback: Gerber origin (0,0)
  return { ox: 0, oy: 0 }
}

/**
 * Draw PnP component center dots on top of the rendered board.
 * Handles mirroring so dots appear at the correct screen position.
 */
function drawPnPMarkers(
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  dpr: number,
  transform: { offsetX: number; offsetY: number; scale: number },
  mirrored: boolean,
  options?: {
    components?: EditablePnPComponent[]
    selectedDesignator?: string | null
    /**
     * If true, and a component has a renderable package footprint, skip the center dot.
     * (Components without a package still get a dot.)
     */
    hideDotWhenPackagePresent?: boolean
    /** Whether package footprints are being rendered (affects dot-hiding logic). */
    includePackages?: boolean
  },
) {
  const components = options?.components ?? props.pnpComponents
  if (!components || components.length === 0) return

  const units = detectUnits()
  const { ox, oy } = getEffectiveOrigin()

  ctx.save()
  if (dpr !== 1) ctx.scale(dpr, dpr)

  for (const comp of components) {
    const gx = pnpToGerber(comp.x, ox, units)
    const gy = pnpToGerber(comp.y, oy, units)

    let screenX = transform.offsetX + gx * transform.scale
    const screenY = transform.offsetY - gy * transform.scale

    if (mirrored) {
      screenX = cssWidth - screenX
    }

    const isSelected = (options?.selectedDesignator ?? props.selectedPnpDesignator) === comp.designator

    // If a footprint package is renderable, suppress the center dot (but keep dots for unknown packages).
    if (options?.hideDotWhenPackagePresent) {
      const includePkgs = options.includePackages ?? !!props.showPackages
      if (includePkgs && props.matchPackage) {
        const pkgName = comp.matchedPackage || comp.package
        const pkg = pkgName ? props.matchPackage(pkgName) : undefined
        if (pkg) {
          // Selection highlight is handled via footprint rendering; skip dot + label.
          continue
        }
      }
    }

    // Draw the filled dot
    ctx.beginPath()
    ctx.arc(screenX, screenY, PNP_DOT_RADIUS, 0, Math.PI * 2)
    ctx.fillStyle = PNP_DOT_COLOR
    ctx.fill()

    // Draw highlight ring for selected component
    if (isSelected) {
      ctx.beginPath()
      ctx.arc(screenX, screenY, PNP_DOT_RADIUS + 3, 0, Math.PI * 2)
      ctx.strokeStyle = PNP_HIGHLIGHT_COLOR
      ctx.lineWidth = 2
      ctx.stroke()

      // Draw designator label
      ctx.font = '11px system-ui, sans-serif'
      ctx.fillStyle = PNP_HIGHLIGHT_COLOR
      ctx.fillText(comp.designator, screenX + PNP_DOT_RADIUS + 5, screenY + 4)
    }
  }

  ctx.restore()
}

// ── Footprint shape cache ──
const footprintCache = new Map<string, FootprintShape[]>()

function getFootprint(pkg: PackageDefinition): FootprintShape[] {
  const key = pkg.name
  if (footprintCache.has(key)) return footprintCache.get(key)!
  const shapes = computeFootprint(pkg)
  footprintCache.set(key, shapes)
  return shapes
}

/**
 * Draw package footprints (body + pads) for PnP components.
 * Renders underneath the PnP center dots.
 */
function drawPackageFootprints(
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  dpr: number,
  transform: { offsetX: number; offsetY: number; scale: number },
  mirrored: boolean,
  options?: {
    components?: EditablePnPComponent[]
    selectedDesignator?: string | null
    includePackages?: boolean
  },
) {
  const components = options?.components ?? props.pnpComponents
  const includePackages = options?.includePackages ?? !!props.showPackages
  if (!components || components.length === 0 || !props.matchPackage || !includePackages) return

  const units = detectUnits()
  const { ox, oy } = getEffectiveOrigin()

  // Scale factor: mm -> screen pixels
  const mmToGerber = units === 'in' ? 1 / 25.4 : 1
  const mmToScreen = mmToGerber * transform.scale

  ctx.save()
  if (dpr !== 1) ctx.scale(dpr, dpr)

  for (const comp of components) {
    const pkgName = comp.matchedPackage || comp.package
    const pkg = props.matchPackage(pkgName)
    if (!pkg) continue

    const shapes = getFootprint(pkg)
    const gx = pnpToGerber(comp.x, ox, units)
    const gy = pnpToGerber(comp.y, oy, units)

    let centerSx = transform.offsetX + gx * transform.scale
    const centerSy = transform.offsetY - gy * transform.scale
    if (mirrored) centerSx = cssWidth - centerSx

    // Convert PnP file rotation into our baseline (degrees CCW, top view)
    // - IPC / IEC: typically CCW-positive
    // - Mycronic: CW-positive
    const { direction, offsetDeg } = getConventionRotationTransform(pkg, props.pnpConvention ?? 'iec61188')
    const adjustedRotationCCW = direction * comp.rotation + offsetDeg

    // Rotation in radians (we keep adjustedRotationCCW in CCW degrees; canvas rotate is visually CW)
    const rotRad = (-adjustedRotationCCW * Math.PI) / 180
    // Mirror flips the rotation direction
    const effectiveRot = mirrored ? -rotRad : rotRad

    const isSelected = (options?.selectedDesignator ?? props.selectedPnpDesignator) === comp.designator

    ctx.save()
    ctx.translate(centerSx, centerSy)
    ctx.rotate(effectiveRot)

    // Draw each shape
    for (const shape of shapes) {
      drawFootprintShape(ctx, shape, mmToScreen, mirrored, isSelected, comp.polarized)
    }
    if (comp.polarized && isLedPackage(pkg, comp.package)) {
      drawLedPolarityLabels(ctx, shapes, mmToScreen, mirrored)
    }

    ctx.restore()
  }

  ctx.restore()
}

// ── Package footprint colors ──
const PKG_BODY_FILL = 'rgba(50, 50, 50, 0.85)'
const PKG_BODY_STROKE = 'rgba(80, 80, 80, 0.9)'
const PKG_PAD_FILL = 'rgba(205, 205, 205, 0.9)'
const PKG_PIN1_FILL = 'rgba(255, 60, 60, 0.95)'
const PKG_BODY_FILL_SEL = 'rgba(0, 180, 180, 0.7)'
const PKG_BODY_STROKE_SEL = 'rgba(0, 255, 255, 0.9)'
const PKG_PAD_FILL_SEL = 'rgba(140, 230, 230, 0.8)'
const PKG_PIN1_FILL_SEL = '#FF3333'
const LED_PIN_LABEL_FILL = 'rgba(255, 255, 255, 0.95)'
const LED_PIN_LABEL_STROKE = 'rgba(0, 0, 0, 0.75)'

/**
 * Draw a single footprint shape at the current transform.
 * Coordinates are in mm, scaled by mmToScreen.
 */
function drawFootprintShape(
  ctx: CanvasRenderingContext2D,
  shape: FootprintShape,
  mmToScreen: number,
  mirrored: boolean,
  isSelected: boolean,
  polarized: boolean,
) {
  const mirrorFactor = mirrored ? -1 : 1

  if (shape.kind === 'rect') {
    const sx = shape.cx * mmToScreen * mirrorFactor
    const sy = -shape.cy * mmToScreen
    const sw = shape.w * mmToScreen
    const sh = shape.h * mmToScreen

    const role = (!polarized && shape.role === 'pin1') ? 'pad' : shape.role

    if (role === 'body') {
      ctx.fillStyle = isSelected ? PKG_BODY_FILL_SEL : PKG_BODY_FILL
      ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh)
      ctx.strokeStyle = isSelected ? PKG_BODY_STROKE_SEL : PKG_BODY_STROKE
      ctx.lineWidth = 1
      ctx.strokeRect(sx - sw / 2, sy - sh / 2, sw, sh)
    } else if (role === 'pad') {
      ctx.fillStyle = isSelected ? PKG_PAD_FILL_SEL : PKG_PAD_FILL
      ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh)
    } else if (role === 'pin1') {
      ctx.fillStyle = isSelected ? PKG_PIN1_FILL_SEL : PKG_PIN1_FILL
      ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh)
    }
  } else if (shape.kind === 'circle') {
    const sx = shape.cx * mmToScreen * mirrorFactor
    const sy = -shape.cy * mmToScreen
    const sr = shape.r * mmToScreen

    const role = (!polarized && shape.role === 'pin1') ? 'pad' : shape.role

    if (role === 'body') {
      ctx.beginPath()
      ctx.arc(sx, sy, sr, 0, Math.PI * 2)
      ctx.fillStyle = isSelected ? PKG_BODY_FILL_SEL : PKG_BODY_FILL
      ctx.fill()
      ctx.strokeStyle = isSelected ? PKG_BODY_STROKE_SEL : PKG_BODY_STROKE
      ctx.lineWidth = 1
      ctx.stroke()
    } else if (role === 'pad') {
      ctx.beginPath()
      ctx.arc(sx, sy, Math.max(sr, 0.5), 0, Math.PI * 2)
      ctx.fillStyle = isSelected ? PKG_PAD_FILL_SEL : PKG_PAD_FILL
      ctx.fill()
    } else if (role === 'pin1') {
      ctx.beginPath()
      ctx.arc(sx, sy, Math.max(sr, 0.5), 0, Math.PI * 2)
      ctx.fillStyle = isSelected ? PKG_PIN1_FILL_SEL : PKG_PIN1_FILL
      ctx.fill()
    }
  } else if (shape.kind === 'roundedRect') {
    const sx = shape.cx * mmToScreen * mirrorFactor
    const sy = -shape.cy * mmToScreen
    const sw = shape.w * mmToScreen
    const sh = shape.h * mmToScreen
    const sr = Math.min(shape.r * mmToScreen, sw / 2, sh / 2)

    ctx.beginPath()
    roundRect(ctx, sx - sw / 2, sy - sh / 2, sw, sh, sr)

    // RoundedRect shapes are used for pads/bodies only (no pin1 role).
    if (shape.role === 'body') {
      ctx.fillStyle = isSelected ? PKG_BODY_FILL_SEL : PKG_BODY_FILL
      ctx.fill()
      ctx.strokeStyle = isSelected ? PKG_BODY_STROKE_SEL : PKG_BODY_STROKE
      ctx.lineWidth = 1
      ctx.stroke()
    } else {
      ctx.fillStyle = isSelected ? PKG_PAD_FILL_SEL : PKG_PAD_FILL
      ctx.fill()
    }
  }
}

function isLedPackage(pkg: PackageDefinition, packageNameFromPnp: string): boolean {
  // LED packages in our library are named/aliased with "LED", e.g. LED-0603.
  const ledPattern = /(^|[\s_-])LED([\s_-]|$)/i
  if (ledPattern.test(packageNameFromPnp)) return true
  if (ledPattern.test(pkg.name)) return true
  return (pkg.aliases ?? []).some(alias => ledPattern.test(alias))
}

function drawLedPolarityLabels(
  ctx: CanvasRenderingContext2D,
  shapes: FootprintShape[],
  mmToScreen: number,
  mirrored: boolean,
) {
  const pads = shapes.filter(shape => shape.role === 'pin1' || shape.role === 'pad')
  if (pads.length < 2) return

  const mirrorFactor = mirrored ? -1 : 1
  // Base symbol size on pad size in screen pixels to keep zoom behavior natural.
  const padHeightsPx = pads.map((pad) => {
    if (pad.kind === 'rect' || pad.kind === 'roundedRect') return Math.min(pad.w, pad.h) * mmToScreen
    if (pad.kind === 'circle') return pad.r * 2 * mmToScreen
    return 0
  })
  const avgPadHeightPx = padHeightsPx.reduce((sum, v) => sum + v, 0) / Math.max(1, padHeightsPx.length)
  const fontPx = Math.max(8, Math.min(24, avgPadHeightPx * 0.78))

  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${fontPx}px system-ui, -apple-system, sans-serif`
  ctx.fillStyle = LED_PIN_LABEL_FILL
  ctx.strokeStyle = LED_PIN_LABEL_STROKE
  ctx.lineWidth = Math.max(0.5, fontPx * 0.08)
  ctx.lineJoin = 'round'

  for (const pad of pads) {
    const label = pad.role === 'pin1' ? '−' : '+'
    const sx = pad.cx * mmToScreen * mirrorFactor
    const sy = -pad.cy * mmToScreen
    ctx.strokeText(label, sx, sy)
    ctx.fillText(label, sx, sy)
  }

  ctx.restore()
}

/** Draw a rounded rectangle path (polyfill for older Canvas APIs) */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (w < 2 * r) r = w / 2
  if (h < 2 * r) r = h / 2
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Hit-test PnP components at a screen coordinate.
 *
 * - If package footprints are shown and the component has a matched package, we hit-test
 *   against the footprint's body + pads (with a small tolerance) so selection works when
 *   clicking anywhere on the rendered package.
 * - Otherwise we fall back to the legacy "center dot" radius hit-test.
 */
function hitTestPnP(
  screenClickX: number,
  screenClickY: number,
  cssWidth: number,
  transform: { offsetX: number; offsetY: number; scale: number },
  mirrored: boolean,
): string | null {
  const components = props.pnpComponents
  if (!components || components.length === 0) return null

  const units = detectUnits()
  const { ox, oy } = getEffectiveOrigin()
  const includeFootprints = !!props.showPackages && !!props.matchPackage
  const mmToGerber = units === 'in' ? 1 / 25.4 : 1
  const mmToScreen = mmToGerber * transform.scale
  let closest: { designator: string; dist: number } | null = null

  const rotate = (x: number, y: number, rad: number) => {
    const c = Math.cos(rad)
    const s = Math.sin(rad)
    return { x: x * c - y * s, y: x * s + y * c }
  }

  for (const comp of components) {
    const gx = pnpToGerber(comp.x, ox, units)
    const gy = pnpToGerber(comp.y, oy, units)

    let screenX = transform.offsetX + gx * transform.scale
    const screenY = transform.offsetY - gy * transform.scale

    if (mirrored) {
      screenX = cssWidth - screenX
    }

    const dx = screenClickX - screenX
    const dy = screenClickY - screenY
    const dist = Math.hypot(dx, dy)

    // If a footprint is rendered, allow clicking anywhere on it.
    if (includeFootprints && props.matchPackage) {
      const pkgName = comp.matchedPackage || comp.package
      const pkg = pkgName ? props.matchPackage(pkgName) : undefined
      if (pkg) {
        // Convert PnP file rotation into our baseline (degrees CCW, top view)
        const { direction, offsetDeg } = getConventionRotationTransform(pkg, props.pnpConvention ?? 'iec61188')
        const adjustedRotationCCW = direction * comp.rotation + offsetDeg
        const rotRad = (-adjustedRotationCCW * Math.PI) / 180
        const effectiveRot = mirrored ? -rotRad : rotRad

        // Transform click point into the footprint-local coordinate system (CSS px),
        // matching the coordinate transforms used by drawPackageFootprints().
        const local = rotate(dx, dy, -effectiveRot)
        const lx = local.x
        const ly = local.y

        const mirrorFactor = mirrored ? -1 : 1
        const tol = PNP_HIT_RADIUS + PNP_FOOTPRINT_HIT_TOLERANCE

        const shapes = getFootprint(pkg)
        let hit = false
        for (const shape of shapes) {
          if (shape.kind === 'rect' || shape.kind === 'roundedRect') {
            const sx = shape.cx * mmToScreen * mirrorFactor
            const sy = -shape.cy * mmToScreen
            const sw = shape.w * mmToScreen
            const sh = shape.h * mmToScreen
            if (Math.abs(lx - sx) <= sw / 2 + tol && Math.abs(ly - sy) <= sh / 2 + tol) {
              hit = true
              break
            }
          } else if (shape.kind === 'circle') {
            const sx = shape.cx * mmToScreen * mirrorFactor
            const sy = -shape.cy * mmToScreen
            const sr = shape.r * mmToScreen
            if (Math.hypot(lx - sx, ly - sy) <= sr + tol) {
              hit = true
              break
            }
          }
        }

        if (hit && (!closest || dist < closest.dist)) {
          closest = { designator: comp.designator, dist }
          continue
        }
      }
    }

    // Fallback: center-dot hit test (works for unknown packages and as a safety net)
    if (dist <= PNP_HIT_RADIUS && (!closest || dist < closest.dist)) {
      closest = { designator: comp.designator, dist }
    }
  }

  return closest?.designator ?? null
}

// ── Set-origin mode: snap infrastructure ──

const SNAP_THRESHOLD_PX = 10

function screenToGerber(sx: number, sy: number, t: { offsetX: number; offsetY: number; scale: number }) {
  return {
    x: (sx - t.offsetX) / t.scale,
    y: (t.offsetY - sy) / t.scale,
  }
}

function gerberToScreen(gx: number, gy: number, t: { offsetX: number; offsetY: number; scale: number }) {
  return {
    sx: t.offsetX + gx * t.scale,
    sy: t.offsetY - gy * t.scale,
  }
}

/**
 * Find the nearest snap point to a Gerber position from the measure tool's snap targets.
 * Returns the snapped Gerber coordinate, or null if no snap found.
 */
function findSnapForOrigin(
  gerberPos: { x: number; y: number },
  transform: { offsetX: number; offsetY: number; scale: number },
): { x: number; y: number } | null {
  if (!props.measure) return null
  const cursorScreen = gerberToScreen(gerberPos.x, gerberPos.y, transform)

  const snapTargets = props.measure.snapTargets.value
  if (!snapTargets || snapTargets.length === 0) return null

  let best: { x: number; y: number } | null = null
  let bestDist = SNAP_THRESHOLD_PX

  for (const sp of snapTargets) {
    const spScreen = gerberToScreen(sp.x, sp.y, transform)
    const dx = spScreen.sx - cursorScreen.sx
    const dy = spScreen.sy - cursorScreen.sy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < bestDist) {
      bestDist = dist
      best = { x: sp.x, y: sp.y }
    }
  }

  return best
}

/** The live cursor position in Gerber coords during set-origin mode */
const originCursorGerber = ref<{ x: number; y: number } | null>(null)
const originActiveSnap = ref<{ x: number; y: number } | null>(null)

/**
 * Convert a Gerber point to screen coordinates, applying mirror.
 */
function gerberToScreenPt(
  gx: number,
  gy: number,
  transform: { offsetX: number; offsetY: number; scale: number },
  cssWidth: number,
  mirrored: boolean,
): { sx: number; sy: number } {
  let sx = transform.offsetX + gx * transform.scale
  const sy = transform.offsetY - gy * transform.scale
  if (mirrored) sx = cssWidth - sx
  return { sx, sy }
}

/**
 * Draw alignment cursor, points, and midpoint line.
 */
function drawAlignOverlay(
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  transform: { offsetX: number; offsetY: number; scale: number },
  mirrored: boolean,
) {
  const mode = props.alignMode
  if (!mode || mode === 'idle') return

  ctx.save()
  if (dpr !== 1) ctx.scale(dpr, dpr)

  const isSnapped = originActiveSnap.value !== null
  const snapColor = '#00FF00'
  const cursorColor = '#00FFFF'
  const activeColor = isSnapped ? snapColor : cursorColor

  // Draw the first alignment click point (for 2-pad mode)
  if (props.alignClickA && (mode === 'align-second')) {
    const ptA = gerberToScreenPt(props.alignClickA.x, props.alignClickA.y, transform, cssWidth, mirrored)

    // Point A marker
    ctx.beginPath()
    ctx.arc(ptA.sx, ptA.sy, 5, 0, Math.PI * 2)
    ctx.fillStyle = snapColor
    ctx.fill()
    ctx.strokeStyle = snapColor
    ctx.lineWidth = 2
    ctx.stroke()

    // If we have a cursor position, draw line from A to cursor and the midpoint
    if (originCursorGerber.value) {
      const ptCursor = gerberToScreenPt(originCursorGerber.value.x, originCursorGerber.value.y, transform, cssWidth, mirrored)

      // Line from A to cursor
      ctx.beginPath()
      ctx.moveTo(ptA.sx, ptA.sy)
      ctx.lineTo(ptCursor.sx, ptCursor.sy)
      ctx.strokeStyle = activeColor
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 3])
      ctx.stroke()
      ctx.setLineDash([])

      // Midpoint
      const midSx = (ptA.sx + ptCursor.sx) / 2
      const midSy = (ptA.sy + ptCursor.sy) / 2

      // Midpoint diamond
      ctx.beginPath()
      ctx.moveTo(midSx, midSy - 6)
      ctx.lineTo(midSx + 6, midSy)
      ctx.lineTo(midSx, midSy + 6)
      ctx.lineTo(midSx - 6, midSy)
      ctx.closePath()
      ctx.strokeStyle = '#FFD700'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.fillStyle = 'rgba(255, 215, 0, 0.3)'
      ctx.fill()

      // Midpoint label
      ctx.font = '10px system-ui, sans-serif'
      ctx.fillStyle = '#FFD700'
      ctx.fillText('center', midSx + 8, midSy - 4)
    }
  }

  // Draw cursor crosshair
  if (originCursorGerber.value) {
    const pt = gerberToScreenPt(originCursorGerber.value.x, originCursorGerber.value.y, transform, cssWidth, mirrored)

    // Crosshair lines
    ctx.strokeStyle = activeColor
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(pt.sx, 0)
    ctx.lineTo(pt.sx, cssHeight)
    ctx.moveTo(0, pt.sy)
    ctx.lineTo(cssWidth, pt.sy)
    ctx.stroke()
    ctx.setLineDash([])

    // Cursor circle
    ctx.beginPath()
    ctx.arc(pt.sx, pt.sy, 5, 0, Math.PI * 2)
    ctx.strokeStyle = activeColor
    ctx.lineWidth = 2
    ctx.stroke()

    // Snap dot
    if (isSnapped) {
      ctx.beginPath()
      ctx.arc(pt.sx, pt.sy, 3, 0, Math.PI * 2)
      ctx.fillStyle = snapColor
      ctx.fill()
    }

    // Label based on mode
    ctx.font = '11px system-ui, sans-serif'
    ctx.fillStyle = activeColor
    const label = mode === 'set-origin' ? '0/0'
      : mode === 'align-single' ? 'center'
      : mode === 'align-first' ? 'pad 1'
      : 'pad 2'
    ctx.fillText(label, pt.sx + 10, pt.sy - 10)
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
    // Only use outline bounds if the outline actually has drawable content and non-degenerate bounds.
    // Some projects contain an "outline" file that plots to an empty tree with bounds [0,0,0,0],
    // which would break auto-fit (everything appears in a corner).
    const ob = outlineTree?.bounds as BoundingBox | undefined
    const outlineHasContent = !!outlineTree && outlineTree.children.length > 0
    const outlineHasValidBounds = !!ob && !isEmpty(ob) && (ob[2] - ob[0]) > 0 && (ob[3] - ob[1]) > 0
    if (outlineHasContent && outlineHasValidBounds) {
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
    drawCanvasGrid({
      ctx,
      cssWidth,
      cssHeight,
      dpr,
      transform,
      mirrored: !!props.mirrored,
      units: detectUnits(),
      gridSpacingMm: appSettings.gridSpacingMm,
      isLight: isLight.value,
    })
  }

  // ── Layer composite with caching ──
  const cacheKey = computeSceneCacheKey()
  const canUseCache = isInteracting.value
    && sceneCache
    && sceneCache.key === cacheKey
    && sceneCache.width === canvas.width
    && sceneCache.height === canvas.height
    && sceneCache.dpr === dpr

  if (canUseCache && sceneCache) {
    // Reproject the cached scene with a delta-transform (single drawImage call)
    const ct = sceneCache.transform
    const r = transform.scale / ct.scale
    const tx = (transform.offsetX - r * ct.offsetX) * dpr
    const ty = (transform.offsetY - r * ct.offsetY) * dpr

    ctx.save()
    if (props.mirrored) {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.translate(tx, ty)
    ctx.scale(r, r)
    ctx.drawImage(sceneCache.canvas, 0, 0)
    ctx.restore()
  } else {
    // Full render — build scene and update cache
    let sceneCanvas: HTMLCanvasElement

    if (isRealistic) {
      // ── Realistic rendering mode ──
      const side = props.activeFilter === 'bot' ? 'bottom' : 'top'
      const realisticLayers = gatherRealisticLayers(side)

      sceneCanvas = acquireCanvas(canvas.width, canvas.height)

      renderRealisticView(realisticLayers, sceneCanvas, {
        preset: props.preset!,
        transform,
        dpr,
        side,
      })

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
      sceneCanvas = acquireCanvas(canvas.width, canvas.height)
      const sceneCtx = sceneCanvas.getContext('2d')!

      for (const { layer, tree } of layerTrees) {
        const tempCanvas = acquireCanvas(canvas.width, canvas.height)

        renderToCanvas(tree, tempCanvas, {
          color: layer.color,
          transform,
          dpr,
        })

        sceneCtx.drawImage(tempCanvas, 0, 0)
        releaseCanvas(tempCanvas)
      }

      if (props.cropToOutline && props.outlineLayer) {
        const outlineTree = getImageTree(props.outlineLayer)
        if (outlineTree && outlineTree.children.length > 0) {
          const maskCanvas = acquireCanvas(canvas.width, canvas.height)

          renderOutlineMask(outlineTree, maskCanvas, {
            color: '#ffffff',
            transform,
            dpr,
          })

          sceneCtx.globalCompositeOperation = 'destination-in'
          sceneCtx.drawImage(maskCanvas, 0, 0)
          sceneCtx.globalCompositeOperation = 'source-over'

          releaseCanvas(maskCanvas)
        }
      }

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

    // Update the scene cache (take ownership of the canvas — don't release it)
    if (sceneCache) releaseCanvas(sceneCache.canvas)
    sceneCache = {
      canvas: sceneCanvas,
      transform: { ...transform },
      dpr,
      width: canvas.width,
      height: canvas.height,
      key: cacheKey,
    }
  }

  // Component overlays (footprints + markers) — always draw.
  // The layer cache above handles the expensive gerber re-rendering;
  // these are lightweight per-component shapes (rects/arcs).
  drawPackageFootprints(ctx, cssWidth, dpr, transform, !!props.mirrored)

  drawPnPMarkers(ctx, cssWidth, dpr, transform, !!props.mirrored, {
    hideDotWhenPackagePresent: true,
    includePackages: !!props.showPackages,
  })

  drawAlignOverlay(ctx, cssWidth, cssHeight, dpr, transform, !!props.mirrored)
}

// ── rAF-coalesced redraw ──
let rafId = 0
function scheduleRedraw() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    draw()
  })
}

// Redraw when interaction ends (to restore footprints/markers)
watch(
  () => props.interaction.isDragging.value,
  (dragging) => { if (!dragging) scheduleRedraw() },
)

// Watch for layer or transform changes and redraw
watch(
  () => [props.layers, props.allLayers, props.interaction.transform.value, props.mirrored, props.cropToOutline, props.outlineLayer, props.viewMode, props.preset, bgColor.value, appSettings.gridEnabled, appSettings.gridSpacingMm, props.pnpComponents, props.selectedPnpDesignator, props.pnpOriginX, props.pnpOriginY, props.alignMode, props.alignClickA, originCursorGerber.value, props.showPackages, props.pnpConvention, props.matchPackage, props.packageLibraryVersion],
  () => scheduleRedraw(),
  { deep: true },
)

onMounted(() => {
  draw()
  const observer = new ResizeObserver(() => {
    autoFitDone.value = false
    scheduleRedraw()
  })
  if (canvasEl.value?.parentElement) {
    observer.observe(canvasEl.value.parentElement)
  }
  onUnmounted(() => {
    observer.disconnect()
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0 }
  })
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
    const b = tree?.bounds as BoundingBox | undefined
    if (tree && tree.children.length > 0 && b && !isEmpty(b) && (b[2] - b[0]) > 0 && (b[3] - b[1]) > 0) {
      return b as [number, number, number, number]
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
      const side = props.activeFilter === 'bot' ? 'bottom' : 'top'
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
 * Export a specific side ('top' | 'bottom') as PNG, optionally including component overlays.
 * Used by the image export modal (can export both sides regardless of current view).
 */
function exportPngForSide(
  side: 'top' | 'bottom',
  options?: {
    targetMaxPx?: number
    includeComponents?: boolean
    components?: EditablePnPComponent[]
    includePackages?: boolean
  },
): Promise<Blob | null> {
  const targetMaxPx = options?.targetMaxPx ?? 4096
  const includeComponents = !!options?.includeComponents
  const components = options?.components ?? []
  const includePackages = options?.includePackages ?? !!props.showPackages
  const mirrorX = side === 'bottom'

  return new Promise((resolve) => {
    const bounds = getExportBounds()
    if (!bounds) return resolve(null)

    const bw = bounds[2] - bounds[0]
    const bh = bounds[3] - bounds[1]
    if (bw <= 0 || bh <= 0) return resolve(null)

    const scaleFactor = Math.min(targetMaxPx / bw, targetMaxPx / bh)
    const canvasW = Math.ceil(bw * scaleFactor)
    const canvasH = Math.ceil(bh * scaleFactor)

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
      ctx.save()
      if (mirrorX) {
        ctx.translate(canvasW, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(sceneCanvas, 0, 0)
      ctx.restore()
    } else {
      // Layer view export (uses currently visible layers)
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

      if (mirrorX) {
        const flipCanvas = document.createElement('canvas')
        flipCanvas.width = canvasW
        flipCanvas.height = canvasH
        const flipCtx = flipCanvas.getContext('2d')!
        flipCtx.translate(canvasW, 0)
        flipCtx.scale(-1, 1)
        flipCtx.drawImage(exportCanvas, 0, 0)
        ctx.clearRect(0, 0, canvasW, canvasH)
        ctx.drawImage(flipCanvas, 0, 0)
      }
    }

    // Optional component overlay (packages under dots)
    if (includeComponents && components.length > 0) {
      const ctx = exportCanvas.getContext('2d')!
      const cssWidth = canvasW
      drawPackageFootprints(ctx, cssWidth, 1, exportTransform, mirrorX, {
        components,
        selectedDesignator: null,
        includePackages,
      })
      drawPnPMarkers(ctx, cssWidth, 1, exportTransform, mirrorX, {
        components,
        selectedDesignator: null,
        hideDotWhenPackagePresent: true,
        includePackages,
      })
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
  invalidateSceneCache()
}

// Expose resetView and export helpers for external use
defineExpose({
  resetView() {
    autoFitDone.value = false
    draw()
  },
  exportPng,
  exportPngForSide,
  getCanvas,
  getRealisticLayersForExport,
  getImageTree,
  invalidateCache,
})
</script>
