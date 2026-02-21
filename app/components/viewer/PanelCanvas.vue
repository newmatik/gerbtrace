<template>
  <div class="relative w-full h-full">
    <canvas
      ref="canvasEl"
      class="w-full h-full"
      :style="{ cursor: canvasCursor }"
      @wheel.prevent="onWheel"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseLeave"
      @contextmenu.prevent
    />
  </div>
</template>

<script setup lang="ts">
import type { LayerInfo } from '~/utils/gerber-helpers'
import { isPnPLayer, getColorForType } from '~/utils/gerber-helpers'
import { drawCanvasGrid } from '~/utils/canvas-grid'
import type { PcbPreset } from '~/utils/pcb-presets'
import type { ImageTree, BoundingBox } from '@lib/gerber/types'
import { renderToCanvas, renderOutlineMask, renderOuterBoundaryOnly, computeAutoFitTransform } from '@lib/renderer/canvas-renderer'
import { renderRealisticView } from '@lib/renderer/realistic-renderer'
import type { RealisticLayers } from '@lib/renderer/realistic-renderer'
import { generateJetprintDots } from '@lib/renderer/jetprint-dots'
import type { PasteSettings } from '~/composables/usePasteSettings'
import { mergeBounds, emptyBounds, isEmpty } from '@lib/gerber/bounding-box'
import type { PanelConfig, DangerZoneConfig, AddedRoutingPath } from '~/utils/panel-types'
import { evenTabPositions } from '~/utils/panel-types'
import { computePanelLayout, type PanelLayout, type TabMarker } from '~/utils/panel-geometry'
import type { EditablePnPComponent } from '~/composables/usePickAndPlace'
import type { PackageDefinition, FootprintShape } from '~/utils/package-types'
import { computeFootprint, getConventionRotationTransform } from '~/utils/package-types'
import { computeThtFootprint, type THTPackageDefinition, type ColoredFootprintShape } from '~/utils/tht-package-types'
import type { PnPConvention } from '~/utils/pnp-conventions'
import { useGerberImageTreeCache } from '~/composables/useGerberImageTreeCache'

export type ViewMode = 'layers' | 'realistic'
type RealisticSide = 'top' | 'bottom' | 'all'

const props = defineProps<{
  layers: LayerInfo[]
  allLayers?: LayerInfo[]
  interaction: ReturnType<typeof useCanvasInteraction>
  mirrored?: boolean
  activeFilter?: 'all' | 'top' | 'bot'
  measure?: ReturnType<typeof useMeasureTool>
  viewMode?: ViewMode
  preset?: PcbPreset
  projectName?: string
  pcbData?: { layerCount?: number; copperWeight?: string; innerCopperWeight?: string } | null
  panelConfig: PanelConfig
  boardSizeMm?: { width: number; height: number } | null
  dangerZone?: DangerZoneConfig
  pnpComponents?: EditablePnPComponent[]
  matchPackage?: (name: string) => PackageDefinition | undefined
  matchThtPackage?: (name: string) => THTPackageDefinition | undefined
  showPackages?: boolean
  pnpConvention?: PnPConvention
  pasteSettings?: PasteSettings
}>()

const emit = defineEmits<{
  (e: 'update:panelConfig', config: PanelConfig): void
}>()

const { backgroundColor, isLight } = useBackgroundColor()
const bgColor = backgroundColor
const { settings: appSettings } = useAppSettings()
const canvasEl = ref<HTMLCanvasElement | null>(null)
const autoFitDone = ref(false)
const currentBounds = ref<[number, number, number, number] | null>(null)
const panelDimensions = ref<{ width: number; height: number } | null>(null)

// ─── Tab dragging state ───
interface TabDragState {
  tab: TabMarker
  /** Snapped normalized position (0-1) */
  currentPos: number
  /** Alignment guide lines to draw (in panel mm) */
  guides: { x1: number; y1: number; x2: number; y2: number }[]
}

interface TabChannel {
  col: number
  row: number
  edge: 'top' | 'bottom' | 'left' | 'right'
  channelId: 'main' | 'pcb-side' | 'opposite-side'
  overrideKey: string
  direction: 'vertical' | 'horizontal'
  edgeStart: number
  edgeLength: number
  gapStart: number
  gapDepth: number
}

interface RoutingSnapGuide {
  id: string
  orientation: 'vertical' | 'horizontal'
  axisMm: number
  rangeStartMm: number
  rangeEndMm: number
}

type TabEditMode = 'off' | 'move' | 'add' | 'delete'
type AddedRoutingEditMode = 'off' | 'add' | 'move' | 'delete'

const tabDrag = ref<TabDragState | null>(null)
const hoveredTab = ref<TabMarker | null>(null)
const tabEditMode = defineModel<TabEditMode>('tabEditMode', { default: 'off' })
const addPreview = ref<{ x: number; y: number; width: number; height: number } | null>(null)
const addedRoutingEditMode = defineModel<AddedRoutingEditMode>('addedRoutingEditMode', { default: 'off' })

function activateTabMode(mode: 'move' | 'add' | 'delete') {
  if (!tabControlEnabled.value) return
  tabEditMode.value = tabEditMode.value === mode ? 'off' : mode
  if (tabEditMode.value !== 'off') addedRoutingEditMode.value = 'off'
}

function activateRoutingMode(mode: 'move' | 'add' | 'delete') {
  addedRoutingEditMode.value = addedRoutingEditMode.value === mode ? 'off' : mode
  if (addedRoutingEditMode.value !== 'off') tabEditMode.value = 'off'
}

watch(tabEditMode, (mode) => {
  if (mode !== 'off' && addedRoutingEditMode.value !== 'off') {
    addedRoutingEditMode.value = 'off'
  }
})

watch(addedRoutingEditMode, (mode) => {
  if (mode !== 'off' && tabEditMode.value !== 'off') {
    tabEditMode.value = 'off'
  }
})

function deactivateAllControls() {
  tabEditMode.value = 'off'
  addedRoutingEditMode.value = 'off'
  addedRoutingStart.value = null
  addedRoutingPreview.value = null
  addedRoutingSnapHover.value = null
  addedRoutingCursorMm.value = null
  hoveredAddedRoutingId.value = null
  addPreview.value = null
  hoveredTab.value = null
}
const addedRoutingStart = ref<{ xMm: number; yMm: number; guide: RoutingSnapGuide } | null>(null)
const addedRoutingPreview = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
const addedRoutingSnapHover = ref<{ xMm: number; yMm: number; guide: RoutingSnapGuide } | null>(null)
const addedRoutingCursorMm = ref<{ xMm: number; yMm: number } | null>(null)
const hoveredAddedRoutingId = ref<string | null>(null)
const addedRoutingDrag = ref<{
  routeId: string
  guide: RoutingSnapGuide
  orientation: 'vertical' | 'horizontal'
  lengthMm: number
  offsetMm: number
  reverse: boolean
  preview: { x1: number; y1: number; x2: number; y2: number }
} | null>(null)

function hasAnyRoutedSeparation(config: PanelConfig): boolean {
  if (config.separationType === 'routed') return true
  if (config.separationType === 'scored') return false
  return config.edges.top.type === 'routed'
    || config.edges.bottom.type === 'routed'
    || config.edges.left.type === 'routed'
    || config.edges.right.type === 'routed'
}

const tabControlEnabled = computed(() => hasAnyRoutedSeparation(props.panelConfig))

const canvasCursor = computed(() => {
  if (props.measure?.active.value) return 'crosshair'
  if (addedRoutingEditMode.value === 'add') return 'crosshair'
  if (addedRoutingEditMode.value === 'move') {
    if (addedRoutingDrag.value) return 'grabbing'
    return hoveredAddedRoutingId.value ? 'grab' : 'default'
  }
  if (addedRoutingEditMode.value === 'delete') return hoveredAddedRoutingId.value ? 'not-allowed' : 'default'
  if (!tabControlEnabled.value || tabEditMode.value === 'off') return ''
  if (tabEditMode.value === 'add') return 'copy'
  if (tabEditMode.value === 'delete') return hoveredTab.value ? 'not-allowed' : 'default'
  if (tabDrag.value) return 'grabbing'
  if (hoveredTab.value) return 'grab'
  return ''
})

// Canvas pool for offscreen rendering
const _canvasPool: HTMLCanvasElement[] = []
const MAX_CANVAS_POOL_SIZE = 8
function acquireCanvas(w: number, h: number): HTMLCanvasElement {
  const c = _canvasPool.pop() || document.createElement('canvas')
  const ctx = c.getContext('2d')!
  if (c.width !== w || c.height !== h) {
    c.width = w
    c.height = h
  } else {
    ctx.clearRect(0, 0, w, h)
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.setLineDash([])
  return c
}
function releaseCanvas(c: HTMLCanvasElement) {
  if (_canvasPool.length >= MAX_CANVAS_POOL_SIZE) {
    c.width = 0
    c.height = 0
    return
  }
  _canvasPool.push(c)
}

function clearCanvasPool() {
  for (const canvas of _canvasPool) {
    canvas.width = 0
    canvas.height = 0
  }
  _canvasPool.length = 0
}

const gerberTreeCache = useGerberImageTreeCache()
const PERF_ENABLED = import.meta.dev
  && typeof window !== 'undefined'
  && !!(window as any).__GERBTRACE_PERF__

const panelPerf = {
  draws: 0,
  pcbTileHits: 0,
  pcbTileBuilds: 0,
  componentTileHits: 0,
  componentTileBuilds: 0,
  dangerTileHits: 0,
  dangerTileBuilds: 0,
}

function resetPanelPerf() {
  panelPerf.draws = 0
  panelPerf.pcbTileHits = 0
  panelPerf.pcbTileBuilds = 0
  panelPerf.componentTileHits = 0
  panelPerf.componentTileBuilds = 0
  panelPerf.dangerTileHits = 0
  panelPerf.dangerTileBuilds = 0
}

interface CachedTile {
  key: string
  canvas: HTMLCanvasElement
}

let pcbTileCache: CachedTile | null = null
let componentTileCache: CachedTile | null = null

function cleanupTileCache(cache: CachedTile | null): null {
  if (cache) releaseCanvas(cache.canvas)
  return null
}

function invalidatePanelRenderCaches() {
  pcbTileCache = cleanupTileCache(pcbTileCache)
  componentTileCache = cleanupTileCache(componentTileCache)
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

function panelComponentsEnabled(): boolean {
  const legacy = props.panelConfig.showComponents === true
  const showSmd = props.panelConfig.showSmdComponents ?? legacy
  const showTht = props.panelConfig.showThtComponents ?? legacy
  return !!(showSmd || showTht)
}

function panelGeometrySignature(): string {
  const cfg = props.panelConfig
  const supports = cfg.supports ?? { enabled: true, xGaps: [], yGaps: [], widthColumns: 0, widthRows: 0 }
  const frame = cfg.frame ?? { enabled: false, widthTop: 0, widthBottom: 0, widthLeft: 0, widthRight: 0 }
  return JSON.stringify({
    board: props.boardSizeMm,
    countX: cfg.countX,
    countY: cfg.countY,
    separationType: cfg.separationType,
    edges: cfg.edges,
    route: cfg.routingToolDiameter,
    rotation: cfg.pcbRotation,
    frame,
    supports,
    fiducials: cfg.fiducials,
    toolingHoles: cfg.toolingHoles,
    tabs: cfg.tabs,
    showSmdComponents: cfg.showSmdComponents,
    showThtComponents: cfg.showThtComponents,
    showComponents: cfg.showComponents,
  })
}

function addedRoutingSignature(paths: AddedRoutingPath[] | undefined): string {
  if (!paths || paths.length === 0) return ''
  return paths.map(path => [
    path.id,
    path.x1,
    path.y1,
    path.x2,
    path.y2,
  ].join(':')).join('|')
}

function getImageTree(layer: LayerInfo): ImageTree | null {
  if (isPnPLayer(layer.type)) return null
  const tree = gerberTreeCache.getOrParseSync(layer)
  if (tree) return tree
  console.warn(`Failed to parse ${layer.file.fileName}`)
  return null
}

function detectUnits(): 'mm' | 'in' {
  for (const layer of props.layers) {
    const tree = getImageTree(layer)
    if (tree) return tree.units
  }
  return 'mm'
}

function detectCopperLayerCount(): number | null {
  const source = props.allLayers ?? props.layers
  const count = source.filter(l => l.type === 'Top Copper' || l.type === 'Bottom Copper' || l.type === 'Inner Layer').length
  return count > 0 ? count : null
}

function copperWeightToUm(weight?: string): number | null {
  if (!weight) return null
  if (weight === '0.5oz') return 18
  if (weight === '1oz') return 35
  if (weight === '2oz') return 70
  return null
}

function formatCopperWeight(weight?: string): string {
  if (!weight) return ''
  if (weight === '0.5oz') return '0.5 oz'
  if (weight === '1oz') return '1 oz'
  if (weight === '2oz') return '2 oz'
  return weight
}

// Mouse event routing
function onWheel(e: WheelEvent) {
  if (canvasEl.value) props.interaction.handleWheel(e, canvasEl.value, 0)
}
function onMouseDown(e: MouseEvent) {
  if (e.button === 1 || e.button === 2) {
    props.interaction.handleMouseDown(e)
    return
  }
  if (e.button === 0 && canvasEl.value) {
    if (props.measure?.active.value) {
      props.measure.handleClick(e, canvasEl.value, props.interaction.transform.value)
      return
    }
    const pt = screenToMm(e.clientX, e.clientY)
    if (pt) {
      if (layout.value) {
        if (addedRoutingEditMode.value === 'delete') {
          const rid = hitTestAddedRouting(pt.xMm, pt.yMm)
          if (rid) {
            removeAddedRouting(rid)
            scheduleRedraw()
            e.preventDefault()
            return
          }
        } else if (addedRoutingEditMode.value === 'move') {
          const rid = hitTestAddedRouting(pt.xMm, pt.yMm)
          if (rid) {
            const route = getAddedRoutingById(rid)
            const guide = route ? nearestGuideForRoute(route, layout.value) : null
            if (route && guide) {
              const vertical = guide.orientation === 'vertical'
              const len = vertical ? Math.abs(route.y2 - route.y1) : Math.abs(route.x2 - route.x1)
              const minAlong = vertical ? Math.min(route.y1, route.y2) : Math.min(route.x1, route.x2)
              const clickAlong = vertical ? pt.yMm : pt.xMm
              const offsetMm = clickAlong - minAlong
              addedRoutingDrag.value = {
                routeId: rid,
                guide,
                orientation: guide.orientation,
                lengthMm: len,
                offsetMm,
                reverse: vertical ? route.y2 < route.y1 : route.x2 < route.x1,
                preview: { x1: route.x1, y1: route.y1, x2: route.x2, y2: route.y2 },
              }
              hoveredAddedRoutingId.value = rid
              scheduleRedraw()
              e.preventDefault()
              return
            }
          }
        } else if (addedRoutingEditMode.value === 'add') {
          if (!addedRoutingStart.value) {
            const snapped = snapToRoutingGuide(pt.xMm, pt.yMm, layout.value)
            if (snapped) {
              addedRoutingStart.value = snapped
              addedRoutingPreview.value = { x1: snapped.xMm, y1: snapped.yMm, x2: snapped.xMm, y2: snapped.yMm }
              addedRoutingSnapHover.value = snapped
              scheduleRedraw()
              e.preventDefault()
              return
            }
          } else {
            const snapped = snapToRoutingGuide(pt.xMm, pt.yMm, layout.value, addedRoutingStart.value.guide)
            if (snapped) {
              addRoutingPath(
                { xMm: addedRoutingStart.value.xMm, yMm: addedRoutingStart.value.yMm },
                { xMm: snapped.xMm, yMm: snapped.yMm },
                addedRoutingStart.value.guide,
              )
              addedRoutingStart.value = null
              addedRoutingPreview.value = null
              addedRoutingSnapHover.value = snapped
              scheduleRedraw()
              e.preventDefault()
              return
            }
          }
        }
      }
      const hit = hitTestTab(pt.xMm, pt.yMm)
      if (tabEditMode.value === 'move') {
        if (hit) {
          tabDrag.value = { tab: hit, currentPos: hit.normalizedPos, guides: [] }
          e.preventDefault()
          return
        }
      } else if (tabEditMode.value === 'delete') {
        if (hit) {
          removeTab(hit)
          scheduleRedraw()
          e.preventDefault()
          return
        }
      } else if (tabEditMode.value === 'add') {
        const channel = hitTestTabChannel(pt.xMm, pt.yMm)
        if (channel) {
          addTab(channel, pt.xMm, pt.yMm)
          scheduleRedraw()
          e.preventDefault()
          return
        }
      }
    }
    props.interaction.handleMouseDown(e)
  }
}
function onMouseMove(e: MouseEvent) {
  // Tab dragging
  if (tabDrag.value) {
    const pt = screenToMm(e.clientX, e.clientY)
    if (pt && layout.value) {
      const tab = tabDrag.value.tab
      // Project mouse position onto the edge to get normalized position
      let rawPos: number
      if (tab.direction === 'vertical') {
        rawPos = (pt.yMm - tab.edgeStart) / tab.edgeLength
      } else {
        rawPos = (pt.xMm - tab.edgeStart) / tab.edgeLength
      }
      rawPos = Math.max(0.05, Math.min(0.95, rawPos))
      const { snappedPos, guides } = computeSnap(tab, rawPos, layout.value)
      tabDrag.value = { ...tabDrag.value, currentPos: snappedPos, guides }
      scheduleRedraw()
    }
    return
  }
  if (addedRoutingDrag.value) {
    const pt = screenToMm(e.clientX, e.clientY)
    if (pt) {
      const drag = addedRoutingDrag.value
      const snapped = layout.value
        ? snapToRoutingGuide(pt.xMm, pt.yMm, layout.value, drag.guide)
        : null
      if (snapped) {
        const g = drag.guide
        if (g.orientation === 'vertical') {
          const maxStart = Math.max(g.rangeStartMm, g.rangeEndMm - drag.lengthMm)
          const start = Math.max(g.rangeStartMm, Math.min(maxStart, snapped.yMm - drag.offsetMm))
          const y1 = drag.reverse ? start + drag.lengthMm : start
          const y2 = drag.reverse ? start : start + drag.lengthMm
          drag.preview = { x1: g.axisMm, y1, x2: g.axisMm, y2 }
        } else {
          const maxStart = Math.max(g.rangeStartMm, g.rangeEndMm - drag.lengthMm)
          const start = Math.max(g.rangeStartMm, Math.min(maxStart, snapped.xMm - drag.offsetMm))
          const x1 = drag.reverse ? start + drag.lengthMm : start
          const x2 = drag.reverse ? start : start + drag.lengthMm
          drag.preview = { x1, y1: g.axisMm, x2, y2: g.axisMm }
        }
        addedRoutingDrag.value = { ...drag }
      }
      scheduleRedraw()
    }
    return
  }
  // Hover detection for tab cursor
  const hpt = screenToMm(e.clientX, e.clientY)
  if (hpt) {
    if (addedRoutingEditMode.value === 'add') {
      addedRoutingCursorMm.value = { xMm: hpt.xMm, yMm: hpt.yMm }
    } else {
      addedRoutingCursorMm.value = null
    }
    if (layout.value && addedRoutingEditMode.value === 'add') {
      const snapped = addedRoutingStart.value
        ? snapToRoutingGuide(hpt.xMm, hpt.yMm, layout.value, addedRoutingStart.value.guide)
        : snapToRoutingGuide(hpt.xMm, hpt.yMm, layout.value)
      addedRoutingSnapHover.value = snapped
      if (addedRoutingStart.value && snapped) {
        addedRoutingPreview.value = {
          x1: addedRoutingStart.value.xMm,
          y1: addedRoutingStart.value.yMm,
          x2: snapped.xMm,
          y2: snapped.yMm,
        }
      } else {
        addedRoutingPreview.value = null
      }
    } else {
      addedRoutingSnapHover.value = null
      addedRoutingPreview.value = null
    }
    hoveredAddedRoutingId.value = (addedRoutingEditMode.value === 'delete' || addedRoutingEditMode.value === 'move')
      ? hitTestAddedRouting(hpt.xMm, hpt.yMm)
      : null
    hoveredTab.value = hitTestTab(hpt.xMm, hpt.yMm)
    if (tabEditMode.value === 'add') {
      const ch = hitTestTabChannel(hpt.xMm, hpt.yMm)
      if (ch) {
        addPreview.value = buildTabRectForChannel(ch, hpt.xMm, hpt.yMm)
      } else {
        addPreview.value = null
      }
    } else {
      addPreview.value = null
    }
  } else {
    hoveredAddedRoutingId.value = null
    hoveredTab.value = null
    addPreview.value = null
    addedRoutingPreview.value = null
    addedRoutingSnapHover.value = null
    addedRoutingCursorMm.value = null
  }
  if (addedRoutingEditMode.value === 'add' || addedRoutingEditMode.value === 'move' || addedRoutingEditMode.value === 'delete') {
    scheduleRedraw()
  }
  if (canvasEl.value && props.measure?.active.value) {
    props.measure.handleMouseMove(e, canvasEl.value, props.interaction.transform.value)
  }
  props.interaction.handleMouseMove(e, { invertPanX: !!props.mirrored })
}
function onMouseUp(_e: MouseEvent) {
  if (tabDrag.value) {
    commitTabDrag()
    return
  }
  if (addedRoutingDrag.value) {
    const drag = addedRoutingDrag.value
    addedRoutingDrag.value = null
    updateAddedRouting({
      id: drag.routeId,
      x1: drag.preview.x1,
      y1: drag.preview.y1,
      x2: drag.preview.x2,
      y2: drag.preview.y2,
    })
    scheduleRedraw()
    return
  }
  props.interaction.handleMouseUp()
}
function onMouseLeave(_e: MouseEvent) {
  if (tabDrag.value) {
    commitTabDrag()
    return
  }
  if (addedRoutingDrag.value) {
    const drag = addedRoutingDrag.value
    addedRoutingDrag.value = null
    updateAddedRouting({
      id: drag.routeId,
      x1: drag.preview.x1,
      y1: drag.preview.y1,
      x2: drag.preview.x2,
      y2: drag.preview.y2,
    })
    scheduleRedraw()
    return
  }
  addPreview.value = null
  hoveredAddedRoutingId.value = null
  addedRoutingSnapHover.value = null
  addedRoutingCursorMm.value = null
  scheduleRedraw()
  props.interaction.handleMouseUp()
}

/** Commit the dragged tab position to the panel config */
function commitTabDrag() {
  const drag = tabDrag.value
  if (!drag) return
  const { tab, currentPos } = drag
  tabDrag.value = null

  const config = props.panelConfig

  // Get current positions for this edge
  const positions = getTabPositionsForKey(config, tab.overrideKey, tab.col, tab.row, tab.edge, tab.channelId)

  if (tab.posIndex >= 0 && tab.posIndex < positions.length) {
    positions[tab.posIndex] = currentPos
  }

  const newConfig: PanelConfig = {
    ...config,
    tabs: {
      ...config.tabs,
      manualPlacement: true,
      edgeOverrides: {
        ...config.tabs.edgeOverrides,
        [tab.overrideKey]: positions,
      },
    },
  }
  emit('update:panelConfig', newConfig)
}

function removeTab(tab: TabMarker) {
  const positions = getTabPositionsForKey(props.panelConfig, tab.overrideKey, tab.col, tab.row, tab.edge, tab.channelId)
  if (tab.posIndex < 0 || tab.posIndex >= positions.length) return
  positions.splice(tab.posIndex, 1)
  const newConfig: PanelConfig = {
    ...props.panelConfig,
    tabs: {
      ...props.panelConfig.tabs,
      manualPlacement: true,
      edgeOverrides: {
        ...props.panelConfig.tabs.edgeOverrides,
        [tab.overrideKey]: positions,
      },
    },
  }
  emit('update:panelConfig', newConfig)
}

function addTab(channel: TabChannel, xMm: number, yMm: number) {
  const raw = channel.direction === 'vertical'
    ? (yMm - channel.edgeStart) / channel.edgeLength
    : (xMm - channel.edgeStart) / channel.edgeLength
  const pos = Math.max(0.05, Math.min(0.95, Math.round(raw * 100) / 100))
  const current = getTabPositionsForKey(
    props.panelConfig,
    channel.overrideKey,
    channel.col,
    channel.row,
    channel.edge,
    channel.channelId,
  )
  current.push(pos)
  current.sort((a, b) => a - b)
  const newConfig: PanelConfig = {
    ...props.panelConfig,
    tabs: {
      ...props.panelConfig.tabs,
      manualPlacement: true,
      edgeOverrides: {
        ...props.panelConfig.tabs.edgeOverrides,
        [channel.overrideKey]: current,
      },
    },
  }
  emit('update:panelConfig', newConfig)
}

function getTabOverrideKey(config: PanelConfig, col: number, row: number, edge: string, channelId: string): string {
  if (config.tabs.syncAcrossPanel ?? true) return `sync-${edge}-${channelId}`
  return `${col}-${row}-${edge}-${channelId}`
}

function getTabPositionsForKey(
  config: PanelConfig,
  overrideKey: string,
  col: number,
  row: number,
  edge: string,
  channelId: string = 'main',
): number[] {
  if (overrideKey in config.tabs.edgeOverrides) return [...config.tabs.edgeOverrides[overrideKey]!]
  const oppositeModeKey = overrideKey.startsWith('sync-')
    ? `${col}-${row}-${edge}-${channelId}`
    : `sync-${edge}-${channelId}`
  if (oppositeModeKey in config.tabs.edgeOverrides) return [...config.tabs.edgeOverrides[oppositeModeKey]!]
  // Backwards compatibility for old projects that used keys without channel suffix.
  const legacyEdgeKey = `${col}-${row}-${edge}`
  if (legacyEdgeKey in config.tabs.edgeOverrides) return [...config.tabs.edgeOverrides[legacyEdgeKey]!]
  return [...evenTabPositions(getDefaultCountForEdge(config, edge))]
}

function getDefaultCountForEdge(config: PanelConfig, edge: string): number {
  switch (edge) {
    case 'top': return config.tabs.defaultCountTop ?? config.tabs.defaultCountPerEdge
    case 'bottom': return config.tabs.defaultCountBottom ?? config.tabs.defaultCountPerEdge
    case 'left': return config.tabs.defaultCountLeft ?? config.tabs.defaultCountPerEdge
    case 'right': return config.tabs.defaultCountRight ?? config.tabs.defaultCountPerEdge
    default: return config.tabs.defaultCountPerEdge
  }
}

function getCssDimensions(): { cssWidth: number; cssHeight: number } {
  const parent = canvasEl.value?.parentElement
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

function mergeImageTrees(trees: ImageTree[]): ImageTree | undefined {
  if (!trees.length) return undefined
  const units = trees[0]!.units
  let bounds: BoundingBox = emptyBounds()
  const children = trees
    .filter(tree => tree.units === units)
    .flatMap((tree) => {
      bounds = mergeBounds(bounds, tree.bounds as BoundingBox)
      return tree.children
    })
  if (!children.length) return undefined
  return {
    units,
    bounds: isEmpty(bounds) ? ([0, 0, 0, 0] as BoundingBox) : bounds,
    children,
  }
}

function gatherRealisticLayers(side: RealisticSide): RealisticLayers {
  const source = props.allLayers ?? props.layers
  const result: RealisticLayers = {}
  const copperTypes = side === 'all' ? ['Top Copper', 'Bottom Copper'] : [side === 'top' ? 'Top Copper' : 'Bottom Copper']
  const maskTypes = side === 'all' ? ['Top Solder Mask', 'Bottom Solder Mask'] : [side === 'top' ? 'Top Solder Mask' : 'Bottom Solder Mask']
  const silkTypes = side === 'all' ? ['Top Silkscreen', 'Bottom Silkscreen'] : [side === 'top' ? 'Top Silkscreen' : 'Bottom Silkscreen']
  const pasteTypes = side === 'all' ? ['Top Paste', 'Bottom Paste'] : [side === 'top' ? 'Top Paste' : 'Bottom Paste']
  const copperTrees: ImageTree[] = []
  const maskTrees: ImageTree[] = []
  const silkTrees: ImageTree[] = []
  const pasteTrees: ImageTree[] = []
  const drillTrees: ImageTree[] = []
  let outlineTree: ImageTree | undefined
  let detectedUnitsLocal: 'mm' | 'in' | undefined
  const usedTrees: ImageTree[] = []

  for (const layer of source) {
    const tree = getImageTree(layer)
    if (!tree || tree.children.length === 0) continue
    if (copperTypes.includes(layer.type)) { copperTrees.push(tree); usedTrees.push(tree) }
    else if (maskTypes.includes(layer.type)) { maskTrees.push(tree); usedTrees.push(tree) }
    else if (silkTypes.includes(layer.type)) { silkTrees.push(tree); usedTrees.push(tree) }
    else if (pasteTypes.includes(layer.type)) { pasteTrees.push(tree); usedTrees.push(tree) }
    else if (layer.type === 'Drill') drillTrees.push(tree)
    else if (layer.type === 'Outline') outlineTree = tree
    else if (layer.type === 'Keep-Out' && !outlineTree) outlineTree = tree
    if (!detectedUnitsLocal) detectedUnitsLocal = tree.units
  }

  result.copper = mergeImageTrees(copperTrees)
  result.solderMask = mergeImageTrees(maskTrees)
  result.silkscreen = mergeImageTrees(silkTrees)
  const mergedPaste = mergeImageTrees(pasteTrees)
  if (mergedPaste) {
    const ps = props.pasteSettings
    result.paste = ps && ps.mode === 'jetprint'
      ? generateJetprintDots(mergedPaste, { dotDiameter: ps.dotDiameter, dotSpacing: ps.dotSpacing, pattern: ps.pattern, dynamicDots: ps.dynamicDots })
      : mergedPaste
  }

  if (drillTrees.length > 0) {
    const units = drillTrees[0]!.units
    let bounds: BoundingBox = emptyBounds()
    const children = drillTrees
      .filter(t => t.units === units)
      .flatMap(t => { bounds = mergeBounds(bounds, t.bounds as BoundingBox); return t.children })
    result.drill = { units, bounds: isEmpty(bounds) ? ([0, 0, 0, 0] as BoundingBox) : bounds, children }
  }

  if (outlineTree) {
    result.outline = outlineTree
  } else if (detectedUnitsLocal) {
    let fallbackBounds: BoundingBox = emptyBounds()
    for (const t of usedTrees) fallbackBounds = mergeBounds(fallbackBounds, t.bounds as BoundingBox)
    for (const t of drillTrees) fallbackBounds = mergeBounds(fallbackBounds, t.bounds as BoundingBox)
    if (!isEmpty(fallbackBounds)) {
      const [minX, minY, maxX, maxY] = fallbackBounds
      result.outline = {
        units: detectedUnitsLocal,
        bounds: fallbackBounds,
        children: [{ type: 'shape', shape: { type: 'rect', x: minX, y: minY, w: maxX - minX, h: maxY - minY } }],
      }
    }
  }
  return result
}

function findOutlineLayer(): LayerInfo | null {
  const source = props.allLayers ?? props.layers
  return source.find(l => l.type === 'Outline') || source.find(l => l.type === 'Keep-Out') || null
}

function getOutlineBoundsGerber(): BoundingBox | null {
  const outLayer = findOutlineLayer()
  if (outLayer) {
    const tree = getImageTree(outLayer)
    if (tree && tree.children.length > 0 && !isEmpty(tree.bounds as BoundingBox)) {
      return tree.bounds as BoundingBox
    }
  }
  const source = props.allLayers ?? props.layers
  let bounds: BoundingBox = emptyBounds()
  for (const layer of source) {
    const tree = getImageTree(layer)
    if (!tree || tree.children.length === 0) continue
    bounds = mergeBounds(bounds, tree.bounds as BoundingBox)
  }
  return isEmpty(bounds) ? null : bounds
}

function mmToGerber(mm: number): number {
  const units = detectUnits()
  return units === 'in' ? mm / 25.4 : mm
}

const layout = computed<PanelLayout | null>(() => {
  if (!props.boardSizeMm) return null
  return computePanelLayout(props.panelConfig, props.boardSizeMm.width, props.boardSizeMm.height)
})

// ─── Coordinate helpers shared by draw + overlay functions ───

interface OverlayContext {
  ctx: CanvasRenderingContext2D
  dpr: number
  transform: { offsetX: number; offsetY: number; scale: number }
  panelHeightGerber: number
  toMm: number
  isRealistic: boolean
  exportTransparent?: boolean
  mirrored?: boolean
  side?: 'top' | 'bottom'
}

function toScreen(oc: OverlayContext, xMm: number, yMm: number): { sx: number; sy: number } {
  const gx = xMm / oc.toMm
  const gy = oc.panelHeightGerber - yMm / oc.toMm
  return {
    sx: (gx * oc.transform.scale + oc.transform.offsetX) * oc.dpr,
    sy: (-gy * oc.transform.scale + oc.transform.offsetY) * oc.dpr,
  }
}

function mmToPx(oc: OverlayContext, mm: number): number {
  return (mm / oc.toMm) * oc.transform.scale * oc.dpr
}

function rotationAnchorOffsetPx(rotationDeg: number, widthPx: number, heightPx: number): { dx: number; dy: number } {
  const rot = ((rotationDeg % 360) + 360) % 360
  if (rot === 90 || rot === 270) {
    return { dx: (heightPx - widthPx) / 2, dy: (widthPx - heightPx) / 2 }
  }
  return { dx: 0, dy: 0 }
}

function applyMirrorX(ctx: CanvasRenderingContext2D, widthPx: number) {
  ctx.translate(widthPx, 0)
  ctx.scale(-1, 1)
}

/** Convert CSS mouse coords to panel mm coordinates */
function screenToMm(cssX: number, cssY: number): { xMm: number; yMm: number } | null {
  const canvas = canvasEl.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  const transform = props.interaction.transform.value
  const units = detectUnits()
  const toMm = units === 'in' ? 25.4 : 1

  let pxX = (cssX - rect.left) * dpr
  const pxY = (cssY - rect.top) * dpr

  // Keep interaction mapping aligned with mirrored rendering.
  if (props.mirrored) {
    pxX = canvas.width - pxX
  }

  const gx = (pxX / dpr - transform.offsetX) / transform.scale
  const panelLayout = layout.value
  if (!panelLayout) return null
  const panelHeightGerber = panelLayout.totalHeight / toMm
  const gy = -(pxY / dpr - transform.offsetY) / transform.scale
  const xMm = gx * toMm
  const yMm = (panelHeightGerber - gy) * toMm
  return { xMm, yMm }
}

/** Hit-test: find a tab at the given panel mm coordinates */
function hitTestTab(xMm: number, yMm: number): TabMarker | null {
  const panelLayout = layout.value
  if (!panelLayout) return null
  const hitPad = 1.5
  for (const tab of panelLayout.tabs) {
    if (xMm >= tab.x - hitPad && xMm <= tab.x + tab.width + hitPad
      && yMm >= tab.y - hitPad && yMm <= tab.y + tab.height + hitPad) {
      return tab
    }
  }
  return null
}

function getPcbAt(panelLayout: PanelLayout, col: number, row: number) {
  return panelLayout.pcbs.find(p => p.col === col && p.row === row) || null
}

function buildTabChannels(panelLayout: PanelLayout): TabChannel[] {
  const cfg = props.panelConfig
  if (!hasAnyRoutedSeparation(cfg)) return []
  const isEdgeRouted = (edge: 'top' | 'bottom' | 'left' | 'right') => {
    if (cfg.separationType === 'routed') return true
    if (cfg.separationType === 'scored') return false
    return cfg.edges[edge].type === 'routed'
  }
  const hasVerticalRouted = isEdgeRouted('left') || isEdgeRouted('right')
  const hasHorizontalRouted = isEdgeRouted('top') || isEdgeRouted('bottom')
  const supportsEnabled = cfg.supports.enabled ?? true
  const channels: TabChannel[] = []
  const pcbW = panelLayout.pcbLayoutWidth
  const pcbH = panelLayout.pcbLayoutHeight
  const frameLeft = panelLayout.frame?.railLeft ?? 0
  const frameTop = panelLayout.frame?.railTop ?? 0
  const frameRight = panelLayout.frame?.railRight ?? 0
  const frameBottom = panelLayout.frame?.railBottom ?? 0

  for (const pcb of panelLayout.pcbs) {
    const { col, row, x, y } = pcb
    // Right channel to neighbor
    if (col < cfg.countX - 1 && hasVerticalRouted) {
      const right = getPcbAt(panelLayout, col + 1, row)
      if (right) {
        const gap = right.x - (x + pcbW)
        if (gap > 0) {
          if (supportsEnabled && cfg.supports.xGaps.includes(col) && gap >= 2 * cfg.routingToolDiameter) {
            const d = cfg.routingToolDiameter
            channels.push({
              col, row, edge: 'right', channelId: 'pcb-side',
              overrideKey: getTabOverrideKey(cfg, col, row, 'right', 'pcb-side'),
              direction: 'vertical', edgeStart: y, edgeLength: pcbH, gapStart: x + pcbW, gapDepth: d,
            })
            channels.push({
              col, row, edge: 'right', channelId: 'opposite-side',
              overrideKey: getTabOverrideKey(cfg, col, row, 'right', 'opposite-side'),
              direction: 'vertical', edgeStart: y, edgeLength: pcbH, gapStart: x + pcbW + gap - d, gapDepth: d,
            })
          } else {
            channels.push({
              col, row, edge: 'right', channelId: 'main',
              overrideKey: getTabOverrideKey(cfg, col, row, 'right', 'main'),
              direction: 'vertical', edgeStart: y, edgeLength: pcbH, gapStart: x + pcbW, gapDepth: gap,
            })
          }
        }
      }
    } else if (cfg.frame.enabled && isEdgeRouted('right')) {
      const gap = (panelLayout.totalWidth - frameRight) - (x + pcbW)
      if (gap > 0) channels.push({
        col, row, edge: 'right', channelId: 'main',
        overrideKey: getTabOverrideKey(cfg, col, row, 'right', 'main'),
        direction: 'vertical', edgeStart: y, edgeLength: pcbH, gapStart: x + pcbW, gapDepth: gap,
      })
    }

    // Bottom channel to neighbor
    if (row < cfg.countY - 1 && hasHorizontalRouted) {
      const below = getPcbAt(panelLayout, col, row + 1)
      if (below) {
        const gap = below.y - (y + pcbH)
        if (gap > 0) {
          if (supportsEnabled && cfg.supports.yGaps.includes(row) && gap >= 2 * cfg.routingToolDiameter) {
            const d = cfg.routingToolDiameter
            channels.push({
              col, row, edge: 'bottom', channelId: 'pcb-side',
              overrideKey: getTabOverrideKey(cfg, col, row, 'bottom', 'pcb-side'),
              direction: 'horizontal', edgeStart: x, edgeLength: pcbW, gapStart: y + pcbH, gapDepth: d,
            })
            channels.push({
              col, row, edge: 'bottom', channelId: 'opposite-side',
              overrideKey: getTabOverrideKey(cfg, col, row, 'bottom', 'opposite-side'),
              direction: 'horizontal', edgeStart: x, edgeLength: pcbW, gapStart: y + pcbH + gap - d, gapDepth: d,
            })
          } else {
            channels.push({
              col, row, edge: 'bottom', channelId: 'main',
              overrideKey: getTabOverrideKey(cfg, col, row, 'bottom', 'main'),
              direction: 'horizontal', edgeStart: x, edgeLength: pcbW, gapStart: y + pcbH, gapDepth: gap,
            })
          }
        }
      }
    } else if (cfg.frame.enabled && isEdgeRouted('bottom')) {
      const gap = (panelLayout.totalHeight - frameBottom) - (y + pcbH)
      if (gap > 0) channels.push({
        col, row, edge: 'bottom', channelId: 'main',
        overrideKey: getTabOverrideKey(cfg, col, row, 'bottom', 'main'),
        direction: 'horizontal', edgeStart: x, edgeLength: pcbW, gapStart: y + pcbH, gapDepth: gap,
      })
    }

    if (cfg.frame.enabled) {
      if (col === 0 && isEdgeRouted('left')) {
        const gap = x - frameLeft
        if (gap > 0) channels.push({
          col, row, edge: 'left', channelId: 'main',
          overrideKey: getTabOverrideKey(cfg, col, row, 'left', 'main'),
          direction: 'vertical', edgeStart: y, edgeLength: pcbH, gapStart: frameLeft, gapDepth: gap,
        })
      }
      if (row === 0 && isEdgeRouted('top')) {
        const gap = y - frameTop
        if (gap > 0) channels.push({
          col, row, edge: 'top', channelId: 'main',
          overrideKey: getTabOverrideKey(cfg, col, row, 'top', 'main'),
          direction: 'horizontal', edgeStart: x, edgeLength: pcbW, gapStart: frameTop, gapDepth: gap,
        })
      }
    }
  }
  return channels
}

function buildTabRectForChannel(ch: TabChannel, xMm: number, yMm: number) {
  const raw = ch.direction === 'vertical'
    ? (yMm - ch.edgeStart) / ch.edgeLength
    : (xMm - ch.edgeStart) / ch.edgeLength
  const pos = Math.max(0.05, Math.min(0.95, raw))
  const tabW = Math.min(props.panelConfig.tabs.width, ch.edgeLength)
  const center = ch.edgeStart + pos * ch.edgeLength
  if (ch.direction === 'vertical') {
    return { x: ch.gapStart, y: center - tabW / 2, width: ch.gapDepth, height: tabW }
  }
  return { x: center - tabW / 2, y: ch.gapStart, width: tabW, height: ch.gapDepth }
}

function hitTestTabChannel(xMm: number, yMm: number): TabChannel | null {
  const panelLayout = layout.value
  if (!panelLayout) return null
  const hitPad = 1.0
  const channels = buildTabChannels(panelLayout)
  for (const ch of channels) {
    if (ch.direction === 'vertical') {
      if (
        xMm >= ch.gapStart - hitPad && xMm <= ch.gapStart + ch.gapDepth + hitPad &&
        yMm >= ch.edgeStart - hitPad && yMm <= ch.edgeStart + ch.edgeLength + hitPad
      ) return ch
    } else {
      if (
        xMm >= ch.edgeStart - hitPad && xMm <= ch.edgeStart + ch.edgeLength + hitPad &&
        yMm >= ch.gapStart - hitPad && yMm <= ch.gapStart + ch.gapDepth + hitPad
      ) return ch
    }
  }
  return null
}

function buildRoutingSnapGuides(panelLayout: PanelLayout): RoutingSnapGuide[] {
  const guides: RoutingSnapGuide[] = []
  const cfg = props.panelConfig
  const toolR = Math.max(0.1, cfg.routingToolDiameter / 2)
  const frameTop = panelLayout.frame?.railTop ?? 0
  const frameBottom = panelLayout.frame?.railBottom ?? 0
  const frameLeft = panelLayout.frame?.railLeft ?? 0
  const frameRight = panelLayout.frame?.railRight ?? 0

  const pushVertical = (id: string, x: number, y1: number, y2: number) => {
    if (y2 - y1 < 0.5) return
    guides.push({
      id,
      orientation: 'vertical',
      axisMm: x,
      rangeStartMm: y1,
      rangeEndMm: y2,
    })
  }
  const pushHorizontal = (id: string, y: number, x1: number, x2: number) => {
    if (x2 - x1 < 0.5) return
    guides.push({
      id,
      orientation: 'horizontal',
      axisMm: y,
      rangeStartMm: x1,
      rangeEndMm: x2,
    })
  }

  if (cfg.frame.enabled) {
    if (frameTop > toolR) {
      pushHorizontal('frame-top-outer', toolR, 0, panelLayout.totalWidth)
      pushHorizontal('frame-top-inner', frameTop - toolR, 0, panelLayout.totalWidth)
    }
    if (frameBottom > toolR) {
      pushHorizontal('frame-bottom-outer', panelLayout.totalHeight - toolR, 0, panelLayout.totalWidth)
      pushHorizontal('frame-bottom-inner', panelLayout.totalHeight - frameBottom + toolR, 0, panelLayout.totalWidth)
    }
    if (frameLeft > toolR) {
      pushVertical('frame-left-outer', toolR, 0, panelLayout.totalHeight)
      pushVertical('frame-left-inner', frameLeft - toolR, 0, panelLayout.totalHeight)
    }
    if (frameRight > toolR) {
      pushVertical('frame-right-outer', panelLayout.totalWidth - toolR, 0, panelLayout.totalHeight)
      pushVertical('frame-right-inner', panelLayout.totalWidth - frameRight + toolR, 0, panelLayout.totalHeight)
    }
  }

  for (const rail of panelLayout.supportRails) {
    if (rail.direction === 'vertical') {
      // Center line gives a forgiving snap target in wide support bars.
      pushVertical(`support-v-${rail.gapIndex}-center`, rail.x + rail.width / 2, rail.y, rail.y + rail.height)
      if (rail.width > 2 * toolR) {
        pushVertical(`support-v-${rail.gapIndex}-left`, rail.x + toolR, rail.y, rail.y + rail.height)
        pushVertical(`support-v-${rail.gapIndex}-right`, rail.x + rail.width - toolR, rail.y, rail.y + rail.height)
      }
    } else {
      // Center line gives a forgiving snap target in wide support bars.
      pushHorizontal(`support-h-${rail.gapIndex}-center`, rail.y + rail.height / 2, rail.x, rail.x + rail.width)
      if (rail.height > 2 * toolR) {
        pushHorizontal(`support-h-${rail.gapIndex}-top`, rail.y + toolR, rail.x, rail.x + rail.width)
        pushHorizontal(`support-h-${rail.gapIndex}-bottom`, rail.y + rail.height - toolR, rail.x, rail.x + rail.width)
      }
    }
  }

  return guides
}

function snapToRoutingGuide(
  xMm: number,
  yMm: number,
  panelLayout: PanelLayout,
  preferredGuide?: RoutingSnapGuide,
): { xMm: number; yMm: number; guide: RoutingSnapGuide } | null {
  const guides = buildRoutingSnapGuides(panelLayout)
  if (!guides.length) return null
  const transform = props.interaction.transform.value
  const units = detectUnits()
  const toMm = units === 'in' ? 25.4 : 1
  const pxPerMm = (1 / toMm) * transform.scale
  const snapMm = 20 / Math.max(1e-6, pxPerMm)

  let best: { guide: RoutingSnapGuide; dist: number } | null = null
  const pool = preferredGuide
    ? guides.filter(g => g.id === preferredGuide.id)
    : guides
  for (const g of pool) {
    const axisDist = g.orientation === 'vertical'
      ? Math.abs(xMm - g.axisMm)
      : Math.abs(yMm - g.axisMm)
    if (axisDist > snapMm) continue
    const along = g.orientation === 'vertical' ? yMm : xMm
    const clampedAlong = Math.max(g.rangeStartMm, Math.min(g.rangeEndMm, along))
    const endDist = Math.abs(along - clampedAlong)
    const dist = axisDist + endDist * 0.2
    if (!best || dist < best.dist) best = { guide: g, dist }
  }
  if (!best) return null
  const g = best.guide
  if (g.orientation === 'vertical') {
    const y = Math.max(g.rangeStartMm, Math.min(g.rangeEndMm, yMm))
    return { xMm: g.axisMm, yMm: y, guide: g }
  }
  const x = Math.max(g.rangeStartMm, Math.min(g.rangeEndMm, xMm))
  return { xMm: x, yMm: g.axisMm, guide: g }
}

function addRoutingPath(
  start: { xMm: number; yMm: number },
  end: { xMm: number; yMm: number },
  guide: RoutingSnapGuide,
) {
  const length = Math.hypot(end.xMm - start.xMm, end.yMm - start.yMm)
  if (length < 1) return

  const panelLayout = layout.value
  const newPaths: AddedRoutingPath[] = []
  const ts = Date.now()
  let idx = 0
  const mkId = () => `route-${ts}-${idx++}-${Math.random().toString(36).slice(2, 6)}`

  // Primary route exactly as the user drew it.
  newPaths.push({ id: mkId(), x1: start.xMm, y1: start.yMm, x2: end.xMm, y2: end.yMm })

  // Replicate to equivalent positions on other PCBs along the guide.
  // Horizontal guide: segment varies in X -> replicate across columns.
  // Vertical guide: segment varies in Y -> replicate across rows.
  if (panelLayout) {
    const pcbW = panelLayout.pcbLayoutWidth
    const pcbH = panelLayout.pcbLayoutHeight
    const colXs = [...new Set(panelLayout.pcbs.map(p => p.x))].sort((a, b) => a - b)
    const rowYs = [...new Set(panelLayout.pcbs.map(p => p.y))].sort((a, b) => a - b)

    if (guide.orientation === 'horizontal' && colXs.length > 1) {
      // Find which column the segment midpoint falls in.
      const midX = (start.xMm + end.xMm) / 2
      const srcCol = colXs.findIndex(cx => midX >= cx && midX <= cx + pcbW)
      if (srcCol >= 0) {
        const relX1 = start.xMm - colXs[srcCol]
        const relX2 = end.xMm - colXs[srcCol]
        for (let c = 0; c < colXs.length; c++) {
          if (c === srcCol) continue
          newPaths.push({
            id: mkId(),
            x1: colXs[c] + relX1,
            y1: start.yMm,
            x2: colXs[c] + relX2,
            y2: end.yMm,
          })
        }
      }
    } else if (guide.orientation === 'vertical' && rowYs.length > 1) {
      // Find which row the segment midpoint falls in.
      const midY = (start.yMm + end.yMm) / 2
      const srcRow = rowYs.findIndex(ry => midY >= ry && midY <= ry + pcbH)
      if (srcRow >= 0) {
        const relY1 = start.yMm - rowYs[srcRow]
        const relY2 = end.yMm - rowYs[srcRow]
        for (let r = 0; r < rowYs.length; r++) {
          if (r === srcRow) continue
          newPaths.push({
            id: mkId(),
            x1: start.xMm,
            y1: rowYs[r] + relY1,
            x2: end.xMm,
            y2: rowYs[r] + relY2,
          })
        }
      }
    }
  }

  const newConfig: PanelConfig = {
    ...props.panelConfig,
    addedRoutings: [...(props.panelConfig.addedRoutings ?? []), ...newPaths],
  }
  emit('update:panelConfig', newConfig)
}

function pointToSegmentDistance(x: number, y: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  if (len2 <= 1e-9) return Math.hypot(x - x1, y - y1)
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2))
  const px = x1 + t * dx
  const py = y1 + t * dy
  return Math.hypot(x - px, y - py)
}

function hitTestAddedRouting(xMm: number, yMm: number): string | null {
  const routes = props.panelConfig.addedRoutings ?? []
  if (!routes.length) return null
  const transform = props.interaction.transform.value
  const units = detectUnits()
  const toMm = units === 'in' ? 25.4 : 1
  const pxPerMm = (1 / toMm) * transform.scale
  const hitMm = 8 / Math.max(1e-6, pxPerMm)
  let bestId: string | null = null
  let best = hitMm
  for (const r of routes) {
    const d = pointToSegmentDistance(xMm, yMm, r.x1, r.y1, r.x2, r.y2)
    if (d <= best) {
      best = d
      bestId = r.id
    }
  }
  return bestId
}

function removeAddedRouting(id: string) {
  const next = (props.panelConfig.addedRoutings ?? []).filter(r => r.id !== id)
  const newConfig: PanelConfig = {
    ...props.panelConfig,
    addedRoutings: next,
  }
  emit('update:panelConfig', newConfig)
}

function updateAddedRouting(path: AddedRoutingPath) {
  const list = props.panelConfig.addedRoutings ?? []
  const next = list.map(r => r.id === path.id ? path : r)
  emit('update:panelConfig', {
    ...props.panelConfig,
    addedRoutings: next,
  })
}

function getAddedRoutingById(id: string): AddedRoutingPath | null {
  return (props.panelConfig.addedRoutings ?? []).find(r => r.id === id) ?? null
}

function nearestGuideForRoute(route: AddedRoutingPath, panelLayout: PanelLayout): RoutingSnapGuide | null {
  const guides = buildRoutingSnapGuides(panelLayout)
  if (!guides.length) return null
  const isVertical = Math.abs(route.x2 - route.x1) <= Math.abs(route.y2 - route.y1)
  const axis = isVertical ? route.x1 : route.y1
  let best: { g: RoutingSnapGuide; d: number } | null = null
  for (const g of guides) {
    if ((g.orientation === 'vertical') !== isVertical) continue
    const d = Math.abs(g.axisMm - axis)
    if (!best || d < best.d) best = { g, d }
  }
  return best?.g ?? null
}

const SNAP_THRESHOLD_PX = 8

/** Compute snapping and alignment guides for a dragged tab */
function computeSnap(
  tab: TabMarker,
  rawPos: number,
  panelLayout: PanelLayout,
): { snappedPos: number; guides: { x1: number; y1: number; x2: number; y2: number }[] } {
  const guides: { x1: number; y1: number; x2: number; y2: number }[] = []

  const transform = props.interaction.transform.value
  const units = detectUnits()
  const toMm = units === 'in' ? 25.4 : 1
  const pxPerMm = (1 / toMm) * transform.scale
  const snapMm = SNAP_THRESHOLD_PX / pxPerMm
  const snapNorm = snapMm / tab.edgeLength

  let bestDist = snapNorm
  let bestPos = rawPos

  for (const other of panelLayout.tabs) {
    if (other === tab) continue
    if (other.direction !== tab.direction) continue

    const dist = Math.abs(other.normalizedPos - rawPos)
    if (dist < bestDist) {
      bestDist = dist
      bestPos = other.normalizedPos

      if (tab.direction === 'horizontal') {
        const alignX = other.edgeStart + other.normalizedPos * other.edgeLength
        guides.length = 0
        guides.push({
          x1: alignX, y1: 0,
          x2: alignX, y2: panelLayout.totalHeight,
        })
      } else {
        const alignY = other.edgeStart + other.normalizedPos * other.edgeLength
        guides.length = 0
        guides.push({
          x1: 0, y1: alignY,
          x2: panelLayout.totalWidth, y2: alignY,
        })
      }
    }
  }

  if (bestDist < snapNorm) {
    return { snappedPos: Math.max(0.05, Math.min(0.95, bestPos)), guides }
  }
  return { snappedPos: Math.max(0.05, Math.min(0.95, rawPos)), guides: [] }
}

function fmtMm(v: number, decimals: number = 1): string {
  // Keep labels compact but readable.
  if (!isFinite(v)) return decimals === 2 ? '0.00' : '0.0'
  const f = Math.pow(10, decimals)
  return (Math.round(v * f) / f).toFixed(decimals)
}

function getPanelSilkscreenColor(isRealistic: boolean): string {
  if (isRealistic) return props.preset?.silkscreen ?? '#f2f2f2'
  return isLight.value ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)'
}

function parseCssColorToRgb(color: string): { r: number, g: number, b: number } | null {
  const c = color.trim()
  const hex = c.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const raw = hex[1]!
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
    }
  }
  const shortHex = c.match(/^#([0-9a-f]{3})$/i)
  if (shortHex) {
    const raw = shortHex[1]!
    return {
      r: parseInt(raw[0]! + raw[0]!, 16),
      g: parseInt(raw[1]! + raw[1]!, 16),
      b: parseInt(raw[2]! + raw[2]!, 16),
    }
  }
  const rgb = c.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)/i)
  if (rgb) {
    return {
      r: Math.max(0, Math.min(255, Math.round(Number(rgb[1])))),
      g: Math.max(0, Math.min(255, Math.round(Number(rgb[2])))),
      b: Math.max(0, Math.min(255, Math.round(Number(rgb[3])))),
    }
  }
  return null
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function mixRgb(
  a: { r: number, g: number, b: number },
  b: { r: number, g: number, b: number },
  t: number,
): { r: number, g: number, b: number } {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  }
}

function getActiveSolderMaskColor(side: 'top' | 'bottom', isRealistic: boolean): string {
  if (isRealistic) return props.preset?.solderMask ?? '#146b3a'
  const maskType = side === 'bottom' ? 'Bottom Solder Mask' : 'Top Solder Mask'
  const fromVisibleLayers = props.layers.find(layer => layer.type === maskType)?.color
  if (fromVisibleLayers) return fromVisibleLayers
  const fromAllLayers = props.allLayers?.find(layer => layer.type === maskType)?.color
  if (fromAllLayers) return fromAllLayers
  return getColorForType(maskType)
}

function getVcutLineStrokeColor(oc: OverlayContext): string {
  const side = oc.side ?? (props.activeFilter === 'bot' ? 'bottom' : 'top')
  const baseMask = getActiveSolderMaskColor(side, oc.isRealistic)
  const baseRgb = parseCssColorToRgb(baseMask)
  if (!baseRgb) return '#1a1a1a'

  const luminance = (0.299 * baseRgb.r + 0.587 * baseRgb.g + 0.114 * baseRgb.b) / 255
  if (luminance >= 0.58) {
    // Light solder mask -> darkened shade of the same mask hue (muted contrast).
    const shaded = mixRgb(baseRgb, { r: 0, g: 0, b: 0 }, 0.62)
    return rgbToHex(shaded.r, shaded.g, shaded.b)
  }
  // Dark solder mask -> brightened shade of the same mask hue (muted contrast).
  const shaded = mixRgb(baseRgb, { r: 255, g: 255, b: 255 }, 0.64)
  return rgbToHex(shaded.r, shaded.g, shaded.b)
}

function getVcutLineWidthPx(oc: OverlayContext): number {
  // Keep V-cut visually stable: physical target width with a tight on-screen clamp.
  return Math.max(2.25 * oc.dpr, Math.min(3.75 * oc.dpr, mmToPx(oc, 0.22)))
}

function drawPanelSilkscreenLabels(oc: OverlayContext, panelLayout: PanelLayout) {
  const { ctx } = oc
  const effectiveMirrored = oc.mirrored ?? !!props.mirrored
  const effectiveSide = oc.side ?? (props.activeFilter === 'bot' ? 'bottom' : 'top')
  const w = panelLayout.totalWidth
  const h = panelLayout.totalHeight

  const frameTop = panelLayout.frame?.railTop ?? 0
  const frameBottom = panelLayout.frame?.railBottom ?? 0
  const frameRight = panelLayout.frame?.railRight ?? 0
  const hasFrame = !!panelLayout.frame

  // Physical text sizing in panel mm so labels scale with zoom/object transform.
  const refFontPx = mmToPx(oc, 2.0)
  const titleFontPx = refFontPx
  const monoFont = 'Consolas, "SFMono-Regular", Menlo, Monaco, "Liberation Mono", monospace'

  ctx.save()
  ctx.fillStyle = getPanelSilkscreenColor(oc.isRealistic)
  ctx.textBaseline = 'middle'
  ctx.textRendering = 'geometricPrecision'

  const drawReadableText = (
    text: string,
    x: number,
    y: number,
    align: CanvasTextAlign,
  ) => {
    ctx.save()
    // When mirrored text is counter-flipped, left/right alignment semantics swap.
    let effectiveAlign = align
    if (effectiveMirrored) {
      if (align === 'left') effectiveAlign = 'right'
      else if (align === 'right') effectiveAlign = 'left'
    }
    ctx.textAlign = effectiveAlign
    if (effectiveMirrored) {
      // Global panel mirror is active for bottom view. Counter-flip text locally
      // so it remains readable while all geometry stays mirrored.
      ctx.translate(x, y)
      ctx.scale(-1, 1)
      ctx.fillText(text, 0, 0)
    } else {
      ctx.fillText(text, x, y)
    }
    ctx.restore()
  }

  // --- Reference points (fiducials) ---
  // Use fiducials as "reference points". If none exist, skip (no guesses).
  const refs = panelLayout.fiducials
  if (refs.length > 0) {
    ctx.font = `600 ${refFontPx}px ${monoFont}`

    const offsetMm = 3.0
    const maxInsetMm = 2.0

    for (let i = 0; i < refs.length; i++) {
      const r = refs[i]!
      const name = `Ref${i + 1}`

      // Coordinates requested are bottom-left origin (0/0).
      const xBl = r.cx
      const yBl = h - r.cy

      // Place label to the inside of the panel, next to the marker.
      // Keep Y aligned with fiducial centerline.
      const onLeftHalf = r.cx <= w / 2

      const labelXmm = Math.max(maxInsetMm, Math.min(w - maxInsetMm, r.cx + (onLeftHalf ? offsetMm : -offsetMm)))
      const labelYmm = r.cy

      const p = toScreen(oc, labelXmm, labelYmm)

      // One-line label aligned with the fiducial center.
      const label = `${name}  X:${fmtMm(xBl)}  Y:${fmtMm(yBl)}`
      drawReadableText(label, p.sx, p.sy, onLeftHalf ? 'left' : 'right')
    }
  }

  // --- Frame titles: top-center project name, bottom-center panel size ---
  const centerX = w / 2
  const topY = hasFrame ? Math.max(2.5, frameTop / 2) : 2.5
  const bottomY = hasFrame ? Math.min(h - 2.5, h - frameBottom / 2) : (h - 2.5)
  const isBottomView = effectiveSide === 'bottom'

  ctx.font = `600 ${titleFontPx}px ${monoFont}`

  const projectName = (props.projectName ?? '').trim()
  {
    const tp = toScreen(oc, centerX, topY)
    const sideLabel = isBottomView ? 'BOTTOM SIDE' : 'TOP SIDE'
    const nameLabel = projectName || 'Untitled'
    const gapPx = titleFontPx * 1.0
    const sideFontSize = titleFontPx * 1.1
    const sideFont = `800 ${sideFontSize}px ${monoFont}`
    const nameFont = `600 ${titleFontPx}px ${monoFont}`
    const padX = titleFontPx * 0.45
    const padY = titleFontPx * 0.3

    ctx.save()
    if (effectiveMirrored) {
      ctx.translate(tp.sx, tp.sy)
      ctx.scale(-1, 1)
      ctx.translate(-tp.sx, -tp.sy)
    }
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'

    ctx.font = sideFont
    const sideW = ctx.measureText(sideLabel).width
    const badgeW = sideW + padX * 2
    const badgeH = sideFontSize + padY * 2

    let totalW = badgeW
    if (!isBottomView) {
      ctx.font = nameFont
      const nameW = ctx.measureText(nameLabel).width
      totalW += gapPx + nameW
    }
    const startX = tp.sx - totalW / 2

    // Framed side badge to make TOP/BOTTOM side stand out
    ctx.strokeStyle = getPanelSilkscreenColor(oc.isRealistic)
    ctx.lineWidth = Math.max(1 * oc.dpr, mmToPx(oc, 0.12))
    ctx.strokeRect(startX, tp.sy - badgeH / 2, badgeW, badgeH)
    ctx.font = sideFont
    ctx.fillText(sideLabel, startX + padX, tp.sy)

    if (!isBottomView) {
      ctx.font = nameFont
      ctx.fillText(nameLabel, startX + badgeW + gapPx, tp.sy)
    }
    ctx.restore()
  }

  if (!isBottomView) {
    const layerCount = props.pcbData?.layerCount ?? detectCopperLayerCount()
    const outerCopper = props.pcbData?.copperWeight
    const innerCopper = props.pcbData?.innerCopperWeight ?? '0.5oz'
    const outerUm = copperWeightToUm(outerCopper)
    const innerUm = copperWeightToUm(innerCopper)

    let infoLine = ''
    if (layerCount != null) infoLine += `${layerCount}L`
    if (outerCopper) {
      const outerPart = outerUm != null ? `${outerUm}µm (${formatCopperWeight(outerCopper)})` : formatCopperWeight(outerCopper)
      infoLine += `${infoLine ? ' · ' : ''}Cu: ${outerPart}`
    }
    if ((layerCount ?? 0) > 2) {
      const innerPart = innerUm != null ? `${innerUm}µm (${formatCopperWeight(innerCopper)})` : formatCopperWeight(innerCopper)
      infoLine += `${infoLine ? ' · ' : ''}Inner: ${innerPart}`
    }

    if (infoLine) {
      const infoX = w - (hasFrame ? Math.max(2.5, frameRight * 0.45) : 2.5)
      const infoY = topY
      const ip = toScreen(oc, infoX, infoY)
      drawReadableText(infoLine, ip.sx, ip.sy, 'right')
    }
  }

  if (!isBottomView) {
    const sizeLabel = `Panel size: ${fmtMm(w, 2)} x ${fmtMm(h, 2)} mm`
    const bp = toScreen(oc, centerX, bottomY)
    const hasBoardSize = !!props.boardSizeMm
    if (hasBoardSize) {
      const pcb = props.boardSizeMm!
      const pcbSizeLabel = `Single PCB size: ${fmtMm(pcb.width, 2)} x ${fmtMm(pcb.height, 2)} mm`
      const lineGap = titleFontPx * 1.15
      drawReadableText(sizeLabel, bp.sx, bp.sy - lineGap / 2, 'center')
      drawReadableText(pcbSizeLabel, bp.sx, bp.sy + lineGap / 2, 'center')
    } else {
      drawReadableText(sizeLabel, bp.sx, bp.sy, 'center')
    }
  }

  ctx.restore()
}

// ─── V-Cut hole punch helper ───
// In V-Cut mode the continuous substrate background hides transparent areas
// in the PCB tile (drills, outline cutouts). This builds a canvas that marks
// exactly those "hole" pixels so they can be stamped over the background.

function buildVCutHolesCanvas(
  tileCanvas: HTMLCanvasElement,
  tileW: number,
  tileH: number,
  tileTransform: { offsetX: number; offsetY: number; scale: number },
  dpr: number,
  isRealistic: boolean,
  forExport = false,
): HTMLCanvasElement | null {
  if (!isRealistic && !forExport) return null

  const outlineLayer = findOutlineLayer()
  const outlineTree = outlineLayer ? getImageTree(outlineLayer) : null
  const hasOutline = outlineTree && outlineTree.children.length > 0

  const holesCanvas = acquireCanvas(tileW, tileH)
  const holesCtx = holesCanvas.getContext('2d')!

  if (hasOutline) {
    renderOuterBoundaryOnly(outlineTree!, holesCanvas, {
      color: '#ffffff',
      transform: tileTransform,
      dpr,
    })
  } else {
    holesCtx.fillStyle = '#fff'
    holesCtx.fillRect(0, 0, tileW, tileH)
  }

  // Erase opaque tile pixels → only transparent areas (drills + cutouts) remain
  holesCtx.globalCompositeOperation = 'destination-out'
  holesCtx.drawImage(tileCanvas, 0, 0)
  holesCtx.globalCompositeOperation = 'source-over'

  if (forExport) {
    // Export uses destination-out on the main canvas; keep white mask as-is
    return holesCanvas
  }

  // Tint holes to canvas background color
  const bgColor = isRealistic
    ? (isLight.value ? '#e8e8ec' : '#1a1a1e')
    : (isLight.value ? '#f5f5f5' : '#111111')
  holesCtx.globalCompositeOperation = 'source-in'
  holesCtx.fillStyle = bgColor
  holesCtx.fillRect(0, 0, tileW, tileH)
  holesCtx.globalCompositeOperation = 'source-over'

  return holesCanvas
}

// ─── Panel background (drawn BEFORE PCB tiles) ───

function drawPanelBackground(oc: OverlayContext, panelLayout: PanelLayout) {
  const { ctx } = oc
  const allScored = !hasAnyRoutedSeparation(props.panelConfig)

  // Frame
  if (panelLayout.frame) {
    const f = panelLayout.frame
    const tl = toScreen(oc, f.outerX, f.outerY)
    const br = toScreen(oc, f.outerX + f.outerWidth, f.outerY + f.outerHeight)
    const itl = toScreen(oc, f.innerX, f.innerY)
    const ibr = toScreen(oc, f.innerX + f.innerWidth, f.innerY + f.innerHeight)
    const outerW = br.sx - tl.sx
    const outerH = br.sy - tl.sy
    const cornerR = mmToPx(oc, f.cornerRadius)

    ctx.save()

    if (oc.isRealistic) {
      const substrateColor = props.preset?.substrate ?? '#c2a366'
      const maskColor = props.preset?.solderMask ?? '#146b3a'

      if (allScored) {
        // V-Cut: continuous substrate, fill entire panel
        ctx.fillStyle = substrateColor
        ctx.beginPath()
        roundedRect(ctx, tl.sx, tl.sy, outerW, outerH, cornerR)
        ctx.fill()

        // Solder mask on top of the frame area (outer minus inner)
        ctx.fillStyle = maskColor
        ctx.beginPath()
        roundedRect(ctx, tl.sx, tl.sy, outerW, outerH, cornerR)
        const iw = ibr.sx - itl.sx
        const ih = ibr.sy - itl.sy
        ctx.moveTo(itl.sx, itl.sy)
        ctx.lineTo(itl.sx, itl.sy + ih)
        ctx.lineTo(itl.sx + iw, itl.sy + ih)
        ctx.lineTo(itl.sx + iw, itl.sy)
        ctx.closePath()
        ctx.fill('evenodd')
      } else {
        // Routed: frame ring only (evenodd to avoid destination-out)
        // Substrate base
        ctx.fillStyle = substrateColor
        ctx.beginPath()
        roundedRect(ctx, tl.sx, tl.sy, outerW, outerH, cornerR)
        const iw = ibr.sx - itl.sx
        const ih = ibr.sy - itl.sy
        ctx.moveTo(itl.sx, itl.sy)
        ctx.lineTo(itl.sx, itl.sy + ih)
        ctx.lineTo(itl.sx + iw, itl.sy + ih)
        ctx.lineTo(itl.sx + iw, itl.sy)
        ctx.closePath()
        ctx.fill('evenodd')

        // Solder mask on top of the frame ring
        ctx.fillStyle = maskColor
        ctx.beginPath()
        roundedRect(ctx, tl.sx, tl.sy, outerW, outerH, cornerR)
        ctx.moveTo(itl.sx, itl.sy)
        ctx.lineTo(itl.sx, itl.sy + ih)
        ctx.lineTo(itl.sx + iw, itl.sy + ih)
        ctx.lineTo(itl.sx + iw, itl.sy)
        ctx.closePath()
        ctx.fill('evenodd')
      }
    } else {
      if (allScored) {
        ctx.fillStyle = isLight.value ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)'
        ctx.beginPath()
        roundedRect(ctx, tl.sx, tl.sy, outerW, outerH, cornerR)
        ctx.fill()
      } else {
        ctx.fillStyle = isLight.value ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)'
        ctx.beginPath()
        roundedRect(ctx, tl.sx, tl.sy, outerW, outerH, cornerR)
        const iw = ibr.sx - itl.sx
        const ih = ibr.sy - itl.sy
        ctx.moveTo(itl.sx, itl.sy)
        ctx.lineTo(itl.sx, itl.sy + ih)
        ctx.lineTo(itl.sx + iw, itl.sy + ih)
        ctx.lineTo(itl.sx + iw, itl.sy)
        ctx.closePath()
        ctx.fill('evenodd')
      }
    }

    ctx.restore()
  }

  // Support rails (background fill)
  for (const rail of panelLayout.supportRails) {
    const tl = toScreen(oc, rail.x, rail.y)
    const br = toScreen(oc, rail.x + rail.width, rail.y + rail.height)
    const rw = br.sx - tl.sx
    const rh = br.sy - tl.sy
    ctx.save()
    if (oc.isRealistic) {
      // Substrate base
      ctx.fillStyle = props.preset?.substrate ?? '#c2a366'
      ctx.fillRect(tl.sx, tl.sy, rw, rh)
      // Solder mask on top
      ctx.fillStyle = props.preset?.solderMask ?? '#146b3a'
      ctx.fillRect(tl.sx, tl.sy, rw, rh)
    } else {
      ctx.fillStyle = isLight.value ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'
      ctx.fillRect(tl.sx, tl.sy, rw, rh)
    }
    ctx.restore()
  }
}

// ─── Panel foreground (drawn AFTER PCB tiles) ───

function drawPanelForeground(oc: OverlayContext, panelLayout: PanelLayout) {
  const { ctx } = oc

  // Frame outline (layers mode)
  if (panelLayout.frame && !oc.isRealistic) {
    const f = panelLayout.frame
    const tl = toScreen(oc, f.outerX, f.outerY)
    const br = toScreen(oc, f.outerX + f.outerWidth, f.outerY + f.outerHeight)
    const outerW = br.sx - tl.sx
    const outerH = br.sy - tl.sy
    const cornerR = mmToPx(oc, f.cornerRadius)

    ctx.save()
    ctx.strokeStyle = isLight.value ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 1.5 * oc.dpr
    ctx.beginPath()
    roundedRect(ctx, tl.sx, tl.sy, outerW, outerH, cornerR)
    ctx.stroke()

    if (hasAnyRoutedSeparation(props.panelConfig)) {
      const itl = toScreen(oc, f.innerX, f.innerY)
      const ibr = toScreen(oc, f.innerX + f.innerWidth, f.innerY + f.innerHeight)
      ctx.beginPath()
      ctx.rect(itl.sx, itl.sy, ibr.sx - itl.sx, ibr.sy - itl.sy)
      ctx.stroke()
    }
    ctx.restore()
  }

  // Support rail strokes (layers mode)
  if (!oc.isRealistic) {
    for (const rail of panelLayout.supportRails) {
      const tl = toScreen(oc, rail.x, rail.y)
      const br = toScreen(oc, rail.x + rail.width, rail.y + rail.height)
      ctx.save()
      ctx.strokeStyle = isLight.value ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 1 * oc.dpr
      ctx.strokeRect(tl.sx, tl.sy, br.sx - tl.sx, br.sy - tl.sy)
      ctx.restore()
    }
  }

  // Routing channels
  for (const ch of panelLayout.routingChannels) {
    const p1 = toScreen(oc, ch.x1, ch.y1)
    const p2 = toScreen(oc, ch.x2, ch.y2)
    const w = mmToPx(oc, ch.width)

    ctx.save()
    if (oc.exportTransparent) {
      // Export should carry true physical cutouts as alpha, not painted "background color" lines.
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = '#000'
    } else if (oc.isRealistic) {
      ctx.strokeStyle = isLight.value ? '#e8e8ec' : '#1a1a1e'
    } else {
      ctx.strokeStyle = isLight.value ? 'rgba(200,150,50,0.25)' : 'rgba(200,150,50,0.2)'
    }
    ctx.lineWidth = w
    ctx.lineCap = 'butt'
    ctx.beginPath()
    ctx.moveTo(p1.sx, p1.sy)
    ctx.lineTo(p2.sx, p2.sy)
    ctx.stroke()
    ctx.restore()
  }

  // Tabs – routed shape with inverted half-moon cutouts and optional mouse bites
  const tabPerf = props.panelConfig.tabs?.perforation ?? 'pcb-side'
  const perfHoleDia = props.panelConfig.tabs?.perforationHoleDiameter ?? 0.5
  const perfHoleSpacing = props.panelConfig.tabs?.perforationHoleSpacing ?? 0.8

  for (const tab of panelLayout.tabs) {
    ctx.save()
    if (oc.isRealistic) {
      ctx.fillStyle = props.preset?.substrate ?? '#c2a366'
    } else {
      ctx.fillStyle = isLight.value ? 'rgba(140,100,40,0.35)' : 'rgba(200,160,80,0.3)'
    }

    // Baseline tab shape: plain rectangular bridge.
    const tl = toScreen(oc, tab.x, tab.y)
    const br = toScreen(oc, tab.x + tab.width, tab.y + tab.height)
    const sx = tl.sx
    const sy = tl.sy
    const w = br.sx - tl.sx
    const h = br.sy - tl.sy

    const toolR = mmToPx(oc, (props.panelConfig.routingToolDiameter ?? 2) / 2)
    // Sub-pixel overlap to avoid anti-aliased seams between PCB tile edges and tab fill.
    // This is visual-only compensation; panel geometry remains unchanged in mm-space.
    const seamOverlapPx = Math.max(0.75 * oc.dpr, mmToPx(oc, 0.03))
    const fillX = tab.direction === 'vertical' ? (sx - seamOverlapPx) : sx
    const fillY = tab.direction === 'horizontal' ? (sy - seamOverlapPx) : sy
    const fillW = tab.direction === 'vertical' ? (w + seamOverlapPx * 2) : w
    const fillH = tab.direction === 'horizontal' ? (h + seamOverlapPx * 2) : h
    ctx.fillRect(fillX, fillY, fillW, fillH)

    // IMPORTANT: Keep this as a subtractive cut (`destination-out`) on top of the
    // rectangular tab base. Do NOT switch back to even-odd path unions here.
    // Why: the router removes material only where the tool overlaps the tab box.
    // If we union circles into the fill path, "outside lobes" appear and the tab
    // shape becomes wrong. This exact bug was fixed by using destination-out cuts.
    //
    // Orientation:
    // - horizontal tab (w >= h): cut left + right ends
    // - vertical tab: cut top + bottom ends
    if (toolR > 0) {
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      if (w >= h) {
        const cy = sy + h / 2
        ctx.moveTo(sx + toolR, cy)
        ctx.arc(sx, cy, toolR, 0, Math.PI * 2)
        ctx.moveTo(sx + w + toolR, cy)
        ctx.arc(sx + w, cy, toolR, 0, Math.PI * 2)
      } else {
        const cx = sx + w / 2
        ctx.moveTo(cx + toolR, sy)
        ctx.arc(cx, sy, toolR, 0, Math.PI * 2)
        ctx.moveTo(cx + toolR, sy + h)
        ctx.arc(cx, sy + h, toolR, 0, Math.PI * 2)
      }
      ctx.fill()
      ctx.restore()
    }

    if (!oc.isRealistic) {
      ctx.strokeStyle = isLight.value ? 'rgba(140,100,40,0.5)' : 'rgba(200,160,80,0.5)'
      ctx.lineWidth = 1 * oc.dpr
      ctx.strokeRect(sx, sy, w, h)
    }

    // Mouse bite perforation holes
    if (tabPerf !== 'none') {
      const holeR = mmToPx(oc, perfHoleDia / 2)
      const spacingPx = mmToPx(oc, perfHoleSpacing)

      if (oc.exportTransparent) {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.fillStyle = '#000'
      } else {
        ctx.fillStyle = oc.isRealistic
          ? (isLight.value ? '#e8e8ec' : '#1a1a1e')
          : (isLight.value ? 'rgba(100,100,100,0.7)' : 'rgba(220,220,220,0.6)')
      }

      // Mouse-bite holes run along the long tab direction.
      // For perforation mode:
      // - pcb-side: one row on the tab edge that touches the source PCB
      // - both-sides: one row on each tab edge (PCB edge + opposite edge)
      const isWide = w >= h
      if (isWide) {
        // Row runs horizontally
        const rowLen = Math.max(0, w - holeR * 4)
        const nHoles = Math.max(1, Math.round(rowLen / spacingPx) + 1)
        const actualSpacing = nHoles > 1 ? rowLen / (nHoles - 1) : 0
        const rowStartX = sx + holeR * 2

        const perfY: number[] = []
        if (tabPerf === 'pcb-side') {
          // Horizontal tab: edge='bottom' means PCB is above tab, edge='top' means PCB is below tab.
          const pcbSideY = tab.edge === 'top' ? (sy + h) : sy
          perfY.push(pcbSideY)
        }
        if (tabPerf === 'both-sides') {
          perfY.push(sy, sy + h)
        }
        for (const py of perfY) {
          for (let i = 0; i < nHoles; i++) {
            ctx.beginPath()
            ctx.arc(rowStartX + i * actualSpacing, py, holeR, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      } else {
        // Row runs vertically
        const rowLen = Math.max(0, h - holeR * 4)
        const nHoles = Math.max(1, Math.round(rowLen / spacingPx) + 1)
        const actualSpacing = nHoles > 1 ? rowLen / (nHoles - 1) : 0
        const rowStartY = sy + holeR * 2

        const perfX: number[] = []
        if (tabPerf === 'pcb-side') {
          // Vertical tab: edge='right' means PCB is left of tab, edge='left' means PCB is right of tab.
          const pcbSideX = tab.edge === 'left' ? (sx + w) : sx
          perfX.push(pcbSideX)
        }
        if (tabPerf === 'both-sides') {
          perfX.push(sx, sx + w)
        }
        for (const px of perfX) {
          for (let i = 0; i < nHoles; i++) {
            ctx.beginPath()
            ctx.arc(px, rowStartY + i * actualSpacing, holeR, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
    }

    ctx.restore()
  }

  // V-cut lines
  for (const vcut of panelLayout.vcutLines) {
    const p1 = toScreen(oc, vcut.x1, vcut.y1)
    const p2 = toScreen(oc, vcut.x2, vcut.y2)
    ctx.save()
    ctx.setLineDash([])
    ctx.lineCap = 'butt'
    ctx.lineJoin = 'miter'
    ctx.strokeStyle = getVcutLineStrokeColor(oc)
    ctx.lineWidth = getVcutLineWidthPx(oc)
    ctx.beginPath()
    ctx.moveTo(p1.sx, p1.sy)
    ctx.lineTo(p2.sx, p2.sy)
    ctx.stroke()
    ctx.restore()
  }

  // Fiducials
  // The configured diameter is the copper pad. The solder mask opening is 2x the copper diameter.
  for (const fid of panelLayout.fiducials) {
    const center = toScreen(oc, fid.cx, fid.cy)
    const copperR = mmToPx(oc, fid.diameter / 2)
    const maskR = mmToPx(oc, fid.diameter) // mask opening = 2x copper diameter

    ctx.save()

    // Solder mask opening (exposed substrate/surface finish area)
    ctx.beginPath()
    ctx.arc(center.sx, center.sy, maskR, 0, Math.PI * 2)
    if (oc.isRealistic) {
      ctx.fillStyle = props.preset?.substrate ?? '#c2a366'
    } else {
      ctx.fillStyle = isLight.value ? 'rgba(180,140,60,0.15)' : 'rgba(200,170,80,0.1)'
    }
    ctx.fill()

    // Mask opening border
    ctx.beginPath()
    ctx.arc(center.sx, center.sy, maskR, 0, Math.PI * 2)
    ctx.lineWidth = 1 * oc.dpr
    ctx.strokeStyle = oc.isRealistic
      ? (props.preset?.solderMask ?? '#146b3a')
      : (isLight.value ? 'rgba(0,100,0,0.4)' : 'rgba(0,200,100,0.3)')
    ctx.stroke()

    // Copper pad
    ctx.beginPath()
    ctx.arc(center.sx, center.sy, copperR, 0, Math.PI * 2)
    ctx.fillStyle = oc.isRealistic
      ? (props.preset?.surfaceFinish ?? '#c5b358')
      : (isLight.value ? '#b87333' : '#d4954a')
    ctx.fill()

    ctx.restore()
  }

  // Tooling holes (non-plated through-holes)
  for (const th of panelLayout.toolingHoles) {
    const center = toScreen(oc, th.cx, th.cy)
    const holeR = mmToPx(oc, th.diameter / 2)

    ctx.save()

    // Hole (drilled through)
    ctx.beginPath()
    ctx.arc(center.sx, center.sy, holeR, 0, Math.PI * 2)
    if (oc.exportTransparent) {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = '#000'
    } else {
      ctx.fillStyle = oc.isRealistic
        ? (isLight.value ? '#e8e8ec' : '#1a1a1e')
        : (isLight.value ? '#f5f5f5' : '#222')
    }
    ctx.fill()

    // Ring + crosshair are preview-only helpers; keep exports physically clean.
    if (!oc.exportTransparent) {
      ctx.beginPath()
      ctx.arc(center.sx, center.sy, holeR, 0, Math.PI * 2)
      ctx.lineWidth = 1.5 * oc.dpr
      ctx.strokeStyle = oc.isRealistic
        ? 'rgba(80,80,80,0.6)'
        : (isLight.value ? 'rgba(80,80,80,0.5)' : 'rgba(180,180,180,0.4)')
      ctx.stroke()
    }

    // Cross-hair marker (layers mode only, for on-canvas clarity)
    if (!oc.exportTransparent && !oc.isRealistic) {
      const cross = holeR * 0.6
      ctx.strokeStyle = isLight.value ? 'rgba(80,80,80,0.4)' : 'rgba(200,200,200,0.35)'
      ctx.lineWidth = 1 * oc.dpr
      ctx.beginPath()
      ctx.moveTo(center.sx - cross, center.sy)
      ctx.lineTo(center.sx + cross, center.sy)
      ctx.moveTo(center.sx, center.sy - cross)
      ctx.lineTo(center.sx, center.sy + cross)
      ctx.stroke()
    }

    ctx.restore()
  }

  // Danger zone overlay
  const dz = props.dangerZone
  if (dz?.enabled && dz.insetMm > 0 && panelLayout.pcbs.length > 0) {
    drawDangerZone(oc, panelLayout, dz.insetMm)
  }

  // Silkscreen-style labels (reference points + panel info)
  drawPanelSilkscreenLabels(oc, panelLayout)
}

// ─── Danger zone overlay ───

// Cache the danger zone tile so we don't recompute on every frame at the same zoom
let _dzCache: {
  key: string
  insetMm: number
  width: number
  height: number
  canvas: HTMLCanvasElement
} | null = null

function drawDangerZone(oc: OverlayContext, panelLayout: PanelLayout, insetMm: number) {
  const { ctx } = oc
  const pcbW = panelLayout.pcbLayoutWidth
  const pcbH = panelLayout.pcbLayoutHeight

  if (insetMm <= 0 || insetMm >= pcbW / 2 || insetMm >= pcbH / 2) return

  const outlineBounds = getOutlineBoundsGerber()
  if (!outlineBounds) return

  const outGerberW = outlineBounds[2] - outlineBounds[0]
  const outGerberH = outlineBounds[3] - outlineBounds[1]
  const tileW = Math.ceil(outGerberW * oc.transform.scale * oc.dpr) + 2
  const tileH = Math.ceil(outGerberH * oc.transform.scale * oc.dpr) + 2

  if (tileW <= 0 || tileH <= 0 || tileW > 8192 || tileH > 8192) return

  const insetPx = mmToPx(oc, insetMm)
  if (insetPx < 1) return

  // Check cache
  const outlineKey = `${outlineBounds[0]},${outlineBounds[1]},${outlineBounds[2]},${outlineBounds[3]}`
  const cacheKey = `${oc.transform.scale}|${oc.dpr}|${outlineKey}|${tileW}|${tileH}`
  let dangerTile: HTMLCanvasElement

  if (_dzCache
    && _dzCache.key === cacheKey
    && _dzCache.insetMm === insetMm
    && _dzCache.width === tileW
    && _dzCache.height === tileH) {
    dangerTile = _dzCache.canvas
    panelPerf.dangerTileHits++
  } else {
    dangerTile = buildDangerZoneTile(tileW, tileH, outlineBounds, oc, insetPx)
    if (_dzCache) releaseCanvas(_dzCache.canvas)
    _dzCache = { key: cacheKey, insetMm, width: tileW, height: tileH, canvas: dangerTile }
    panelPerf.dangerTileBuilds++
  }

  // Stamp the danger zone tile onto each PCB instance
  for (const pcb of panelLayout.pcbs) {
    const tl = toScreen(oc, pcb.x, pcb.y)
    const { dx, dy } = rotationAnchorOffsetPx(pcb.rotation, tileW, tileH)
    const drawX = tl.sx + dx
    const drawY = tl.sy + dy

    ctx.save()
    if (pcb.rotation !== 0) {
      const cx = drawX + tileW / 2
      const cy = drawY + tileH / 2
      ctx.translate(cx, cy)
      ctx.rotate((pcb.rotation * Math.PI) / 180)
      ctx.translate(-cx, -cy)
    }
    ctx.drawImage(dangerTile, drawX, drawY)
    ctx.restore()
  }
}


/**
 * Build the danger zone tile: a semi-transparent red ring that follows the
 * board outline contour inward by `insetPx` pixels.
 *
 * Uses morphological erosion via intersection of directionally-shifted copies
 * of the outline mask, then subtracts the eroded interior from the full shape.
 */
function buildDangerZoneTile(
  tileW: number, tileH: number,
  outlineBounds: BoundingBox,
  oc: OverlayContext,
  insetPx: number,
): HTMLCanvasElement {
  const tileTransform = {
    offsetX: -outlineBounds[0] * oc.transform.scale,
    offsetY: outlineBounds[3] * oc.transform.scale,
    scale: oc.transform.scale,
  }

  // Render only the outer boundary of the PCB (no internal cutouts like
  // drill holes or slots) so the danger zone only follows the external edge.
  const outlineLayer = findOutlineLayer()
  const fullShape = acquireCanvas(tileW, tileH)

  if (outlineLayer) {
    const outlineTree = getImageTree(outlineLayer)
    if (outlineTree && outlineTree.children.length > 0) {
      renderOuterBoundaryOnly(outlineTree, fullShape, {
        color: '#ffffff',
        transform: tileTransform,
        dpr: oc.dpr,
      })
    } else {
      const fCtx = fullShape.getContext('2d')!
      fCtx.fillStyle = '#ffffff'
      fCtx.fillRect(0, 0, tileW, tileH)
    }
  } else {
    const fCtx = fullShape.getContext('2d')!
    fCtx.fillStyle = '#ffffff'
    fCtx.fillRect(0, 0, tileW, tileH)
  }

  // Erode the shape inward by insetPx using morphological erosion.
  // Erosion = intersection of all directionally-shifted copies of the shape.
  // A pixel survives only if the shape exists in all shifted directions around it.
  const eroded = acquireCanvas(tileW, tileH)
  const eCtx = eroded.getContext('2d')!
  eCtx.drawImage(fullShape, 0, 0)

  const numDirs = 16
  for (let i = 0; i < numDirs; i++) {
    const angle = (i / numDirs) * Math.PI * 2
    const dx = Math.cos(angle) * insetPx
    const dy = Math.sin(angle) * insetPx
    eCtx.globalCompositeOperation = 'destination-in'
    eCtx.drawImage(fullShape, -dx, -dy)
  }
  eCtx.globalCompositeOperation = 'source-over'

  // Danger zone = full shape minus eroded interior
  const dangerTile = acquireCanvas(tileW, tileH)
  const dCtx = dangerTile.getContext('2d')!
  dCtx.drawImage(fullShape, 0, 0)
  dCtx.globalCompositeOperation = 'destination-out'
  dCtx.drawImage(eroded, 0, 0)
  dCtx.globalCompositeOperation = 'source-over'

  // Tint the white ring with danger zone color
  dCtx.globalCompositeOperation = 'source-in'
  dCtx.fillStyle = 'rgba(255, 80, 40, 0.25)'
  dCtx.fillRect(0, 0, tileW, tileH)
  dCtx.globalCompositeOperation = 'source-over'

  // Draw a dashed line along the inner boundary (edge of eroded shape).
  // We extract the boundary by rendering a thin ring at the edge of the eroded shape.
  const boundary = acquireCanvas(tileW, tileH)
  const bCtx = boundary.getContext('2d')!
  bCtx.drawImage(eroded, 0, 0)
  // Shrink eroded shape by 1px further to get just the edge pixels
  const innerShrink = acquireCanvas(tileW, tileH)
  const isCtx = innerShrink.getContext('2d')!
  isCtx.drawImage(eroded, 0, 0)
  const shrinkPx = Math.max(1, oc.dpr)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    isCtx.globalCompositeOperation = 'destination-in'
    isCtx.drawImage(eroded, -Math.cos(angle) * shrinkPx, -Math.sin(angle) * shrinkPx)
  }
  isCtx.globalCompositeOperation = 'source-over'
  bCtx.globalCompositeOperation = 'destination-out'
  bCtx.drawImage(innerShrink, 0, 0)
  bCtx.globalCompositeOperation = 'source-in'
  bCtx.fillStyle = 'rgba(255, 80, 40, 0.6)'
  bCtx.fillRect(0, 0, tileW, tileH)
  bCtx.globalCompositeOperation = 'source-over'

  // Composite boundary onto danger tile
  dCtx.drawImage(boundary, 0, 0)

  releaseCanvas(fullShape)
  releaseCanvas(eroded)
  releaseCanvas(boundary)
  releaseCanvas(innerShrink)

  return dangerTile
}

// ─── Component rendering on tile ───

const footprintCache = new Map<string, FootprintShape[]>()
const thtFootprintCache = new Map<string, ColoredFootprintShape[]>()

function getCachedFootprint(pkg: PackageDefinition): FootprintShape[] {
  if (footprintCache.has(pkg.name)) return footprintCache.get(pkg.name)!
  const shapes = computeFootprint(pkg)
  footprintCache.set(pkg.name, shapes)
  return shapes
}

function getCachedThtFootprint(pkg: THTPackageDefinition): ColoredFootprintShape[] {
  const key = `tht:${pkg.name}`
  if (thtFootprintCache.has(key)) return thtFootprintCache.get(key)!
  const shapes = computeThtFootprint(pkg)
  thtFootprintCache.set(key, shapes)
  return shapes
}

// Package footprint colors
const PKG_BODY_FILL = 'rgba(50, 50, 50, 0.85)'
const PKG_BODY_STROKE = 'rgba(80, 80, 80, 0.9)'
const PKG_PAD_FILL = 'rgba(205, 205, 205, 0.9)'
const PKG_PIN1_FILL = 'rgba(255, 60, 60, 0.95)'
const PNP_DOT_COLOR = '#FF69B4'
const PNP_DOT_RADIUS = 3

function getEffectivePnpOrigin(outlineBounds: BoundingBox): { ox: number; oy: number } {
  return { ox: outlineBounds[0], oy: outlineBounds[1] }
}

function pnpToGerber(mmVal: number, originGerber: number, units: 'mm' | 'in'): number {
  const inGerberUnits = units === 'in' ? mmVal / 25.4 : mmVal
  return originGerber + inGerberUnits
}

/**
 * Draw PnP components (footprints + dots) onto an already-selected context.
 * The target context coordinate system must match `tileTransform` units.
 */
function drawComponentsOnContext(
  tileCtx: CanvasRenderingContext2D,
  tileTransform: { offsetX: number; offsetY: number; scale: number },
  outlineBounds: BoundingBox,
  dpr: number,
  options?: {
    components?: EditablePnPComponent[]
    includePackages?: boolean
  },
) {
  const components = options?.components ?? props.pnpComponents
  if (!components || components.length === 0) return
  const includePackages = options?.includePackages ?? !!props.showPackages
  if (!includePackages && !panelComponentsEnabled()) return

  const units = detectUnits()
  const { ox, oy } = getEffectivePnpOrigin(outlineBounds)
  const mmToGerberFactor = units === 'in' ? 1 / 25.4 : 1
  const mmToScreen = mmToGerberFactor * tileTransform.scale

  tileCtx.save()
  if (dpr !== 1) tileCtx.scale(dpr, dpr)

  // Draw package footprints first (underneath dots)
  if (includePackages && (props.matchPackage || props.matchThtPackage)) {
    for (const comp of components) {
      const pkgName = comp.matchedPackage || comp.package
      const isTht = comp.componentType === 'tht'

      let shapes: FootprintShape[]
      let rotRad: number

      if (isTht && props.matchThtPackage) {
        const thtPkg = props.matchThtPackage(pkgName)
        if (!thtPkg) continue
        shapes = getCachedThtFootprint(thtPkg)
        const thtDirection = (props.pnpConvention ?? 'iec61188') === 'mycronic' ? -1 : 1
        const rotationCCW = thtDirection * comp.rotation + 0
        rotRad = (-rotationCCW * Math.PI) / 180
      } else if (props.matchPackage) {
        const pkg = props.matchPackage(pkgName)
        if (!pkg) continue
        shapes = getCachedFootprint(pkg)
        const { direction, offsetDeg } = getConventionRotationTransform(pkg, props.pnpConvention ?? 'iec61188')
        const adjustedRotationCCW = direction * comp.rotation + offsetDeg
        rotRad = (-adjustedRotationCCW * Math.PI) / 180
      } else {
        continue
      }

      const gx = pnpToGerber(comp.x, ox, units)
      const gy = pnpToGerber(comp.y, oy, units)
      const centerSx = tileTransform.offsetX + gx * tileTransform.scale
      const centerSy = tileTransform.offsetY - gy * tileTransform.scale

      tileCtx.save()
      tileCtx.translate(centerSx, centerSy)
      tileCtx.rotate(rotRad)

      for (const shape of shapes) {
        drawFootprintShapeOnTile(tileCtx, shape, mmToScreen, comp.polarized)
      }

      tileCtx.restore()
    }
  }

  // Draw PnP dots for components without a matched package
  for (const comp of components) {
    const pkgName = comp.matchedPackage || comp.package
    const isTht = comp.componentType === 'tht'
    let hasPkg = false
    if (includePackages && isTht && props.matchThtPackage) {
      hasPkg = !!props.matchThtPackage(pkgName)
    } else if (includePackages && props.matchPackage) {
      hasPkg = !!(pkgName ? props.matchPackage(pkgName) : undefined)
    }
    if (hasPkg) continue

    const gx = pnpToGerber(comp.x, ox, units)
    const gy = pnpToGerber(comp.y, oy, units)
    const screenX = tileTransform.offsetX + gx * tileTransform.scale
    const screenY = tileTransform.offsetY - gy * tileTransform.scale

    tileCtx.beginPath()
    tileCtx.arc(screenX, screenY, PNP_DOT_RADIUS, 0, Math.PI * 2)
    tileCtx.fillStyle = PNP_DOT_COLOR
    tileCtx.fill()
  }

  tileCtx.restore()
}

/**
 * Draw component overlays for every PCB instance directly on the panel canvas.
 * This avoids clipping components to the board outline/tile bounds so packages
 * can protrude into gaps, tabs, and frame regions.
 */
function computeShapeExtentMm(shapes: FootprintShape[]): number {
  let maxDist = 0
  for (const shape of shapes) {
    if (shape.kind === 'circle') {
      maxDist = Math.max(maxDist, Math.hypot(shape.cx, shape.cy) + shape.r)
      continue
    }
    const hw = shape.w / 2
    const hh = shape.h / 2
    const corners = [
      [shape.cx - hw, shape.cy - hh],
      [shape.cx + hw, shape.cy - hh],
      [shape.cx - hw, shape.cy + hh],
      [shape.cx + hw, shape.cy + hh],
    ]
    for (const [x, y] of corners) maxDist = Math.max(maxDist, Math.hypot(x, y))
  }
  return maxDist
}

function computeComponentPaddingPx(
  components: EditablePnPComponent[],
  scalePx: number,
): number {
  let maxMm = 0.7 // Keep at least center dot + small margin
  for (const comp of components) {
    const pkgName = comp.matchedPackage || comp.package
    const isTht = comp.componentType === 'tht'
    if (isTht && props.matchThtPackage) {
      const pkg = props.matchThtPackage(pkgName)
      if (!pkg) continue
      maxMm = Math.max(maxMm, computeShapeExtentMm(getCachedThtFootprint(pkg)))
      continue
    }
    if (!props.matchPackage) continue
    const pkg = props.matchPackage(pkgName)
    if (!pkg) continue
    maxMm = Math.max(maxMm, computeShapeExtentMm(getCachedFootprint(pkg)))
  }
  const px = Math.ceil(maxMm * scalePx + 10)
  return Math.min(256, Math.max(12, px))
}

function drawPanelComponents(
  oc: OverlayContext,
  panelLayout: PanelLayout,
  outlineBounds: BoundingBox,
  options?: {
    components?: EditablePnPComponent[]
    includePackages?: boolean
    enabled?: boolean
  },
) {
  const enabled = options?.enabled ?? panelComponentsEnabled()
  if (!enabled) return
  const components = options?.components ?? props.pnpComponents
  if (!components || components.length === 0) return

  const outGerberW = outlineBounds[2] - outlineBounds[0]
  const outGerberH = outlineBounds[3] - outlineBounds[1]
  const scalePx = oc.transform.scale * oc.dpr
  const tileW = Math.ceil(outGerberW * scalePx) + 2
  const tileH = Math.ceil(outGerberH * scalePx) + 2
  if (tileW <= 0 || tileH <= 0) return

  const paddingPx = computeComponentPaddingPx(components, scalePx)
  const cacheKey = [
    tileW,
    tileH,
    paddingPx,
    scalePx.toFixed(4),
    oc.side ?? 'top',
    options?.includePackages ? '1' : '0',
    props.pnpConvention ?? 'iec61188',
    componentSignature(components),
  ].join('|')

  let componentTile: HTMLCanvasElement
  if (componentTileCache?.key === cacheKey
    && componentTileCache.canvas.width === tileW + paddingPx * 2
    && componentTileCache.canvas.height === tileH + paddingPx * 2) {
    componentTile = componentTileCache.canvas
    panelPerf.componentTileHits++
  } else {
    componentTile = acquireCanvas(tileW + paddingPx * 2, tileH + paddingPx * 2)
    const componentCtx = componentTile.getContext('2d')!
    const tileTransformPx = {
      offsetX: -outlineBounds[0] * scalePx + paddingPx,
      offsetY: outlineBounds[3] * scalePx + paddingPx,
      scale: scalePx,
    }
    drawComponentsOnContext(componentCtx, tileTransformPx, outlineBounds, 1, {
      components,
      includePackages: options?.includePackages,
    })
    if (componentTileCache) releaseCanvas(componentTileCache.canvas)
    componentTileCache = { key: cacheKey, canvas: componentTile }
    panelPerf.componentTileBuilds++
  }

  const panelHeightGerber = panelLayout.totalHeight / oc.toMm

  for (const pcb of panelLayout.pcbs) {
    const gerberX = mmToGerber(pcb.x)
    const gerberY = panelHeightGerber - mmToGerber(pcb.y)
    const screenX = (gerberX * oc.transform.scale + oc.transform.offsetX) * oc.dpr
    const screenY = (-gerberY * oc.transform.scale + oc.transform.offsetY) * oc.dpr
    const { dx, dy } = rotationAnchorOffsetPx(pcb.rotation, tileW, tileH)
    const drawX = screenX + dx
    const drawY = screenY + dy

    oc.ctx.save()
    if (pcb.rotation !== 0) {
      const cx = drawX + tileW / 2
      const cy = drawY + tileH / 2
      oc.ctx.translate(cx, cy)
      oc.ctx.rotate((pcb.rotation * Math.PI) / 180)
      oc.ctx.translate(-cx, -cy)
    }

    oc.ctx.drawImage(componentTile, drawX - paddingPx, drawY - paddingPx)
    oc.ctx.restore()
  }
}

function drawFootprintShapeOnTile(
  ctx: CanvasRenderingContext2D,
  shape: FootprintShape,
  mmToScreen: number,
  polarized: boolean,
) {
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
    const sx = shape.cx * mmToScreen
    const sy = -shape.cy * mmToScreen
    const sw = shape.w * mmToScreen
    const sh = shape.h * mmToScreen
    const role = (!polarized && shape.role === 'pin1') ? 'pad' : shape.role

    if (role === 'body') {
      ctx.fillStyle = customFill || PKG_BODY_FILL
      ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh)
      ctx.strokeStyle = customStroke || PKG_BODY_STROKE
      ctx.lineWidth = 1
      ctx.strokeRect(sx - sw / 2, sy - sh / 2, sw, sh)
    } else if (role === 'pad') {
      ctx.fillStyle = customFill || PKG_PAD_FILL
      ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh)
    } else if (role === 'pin1') {
      ctx.fillStyle = customFill || PKG_PIN1_FILL
      ctx.fillRect(sx - sw / 2, sy - sh / 2, sw, sh)
    }
  } else if (shape.kind === 'circle') {
    const sx = shape.cx * mmToScreen
    const sy = -shape.cy * mmToScreen
    const sr = shape.r * mmToScreen
    const role = (!polarized && shape.role === 'pin1') ? 'pad' : shape.role

    if (role === 'body') {
      ctx.beginPath()
      ctx.arc(sx, sy, sr, 0, Math.PI * 2)
      ctx.fillStyle = customFill || PKG_BODY_FILL
      ctx.fill()
      ctx.strokeStyle = customStroke || PKG_BODY_STROKE
      ctx.lineWidth = 1
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(sx, sy, Math.max(sr, 0.5), 0, Math.PI * 2)
      ctx.fillStyle = role === 'pin1' ? (customFill || PKG_PIN1_FILL) : (customFill || PKG_PAD_FILL)
      ctx.fill()
    }
  } else if (shape.kind === 'roundedRect') {
    const sx = shape.cx * mmToScreen
    const sy = -shape.cy * mmToScreen
    const sw = shape.w * mmToScreen
    const sh = shape.h * mmToScreen
    const sr = Math.min(shape.r * mmToScreen, sw / 2, sh / 2)

    ctx.beginPath()
    roundedRect(ctx, sx - sw / 2, sy - sh / 2, sw, sh, sr)

    if (shape.role === 'body') {
      ctx.fillStyle = customFill || PKG_BODY_FILL
      ctx.fill()
      ctx.strokeStyle = customStroke || PKG_BODY_STROKE
      ctx.lineWidth = 1
      ctx.stroke()
    } else {
      ctx.fillStyle = customFill || PKG_PAD_FILL
      ctx.fill()
    }
  }
}

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgba') || color.startsWith('hsla')) return color
  const hex = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (hex) {
    return `rgba(${parseInt(hex[1]!, 16)}, ${parseInt(hex[2]!, 16)}, ${parseInt(hex[3]!, 16)}, ${alpha})`
  }
  const shex = color.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i)
  if (shex) {
    return `rgba(${parseInt(shex[1]! + shex[1]!, 16)}, ${parseInt(shex[2]! + shex[2]!, 16)}, ${parseInt(shex[3]! + shex[3]!, 16)}, ${alpha})`
  }
  return color
}

// ─── Main draw ───

function draw() {
  const perfStart = PERF_ENABLED ? performance.now() : 0
  const canvas = canvasEl.value
  if (!canvas) return
  const dpr = sizeCanvas()
  const { cssWidth, cssHeight } = getCssDimensions()
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const isRealistic = !!(props.viewMode === 'realistic' && props.preset)
  const effectiveBg = isRealistic
    ? (isLight.value ? '#e8e8ec' : '#1a1a1e')
    : bgColor.value
  ctx.fillStyle = effectiveBg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const panelLayout = layout.value
  if (!panelLayout || !props.boardSizeMm) return

  const outlineBounds = getOutlineBoundsGerber()
  if (!outlineBounds) return

  const units = detectUnits()
  const toMm = units === 'in' ? 25.4 : 1

  panelDimensions.value = { width: panelLayout.totalWidth, height: panelLayout.totalHeight }

  const panelWidthGerber = panelLayout.totalWidth / toMm
  const panelHeightGerber = panelLayout.totalHeight / toMm
  const panelBounds: [number, number, number, number] = [0, 0, panelWidthGerber, panelHeightGerber]

  // Auto-fit
  const needsAutoFit = !autoFitDone.value || props.interaction.transform.value.scale <= 0
  if (needsAutoFit) {
    const fit = computeAutoFitTransform(cssWidth, cssHeight, panelBounds)
    props.interaction.transform.value = fit
    autoFitDone.value = true
  }
  currentBounds.value = panelBounds

  const transform = props.interaction.transform.value
  const currentSide: 'top' | 'bottom' = props.activeFilter === 'bot' ? 'bottom' : 'top'
  const oc: OverlayContext = { ctx, dpr, transform, panelHeightGerber, toMm, isRealistic, mirrored: !!props.mirrored, side: currentSide }

  if (props.mirrored) {
    ctx.save()
    applyMirrorX(ctx, canvas.width)
  }

  // Background grid
  if (!isRealistic && appSettings.gridEnabled) {
    drawCanvasGrid({
      ctx, cssWidth, cssHeight, dpr, transform,
      mirrored: false, units,
      gridSpacingMm: appSettings.gridSpacingMm,
      isLight: isLight.value,
    })
  }

  // === PASS 1: Panel background (frame, support rails) ===
  drawPanelBackground(oc, panelLayout)

  // === PCB tiles ===
  const outGerberW = outlineBounds[2] - outlineBounds[0]
  const outGerberH = outlineBounds[3] - outlineBounds[1]
  const pcbPixW = Math.ceil(outGerberW * transform.scale * dpr) + 2
  const pcbPixH = Math.ceil(outGerberH * transform.scale * dpr) + 2

  if (pcbPixW > 0 && pcbPixH > 0) {
    const MAX_TILE_PX = 8192
    if (pcbPixW <= MAX_TILE_PX && pcbPixH <= MAX_TILE_PX) {
      const tileTransform = {
        offsetX: -outlineBounds[0] * transform.scale,
        offsetY: outlineBounds[3] * transform.scale,
        scale: transform.scale,
      }
      const side: RealisticSide = props.activeFilter === 'bot' ? 'bottom' : props.activeFilter === 'all' ? 'all' : 'top'
      const tileKey = [
        pcbPixW,
        pcbPixH,
        transform.scale.toFixed(5),
        dpr,
        side,
        isRealistic ? 'realistic' : 'layers',
        props.preset?.name ?? '',
        layerSignature(props.layers),
        allLayerSignature(props.allLayers),
        findOutlineLayer()?.file.fileName ?? '',
        `${outlineBounds[0]},${outlineBounds[1]},${outlineBounds[2]},${outlineBounds[3]}`,
      ].join('|')

      let tileCanvas: HTMLCanvasElement
      if (pcbTileCache?.key === tileKey
        && pcbTileCache.canvas.width === pcbPixW
        && pcbTileCache.canvas.height === pcbPixH) {
        tileCanvas = pcbTileCache.canvas
        panelPerf.pcbTileHits++
      } else {
        tileCanvas = acquireCanvas(pcbPixW, pcbPixH)
        if (isRealistic) {
          const ps = props.pasteSettings
          if (side === 'all') {
            renderRealisticView(gatherRealisticLayers('top'), tileCanvas, {
              preset: props.preset!,
              transform: tileTransform,
              dpr,
              side: 'top',
              pasteColor: ps?.mode === 'jetprint' && ps.highlightDots ? '#00FF66' : undefined,
            })
            const bottomCanvas = acquireCanvas(pcbPixW, pcbPixH)
            renderRealisticView(gatherRealisticLayers('bottom'), bottomCanvas, {
              preset: props.preset!,
              transform: tileTransform,
              dpr,
              side: 'bottom',
              pasteColor: ps?.mode === 'jetprint' && ps.highlightDots ? '#00FF66' : undefined,
            })
            const tileCtx = tileCanvas.getContext('2d')!
            tileCtx.save()
            tileCtx.globalAlpha = 0.45
            tileCtx.filter = 'grayscale(1)'
            tileCtx.drawImage(bottomCanvas, 0, 0)
            tileCtx.restore()
            releaseCanvas(bottomCanvas)
          } else {
            renderRealisticView(gatherRealisticLayers(side), tileCanvas, {
              preset: props.preset!,
              transform: tileTransform,
              dpr,
              side,
              pasteColor: ps?.mode === 'jetprint' && ps.highlightDots ? '#00FF66' : undefined,
            })
          }
        } else {
          const tileCtx = tileCanvas.getContext('2d')!
          for (const layer of props.layers) {
            if (!layer.visible) continue
            const tree = getImageTree(layer)
            if (!tree || tree.children.length === 0) continue
            const tempCanvas = acquireCanvas(pcbPixW, pcbPixH)
            renderToCanvas(tree, tempCanvas, { color: layer.color, transform: tileTransform, dpr })
            tileCtx.drawImage(tempCanvas, 0, 0)
            releaseCanvas(tempCanvas)
          }
        }

        // Crop tile to outline
        const outlineLayer = findOutlineLayer()
        if (outlineLayer) {
          const outlineTree = getImageTree(outlineLayer)
          if (outlineTree && outlineTree.children.length > 0) {
            const maskCanvas = acquireCanvas(pcbPixW, pcbPixH)
            renderOutlineMask(outlineTree, maskCanvas, { color: '#ffffff', transform: tileTransform, dpr })
            const tileCtx = tileCanvas.getContext('2d')!
            tileCtx.globalCompositeOperation = 'destination-in'
            tileCtx.drawImage(maskCanvas, 0, 0)
            tileCtx.globalCompositeOperation = 'source-over'
            releaseCanvas(maskCanvas)
          }
        }

        if (pcbTileCache) releaseCanvas(pcbTileCache.canvas)
        pcbTileCache = { key: tileKey, canvas: tileCanvas }
        panelPerf.pcbTileBuilds++
      }

      // Stamp tiles
      for (const pcb of panelLayout.pcbs) {
        const gerberX = mmToGerber(pcb.x)
        const gerberY = panelHeightGerber - mmToGerber(pcb.y)
        const screenX = (gerberX * transform.scale + transform.offsetX) * dpr
        const screenY = (-gerberY * transform.scale + transform.offsetY) * dpr
        const { dx, dy } = rotationAnchorOffsetPx(pcb.rotation, pcbPixW, pcbPixH)
        const drawX = screenX + dx
        const drawY = screenY + dy

        ctx.save()
        if (pcb.rotation !== 0) {
          const pcbCenterX = drawX + pcbPixW / 2
          const pcbCenterY = drawY + pcbPixH / 2
          ctx.translate(pcbCenterX, pcbCenterY)
          ctx.rotate((pcb.rotation * Math.PI) / 180)
          ctx.translate(-pcbCenterX, -pcbCenterY)
        }
        ctx.drawImage(tileCanvas, drawX, drawY)
        ctx.restore()
      }

      // V-Cut mode: the continuous background fill hides drill holes and
      // outline cutouts because they are transparent in the tile but the
      // substrate background beneath looks identical. Punch those areas
      // through so they show the canvas background instead.
      if (!hasAnyRoutedSeparation(props.panelConfig)) {
        const holesCanvas = buildVCutHolesCanvas(
          tileCanvas, pcbPixW, pcbPixH, tileTransform, dpr, isRealistic,
        )
        if (holesCanvas) {
          for (const pcb of panelLayout.pcbs) {
            const gerberX = mmToGerber(pcb.x)
            const gerberY = panelHeightGerber - mmToGerber(pcb.y)
            const screenX = (gerberX * transform.scale + transform.offsetX) * dpr
            const screenY = (-gerberY * transform.scale + transform.offsetY) * dpr
            const { dx, dy } = rotationAnchorOffsetPx(pcb.rotation, pcbPixW, pcbPixH)
            const drawX = screenX + dx
            const drawY = screenY + dy

            ctx.save()
            if (pcb.rotation !== 0) {
              const pcbCenterX = drawX + pcbPixW / 2
              const pcbCenterY = drawY + pcbPixH / 2
              ctx.translate(pcbCenterX, pcbCenterY)
              ctx.rotate((pcb.rotation * Math.PI) / 180)
              ctx.translate(-pcbCenterX, -pcbCenterY)
            }
            ctx.drawImage(holesCanvas, drawX, drawY)
            ctx.restore()
          }
          releaseCanvas(holesCanvas)
        }
      }

    }
  }

  // === PASS 2: Panel foreground (channels, tabs, v-cuts, fiducials, danger zone) ===
  drawPanelForeground(oc, panelLayout)

  // === PASS 3: Components over full panel (not clipped to PCB outline) ===
  drawPanelComponents(oc, panelLayout, outlineBounds)

  // === PASS 4: Tab drag preview + alignment guides ===
  drawTabDragOverlay(oc, panelLayout)

  if (props.mirrored) {
    ctx.restore()
  }
  if (PERF_ENABLED) {
    panelPerf.draws++
    if (panelPerf.draws % 120 === 0) {
      const took = performance.now() - perfStart
      console.debug('[PanelCanvas][perf]', {
        drawMs: Number(took.toFixed(2)),
        draws: panelPerf.draws,
        pcbTileHits: panelPerf.pcbTileHits,
        pcbTileBuilds: panelPerf.pcbTileBuilds,
        componentTileHits: panelPerf.componentTileHits,
        componentTileBuilds: panelPerf.componentTileBuilds,
        dangerTileHits: panelPerf.dangerTileHits,
        dangerTileBuilds: panelPerf.dangerTileBuilds,
      })
    }
  }
}

/** Draw the dragged tab at its new position + alignment guide lines */
function drawTabDragOverlay(oc: OverlayContext, panelLayout: PanelLayout) {
  const drag = tabDrag.value
  if (!drag) return

  const { ctx } = oc
  const tab = drag.tab

  // Compute where the tab center would be at the new position
  const newCenter = tab.edgeStart + drag.currentPos * tab.edgeLength

  // Draw alignment guides
  for (const guide of drag.guides) {
    const p1 = toScreen(oc, guide.x1, guide.y1)
    const p2 = toScreen(oc, guide.x2, guide.y2)
    ctx.save()
    ctx.setLineDash([6 * oc.dpr, 4 * oc.dpr])
    ctx.strokeStyle = '#ff6b35'
    ctx.lineWidth = 1.5 * oc.dpr
    ctx.beginPath()
    ctx.moveTo(p1.sx, p1.sy)
    ctx.lineTo(p2.sx, p2.sy)
    ctx.stroke()
    ctx.restore()
  }

  // Draw the dragged tab at its new position with highlight
  const halfTab = tab.tabWidth / 2
  let tabX: number, tabY: number, tabW: number, tabH: number
  if (tab.direction === 'vertical') {
    tabX = tab.x
    tabY = newCenter - halfTab
    tabW = tab.width
    tabH = tab.tabWidth
  } else {
    tabX = newCenter - halfTab
    tabY = tab.y
    tabW = tab.tabWidth
    tabH = tab.height
  }

  const p = toScreen(oc, tabX, tabY)
  const pw = mmToPx(oc, tabW)
  const ph = mmToPx(oc, tabH)

  // Draw a highlighted preview rectangle
  ctx.save()
  ctx.fillStyle = 'rgba(255, 107, 53, 0.35)'
  ctx.strokeStyle = '#ff6b35'
  ctx.lineWidth = 2 * oc.dpr
  ctx.setLineDash([])
  ctx.fillRect(p.sx, p.sy, pw, ph)
  ctx.strokeRect(p.sx, p.sy, pw, ph)
  ctx.restore()

  if (tabEditMode.value === 'add' && addPreview.value) {
    const p = addPreview.value
    const tl = toScreen(oc, p.x, p.y)
    const br = toScreen(oc, p.x + p.width, p.y + p.height)
    ctx.save()
    ctx.fillStyle = 'rgba(59, 130, 246, 0.28)'
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.85)'
    ctx.lineWidth = 1.5 * oc.dpr
    ctx.setLineDash([6 * oc.dpr, 4 * oc.dpr])
    ctx.fillRect(tl.sx, tl.sy, br.sx - tl.sx, br.sy - tl.sy)
    ctx.strokeRect(tl.sx, tl.sy, br.sx - tl.sx, br.sy - tl.sy)
    ctx.restore()
  }

  if (addedRoutingPreview.value) {
    const rp = addedRoutingPreview.value
    const p1 = toScreen(oc, rp.x1, rp.y1)
    const p2 = toScreen(oc, rp.x2, rp.y2)
    ctx.save()
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.95)'
    ctx.lineWidth = Math.max(1.2 * oc.dpr, mmToPx(oc, props.panelConfig.routingToolDiameter))
    ctx.setLineDash([6 * oc.dpr, 4 * oc.dpr])
    ctx.beginPath()
    ctx.moveTo(p1.sx, p1.sy)
    ctx.lineTo(p2.sx, p2.sy)
    ctx.stroke()
    ctx.restore()
  }

  if (addedRoutingEditMode.value === 'add') {
    const snapped = addedRoutingSnapHover.value
    const cursor = addedRoutingCursorMm.value

    if (snapped) {
      const sp = snapped
      const p = toScreen(oc, sp.xMm, sp.yMm)
      const g = sp.guide
      const r = 10 * oc.dpr

      ctx.save()
      // Guide line (full extent of the snapped edge)
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.55)'
      ctx.lineWidth = 1.5 * oc.dpr
      ctx.setLineDash([8 * oc.dpr, 5 * oc.dpr])
      if (g.orientation === 'vertical') {
        const a = toScreen(oc, g.axisMm, g.rangeStartMm)
        const b = toScreen(oc, g.axisMm, g.rangeEndMm)
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke()
      } else {
        const a = toScreen(oc, g.rangeStartMm, g.axisMm)
        const b = toScreen(oc, g.rangeEndMm, g.axisMm)
        ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke()
      }

      // Snap dot (filled green circle)
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(34, 197, 94, 0.85)'
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
      ctx.lineWidth = 2 * oc.dpr
      ctx.beginPath()
      ctx.arc(p.sx, p.sy, 5 * oc.dpr, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      // Crosshair arms extending well past the dot
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)'
      ctx.lineWidth = 1.2 * oc.dpr
      ctx.beginPath()
      ctx.moveTo(p.sx - r, p.sy); ctx.lineTo(p.sx + r, p.sy)
      ctx.moveTo(p.sx, p.sy - r); ctx.lineTo(p.sx, p.sy + r)
      ctx.stroke()
      ctx.restore()
    } else if (cursor) {
      // Not snapped - show a small red crosshair at mouse position
      const p = toScreen(oc, cursor.xMm, cursor.yMm)
      const r = 8 * oc.dpr
      ctx.save()
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)'
      ctx.lineWidth = 1 * oc.dpr
      ctx.setLineDash([4 * oc.dpr, 3 * oc.dpr])
      ctx.beginPath()
      ctx.moveTo(p.sx - r, p.sy); ctx.lineTo(p.sx + r, p.sy)
      ctx.moveTo(p.sx, p.sy - r); ctx.lineTo(p.sx, p.sy + r)
      ctx.stroke()
      ctx.restore()
    }
  }

  if (addedRoutingDrag.value && addedRoutingEditMode.value === 'move') {
    const rp = addedRoutingDrag.value.preview
    const p1 = toScreen(oc, rp.x1, rp.y1)
    const p2 = toScreen(oc, rp.x2, rp.y2)
    ctx.save()
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.95)'
    ctx.lineWidth = Math.max(1.4 * oc.dpr, mmToPx(oc, props.panelConfig.routingToolDiameter))
    ctx.setLineDash([6 * oc.dpr, 4 * oc.dpr])
    ctx.beginPath()
    ctx.moveTo(p1.sx, p1.sy)
    ctx.lineTo(p2.sx, p2.sy)
    ctx.stroke()
    ctx.restore()
  }

  if (hoveredAddedRoutingId.value) {
    const route = (props.panelConfig.addedRoutings ?? []).find(r => r.id === hoveredAddedRoutingId.value)
    if (route) {
      const p1 = toScreen(oc, route.x1, route.y1)
      const p2 = toScreen(oc, route.x2, route.y2)
      ctx.save()
      ctx.strokeStyle = addedRoutingEditMode.value === 'move'
        ? 'rgba(59, 130, 246, 0.95)'
        : 'rgba(239, 68, 68, 0.95)'
      ctx.lineWidth = Math.max(2 * oc.dpr, mmToPx(oc, props.panelConfig.routingToolDiameter) + 1.5 * oc.dpr)
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(p1.sx, p1.sy)
      ctx.lineTo(p2.sx, p2.sy)
      ctx.stroke()
      ctx.restore()
    }
  }
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// rAF-coalesced redraw
let rafId = 0
function scheduleRedraw() {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    draw()
  })
}

watch(
  () => [
    props.interaction.transform.value.offsetX,
    props.interaction.transform.value.offsetY,
    props.interaction.transform.value.scale,
    props.mirrored,
    appSettings.gridEnabled,
    appSettings.gridSpacingMm,
    bgColor.value,
    tabEditMode.value,
    addedRoutingEditMode.value,
  ],
  () => scheduleRedraw(),
)

watch(
  () => [
    props.viewMode ?? 'layers',
    props.preset?.name ?? '',
    props.activeFilter ?? 'all',
    layerSignature(props.layers),
    allLayerSignature(props.allLayers),
    props.pasteSettings?.mode ?? 'stencil',
    props.pasteSettings?.dotDiameter ?? 0,
    props.pasteSettings?.dotSpacing ?? 0,
    props.pasteSettings?.pattern ?? 'hex',
    props.pasteSettings?.highlightDots,
    props.pasteSettings?.dynamicDots,
  ],
  () => {
    invalidatePanelRenderCaches()
    scheduleRedraw()
  },
)

watch(
  () => panelGeometrySignature(),
  () => {
    invalidatePanelRenderCaches()
    autoFitDone.value = false
    scheduleRedraw()
  },
)

watch(
  () => addedRoutingSignature(props.panelConfig.addedRoutings),
  () => {
    invalidatePanelRenderCaches()
    scheduleRedraw()
  },
)

watch(
  () => [
    componentSignature(props.pnpComponents),
    props.showPackages,
    props.pnpConvention ?? 'iec61188',
  ],
  () => {
    componentTileCache = cleanupTileCache(componentTileCache)
    scheduleRedraw()
  },
)

watch(
  () => [props.dangerZone?.enabled, props.dangerZone?.insetMm ?? 0],
  () => scheduleRedraw(),
)

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    deactivateAllControls()
    ;(document.activeElement as HTMLElement)?.blur()
    scheduleRedraw()
  }
}

onMounted(() => {
  resetPanelPerf()
  nextTick(() => draw())
  window.addEventListener('keydown', onKeyDown)
  const observer = new ResizeObserver(() => {
    autoFitDone.value = false
    scheduleRedraw()
  })
  if (canvasEl.value?.parentElement) {
    observer.observe(canvasEl.value.parentElement)
  }
  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown)
    observer.disconnect()
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0 }
    invalidatePanelRenderCaches()
    if (_dzCache) {
      releaseCanvas(_dzCache.canvas)
      _dzCache = null
    }
    clearCanvasPool()
    resetPanelPerf()
  })
})

watch(tabControlEnabled, (enabled) => {
  if (enabled) return
  tabDrag.value = null
  hoveredTab.value = null
  addPreview.value = null
  tabEditMode.value = 'off'
})

watch(addedRoutingEditMode, (mode) => {
  if (mode !== 'add') {
    addedRoutingStart.value = null
    addedRoutingPreview.value = null
    addedRoutingSnapHover.value = null
    addedRoutingCursorMm.value = null
  }
  if (mode !== 'delete' && mode !== 'move') {
    hoveredAddedRoutingId.value = null
  }
  if (mode !== 'move') {
    addedRoutingDrag.value = null
  }
})

function exportPng(
  dpi: number = 600,
  options?: {
    side?: 'top' | 'bottom' | 'all'
    includeComponents?: boolean
    components?: EditablePnPComponent[]
    includePackages?: boolean
  },
): Promise<Blob | null> {
  const exportSide: RealisticSide = options?.side ?? (props.activeFilter === 'bot' ? 'bottom' : props.activeFilter === 'all' ? 'all' : 'top')
  const includeComponents = options?.includeComponents ?? true
  return new Promise((resolve) => {
    const panelLayout = layout.value
    if (!panelLayout || !props.boardSizeMm) return resolve(null)

    const outlineBounds = getOutlineBoundsGerber()
    if (!outlineBounds) return resolve(null)

    const units = detectUnits()
    const toMm = units === 'in' ? 25.4 : 1
    const panelWidthGerber = panelLayout.totalWidth / toMm
    const panelHeightGerber = panelLayout.totalHeight / toMm

    const MAX_CANVAS_PX = 16384
    const idealScale = units === 'in' ? dpi : dpi / 25.4
    const scaleFactor = Math.min(idealScale, MAX_CANVAS_PX / panelWidthGerber, MAX_CANVAS_PX / panelHeightGerber)
    const canvasW = Math.ceil(panelWidthGerber * scaleFactor)
    const canvasH = Math.ceil(panelHeightGerber * scaleFactor)

    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = canvasW
    exportCanvas.height = canvasH

    const exportCtx = exportCanvas.getContext('2d')!
    const isRealistic = !!(props.viewMode === 'realistic' && props.preset)
    exportCtx.clearRect(0, 0, canvasW, canvasH)

    const shouldMirror = exportSide === 'bottom'
    const exportTransform = { offsetX: 0, offsetY: panelHeightGerber * scaleFactor, scale: scaleFactor }
    const oc: OverlayContext = {
      ctx: exportCtx,
      dpr: 1,
      transform: exportTransform,
      panelHeightGerber,
      toMm,
      isRealistic,
      exportTransparent: true,
      mirrored: shouldMirror,
      side: exportSide === 'all' ? 'top' : exportSide,
    }

    if (shouldMirror) {
      exportCtx.save()
      applyMirrorX(exportCtx, exportCanvas.width)
    }

    // Background
    drawPanelBackground(oc, panelLayout)

    // Tiles
    const outGerberW = outlineBounds[2] - outlineBounds[0]
    const outGerberH = outlineBounds[3] - outlineBounds[1]
    const tileW = Math.ceil(outGerberW * scaleFactor) + 2
    const tileH = Math.ceil(outGerberH * scaleFactor) + 2

    const tileTransform = { offsetX: -outlineBounds[0] * scaleFactor, offsetY: outlineBounds[3] * scaleFactor, scale: scaleFactor }

    let tileCanvas: HTMLCanvasElement
    if (isRealistic) {
      tileCanvas = acquireCanvas(tileW, tileH)
      if (exportSide === 'all') {
        renderRealisticView(gatherRealisticLayers('top'), tileCanvas, {
          preset: props.preset!,
          transform: tileTransform,
          dpr: 1,
          side: 'top',
        })
        const bottomCanvas = acquireCanvas(tileW, tileH)
        renderRealisticView(gatherRealisticLayers('bottom'), bottomCanvas, {
          preset: props.preset!,
          transform: tileTransform,
          dpr: 1,
          side: 'bottom',
        })
        const tileCtx = tileCanvas.getContext('2d')!
        tileCtx.save()
        tileCtx.globalAlpha = 0.45
        tileCtx.filter = 'grayscale(1)'
        tileCtx.drawImage(bottomCanvas, 0, 0)
        tileCtx.restore()
        releaseCanvas(bottomCanvas)
      } else {
        renderRealisticView(gatherRealisticLayers(exportSide), tileCanvas, {
          preset: props.preset!,
          transform: tileTransform,
          dpr: 1,
          side: exportSide,
        })
      }
    } else {
      tileCanvas = acquireCanvas(tileW, tileH)
      const tileCtx = tileCanvas.getContext('2d')!
      for (const layer of props.layers) {
        if (!layer.visible) continue
        const tree = getImageTree(layer)
        if (!tree || tree.children.length === 0) continue
        const tempCanvas = acquireCanvas(tileW, tileH)
        renderToCanvas(tree, tempCanvas, { color: layer.color, transform: tileTransform, dpr: 1 })
        tileCtx.drawImage(tempCanvas, 0, 0)
        releaseCanvas(tempCanvas)
      }
    }

    const outLayer = findOutlineLayer()
    if (outLayer) {
      const outlineTree = getImageTree(outLayer)
      if (outlineTree && outlineTree.children.length > 0) {
        const maskCanvas = acquireCanvas(tileW, tileH)
        renderOutlineMask(outlineTree, maskCanvas, { color: '#ffffff', transform: tileTransform, dpr: 1 })
        const tileCtx = tileCanvas.getContext('2d')!
        tileCtx.globalCompositeOperation = 'destination-in'
        tileCtx.drawImage(maskCanvas, 0, 0)
        tileCtx.globalCompositeOperation = 'source-over'
        releaseCanvas(maskCanvas)
      }
    }

    for (const pcb of panelLayout.pcbs) {
      const screenX = (pcb.x / toMm) * scaleFactor
      const screenY = (pcb.y / toMm) * scaleFactor
      const { dx, dy } = rotationAnchorOffsetPx(pcb.rotation, tileW, tileH)
      const drawX = screenX + dx
      const drawY = screenY + dy
      exportCtx.save()
      if (pcb.rotation !== 0) {
        const cx = drawX + tileW / 2
        const cy = drawY + tileH / 2
        exportCtx.translate(cx, cy)
        exportCtx.rotate((pcb.rotation * Math.PI) / 180)
        exportCtx.translate(-cx, -cy)
      }
      exportCtx.drawImage(tileCanvas, drawX, drawY)
      exportCtx.restore()
    }

    // V-Cut export: punch through drill holes and outline cutouts
    if (!hasAnyRoutedSeparation(props.panelConfig)) {
      const holesCanvas = buildVCutHolesCanvas(
        tileCanvas, tileW, tileH, tileTransform, 1, isRealistic, true,
      )
      if (holesCanvas) {
        exportCtx.globalCompositeOperation = 'destination-out'
        for (const pcb of panelLayout.pcbs) {
          const screenX = (pcb.x / toMm) * scaleFactor
          const screenY = (pcb.y / toMm) * scaleFactor
          const { dx, dy } = rotationAnchorOffsetPx(pcb.rotation, tileW, tileH)
          const drawX = screenX + dx
          const drawY = screenY + dy
          exportCtx.save()
          if (pcb.rotation !== 0) {
            const cx = drawX + tileW / 2
            const cy = drawY + tileH / 2
            exportCtx.translate(cx, cy)
            exportCtx.rotate((pcb.rotation * Math.PI) / 180)
            exportCtx.translate(-cx, -cy)
          }
          exportCtx.drawImage(holesCanvas, drawX, drawY)
          exportCtx.restore()
        }
        exportCtx.globalCompositeOperation = 'source-over'
        releaseCanvas(holesCanvas)
      }
    }

    releaseCanvas(tileCanvas)

    // Foreground (no danger zone in export)
    const exportOc: OverlayContext = { ...oc }
    drawPanelForeground(exportOc, panelLayout)
    drawPanelComponents(exportOc, panelLayout, outlineBounds, {
      enabled: includeComponents,
      components: options?.components,
      includePackages: options?.includePackages,
    })

    if (shouldMirror) {
      exportCtx.restore()
    }

    exportCanvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

function exportPngForSide(
  side: 'top' | 'bottom' | 'all',
  options?: {
    dpi?: number
    includeComponents?: boolean
    components?: EditablePnPComponent[]
    includePackages?: boolean
  },
): Promise<Blob | null> {
  return exportPng(options?.dpi ?? 600, {
    side,
    includeComponents: options?.includeComponents,
    components: options?.components,
    includePackages: options?.includePackages,
  })
}

function getPerformanceStats() {
  const pcbBytes = pcbTileCache ? pcbTileCache.canvas.width * pcbTileCache.canvas.height * 4 : 0
  const componentBytes = componentTileCache ? componentTileCache.canvas.width * componentTileCache.canvas.height * 4 : 0
  const dangerBytes = _dzCache ? _dzCache.canvas.width * _dzCache.canvas.height * 4 : 0
  return {
    draws: panelPerf.draws,
    pcbTileHits: panelPerf.pcbTileHits,
    pcbTileBuilds: panelPerf.pcbTileBuilds,
    componentTileHits: panelPerf.componentTileHits,
    componentTileBuilds: panelPerf.componentTileBuilds,
    dangerTileHits: panelPerf.dangerTileHits,
    dangerTileBuilds: panelPerf.dangerTileBuilds,
    pcbTile: pcbTileCache
      ? { width: pcbTileCache.canvas.width, height: pcbTileCache.canvas.height, estimatedBytes: pcbBytes }
      : null,
    componentTile: componentTileCache
      ? { width: componentTileCache.canvas.width, height: componentTileCache.canvas.height, estimatedBytes: componentBytes }
      : null,
    dangerTile: _dzCache
      ? { width: _dzCache.canvas.width, height: _dzCache.canvas.height, estimatedBytes: dangerBytes }
      : null,
    canvasPoolSize: _canvasPool.length,
    parsedLayerCacheSize: gerberTreeCache.getCacheSize(),
    footprintCacheSize: footprintCache.size,
    thtFootprintCacheSize: thtFootprintCache.size,
  }
}

defineExpose({
  resetView() {
    autoFitDone.value = false
    draw()
  },
  exportPng,
  exportPngForSide,
  getPerformanceStats,
  panelDimensions,
  getImageTree,
})
</script>
