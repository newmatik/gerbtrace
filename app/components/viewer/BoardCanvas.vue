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
    @dblclick="onDblClick"
    @contextmenu.prevent
  />
</template>

<script setup lang="ts">
import type { LayerInfo } from '~/utils/gerber-helpers'
import { isPnPLayer } from '~/utils/gerber-helpers'
import { drawCanvasGrid } from '~/utils/canvas-grid'
import type { PcbPreset } from '~/utils/pcb-presets'
import type { ImageTree, BoundingBox } from '@lib/gerber/types'
import { renderToCanvas, renderOutlineMask, computeAutoFitTransform, renderGraphicSubset } from '@lib/renderer/canvas-renderer'
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
import { computeThtFootprint, type THTPackageDefinition, type ColoredFootprintShape } from '~/utils/tht-package-types'

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
  /** Package lookup function — returns definition for a package name (SMD) */
  matchPackage?: (name: string) => PackageDefinition | undefined
  /** THT package lookup function — returns definition for a THT package name */
  matchThtPackage?: (name: string) => import('~/utils/tht-package-types').THTPackageDefinition | undefined
  /** Reactive package-library version token to trigger redraw when package data loads */
  packageLibraryVersion?: number
  /** Whether to render package footprints */
  showPackages?: boolean
  /** PnP orientation convention used in the PnP file */
  pnpConvention?: PnPConvention
  /** Board rotation in degrees (CW). Purely visual — does not modify data. */
  boardRotation?: number
}>()

const emit = defineEmits<{
  pnpClick: [designator: string | null]
  pnpDblclick: [designator: string]
  alignClick: [gerberX: number, gerberY: number]
}>()

const canvasEl = ref<HTMLCanvasElement | null>(null)
const autoFitDone = ref(false)
const currentBounds = ref<[number, number, number, number] | null>(null)

/** Reactive board dimensions in mm — updated on every draw cycle. */
const boardDimensions = ref<{ width: number; height: number } | null>(null)
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
const PERF_ENABLED = import.meta.dev
  && typeof window !== 'undefined'
  && !!(window as any).__GERBTRACE_PERF__
const boardPerf = {
  draws: 0,
  sceneCacheHits: 0,
  sceneCacheBuilds: 0,
}

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
    String(props.boardRotation ?? 0),
  )
  if (props.viewMode === 'realistic') {
    const al = props.allLayers ?? props.layers
    for (const l of al) parts.push(l.file.fileName, l.color)
  }
  return parts.join('|')
}

// ── Board rotation helpers ──

/** Current board rotation in radians */
function getRotationRad(): number {
  const deg = props.boardRotation ?? 0
  return (deg * Math.PI) / 180
}

/**
 * Un-rotate a screen point around the canvas center.
 * Converts a mouse position (in screen/CSS space) into the coordinate
 * system used by the transform, accounting for the visual rotation.
 */
function unrotateScreenPoint(sx: number, sy: number): { x: number; y: number } {
  const deg = props.boardRotation ?? 0
  if (deg === 0) return { x: sx, y: sy }
  const { cssWidth, cssHeight } = getCssDimensions()
  const cx = cssWidth / 2
  const cy = cssHeight / 2
  const rad = -getRotationRad()
  const dx = sx - cx
  const dy = sy - cy
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  }
}

/** Rotate a screen point around the canvas center by board rotation. */
function rotateScreenPoint(sx: number, sy: number, cssWidth: number, cssHeight: number): { x: number; y: number } {
  const deg = props.boardRotation ?? 0
  if (deg === 0) return { x: sx, y: sy }
  const cx = cssWidth / 2
  const cy = cssHeight / 2
  const rad = getRotationRad()
  const dx = sx - cx
  const dy = sy - cy
  return {
    x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
  }
}

function invalidateSceneCache() {
  sceneCache = null
}

function layerSignature(layers: LayerInfo[]): string {
  return layers.map(layer => `${layer.file.fileName}:${layer.visible ? 1 : 0}:${layer.color}`).join('|')
}

function allLayerSignature(layers: LayerInfo[] | undefined): string {
  if (!layers || layers.length === 0) return ''
  return layers.map(layer => `${layer.file.fileName}:${layer.color}`).join('|')
}

function componentSignature(components: EditablePnPComponent[] | undefined): string {
  if (!components || components.length === 0) return ''
  return components.map(comp => [
    comp.key,
    comp.matchedPackage || comp.package,
    comp.x,
    comp.y,
    comp.rotation,
    comp.side,
    comp.componentType,
    comp.polarized ? 1 : 0,
  ].join(':')).join('|')
}

function isCircleVisible(
  x: number,
  y: number,
  radius: number,
  width: number,
  height: number,
): boolean {
  return !(x + radius < 0 || x - radius > width || y + radius < 0 || y - radius > height)
}

// ── Reusable offscreen-canvas pool ──
const _canvasPool: HTMLCanvasElement[] = []

function acquireCanvas(w: number, h: number): HTMLCanvasElement {
  const c = _canvasPool.pop() || document.createElement('canvas')
  const ctx = c.getContext('2d')!
  if (c.width !== w || c.height !== h) {
    c.width = w
    c.height = h
  } else {
    ctx.clearRect(0, 0, w, h)
  }
  // Reset context state so prior renders (e.g. composite masks) don't leak
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.setLineDash([])
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
    props.interaction.handleWheel(e, canvasEl.value, props.boardRotation ?? 0)
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
  // Right-click or middle-click: always pan (regardless of active tool)
  if (e.button === 1 || e.button === 2) {
    props.interaction.handleMouseDown(e)
    return
  }
  // Left-click: route to active tool or mode
  if (e.button === 0 && canvasEl.value) {
    // Alignment mode: click with snap
    if (props.alignMode && props.alignMode !== 'idle') {
      const rect = canvasEl.value.getBoundingClientRect()
      const rawSx = e.clientX - rect.left
      const rawSy = e.clientY - rect.top
      const { x: sx, y: sy } = unrotateScreenPoint(rawSx, rawSy)
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
      const rawClickX = e.clientX - rect.left
      const rawClickY = e.clientY - rect.top
      const { x: clickX, y: clickY } = unrotateScreenPoint(rawClickX, rawClickY)
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

function onDblClick(e: MouseEvent) {
  if (e.button !== 0 || !canvasEl.value) return
  if (props.alignMode && props.alignMode !== 'idle') return
  if (props.measure?.active.value || props.info?.active.value || props.deleteTool?.active.value) return
  if (!props.pnpComponents || props.pnpComponents.length === 0) return

  const rect = canvasEl.value.getBoundingClientRect()
  const rawClickX = e.clientX - rect.left
  const rawClickY = e.clientY - rect.top
  const { x: clickX, y: clickY } = unrotateScreenPoint(rawClickX, rawClickY)
  const { cssWidth } = getCssDimensions()
  const hit = hitTestPnP(clickX, clickY, cssWidth, props.interaction.transform.value, !!props.mirrored)
  if (hit) emit('pnpDblclick', hit)
}

function onMouseMove(e: MouseEvent) {
  // Always update pan if dragging (right-click drag)
  props.interaction.handleMouseMove(e, { invertPanX: !!props.mirrored, rotationDeg: props.boardRotation ?? 0 })

  // Alignment mode: track cursor with snap
  if (props.alignMode && props.alignMode !== 'idle' && canvasEl.value) {
    const rect = canvasEl.value.getBoundingClientRect()
    const rawSx = e.clientX - rect.left
    const rawSy = e.clientY - rect.top
    const { x: sx, y: sy } = unrotateScreenPoint(rawSx, rawSy)
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
  cssHeight: number,
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
    const rotatedDot = rotateScreenPoint(screenX, screenY, cssWidth, cssHeight)
    if (!isCircleVisible(rotatedDot.x, rotatedDot.y, PNP_DOT_RADIUS + 6, cssWidth, cssHeight)) continue

    const isSelected = (options?.selectedDesignator ?? props.selectedPnpDesignator) === comp.designator

    // If a footprint package is renderable, suppress the center dot (but keep dots for unknown packages).
    if (options?.hideDotWhenPackagePresent) {
      const includePkgs = options.includePackages ?? !!props.showPackages
      if (includePkgs) {
        const pkgName = comp.matchedPackage || comp.package
        const isTht = (comp as any).componentType === 'tht'
        let hasPkg = false
        if (isTht && props.matchThtPackage) {
          hasPkg = !!props.matchThtPackage(pkgName)
        } else if (props.matchPackage) {
          hasPkg = !!(pkgName ? props.matchPackage(pkgName) : undefined)
        }
        if (hasPkg) {
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
 * Compute the radius of the smallest circle centered at (0,0) that contains
 * all footprint shapes. Rotation-invariant; used to estimate how far a
 * component extends from its placement center for export bounds computation.
 */
function computePkgExtent(shapes: FootprintShape[]): number {
  let maxDist = 0
  for (const shape of shapes) {
    if (shape.kind === 'circle') {
      const dist = Math.sqrt(shape.cx * shape.cx + shape.cy * shape.cy) + shape.r
      maxDist = Math.max(maxDist, dist)
    } else {
      const hw = shape.w / 2
      const hh = shape.h / 2
      for (const dx of [-hw, hw]) {
        for (const dy of [-hh, hh]) {
          const x = shape.cx + dx
          const y = shape.cy + dy
          maxDist = Math.max(maxDist, Math.sqrt(x * x + y * y))
        }
      }
    }
  }
  return maxDist
}

// THT footprint shape cache (uses ColoredFootprintShape which extends FootprintShape)
const thtFootprintCache = new Map<string, ColoredFootprintShape[]>()

function getThtFootprint(pkg: THTPackageDefinition): ColoredFootprintShape[] {
  const key = `tht:${pkg.name}`
  if (thtFootprintCache.has(key)) return thtFootprintCache.get(key)!
  const shapes = computeThtFootprint(pkg)
  thtFootprintCache.set(key, shapes)
  return shapes
}

// Flush footprint caches when package library version changes (add/update/delete)
watch(() => props.packageLibraryVersion, () => {
  footprintCache.clear()
  thtFootprintCache.clear()
})

/**
 * Draw package footprints (body + pads) for PnP components.
 * Renders underneath the PnP center dots.
 */
function drawPackageFootprints(
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  cssHeight: number,
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
  if (!components || components.length === 0 || !includePackages) return
  if (!props.matchPackage && !props.matchThtPackage) return

  const units = detectUnits()
  const { ox, oy } = getEffectiveOrigin()

  // Scale factor: mm -> screen pixels
  const mmToGerber = units === 'in' ? 1 / 25.4 : 1
  const mmToScreen = mmToGerber * transform.scale

  ctx.save()
  if (dpr !== 1) ctx.scale(dpr, dpr)

  for (const comp of components) {
    const pkgName = comp.matchedPackage || comp.package
    const isTht = comp.componentType === 'tht'

    let shapes: FootprintShape[]
    let rotRad: number

    if (isTht && props.matchThtPackage) {
      const thtPkg = props.matchThtPackage(pkgName)
      if (!thtPkg) continue
      shapes = getThtFootprint(thtPkg)
      // Apply PnP convention rotation for THT components
      const thtDirection = (props.pnpConvention ?? 'iec61188') === 'mycronic' ? -1 : 1
      const rotationCCW = thtDirection * comp.rotation
      rotRad = (-rotationCCW * Math.PI) / 180
    } else if (props.matchPackage) {
      const pkg = props.matchPackage(pkgName)
      if (!pkg) continue
      shapes = getFootprint(pkg)
      // Convert PnP file rotation into our baseline (degrees CCW, top view)
      const { direction, offsetDeg } = getConventionRotationTransform(pkg, props.pnpConvention ?? 'iec61188')
      const adjustedRotationCCW = direction * comp.rotation + offsetDeg
      rotRad = (-adjustedRotationCCW * Math.PI) / 180
    } else {
      continue
    }

    const gx = pnpToGerber(comp.x, ox, units)
    const gy = pnpToGerber(comp.y, oy, units)

    let centerSx = transform.offsetX + gx * transform.scale
    const centerSy = transform.offsetY - gy * transform.scale
    if (mirrored) centerSx = cssWidth - centerSx

    // Mirror flips the rotation direction
    const effectiveRot = mirrored ? -rotRad : rotRad

    const isSelected = (options?.selectedDesignator ?? props.selectedPnpDesignator) === comp.designator
    const extentPx = Math.max(6, computePkgExtent(shapes) * mmToScreen + 12)
    const rotatedCenter = rotateScreenPoint(centerSx, centerSy, cssWidth, cssHeight)
    if (!isCircleVisible(rotatedCenter.x, rotatedCenter.y, extentPx, cssWidth, cssHeight)) continue

    ctx.save()
    ctx.translate(centerSx, centerSy)
    ctx.rotate(effectiveRot)

    // Draw each shape
    for (const shape of shapes) {
      drawFootprintShape(ctx, shape, mmToScreen, mirrored, isSelected, comp.polarized)
    }
    if (!isTht && comp.polarized && props.matchPackage) {
      const pkg = props.matchPackage(pkgName)
      if (pkg && isLedPackage(pkg, comp.package)) {
        drawLedPolarityLabels(ctx, shapes, mmToScreen, mirrored)
      }
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
 * Ensure a CSS color has the desired alpha. If the color is a hex (#rrggbb)
 * or named color without alpha, wrap it in rgba with the given alpha.
 */
function withAlpha(color: string, alpha: number): string {
  // Already has alpha (rgba / hsla)
  if (color.startsWith('rgba') || color.startsWith('hsla')) return color
  // Hex color
  const hex = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (hex) {
    const r = parseInt(hex[1]!, 16)
    const g = parseInt(hex[2]!, 16)
    const b = parseInt(hex[3]!, 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  // Short hex
  const shex = color.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i)
  if (shex) {
    const r = parseInt(shex[1]! + shex[1]!, 16)
    const g = parseInt(shex[2]! + shex[2]!, 16)
    const b = parseInt(shex[3]! + shex[3]!, 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return color
}

/**
 * Draw a single footprint shape at the current transform.
 * Coordinates are in mm, scaled by mmToScreen.
 *
 * Supports per-shape color overrides via `fillColor` and `strokeColorOverride`
 * properties (used by THT component packages). If absent, uses default constants.
 * Custom colors are blended with the same alpha as the default SMD colors.
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
  // Per-shape color overrides (from THT packages via ColoredFootprintShape)
  // Apply matching alpha so THT components render at the same transparency as SMD
  const rawFill = (shape as any).fillColor as string | undefined
  const rawStroke = (shape as any).strokeColorOverride as string | undefined
  const role0 = shape.role
  const bodyAlpha = 0.85
  const padAlpha = 0.9
  const pin1Alpha = 0.95
  const strokeAlpha = 0.9
  const a = role0 === 'body' ? bodyAlpha : role0 === 'pin1' ? pin1Alpha : padAlpha
  const customFill = rawFill ? withAlpha(rawFill, a) : undefined
  const customStroke = rawStroke ? withAlpha(rawStroke, strokeAlpha) : undefined

  if (shape.kind === 'rect') {
    const sx = shape.cx * mmToScreen * mirrorFactor
    const sy = -shape.cy * mmToScreen
    const sw = shape.w * mmToScreen
    const sh = shape.h * mmToScreen

    const role = (!polarized && shape.role === 'pin1') ? 'pad' : shape.role

    if (role === 'body') {
      ctx.fillStyle = isSelected ? PKG_BODY_FILL_SEL : (customFill || PKG_BODY_FILL)
      ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh)
      ctx.strokeStyle = isSelected ? PKG_BODY_STROKE_SEL : (customStroke || PKG_BODY_STROKE)
      ctx.lineWidth = 1
      ctx.strokeRect(sx - sw / 2, sy - sh / 2, sw, sh)
    } else if (role === 'pad') {
      ctx.fillStyle = isSelected ? PKG_PAD_FILL_SEL : (customFill || PKG_PAD_FILL)
      ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh)
    } else if (role === 'pin1') {
      ctx.fillStyle = isSelected ? PKG_PIN1_FILL_SEL : (customFill || PKG_PIN1_FILL)
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
      ctx.fillStyle = isSelected ? PKG_BODY_FILL_SEL : (customFill || PKG_BODY_FILL)
      ctx.fill()
      ctx.strokeStyle = isSelected ? PKG_BODY_STROKE_SEL : (customStroke || PKG_BODY_STROKE)
      ctx.lineWidth = 1
      ctx.stroke()
    } else if (role === 'pad') {
      ctx.beginPath()
      ctx.arc(sx, sy, Math.max(sr, 0.5), 0, Math.PI * 2)
      ctx.fillStyle = isSelected ? PKG_PAD_FILL_SEL : (customFill || PKG_PAD_FILL)
      ctx.fill()
    } else if (role === 'pin1') {
      ctx.beginPath()
      ctx.arc(sx, sy, Math.max(sr, 0.5), 0, Math.PI * 2)
      ctx.fillStyle = isSelected ? PKG_PIN1_FILL_SEL : (customFill || PKG_PIN1_FILL)
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

    if (shape.role === 'body') {
      ctx.fillStyle = isSelected ? PKG_BODY_FILL_SEL : (customFill || PKG_BODY_FILL)
      ctx.fill()
      ctx.strokeStyle = isSelected ? PKG_BODY_STROKE_SEL : (customStroke || PKG_BODY_STROKE)
      ctx.lineWidth = 1
      ctx.stroke()
    } else {
      ctx.fillStyle = isSelected ? PKG_PAD_FILL_SEL : (customFill || PKG_PAD_FILL)
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

// ── Delete-tool selection highlight ──

const DELETE_HIGHLIGHT_COLOR = '#ffffff'
const DELETE_HIGHLIGHT_ALPHA = 0.55

/**
 * Draw a translucent white overlay on graphics that are pending deletion.
 * This gives the user a clear visual indicator of which objects are selected
 * (similar to Gerbv's highlight behaviour).
 */
function drawDeleteHighlights(
  ctx: CanvasRenderingContext2D,
  cssWidth: number,
  dpr: number,
  transform: { offsetX: number; offsetY: number; scale: number },
  mirrored: boolean,
) {
  const pending = props.deleteTool?.pendingDeletion.value
  if (!pending) return

  ctx.save()
  if (dpr !== 1) ctx.scale(dpr, dpr)

  if (mirrored) {
    ctx.translate(cssWidth, 0)
    ctx.scale(-1, 1)
  }

  ctx.translate(transform.offsetX, transform.offsetY)
  ctx.scale(transform.scale, -transform.scale)

  ctx.globalAlpha = DELETE_HIGHLIGHT_ALPHA

  for (const pendingLayer of pending.layers) {
    if (!pendingLayer.selected) continue

    const layer = props.layers.find(l => l.file.fileName === pendingLayer.layerName)
    if (!layer) continue

    const tree = getImageTree(layer)
    if (!tree) continue

    renderGraphicSubset(tree, pendingLayer.graphicIndices, ctx, DELETE_HIGHLIGHT_COLOR, transform.scale)
  }

  ctx.restore()
}

function draw() {
  const perfStart = PERF_ENABLED ? performance.now() : 0
  const canvas = canvasEl.value
  if (!canvas) return

  const dpr = sizeCanvas()
  const { cssWidth, cssHeight } = getCssDimensions()

  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const isRealistic = props.viewMode === 'realistic' && props.preset

  // Fill background — use a soft workspace tone in realistic mode so the
  // area outside the board doesn't look like a harsh void.
  const effectiveBg = isRealistic
    ? (isLight.value ? '#e8e8ec' : '#1a1a1e')
    : bgColor.value
  ctx.fillStyle = effectiveBg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

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

  // Update reactive board dimensions (mm) from the export-quality bounds
  const dimBounds = getExportBounds()
  if (dimBounds) {
    const bw = dimBounds[2] - dimBounds[0]
    const bh = dimBounds[3] - dimBounds[1]
    if (bw > 0 && bh > 0) {
      const toMm = detectUnits() === 'in' ? 25.4 : 1
      boardDimensions.value = { width: bw * toMm, height: bh * toMm }
    } else {
      boardDimensions.value = null
    }
  } else {
    boardDimensions.value = null
  }

  // Auto-fit on first render, when bounds change, or when reset is requested (scale <= 0)
  const rotDeg = props.boardRotation ?? 0
  const rotRad = getRotationRad()
  const needsAutoFit = !autoFitDone.value || props.interaction.transform.value.scale <= 0
  const boundsChanged = fitBounds.join(',') !== currentBounds.value?.join(',')
  if (needsAutoFit || boundsChanged) {
    let effectiveBounds = fitBounds
    // When rotated, compute the enlarged bounding box so auto-fit accommodates the rotation
    if (rotDeg !== 0) {
      const gerberW = fitBounds[2] - fitBounds[0]
      const gerberH = fitBounds[3] - fitBounds[1]
      const absC = Math.abs(Math.cos(rotRad))
      const absS = Math.abs(Math.sin(rotRad))
      const rotW = gerberW * absC + gerberH * absS
      const rotH = gerberW * absS + gerberH * absC
      const cx = (fitBounds[0] + fitBounds[2]) / 2
      const cy = (fitBounds[1] + fitBounds[3]) / 2
      effectiveBounds = [cx - rotW / 2, cy - rotH / 2, cx + rotW / 2, cy + rotH / 2] as [number, number, number, number]
    }
    const fit = computeAutoFitTransform(cssWidth, cssHeight, effectiveBounds)
    props.interaction.transform.value = fit
    autoFitDone.value = true
    currentBounds.value = fitBounds
  }

  const transform = props.interaction.transform.value

  // ── Apply board rotation around the canvas center ──
  // All subsequent drawing (grid, scene, overlays) happens within this
  // rotated context. The rotation is purely visual and does not modify data.
  if (rotDeg !== 0) {
    ctx.save()
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate(rotRad)
    ctx.translate(-canvas.width / 2, -canvas.height / 2)
  }

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

  // ── Overscan: render 10 % extra on each side so panning doesn't
  //    immediately expose bare background at the edges. ──
  const OVERSCAN = 0.10
  const overscanW = Math.ceil(canvas.width * (1 + 2 * OVERSCAN))
  const overscanH = Math.ceil(canvas.height * (1 + 2 * OVERSCAN))
  const marginCssX = cssWidth * OVERSCAN
  const marginCssY = cssHeight * OVERSCAN

  // Composite a scene canvas onto the main canvas using a delta-transform.
  // Used identically for fresh renders and cached reprojection.
  function blitScene(
    scene: HTMLCanvasElement,
    sceneTransform: { offsetX: number; offsetY: number; scale: number },
  ) {
    const r = transform.scale / sceneTransform.scale
    const tx = (transform.offsetX - r * sceneTransform.offsetX) * dpr
    const ty = (transform.offsetY - r * sceneTransform.offsetY) * dpr
    ctx.save()
    if (props.mirrored) {
      ctx.translate(canvas!.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.translate(tx, ty)
    ctx.scale(r, r)
    ctx.drawImage(scene, 0, 0)
    ctx.restore()
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
    blitScene(sceneCache.canvas, sceneCache.transform)
    boardPerf.sceneCacheHits++
  } else {
    // Full render — build overscan scene and update cache
    const osTransform = {
      offsetX: transform.offsetX + marginCssX,
      offsetY: transform.offsetY + marginCssY,
      scale: transform.scale,
    }

    let sceneCanvas: HTMLCanvasElement

    if (isRealistic) {
      // ── Realistic rendering mode ──
      const side = props.activeFilter === 'bot' ? 'bottom' : 'top'
      const realisticLayers = gatherRealisticLayers(side)

      sceneCanvas = acquireCanvas(overscanW, overscanH)

      renderRealisticView(realisticLayers, sceneCanvas, {
        preset: props.preset!,
        transform: osTransform,
        dpr,
        side,
      })
    } else {
      // ── Standard layer rendering mode ──
      sceneCanvas = acquireCanvas(overscanW, overscanH)
      const sceneCtx = sceneCanvas.getContext('2d')!

      for (const { layer, tree } of layerTrees) {
        const tempCanvas = acquireCanvas(overscanW, overscanH)

        renderToCanvas(tree, tempCanvas, {
          color: layer.color,
          transform: osTransform,
          dpr,
        })

        sceneCtx.drawImage(tempCanvas, 0, 0)
        releaseCanvas(tempCanvas)
      }

      if (props.cropToOutline && props.outlineLayer) {
        const outlineTree = getImageTree(props.outlineLayer)
        if (outlineTree && outlineTree.children.length > 0) {
          const maskCanvas = acquireCanvas(overscanW, overscanH)

          renderOutlineMask(outlineTree, maskCanvas, {
            color: '#ffffff',
            transform: osTransform,
            dpr,
          })

          sceneCtx.globalCompositeOperation = 'destination-in'
          sceneCtx.drawImage(maskCanvas, 0, 0)
          sceneCtx.globalCompositeOperation = 'source-over'

          releaseCanvas(maskCanvas)
        }
      }
    }

    blitScene(sceneCanvas, osTransform)

    // Update the scene cache (take ownership of the canvas — don't release it)
    if (sceneCache) releaseCanvas(sceneCache.canvas)
    sceneCache = {
      canvas: sceneCanvas,
      transform: { ...osTransform },
      dpr,
      width: canvas.width,
      height: canvas.height,
      key: cacheKey,
    }
    boardPerf.sceneCacheBuilds++
  }

  // Highlight selected objects (delete tool pending selection)
  drawDeleteHighlights(ctx, cssWidth, dpr, transform, !!props.mirrored)

  // Component overlays (footprints + markers) — always draw.
  // The layer cache above handles the expensive gerber re-rendering;
  // these are lightweight per-component shapes (rects/arcs).
  drawPackageFootprints(ctx, cssWidth, cssHeight, dpr, transform, !!props.mirrored)

  drawPnPMarkers(ctx, cssWidth, cssHeight, dpr, transform, !!props.mirrored, {
    hideDotWhenPackagePresent: true,
    includePackages: !!props.showPackages,
  })

  drawAlignOverlay(ctx, cssWidth, cssHeight, dpr, transform, !!props.mirrored)

  // Close the board rotation context
  if (rotDeg !== 0) {
    ctx.restore()
  }
  if (PERF_ENABLED) {
    boardPerf.draws++
    if (boardPerf.draws % 120 === 0) {
      const took = performance.now() - perfStart
      console.debug('[BoardCanvas][perf]', {
        drawMs: Number(took.toFixed(2)),
        draws: boardPerf.draws,
        sceneCacheHits: boardPerf.sceneCacheHits,
        sceneCacheBuilds: boardPerf.sceneCacheBuilds,
      })
    }
  }
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

// Re-fit the board when rotation changes
watch(
  () => props.boardRotation,
  () => {
    invalidateSceneCache()
    autoFitDone.value = false
    scheduleRedraw()
  },
)

watch(
  () => `${props.interaction.transform.value.offsetX}|${props.interaction.transform.value.offsetY}|${props.interaction.transform.value.scale}|${props.mirrored ? 1 : 0}|${appSettings.gridEnabled ? 1 : 0}|${appSettings.gridSpacingMm}|${bgColor.value}`,
  () => scheduleRedraw(),
)

watch(
  () => `${props.viewMode ?? 'layers'}|${props.preset?.name ?? ''}|${props.cropToOutline ? 1 : 0}|${props.outlineLayer?.file.fileName ?? ''}|${props.activeFilter ?? 'all'}|${layerSignature(props.layers)}|${allLayerSignature(props.allLayers)}`,
  () => {
    invalidateSceneCache()
    scheduleRedraw()
  },
)

watch(
  () => `${componentSignature(props.pnpComponents)}|${props.selectedPnpDesignator ?? ''}|${props.showPackages ? 1 : 0}|${props.pnpConvention ?? 'iec61188'}|${props.packageLibraryVersion ?? 0}|${props.pnpOriginX ?? ''}|${props.pnpOriginY ?? ''}`,
  () => scheduleRedraw(),
)

watch(
  () => `${props.alignMode ?? 'idle'}|${props.alignClickA?.x ?? ''}|${props.alignClickA?.y ?? ''}|${originCursorGerber.value?.x ?? ''}|${originCursorGerber.value?.y ?? ''}`,
  () => scheduleRedraw(),
)

watch(
  () => `${props.deleteTool?.pendingDeletion.value ?? ''}`,
  () => scheduleRedraw(),
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

/** Maximum canvas dimension to prevent browser memory issues */
const MAX_CANVAS_PX = 16384

/**
 * Convert a DPI value to a scale factor (pixels per Gerber coordinate unit).
 */
function dpiToScaleFactor(dpi: number): number {
  const units = detectUnits()
  return units === 'in' ? dpi : dpi / 25.4
}

/**
 * Export the realistic (or layer) view as a PNG blob.
 * Renders to a dedicated offscreen canvas tightly cropped to the board.
 * @param dpi Resolution in dots per inch (default 600)
 */
function exportPng(dpi: number = 600): Promise<Blob | null> {
  return new Promise((resolve) => {
    const bounds = getExportBounds()
    if (!bounds) return resolve(null)

    const bw = bounds[2] - bounds[0]
    const bh = bounds[3] - bounds[1]
    if (bw <= 0 || bh <= 0) return resolve(null)

    const expRotDeg = props.boardRotation ?? 0
    const expRotRad = (expRotDeg * Math.PI) / 180

    // Compute effective dimensions after rotation
    const absC = Math.abs(Math.cos(expRotRad))
    const absS = Math.abs(Math.sin(expRotRad))
    const effectiveW = expRotDeg !== 0 ? bw * absC + bh * absS : bw
    const effectiveH = expRotDeg !== 0 ? bw * absS + bh * absC : bh

    // Compute scale from DPI, capped to MAX_CANVAS_PX
    const idealScale = dpiToScaleFactor(dpi)
    const scaleFactor = Math.min(idealScale, MAX_CANVAS_PX / effectiveW, MAX_CANVAS_PX / effectiveH)
    const canvasW = Math.ceil(effectiveW * scaleFactor)
    const canvasH = Math.ceil(effectiveH * scaleFactor)

    // Center the board in the export canvas (works for both rotated and unrotated)
    const gerberCX = (bounds[0] + bounds[2]) / 2
    const gerberCY = (bounds[1] + bounds[3]) / 2
    const exportTransform = {
      offsetX: canvasW / 2 - gerberCX * scaleFactor,
      offsetY: canvasH / 2 + gerberCY * scaleFactor,
      scale: scaleFactor,
    }

    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = canvasW
    exportCanvas.height = canvasH

    const isRealistic = props.viewMode === 'realistic' && props.preset

    // Helper to apply rotation to an export context
    const applyExportRotation = (c: CanvasRenderingContext2D) => {
      if (expRotDeg !== 0) {
        c.translate(canvasW / 2, canvasH / 2)
        c.rotate(expRotRad)
        c.translate(-canvasW / 2, -canvasH / 2)
      }
    }

    if (isRealistic) {
      const side = props.activeFilter === 'bot' ? 'bottom' : 'top'
      const realisticLayers = gatherRealisticLayers(side)

      const sceneCanvas = document.createElement('canvas')
      sceneCanvas.width = canvasW
      sceneCanvas.height = canvasH

      const sceneCtx = sceneCanvas.getContext('2d')!
      sceneCtx.save()
      applyExportRotation(sceneCtx)

      renderRealisticView(realisticLayers, sceneCanvas, {
        preset: props.preset!,
        transform: exportTransform,
        dpr: 1,
        side,
      })

      sceneCtx.restore()

      const ctx = exportCanvas.getContext('2d')!
      if (props.mirrored) {
        ctx.translate(canvasW, 0)
        ctx.scale(-1, 1)
      }
      ctx.drawImage(sceneCanvas, 0, 0)
    } else {
      // Layer view export
      const ctx = exportCanvas.getContext('2d')!

      ctx.save()
      applyExportRotation(ctx)

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

      ctx.restore()

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
    dpi?: number
    includeComponents?: boolean
    components?: EditablePnPComponent[]
    includePackages?: boolean
  },
): Promise<Blob | null> {
  const dpi = options?.dpi ?? 600
  const includeComponents = !!options?.includeComponents
  const components = options?.components ?? []
  const includePackages = options?.includePackages ?? !!props.showPackages
  const mirrorX = side === 'bottom'

  return new Promise((resolve) => {
    const boardBounds = getExportBounds()
    if (!boardBounds) return resolve(null)

    // Start with board bounds; expand to include component extents if needed
    let bMinX = boardBounds[0], bMinY = boardBounds[1]
    let bMaxX = boardBounds[2], bMaxY = boardBounds[3]

    if (includeComponents && components.length > 0) {
      const units = detectUnits()
      const { ox, oy } = getEffectiveOrigin()
      const mmToGerber = units === 'in' ? 1 / 25.4 : 1
      const dotR = 0.20 * mmToGerber

      for (const comp of components) {
        const gx = pnpToGerber(comp.x, ox, units)
        const gy = pnpToGerber(comp.y, oy, units)
        const pkgName = comp.matchedPackage || comp.package
        const isTht = (comp as any).componentType === 'tht'
        let extent = dotR

        if (includePackages && pkgName) {
          if (isTht && props.matchThtPackage) {
            const thtPkg = props.matchThtPackage(pkgName)
            if (thtPkg) {
              extent = Math.max(extent, computePkgExtent(computeThtFootprint(thtPkg)) * mmToGerber)
            }
          } else if (props.matchPackage) {
            const pkg = props.matchPackage(pkgName)
            if (pkg) {
              extent = Math.max(extent, computePkgExtent(computeFootprint(pkg)) * mmToGerber)
            }
          }
        }

        bMinX = Math.min(bMinX, gx - extent)
        bMinY = Math.min(bMinY, gy - extent)
        bMaxX = Math.max(bMaxX, gx + extent)
        bMaxY = Math.max(bMaxY, gy + extent)
      }
    }

    const bw = bMaxX - bMinX
    const bh = bMaxY - bMinY
    if (bw <= 0 || bh <= 0) return resolve(null)

    const expRotDeg = props.boardRotation ?? 0
    const expRotRad = (expRotDeg * Math.PI) / 180
    const absC = Math.abs(Math.cos(expRotRad))
    const absS = Math.abs(Math.sin(expRotRad))
    const effectiveW = expRotDeg !== 0 ? bw * absC + bh * absS : bw
    const effectiveH = expRotDeg !== 0 ? bw * absS + bh * absC : bh

    const idealScale = dpiToScaleFactor(dpi)
    const scaleFactor = Math.min(idealScale, MAX_CANVAS_PX / effectiveW, MAX_CANVAS_PX / effectiveH)
    const canvasW = Math.ceil(effectiveW * scaleFactor)
    const canvasH = Math.ceil(effectiveH * scaleFactor)

    const gerberCX = (bMinX + bMaxX) / 2
    const gerberCY = (bMinY + bMaxY) / 2
    const exportTransform = {
      offsetX: canvasW / 2 - gerberCX * scaleFactor,
      offsetY: canvasH / 2 + gerberCY * scaleFactor,
      scale: scaleFactor,
    }

    const applyExportRot = (c: CanvasRenderingContext2D) => {
      if (expRotDeg !== 0) {
        c.translate(canvasW / 2, canvasH / 2)
        c.rotate(expRotRad)
        c.translate(-canvasW / 2, -canvasH / 2)
      }
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

      const sceneCtx = sceneCanvas.getContext('2d')!
      sceneCtx.save()
      applyExportRot(sceneCtx)

      renderRealisticView(realisticLayers, sceneCanvas, {
        preset: props.preset!,
        transform: exportTransform,
        dpr: 1,
        side,
      })

      sceneCtx.restore()

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

      ctx.save()
      applyExportRot(ctx)

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

      ctx.restore()

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
      ctx.save()
      applyExportRot(ctx)
      const cssWidth = canvasW
      const cssHeight = canvasH
      drawPackageFootprints(ctx, cssWidth, cssHeight, 1, exportTransform, mirrorX, {
        components,
        selectedDesignator: null,
        includePackages,
      })
      drawPnPMarkers(ctx, cssWidth, cssHeight, 1, exportTransform, mirrorX, {
        components,
        selectedDesignator: null,
        hideDotWhenPackagePresent: true,
        includePackages,
      })
      ctx.restore()
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

/**
 * Return the board's physical dimensions in millimeters (for UI display).
 */
function getExportDimensionsMm(): { width: number; height: number } | null {
  const bounds = getExportBounds()
  if (!bounds) return null
  const bw = bounds[2] - bounds[0]
  const bh = bounds[3] - bounds[1]
  if (bw <= 0 || bh <= 0) return null
  const units = detectUnits()
  const toMm = units === 'in' ? 25.4 : 1
  return { width: bw * toMm, height: bh * toMm }
}

function getPerformanceStats() {
  const sceneBytes = sceneCache ? sceneCache.canvas.width * sceneCache.canvas.height * 4 : 0
  return {
    draws: boardPerf.draws,
    sceneCacheHits: boardPerf.sceneCacheHits,
    sceneCacheBuilds: boardPerf.sceneCacheBuilds,
    sceneCache: sceneCache
      ? {
          width: sceneCache.canvas.width,
          height: sceneCache.canvas.height,
          estimatedBytes: sceneBytes,
        }
      : null,
    canvasPoolSize: _canvasPool.length,
    footprintCacheSize: footprintCache.size,
    thtFootprintCacheSize: thtFootprintCache.size,
    parsedLayerCacheSize: imageTreeCache.size,
  }
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
  getExportDimensionsMm,
  getPerformanceStats,
  boardDimensions,
})
</script>
