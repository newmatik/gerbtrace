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
import type { PcbPreset } from '~/utils/pcb-presets'
import type { ImageTree, BoundingBox } from '@lib/gerber/types'
import { renderToCanvas, renderOutlineMask, computeAutoFitTransform } from '@lib/renderer/canvas-renderer'
import { renderRealisticView } from '@lib/renderer/realistic-renderer'
import type { RealisticLayers } from '@lib/renderer/realistic-renderer'
import { parseGerber } from '@lib/gerber'
import { plotImageTree } from '@lib/gerber/plotter'
import { mergeBounds, emptyBounds, isEmpty } from '@lib/gerber/bounding-box'
import type { PnPComponent } from '~/utils/pnp-parser'
import type { AlignMode, AlignPoint } from '~/composables/usePickAndPlace'
import type { PackageDefinition, FootprintShape } from '~/utils/package-types'
import type { PnPConvention } from '~/utils/pnp-conventions'
import { computeFootprint, getConventionRotationTransform } from '~/utils/package-types'

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
  /** Visible PnP components to render as dots */
  pnpComponents?: PnPComponent[]
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

// ── PnP marker rendering ──

/** Radius of PnP center dots in CSS pixels */
const PNP_DOT_RADIUS = 3
/** Hit-test radius for clicking PnP dots (CSS px) */
const PNP_HIT_RADIUS = 8
/** Highlight ring colour for the selected component */
const PNP_HIGHLIGHT_COLOR = '#00FFFF'
/** Default PnP dot color */
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
) {
  const components = props.pnpComponents
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

    const isSelected = props.selectedPnpDesignator === comp.designator

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
) {
  const components = props.pnpComponents
  if (!components || components.length === 0 || !props.matchPackage || !props.showPackages) return

  const units = detectUnits()
  const { ox, oy } = getEffectiveOrigin()

  // Scale factor: mm -> screen pixels
  const mmToGerber = units === 'in' ? 1 / 25.4 : 1
  const mmToScreen = mmToGerber * transform.scale

  ctx.save()
  if (dpr !== 1) ctx.scale(dpr, dpr)

  for (const comp of components) {
    const pkg = props.matchPackage(comp.package)
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
    const { direction, offsetDeg } = getConventionRotationTransform(pkg, props.pnpConvention ?? 'mycronic')
    const adjustedRotationCCW = direction * comp.rotation + offsetDeg

    // Rotation in radians (we keep adjustedRotationCCW in CCW degrees; canvas rotate is visually CW)
    const rotRad = (-adjustedRotationCCW * Math.PI) / 180
    // Mirror flips the rotation direction
    const effectiveRot = mirrored ? -rotRad : rotRad

    const isSelected = props.selectedPnpDesignator === comp.designator

    ctx.save()
    ctx.translate(centerSx, centerSy)
    ctx.rotate(effectiveRot)

    // Draw each shape
    for (const shape of shapes) {
      drawFootprintShape(ctx, shape, mmToScreen, mirrored, isSelected)
    }

    ctx.restore()
  }

  ctx.restore()
}

// ── Package footprint colors ──
const PKG_BODY_FILL = 'rgba(50, 50, 50, 0.85)'
const PKG_BODY_STROKE = 'rgba(80, 80, 80, 0.9)'
const PKG_PAD_FILL = 'rgba(180, 180, 180, 0.8)'
const PKG_PIN1_FILL = 'rgba(255, 60, 60, 0.95)'
const PKG_BODY_FILL_SEL = 'rgba(0, 180, 180, 0.7)'
const PKG_BODY_STROKE_SEL = 'rgba(0, 255, 255, 0.9)'
const PKG_PAD_FILL_SEL = 'rgba(140, 230, 230, 0.8)'
const PKG_PIN1_FILL_SEL = '#FF3333'

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
) {
  const mirrorFactor = mirrored ? -1 : 1

  if (shape.kind === 'rect') {
    const sx = shape.cx * mmToScreen * mirrorFactor
    const sy = -shape.cy * mmToScreen
    const sw = shape.w * mmToScreen
    const sh = shape.h * mmToScreen

    if (shape.role === 'body') {
      ctx.fillStyle = isSelected ? PKG_BODY_FILL_SEL : PKG_BODY_FILL
      ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh)
      ctx.strokeStyle = isSelected ? PKG_BODY_STROKE_SEL : PKG_BODY_STROKE
      ctx.lineWidth = 1
      ctx.strokeRect(sx - sw / 2, sy - sh / 2, sw, sh)
    } else if (shape.role === 'pad') {
      ctx.fillStyle = isSelected ? PKG_PAD_FILL_SEL : PKG_PAD_FILL
      ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh)
    } else if (shape.role === 'pin1') {
      ctx.fillStyle = isSelected ? PKG_PIN1_FILL_SEL : PKG_PIN1_FILL
      ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh)
    }
  } else if (shape.kind === 'circle') {
    const sx = shape.cx * mmToScreen * mirrorFactor
    const sy = -shape.cy * mmToScreen
    const sr = shape.r * mmToScreen

    if (shape.role === 'body') {
      ctx.beginPath()
      ctx.arc(sx, sy, sr, 0, Math.PI * 2)
      ctx.fillStyle = isSelected ? PKG_BODY_FILL_SEL : PKG_BODY_FILL
      ctx.fill()
      ctx.strokeStyle = isSelected ? PKG_BODY_STROKE_SEL : PKG_BODY_STROKE
      ctx.lineWidth = 1
      ctx.stroke()
    } else if (shape.role === 'pad') {
      ctx.beginPath()
      ctx.arc(sx, sy, Math.max(sr, 0.5), 0, Math.PI * 2)
      ctx.fillStyle = isSelected ? PKG_PAD_FILL_SEL : PKG_PAD_FILL
      ctx.fill()
    } else if (shape.role === 'pin1') {
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
 * Hit-test PnP dots at a screen coordinate. Returns the designator
 * of the closest component within hit radius, or null.
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
  let closest: { designator: string; dist: number } | null = null

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
    const dist = Math.sqrt(dx * dx + dy * dy)

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

  // ── Draw package footprints (under the dots) ──
  drawPackageFootprints(ctx, cssWidth, dpr, transform, !!props.mirrored)

  // ── Draw PnP markers on top of everything ──
  drawPnPMarkers(ctx, cssWidth, dpr, transform, !!props.mirrored)

  // ── Draw alignment overlay (crosshair, points, midpoint line) ──
  drawAlignOverlay(ctx, cssWidth, cssHeight, dpr, transform, !!props.mirrored)
}

// Watch for layer or transform changes and redraw
watch(
  () => [props.layers, props.allLayers, props.interaction.transform.value, props.mirrored, props.cropToOutline, props.outlineLayer, props.viewMode, props.preset, bgColor.value, appSettings.gridEnabled, appSettings.gridSpacingMm, props.pnpComponents, props.selectedPnpDesignator, props.pnpOriginX, props.pnpOriginY, props.alignMode, props.alignClickA, originCursorGerber.value, props.showPackages, props.pnpConvention],
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
