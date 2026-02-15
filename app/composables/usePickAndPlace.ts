import type { LayerInfo } from '~/utils/gerber-helpers'
import { isPnPLayer } from '~/utils/gerber-helpers'
import { parsePnPFile, isFiducial, type PnPComponent } from '~/utils/pnp-parser'
import type { PnPConvention } from '~/utils/pnp-conventions'
import type { PackageDefinition } from '~/utils/package-types'

export interface AlignPoint {
  x: number
  y: number
}

export interface EditablePnPComponent extends PnPComponent {
  /** Stable key used for UI edits (rotation overrides). */
  key: string
  /** Rotation from the original parsed file (never modified). */
  originalRotation: number
  /** True when a per-component rotation override is active. */
  rotationOverridden: boolean
  /** Whether this component is marked as Do Not Populate. */
  dnp: boolean
  /** CAD-defined package name from the PnP file (customer footprint name). */
  cadPackage: string
  /** Our matched package name (canonical library name), possibly via alias or manual mapping. */
  matchedPackage: string
  /** True when this CAD package has been manually mapped to a library package. */
  packageMapped: boolean
  /** Whether the component is considered polarized (controls pin-1 marker rendering). */
  polarized: boolean
  /** True when polarized is defaulted (no user override). */
  polarizedDefaulted: boolean
}

export type PnPRotationOverrides = Record<string, number>
export type PnPPackageMap = Record<string, string>
export type PnPPolarizedOverrides = Record<string, boolean>

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
  // Keep user-edited rotations separate so original parsed values stay intact.
  const rotationOverrides = ref(new Map<string, number>())
  // DNP (Do Not Populate) component keys
  const dnpSet = ref(new Set<string>())
  // Manual mapping from CAD package string -> library package name
  const cadPackageMap = ref(new Map<string, string>())
  // Per-component polarized override keyed by stable component key
  const polarizedOverrides = ref(new Map<string, boolean>())
  // Optional matcher supplied by the viewer (package library)
  const packageMatcher = ref<((name: string) => PackageDefinition | undefined) | null>(null)

  function getComponentKey(comp: PnPComponent): string {
    return [
      comp.side,
      comp.designator,
      comp.x.toFixed(6),
      comp.y.toFixed(6),
      comp.package,
      comp.value,
    ].join('|')
  }

  function computeDefaultPolarized(comp: PnPComponent, matched: PackageDefinition | undefined): boolean {
    // Default: polarized (pin-1 visible)
    // Exception: chip passives like resistors/capacitors/inductors/jumpers are typically not polarized.
    const ref = (comp.designator || '').trim().toUpperCase()
    const isPassiveRef = /^(R|C|L|J|FB)\d+/.test(ref)
    if (matched?.type === 'Chip' && isPassiveRef) return false
    return true
  }

  function toEditable(comp: PnPComponent): EditablePnPComponent {
    const key = getComponentKey(comp)
    const override = rotationOverrides.value.get(key)
    const rotation = override ?? comp.rotation

    const cadPackage = comp.package
    const mapped = cadPackageMap.value.get(cadPackage)
    const matchedFromLib = packageMatcher.value ? packageMatcher.value(cadPackage) : undefined
    const matchedPackage = mapped || matchedFromLib?.name || ''

    const defaultPolarized = computeDefaultPolarized(comp, mapped ? (packageMatcher.value?.(mapped) ?? undefined) : matchedFromLib)
    const polOverride = polarizedOverrides.value.get(key)
    const polarized = polOverride ?? defaultPolarized

    return {
      ...comp,
      key,
      rotation,
      originalRotation: comp.rotation,
      rotationOverridden: override != null,
      dnp: dnpSet.value.has(key),
      cadPackage,
      matchedPackage,
      packageMapped: mapped != null,
      polarized,
      polarizedDefaulted: polOverride == null,
    }
  }

  function parseLayer(layer: LayerInfo): PnPComponent[] {
    // Cache key includes layer type so same-content layers with different types get separate entries
    const cacheKey = `${layer.file.fileName}::${layer.type}`
    if (parsedCache.has(cacheKey)) return parsedCache.get(cacheKey)!
    const side = layer.type === 'PnP Bottom' ? 'bottom' : 'top'
    const allComponents = parsePnPFile(layer.file.content, side)
    // Combined layers return all components; single-side layers filter by side
    const components = layer.type === 'PnP Top + Bot'
      ? allComponents
      : allComponents.filter(c => c.side === side)
    parsedCache.set(cacheKey, components)
    return components
  }

  /** Invalidate cache when layers change (e.g. after re-import) */
  function invalidateCache(fileName?: string) {
    if (fileName) {
      // Delete all entries for this file (handles split PnP files with composite keys)
      for (const key of parsedCache.keys()) {
        if (key === fileName || key.startsWith(`${fileName}::`)) {
          parsedCache.delete(key)
        }
      }
    } else {
      parsedCache.clear()
    }
  }

  // ── PnP layers ──

  const pnpLayers = computed(() =>
    layers.value.filter(l => isPnPLayer(l.type)),
  )

  const hasPnP = computed(() => pnpLayers.value.length > 0)

  // ── All parsed components from all PnP layers (original values) ──
  const allParsedComponents = computed<PnPComponent[]>(() => {
    const result: PnPComponent[] = []
    for (const layer of pnpLayers.value) {
      result.push(...parseLayer(layer))
    }
    return result
  })

  /** Visible parsed components (from visible PnP layers only) */
  const visibleParsedComponents = computed<PnPComponent[]>(() => {
    const result: PnPComponent[] = []
    for (const layer of pnpLayers.value) {
      if (!layer.visible) continue
      result.push(...parseLayer(layer))
    }
    return result
  })

  // ── Side filter (synced with toolbar All/Top/Bot) ──

  const activeSideFilter = ref<'all' | 'top' | 'bottom'>('all')

  // ── Editable components (with optional rotation overrides) ──

  const allComponents = computed<EditablePnPComponent[]>(() =>
    allParsedComponents.value.map(toEditable),
  )

  /** Components from visible PnP layers, filtered by active side (for component panel base) */
  const activeComponents = computed<EditablePnPComponent[]>(() => {
    const base = visibleParsedComponents.value.map(toEditable)
    const side = activeSideFilter.value
    if (side === 'all') return base
    return base.filter(c => c.side === side)
  })

  /** Components from visible PnP layers, filtered by side and excluding DNP (for canvas rendering) */
  const visibleComponents = computed<EditablePnPComponent[]>(() =>
    activeComponents.value.filter(c => !c.dnp),
  )

  // ── Search & filtering ──

  const searchQuery = ref('')

  /** Active components filtered by search query (for component panel table) */
  const filteredComponents = computed<EditablePnPComponent[]>(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return activeComponents.value
    return activeComponents.value.filter(c =>
      c.designator.toLowerCase().includes(q)
      || c.value.toLowerCase().includes(q)
      || c.cadPackage.toLowerCase().includes(q)
      || c.matchedPackage.toLowerCase().includes(q),
    )
  })

  // ── Selection ──

  const selectedDesignator = ref<string | null>(null)

  const selectedComponent = computed<EditablePnPComponent | null>(() => {
    if (!selectedDesignator.value) return null
    return allComponents.value.find(c => c.designator === selectedDesignator.value) ?? null
  })

  function selectComponent(designator: string | null) {
    selectedDesignator.value = designator
  }

  function setRotationOverride(key: string, rotation: number) {
    if (!Number.isFinite(rotation)) return
    const target = allComponents.value.find(c => c.key === key)
    if (!target) return
    const next = new Map(rotationOverrides.value)
    if (Math.abs(rotation - target.originalRotation) < 1e-6) {
      next.delete(key)
    } else {
      next.set(key, rotation)
    }
    rotationOverrides.value = next
  }

  function resetRotationOverride(key: string) {
    if (!rotationOverrides.value.has(key)) return
    const next = new Map(rotationOverrides.value)
    next.delete(key)
    rotationOverrides.value = next
  }

  function resetAllRotationOverrides() {
    if (rotationOverrides.value.size === 0) return
    rotationOverrides.value = new Map()
  }

  function setRotationOverrides(overrides: PnPRotationOverrides | null | undefined) {
    const next = new Map<string, number>()
    for (const [key, rotation] of Object.entries(overrides ?? {})) {
      if (Number.isFinite(rotation)) {
        next.set(key, rotation)
      }
    }
    rotationOverrides.value = next
  }

  const rotationOverridesRecord = computed<PnPRotationOverrides>(() => {
    const out: PnPRotationOverrides = {}
    for (const [key, rotation] of rotationOverrides.value.entries()) {
      out[key] = rotation
    }
    return out
  })

  // ── DNP (Do Not Populate) ──

  function toggleDnp(key: string) {
    const next = new Set(dnpSet.value)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    dnpSet.value = next
  }

  function setDnpKeys(keys: string[] | null | undefined) {
    dnpSet.value = new Set(keys ?? [])
  }

  function resetAllDnp() {
    if (dnpSet.value.size === 0) return
    dnpSet.value = new Set()
  }

  /** Serialised DNP keys for persistence */
  const dnpRecord = computed<string[]>(() => [...dnpSet.value])

  // ── CAD package -> library package mapping (manual) ──

  function setCadPackageMapping(cadPackage: string, libraryPackageName: string | null) {
    const cad = cadPackage?.trim()
    if (!cad) return
    const next = new Map(cadPackageMap.value)
    if (!libraryPackageName) {
      next.delete(cad)
    } else {
      next.set(cad, libraryPackageName)
    }
    cadPackageMap.value = next
  }

  function setCadPackageMap(map: PnPPackageMap | null | undefined) {
    const next = new Map<string, string>()
    for (const [cad, lib] of Object.entries(map ?? {})) {
      if (typeof cad === 'string' && cad.trim() && typeof lib === 'string' && lib.trim()) {
        next.set(cad.trim(), lib.trim())
      }
    }
    cadPackageMap.value = next
  }

  const cadPackageMapRecord = computed<PnPPackageMap>(() => {
    const out: PnPPackageMap = {}
    for (const [cad, lib] of cadPackageMap.value.entries()) {
      out[cad] = lib
    }
    return out
  })

  // ── Polarized overrides ──

  function setPolarizedOverride(key: string, polarized: boolean | null) {
    const next = new Map(polarizedOverrides.value)
    if (polarized == null) next.delete(key)
    else next.set(key, !!polarized)
    polarizedOverrides.value = next
  }

  function setPolarizedOverrides(overrides: PnPPolarizedOverrides | null | undefined) {
    const next = new Map<string, boolean>()
    for (const [key, val] of Object.entries(overrides ?? {})) {
      if (typeof val === 'boolean') next.set(key, val)
    }
    polarizedOverrides.value = next
  }

  const polarizedOverridesRecord = computed<PnPPolarizedOverrides>(() => {
    const out: PnPPolarizedOverrides = {}
    for (const [k, v] of polarizedOverrides.value.entries()) out[k] = v
    return out
  })

  // ── External package matcher (library) ──

  function setPackageMatcher(fn: ((name: string) => PackageDefinition | undefined) | null | undefined) {
    packageMatcher.value = fn ?? null
  }

  // ── PnP convention (orientation standard) ──
  // Default to Mycronic since our package footprints are defined in Mycronic convention
  const convention = ref<PnPConvention>('mycronic')

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
  // Drop stale overrides when imported component set changes.
  watch(allParsedComponents, (components) => {
    if (rotationOverrides.value.size === 0) return
    const validKeys = new Set(components.map(getComponentKey))
    const next = new Map(rotationOverrides.value)
    let changed = false
    for (const key of next.keys()) {
      if (!validKeys.has(key)) {
        next.delete(key)
        changed = true
      }
    }
    if (changed) rotationOverrides.value = next
  }, { deep: false })

  return {
    pnpLayers,
    hasPnP,
    allComponents,
    activeComponents,
    visibleComponents,
    searchQuery,
    filteredComponents,
    selectedDesignator,
    selectedComponent,
    selectComponent,
    setRotationOverride,
    resetRotationOverride,
    resetAllRotationOverrides,
    setRotationOverrides,
    rotationOverridesRecord,
    invalidateCache,
    // Side filter
    activeSideFilter,
    // DNP
    toggleDnp,
    setDnpKeys,
    resetAllDnp,
    dnpRecord,
    // Package mapping
    setPackageMatcher,
    setCadPackageMapping,
    setCadPackageMap,
    cadPackageMapRecord,
    // Polarized
    setPolarizedOverride,
    setPolarizedOverrides,
    polarizedOverridesRecord,
    // Convention
    convention,
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
