import type { LayerInfo } from '~/utils/gerber-helpers'
import { isPnPLayer, isSmdPnPLayer, isThtPnPLayer } from '~/utils/gerber-helpers'
import { parsePnPFile, isFiducial, type PnPComponent } from '~/utils/pnp-parser'
import type { PnPConvention } from '~/utils/pnp-conventions'
import type { PackageDefinition } from '~/utils/package-types'
import type { THTPackageDefinition } from '~/utils/tht-package-types'

export type ComponentType = 'smd' | 'tht'

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
  /** User-provided note for this component (empty string when no note). */
  note: string
  /** True when this component was manually added by the user (not from PnP file). */
  manual: boolean
  /** Original designator before any field overrides (for display/export). */
  originalDesignator: string
  /** Original value before field overrides. */
  originalValue: string
  /** Original X before field overrides. */
  originalX: number
  /** Original Y before field overrides. */
  originalY: number
  /** True when any field (designator, value, x, y) has been overridden. */
  fieldsOverridden: boolean
  /** Whether this component is SMD or THT. */
  componentType: ComponentType
}

/** Per-component field overrides (designator, value, x, y). */
export interface PnPFieldOverride {
  designator?: string
  value?: string
  x?: number
  y?: number
}

/** Serialised manual component for persistence. */
export interface ManualPnPComponent {
  id: string
  designator: string
  value: string
  package: string
  x: number
  y: number
  rotation: number
  side: 'top' | 'bottom'
  /** Component technology type. Defaults to 'smd' for backward compatibility. */
  componentType?: ComponentType
}

export type PnPRotationOverrides = Record<string, number>
export type PnPPackageMap = Record<string, string>
export type PnPPolarizedOverrides = Record<string, boolean>
export type PnPComponentNotes = Record<string, string>
export type PnPFieldOverrides = Record<string, PnPFieldOverride>
export type PnPFilterKey = 'polarized' | 'dnp' | 'edited' | 'unmatched'

/**
 * Alignment / placement mode state machine:
 * - 'idle': no alignment in progress
 * - 'set-origin': click to place the 0/0 origin directly
 * - 'align-single': click one point for fiducial alignment (single pad)
 * - 'align-first': waiting for first click (alignment or manual component placement)
 * - 'align-second': waiting for second click (same spot confirms, different spot uses midpoint)
 *
 * When `placingComponent` is set, align-first/align-second place a component
 * instead of computing the origin offset. Same UX, different outcome.
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
  // Per-component user notes keyed by stable component key
  const componentNotes = ref(new Map<string, string>())
  // Per-component field overrides (designator, value, x, y) keyed by stable component key
  const fieldOverrides = ref(new Map<string, PnPFieldOverride>())
  // Deleted component keys (parsed components removed by the user)
  const deletedKeys = ref(new Set<string>())
  // User-added manual components (not from PnP file)
  const manualComponents = ref<ManualPnPComponent[]>([])
  // Optional matchers supplied by the viewer (package libraries)
  const packageMatcher = ref<((name: string) => PackageDefinition | undefined) | null>(null)
  const thtPackageMatcher = ref<((name: string) => THTPackageDefinition | undefined) | null>(null)

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

  function toEditable(comp: PnPComponent & { id?: string; componentType?: ComponentType }, isManual = false): EditablePnPComponent {
    const key = isManual ? `manual|${comp.id || comp.designator}` : getComponentKey(comp)
    const override = rotationOverrides.value.get(key)
    const rotation = override ?? comp.rotation

    const cadPackage = comp.package
    const mapped = cadPackageMap.value.get(cadPackage)
    const compType = comp.componentType ?? 'smd'
    // Use the correct library matcher based on component type
    const matcherForType = compType === 'tht' ? thtPackageMatcher.value : packageMatcher.value
    const nameToLookup = mapped || cadPackage
    const matchedFromLib = matcherForType ? matcherForType(nameToLookup) : undefined
    const matchedPackage = mapped || matchedFromLib?.name || ''

    const defaultPolarized = computeDefaultPolarized(comp, mapped ? (packageMatcher.value?.(mapped) ?? undefined) : (compType === 'smd' ? matchedFromLib as PackageDefinition | undefined : undefined))
    const polOverride = polarizedOverrides.value.get(key)
    const polarized = polOverride ?? defaultPolarized

    // Apply field overrides
    const fo = fieldOverrides.value.get(key)
    const designator = fo?.designator ?? comp.designator
    const value = fo?.value ?? comp.value
    const x = fo?.x ?? comp.x
    const y = fo?.y ?? comp.y
    const fieldsOverridden = fo != null && (fo.designator != null || fo.value != null || fo.x != null || fo.y != null)

    return {
      ...comp,
      designator,
      value,
      x,
      y,
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
      note: componentNotes.value.get(key) ?? '',
      manual: isManual,
      originalDesignator: comp.designator,
      originalValue: comp.value,
      originalX: comp.x,
      originalY: comp.y,
      fieldsOverridden,
      componentType: comp.componentType ?? 'smd',
    }
  }

  function parseLayer(layer: LayerInfo): PnPComponent[] {
    // Cache key includes layer type so same-content layers with different types get separate entries
    const cacheKey = `${layer.file.fileName}::${layer.type}`
    if (parsedCache.has(cacheKey)) return parsedCache.get(cacheKey)!
    const side = (layer.type === 'PnP Bottom' || layer.type === 'PnP Bottom (THT)') ? 'bottom' : 'top'
    const allComponents = parsePnPFile(layer.file.content, side)
    // Combined layers return all components; single-side layers filter by side
    const isCombined = layer.type === 'PnP Top + Bot' || layer.type === 'PnP Top + Bot (THT)'
    const components = isCombined
      ? allComponents
      : allComponents.filter(c => c.side === side)
    parsedCache.set(cacheKey, components)
    return components
  }

  /** Determine the component type of a parsed layer */
  function layerComponentType(layer: LayerInfo): ComponentType {
    return isThtPnPLayer(layer.type) ? 'tht' : 'smd'
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

  const hasPnP = computed(() => pnpLayers.value.length > 0 || manualComponents.value.length > 0)

  // ── All parsed components from all PnP layers (original values, with componentType) ──
  const allParsedComponents = computed<(PnPComponent & { componentType: ComponentType })[]>(() => {
    const result: (PnPComponent & { componentType: ComponentType })[] = []
    for (const layer of pnpLayers.value) {
      const ct = layerComponentType(layer)
      for (const comp of parseLayer(layer)) {
        result.push({ ...comp, componentType: ct })
      }
    }
    return result
  })

  /** Visible parsed components (from visible PnP layers only) */
  const visibleParsedComponents = computed<(PnPComponent & { componentType: ComponentType })[]>(() => {
    const result: (PnPComponent & { componentType: ComponentType })[] = []
    for (const layer of pnpLayers.value) {
      if (!layer.visible) continue
      const ct = layerComponentType(layer)
      for (const comp of parseLayer(layer)) {
        result.push({ ...comp, componentType: ct })
      }
    }
    return result
  })

  // ── Side filter (synced with toolbar All/Top/Bot) ──

  const activeSideFilter = ref<'all' | 'top' | 'bottom'>('all')

  // ── Component filters (toggle chips in the sidebar) ──

  const activeFilters = ref(new Set<PnPFilterKey>())

  // ── Editable components (with optional rotation overrides) ──

  /** Convert manual components to PnPComponent shape for toEditable */
  function manualToPnP(mc: ManualPnPComponent): PnPComponent & { id: string; componentType: ComponentType } {
    return {
      id: mc.id,
      designator: mc.designator,
      value: mc.value,
      package: mc.package,
      x: mc.x,
      y: mc.y,
      rotation: mc.rotation,
      side: mc.side,
      componentType: mc.componentType ?? 'smd',
    }
  }

  const allComponents = computed<EditablePnPComponent[]>(() => {
    const parsed = allParsedComponents.value.map(c => toEditable(c, false))
      .filter(c => !deletedKeys.value.has(c.key))
    const manual = manualComponents.value.map(mc => toEditable(manualToPnP(mc), true))
    return [...parsed, ...manual]
  })

  /** Components from visible PnP layers, filtered by active side (for component panel base) */
  const activeComponents = computed<EditablePnPComponent[]>(() => {
    const base = visibleParsedComponents.value.map(c => toEditable(c, false))
      .filter(c => !deletedKeys.value.has(c.key))
    const manual = manualComponents.value.map(mc => toEditable(manualToPnP(mc), true))
    const combined = [...base, ...manual]
    const side = activeSideFilter.value
    if (side === 'all') return combined
    return combined.filter(c => c.side === side)
  })

  // ── SMD / THT filtered active component lists ──

  /** SMD-only active components (filtered by side) */
  const smdActiveComponents = computed<EditablePnPComponent[]>(() =>
    activeComponents.value.filter(c => c.componentType === 'smd'),
  )

  /** THT-only active components (filtered by side) */
  const thtActiveComponents = computed<EditablePnPComponent[]>(() =>
    activeComponents.value.filter(c => c.componentType === 'tht'),
  )

  /** Whether any SMD data (parsed or manual) exists */
  const hasSmdPnP = computed(() =>
    pnpLayers.value.some(l => isSmdPnPLayer(l.type))
    || manualComponents.value.some(mc => (mc.componentType ?? 'smd') === 'smd'),
  )

  /** Whether any THT data (parsed or manual) exists */
  const hasThtPnP = computed(() =>
    pnpLayers.value.some(l => isThtPnPLayer(l.type))
    || manualComponents.value.some(mc => mc.componentType === 'tht'),
  )

  // ── Search & filtering ──

  const searchQuery = ref('')

  function isComponentEdited(comp: EditablePnPComponent): boolean {
    return comp.rotationOverridden || comp.packageMapped || !comp.polarizedDefaulted || comp.dnp || comp.note !== '' || comp.fieldsOverridden || comp.manual
  }

  function matchesActiveFilters(comp: EditablePnPComponent): boolean {
    const filters = activeFilters.value
    if (filters.size === 0) return true
    if (filters.has('polarized') && comp.polarized) return true
    if (filters.has('dnp') && comp.dnp) return true
    if (filters.has('edited') && isComponentEdited(comp)) return true
    if (filters.has('unmatched') && !comp.matchedPackage) return true
    return false
  }

  /** Active components filtered by toggle filters and search query (for sidebar table) */
  const searchableComponentText = computed(() => {
    const index = new Map<string, string>()
    for (const comp of activeComponents.value) {
      index.set(
        comp.key,
        [
          comp.designator,
          comp.value,
          comp.cadPackage,
          comp.matchedPackage,
          comp.note,
        ].join('\n').toLowerCase(),
      )
    }
    return index
  })

  const filteredComponents = computed<EditablePnPComponent[]>(() => {
    let result = activeComponents.value.filter(matchesActiveFilters)
    const q = searchQuery.value.trim().toLowerCase()
    if (q) {
      const searchIndex = searchableComponentText.value
      result = result.filter(c => (searchIndex.get(c.key) ?? '').includes(q))
    }
    return result
  })

  /** SMD-only filtered components */
  const smdFilteredComponents = computed<EditablePnPComponent[]>(() =>
    filteredComponents.value.filter(c => c.componentType === 'smd'),
  )

  /** THT-only filtered components */
  const thtFilteredComponents = computed<EditablePnPComponent[]>(() =>
    filteredComponents.value.filter(c => c.componentType === 'tht'),
  )

  /** Components for canvas rendering — respects search + toggle filters when active */
  const visibleComponents = computed<EditablePnPComponent[]>(() => {
    const hasFilters = activeFilters.value.size > 0
    const hasSearch = searchQuery.value.trim() !== ''
    if (!hasFilters && !hasSearch) {
      return activeComponents.value.filter(c => !c.dnp)
    }
    return filteredComponents.value
  })

  function toggleFilter(key: PnPFilterKey) {
    const next = new Set(activeFilters.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    activeFilters.value = next
  }

  function clearFilters() {
    if (activeFilters.value.size > 0) activeFilters.value = new Set()
    if (searchQuery.value) searchQuery.value = ''
  }

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

  // ── Component notes ──

  function setComponentNote(key: string, note: string) {
    const next = new Map(componentNotes.value)
    const trimmed = note.trim()
    if (!trimmed) {
      next.delete(key)
    } else {
      next.set(key, trimmed)
    }
    componentNotes.value = next
  }

  function setComponentNotes(notes: PnPComponentNotes | null | undefined) {
    const next = new Map<string, string>()
    for (const [key, val] of Object.entries(notes ?? {})) {
      if (typeof val === 'string' && val.trim()) next.set(key, val.trim())
    }
    componentNotes.value = next
  }

  const componentNotesRecord = computed<PnPComponentNotes>(() => {
    const out: PnPComponentNotes = {}
    for (const [k, v] of componentNotes.value.entries()) out[k] = v
    return out
  })

  // ── Field overrides (designator, value, x, y) ──

  function setFieldOverride(key: string, override: PnPFieldOverride) {
    const next = new Map(fieldOverrides.value)
    // Remove empty overrides
    const clean: PnPFieldOverride = {}
    if (override.designator != null && override.designator !== '') clean.designator = override.designator
    if (override.value != null) clean.value = override.value
    if (override.x != null && Number.isFinite(override.x)) clean.x = override.x
    if (override.y != null && Number.isFinite(override.y)) clean.y = override.y
    if (Object.keys(clean).length === 0) {
      next.delete(key)
    } else {
      next.set(key, clean)
    }
    fieldOverrides.value = next
  }

  function setFieldOverrides(overrides: PnPFieldOverrides | null | undefined) {
    const next = new Map<string, PnPFieldOverride>()
    for (const [key, val] of Object.entries(overrides ?? {})) {
      if (val && typeof val === 'object') next.set(key, val)
    }
    fieldOverrides.value = next
  }

  const fieldOverridesRecord = computed<PnPFieldOverrides>(() => {
    const out: PnPFieldOverrides = {}
    for (const [k, v] of fieldOverrides.value.entries()) out[k] = v
    return out
  })

  // ── Manual components ──

  function addManualComponent(mc: ManualPnPComponent) {
    manualComponents.value = [...manualComponents.value, mc]
  }

  function updateManualComponent(id: string, updates: Partial<ManualPnPComponent>) {
    manualComponents.value = manualComponents.value.map(mc =>
      mc.id === id ? { ...mc, ...updates } : mc,
    )
  }

  function removeManualComponent(id: string) {
    const key = `manual|${id}`
    // Clean up any overrides/notes for this component
    const nextRot = new Map(rotationOverrides.value)
    nextRot.delete(key)
    if (nextRot.size !== rotationOverrides.value.size) rotationOverrides.value = nextRot

    const nextDnp = new Set(dnpSet.value)
    nextDnp.delete(key)
    if (nextDnp.size !== dnpSet.value.size) dnpSet.value = nextDnp

    const nextNotes = new Map(componentNotes.value)
    nextNotes.delete(key)
    if (nextNotes.size !== componentNotes.value.size) componentNotes.value = nextNotes

    const nextFo = new Map(fieldOverrides.value)
    nextFo.delete(key)
    if (nextFo.size !== fieldOverrides.value.size) fieldOverrides.value = nextFo

    const nextPol = new Map(polarizedOverrides.value)
    nextPol.delete(key)
    if (nextPol.size !== polarizedOverrides.value.size) polarizedOverrides.value = nextPol

    manualComponents.value = manualComponents.value.filter(mc => mc.id !== id)
  }

  /**
   * Delete any component (manual or parsed).
   * Manual components are removed entirely; parsed components are tracked in deletedKeys.
   */
  function deleteComponent(key: string) {
    if (key.startsWith('manual|')) {
      const id = key.replace('manual|', '')
      removeManualComponent(id)
      return
    }
    // Parsed component: add to deletedKeys and clean up associated overrides
    const next = new Set(deletedKeys.value)
    next.add(key)
    deletedKeys.value = next

    const nextRot = new Map(rotationOverrides.value)
    nextRot.delete(key)
    if (nextRot.size !== rotationOverrides.value.size) rotationOverrides.value = nextRot

    const nextDnp = new Set(dnpSet.value)
    nextDnp.delete(key)
    if (nextDnp.size !== dnpSet.value.size) dnpSet.value = nextDnp

    const nextNotes = new Map(componentNotes.value)
    nextNotes.delete(key)
    if (nextNotes.size !== componentNotes.value.size) componentNotes.value = nextNotes

    const nextFo = new Map(fieldOverrides.value)
    nextFo.delete(key)
    if (nextFo.size !== fieldOverrides.value.size) fieldOverrides.value = nextFo

    const nextPol = new Map(polarizedOverrides.value)
    nextPol.delete(key)
    if (nextPol.size !== polarizedOverrides.value.size) polarizedOverrides.value = nextPol
  }

  function setDeletedKeys(keys: string[] | null | undefined) {
    deletedKeys.value = new Set(keys ?? [])
  }

  /** Serialised deleted keys for persistence */
  const deletedKeysRecord = computed<string[]>(() => [...deletedKeys.value])

  function setManualComponents(components: ManualPnPComponent[] | null | undefined) {
    manualComponents.value = components ?? []
  }

  const manualComponentsRecord = computed<ManualPnPComponent[]>(() =>
    manualComponents.value.map(mc => ({ ...mc })),
  )

  // ── External package matcher (library) ──

  function setPackageMatcher(fn: ((name: string) => PackageDefinition | undefined) | null | undefined) {
    packageMatcher.value = fn ?? null
  }

  function setThtPackageMatcher(fn: ((name: string) => THTPackageDefinition | undefined) | null | undefined) {
    thtPackageMatcher.value = fn ?? null
  }

  // ── PnP convention (orientation standard) ──
  // Default to IEC 61188-7 as the most common PnP convention
  const convention = ref<PnPConvention>('iec61188')

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

  /** Pending manual component being placed (set during align-first/align-second) */
  const placingComponent = ref<ManualPnPComponent | null>(null)

  /** Cancel any in-progress alignment or placement */
  function cancelAlign() {
    alignMode.value = 'idle'
    alignComponent.value = null
    alignClickA.value = null
    placingComponent.value = null
  }

  /**
   * Convert a Gerber coordinate to PnP coordinate (mm) using the current origin.
   */
  function gerberToPnP(gerberX: number, gerberY: number, units: 'mm' | 'in'): { x: number; y: number } {
    const ox = originX.value ?? 0
    const oy = originY.value ?? 0
    const dx = gerberX - ox
    const dy = gerberY - oy
    if (units === 'in') {
      return { x: dx * 25.4, y: dy * 25.4 }
    }
    return { x: dx, y: dy }
  }

  /**
   * Handle a snapped click from the canvas during alignment or placement.
   * Returns true if the operation is complete.
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

      case 'align-second': {
        if (!alignClickA.value) break
        // Midpoint of the two clicks (or same point if clicked twice on same spot)
        const midX = (alignClickA.value.x + gerberX) / 2
        const midY = (alignClickA.value.y + gerberY) / 2

        if (placingComponent.value) {
          // Placement mode: set position and add the manual component
          const pos = gerberToPnP(midX, midY, units)
          placingComponent.value.x = pos.x
          placingComponent.value.y = pos.y
          addManualComponent(placingComponent.value)
          selectComponent(placingComponent.value.designator)
          placingComponent.value = null
        } else if (alignComponent.value) {
          // Alignment mode: compute origin from the midpoint
          computeOriginFromComponent(alignComponent.value, midX, midY, units)
        }

        alignMode.value = 'idle'
        alignComponent.value = null
        alignClickA.value = null
        return true
      }

      default:
        return false
    }
    return false
  }

  /** Start placement mode for a new manual component. Uses the same two-click flow as component alignment. */
  function startPlacement(mc: ManualPnPComponent) {
    placingComponent.value = mc
    alignComponent.value = null
    alignClickA.value = null
    alignMode.value = 'align-first'
  }

  // Invalidate cache when layers ref changes identity
  watch(layers, () => invalidateCache(), { deep: false })
  // Drop stale overrides when imported component set changes.
  // Preserve manual component overrides (keys starting with 'manual|').
  watch(allParsedComponents, (components) => {
    if (rotationOverrides.value.size === 0) return
    const validKeys = new Set(components.map(getComponentKey))
    const next = new Map(rotationOverrides.value)
    let changed = false
    for (const key of next.keys()) {
      if (key.startsWith('manual|')) continue
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
    hasSmdPnP,
    hasThtPnP,
    allComponents,
    activeComponents,
    smdActiveComponents,
    thtActiveComponents,
    visibleComponents,
    searchQuery,
    filteredComponents,
    smdFilteredComponents,
    thtFilteredComponents,
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
    // Component filters
    activeFilters,
    toggleFilter,
    clearFilters,
    // DNP
    toggleDnp,
    setDnpKeys,
    resetAllDnp,
    dnpRecord,
    // Package mapping
    setPackageMatcher,
    setThtPackageMatcher,
    setCadPackageMapping,
    setCadPackageMap,
    cadPackageMapRecord,
    // Polarized
    setPolarizedOverride,
    setPolarizedOverrides,
    polarizedOverridesRecord,
    // Notes
    setComponentNote,
    setComponentNotes,
    componentNotesRecord,
    // Field overrides
    setFieldOverride,
    setFieldOverrides,
    fieldOverridesRecord,
    // Manual components
    addManualComponent,
    updateManualComponent,
    removeManualComponent,
    setManualComponents,
    manualComponentsRecord,
    // Delete any component (manual or parsed)
    deleteComponent,
    setDeletedKeys,
    deletedKeysRecord,
    startPlacement,
    placingComponent,
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
