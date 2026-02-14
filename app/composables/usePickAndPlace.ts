import type { LayerInfo } from '~/utils/gerber-helpers'
import { isPnPLayer } from '~/utils/gerber-helpers'
import { parsePnPFile, isFiducial, type PnPComponent } from '~/utils/pnp-parser'

export interface AlignPoint {
  x: number
  y: number
}

/**
 * Alignment mode state machine:
 * - 'idle': no alignment in progress
 * - 'set-origin': click to place the 0/0 origin directly
 * - 'align-single': click one point for fiducial alignment (single pad)
 * - 'align-first': waiting for first pad click (2-pad component alignment)
 * - 'align-second': waiting for second pad click (2-pad component alignment)
 */
export type AlignMode = 'idle' | 'set-origin' | 'align-single' | 'align-first' | 'align-second'

/**
 * Composable managing Pick & Place state for the viewer.
 *
 * Parses PnP layer content, holds the selected component and search query,
 * origin offset for aligning PnP coordinates with Gerber coordinate space,
 * and provides filtered/computed lists for the ComponentPanel and BoardCanvas.
 */
export function usePickAndPlace(layers: Ref<LayerInfo[]>) {
  // ── Parsed component cache ──
  const parsedCache = new Map<string, PnPComponent[]>()

  function parseLayer(layer: LayerInfo): PnPComponent[] {
    const key = layer.file.fileName
    if (parsedCache.has(key)) return parsedCache.get(key)!
    const side = layer.type === 'PnP Bottom' ? 'bottom' : 'top'
    const components = parsePnPFile(layer.file.content, side)
    parsedCache.set(key, components)
    return components
  }

  /** Invalidate cache when layers change (e.g. after re-import) */
  function invalidateCache(fileName?: string) {
    if (fileName) {
      parsedCache.delete(fileName)
    } else {
      parsedCache.clear()
    }
  }

  // ── PnP layers ──

  const pnpLayers = computed(() =>
    layers.value.filter(l => isPnPLayer(l.type)),
  )

  const hasPnP = computed(() => pnpLayers.value.length > 0)

  // ── All components from all PnP layers ──

  const allComponents = computed<PnPComponent[]>(() => {
    const result: PnPComponent[] = []
    for (const layer of pnpLayers.value) {
      result.push(...parseLayer(layer))
    }
    return result
  })

  /** Visible components (from visible PnP layers only) */
  const visibleComponents = computed<PnPComponent[]>(() => {
    const result: PnPComponent[] = []
    for (const layer of pnpLayers.value) {
      if (!layer.visible) continue
      result.push(...parseLayer(layer))
    }
    return result
  })

  // ── Search & filtering ──

  const searchQuery = ref('')

  const filteredComponents = computed<PnPComponent[]>(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return allComponents.value
    return allComponents.value.filter(c =>
      c.designator.toLowerCase().includes(q)
      || c.value.toLowerCase().includes(q)
      || c.package.toLowerCase().includes(q),
    )
  })

  // ── Selection ──

  const selectedDesignator = ref<string | null>(null)

  const selectedComponent = computed<PnPComponent | null>(() => {
    if (!selectedDesignator.value) return null
    return allComponents.value.find(c => c.designator === selectedDesignator.value) ?? null
  })

  function selectComponent(designator: string | null) {
    selectedDesignator.value = designator
  }

  // ── Origin offset ──
  // The origin maps PnP (0,0) to a point in Gerber coordinate space.
  // PnP coordinates are in mm, origin is stored in Gerber units.

  /** Origin X in Gerber units — null means "use default (outline bottom-left)" */
  const originX = ref<number | null>(null)
  /** Origin Y in Gerber units */
  const originY = ref<number | null>(null)
  /** Whether a manual origin has been set */
  const hasOrigin = computed(() => originX.value !== null && originY.value !== null)

  function resetOrigin() {
    originX.value = null
    originY.value = null
  }

  // ── Alignment state machine ──

  const alignMode = ref<AlignMode>('idle')
  /** The component being used for alignment (for align-single / align-first / align-second) */
  const alignComponent = ref<PnPComponent | null>(null)
  /** First click point in Gerber coordinates (for 2-pad alignment) */
  const alignClickA = ref<AlignPoint | null>(null)

  /** Whether any alignment/origin-setting is actively in progress */
  const isAligning = computed(() => alignMode.value !== 'idle')

  /**
   * Calculate origin from a Gerber point that corresponds to a known PnP component.
   * origin = gerberPoint - pnpCoords (in Gerber units)
   */
  function computeOriginFromComponent(comp: PnPComponent, gerberX: number, gerberY: number, units: 'mm' | 'in') {
    const pnpInGerber = units === 'in' ? { x: comp.x / 25.4, y: comp.y / 25.4 } : { x: comp.x, y: comp.y }
    originX.value = gerberX - pnpInGerber.x
    originY.value = gerberY - pnpInGerber.y
  }

  // ── Public actions ──

  /** Start "Set 0/0" mode: click to place origin directly */
  function startSettingOrigin() {
    alignMode.value = 'set-origin'
    alignComponent.value = null
    alignClickA.value = null
  }

  /** Start component-based alignment */
  function startComponentAlign(comp: PnPComponent) {
    alignComponent.value = comp
    alignClickA.value = null
    if (isFiducial(comp)) {
      alignMode.value = 'align-single'
    } else {
      alignMode.value = 'align-first'
    }
  }

  /** Cancel any in-progress alignment */
  function cancelAlign() {
    alignMode.value = 'idle'
    alignComponent.value = null
    alignClickA.value = null
  }

  /**
   * Handle a snapped click from the canvas during alignment.
   * Returns true if the alignment is complete (origin has been set).
   */
  function handleAlignClick(gerberX: number, gerberY: number, units: 'mm' | 'in'): boolean {
    switch (alignMode.value) {
      case 'set-origin':
        originX.value = gerberX
        originY.value = gerberY
        alignMode.value = 'idle'
        return true

      case 'align-single':
        if (alignComponent.value) {
          computeOriginFromComponent(alignComponent.value, gerberX, gerberY, units)
        }
        alignMode.value = 'idle'
        alignComponent.value = null
        return true

      case 'align-first':
        alignClickA.value = { x: gerberX, y: gerberY }
        alignMode.value = 'align-second'
        return false

      case 'align-second':
        if (alignComponent.value && alignClickA.value) {
          // Midpoint of the two clicks = component center
          const midX = (alignClickA.value.x + gerberX) / 2
          const midY = (alignClickA.value.y + gerberY) / 2
          computeOriginFromComponent(alignComponent.value, midX, midY, units)
        }
        alignMode.value = 'idle'
        alignComponent.value = null
        alignClickA.value = null
        return true

      default:
        return false
    }
  }

  // Invalidate cache when layers ref changes identity
  watch(layers, () => invalidateCache(), { deep: false })

  return {
    pnpLayers,
    hasPnP,
    allComponents,
    visibleComponents,
    searchQuery,
    filteredComponents,
    selectedDesignator,
    selectedComponent,
    selectComponent,
    invalidateCache,
    // Origin
    originX,
    originY,
    hasOrigin,
    resetOrigin,
    // Alignment
    alignMode,
    alignComponent,
    alignClickA,
    isAligning,
    startSettingOrigin,
    startComponentAlign,
    cancelAlign,
    handleAlignClick,
  }
}
