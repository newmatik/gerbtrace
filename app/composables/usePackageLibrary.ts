import type { PackageDefinition } from '~/utils/package-types'

export interface BuiltinLibraryAttribution {
  upstreamOwner?: string
  upstreamRepo?: string
  upstreamUrl?: string
  notice?: string
}

export interface BuiltinLibraryInfo {
  id: string
  name: string
  owner: string
  sourceType?: string
  license?: string
  redistribution?: string
  attribution?: BuiltinLibraryAttribution
  packageCount: number
}

type PackageWithLibrary = PackageDefinition & {
  libraryId?: string
  libraryName?: string
  owner?: string
  attribution?: BuiltinLibraryAttribution
  sourceType?: string
}

export function usePackageLibrary() {
  const packageCache = ref<Record<string, PackageWithLibrary[]>>({})
  const packages = computed<PackageDefinition[]>(() => {
    const ids = selectedLibraryIds.value.length
      ? selectedLibraryIds.value
      : libraries.value.map((l) => l.id)
    const out: PackageDefinition[] = []
    for (const id of ids) {
      const fromLib = packageCache.value[id] ?? []
      out.push(...fromLib)
    }
    return out
  })
  const customPackages = ref<PackageDefinition[]>([])
  const teamPackages = ref<PackageDefinition[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const selectedLibraryIds = ref<string[]>([])
  const libraries = ref<BuiltinLibraryInfo[]>([])
  const treeManifest = ref<any>(null)

  /** All packages: local custom first (highest), then team, then built-in */
  const allPackages = computed(() => [...customPackages.value, ...teamPackages.value, ...packages.value])

  /** Map from normalised package name -> PackageDefinition */
  const lookupMap = computed(() => {
    const map = new Map<string, PackageDefinition>()
    // Built-in first, then team overwrites, then local custom overwrites (highest priority)
    for (const pkg of packages.value) {
      map.set(normalise(pkg.name), pkg)
      if (pkg.aliases) {
        for (const alias of pkg.aliases) {
          map.set(normalise(alias), pkg)
        }
      }
    }
    for (const pkg of teamPackages.value) {
      map.set(normalise(pkg.name), pkg)
      if (pkg.aliases) {
        for (const alias of pkg.aliases) {
          map.set(normalise(alias), pkg)
        }
      }
    }
    for (const pkg of customPackages.value) {
      map.set(normalise(pkg.name), pkg)
      if (pkg.aliases) {
        for (const alias of pkg.aliases) {
          map.set(normalise(alias), pkg)
        }
      }
    }
    return map
  })

  /** Look up a package definition by a PnP file package name */
  function matchPackage(packageName: string): PackageDefinition | undefined {
    if (!packageName) return undefined
    for (const candidate of normaliseCandidates(packageName)) {
      const hit = lookupMap.value.get(candidate)
      if (hit) return hit
    }
    return undefined
  }

  /** Set custom packages (from IndexedDB) to be merged into the lookup */
  function setCustomPackages(pkgs: PackageDefinition[]) {
    customPackages.value = pkgs
  }

  /** Set team packages (from Supabase) to be merged into the lookup */
  function setTeamPackages(pkgs: PackageDefinition[]) {
    teamPackages.value = pkgs
  }

  async function loadLegacyFlatManifest() {
    const manifestRes = await fetch('/packages/_manifest.json')
    if (!manifestRes.ok) return
    const filenames: string[] = await manifestRes.json()
    const results = await Promise.all(
      filenames.map(async (fname) => {
        try {
          const res = await fetch(`/packages/${fname}`)
          if (!res.ok) return null
          return (await res.json()) as PackageDefinition
        } catch {
          return null
        }
      }),
    )
    packageCache.value = {
      legacy: results.filter((p): p is PackageWithLibrary => p !== null),
    }
    libraries.value = [{
      id: 'legacy',
      name: 'Built-in',
      owner: 'newmatik',
      sourceType: 'TPSys',
      packageCount: packageCache.value.legacy.length,
    }]
    selectedLibraryIds.value = ['legacy']
  }

  async function ensureLibrariesLoaded(ids: string[]) {
    if (!treeManifest.value?.libraries) return
    const misses = ids.filter((id) => !(id in packageCache.value))
    if (misses.length === 0) return

    const nextCache: Record<string, PackageWithLibrary[]> = { ...packageCache.value }
    for (const id of misses) {
      const entry = treeManifest.value.libraries.find((l: any) => l.id === id)
      if (!entry) continue
      const files = Array.isArray(entry.packages) ? entry.packages : []
      const loadedPkgs = await Promise.all(
        files.map(async (p: any) => {
          const rel = `/packages/libraries/${id}/packages/${p.file}`
          try {
            const res = await fetch(rel)
            if (!res.ok) return null
            const pkg = (await res.json()) as PackageWithLibrary
            pkg.libraryId = id
            pkg.libraryName = entry.library?.displayName ?? id
            pkg.owner = entry.library?.owner ?? 'newmatik'
            pkg.attribution = entry.library?.attribution
            pkg.sourceType = entry.library?.sourceType
            return pkg
          } catch {
            return null
          }
        }),
      )
      nextCache[id] = loadedPkgs.filter((p): p is PackageWithLibrary => p !== null)
    }
    packageCache.value = nextCache
  }

  async function setSelectedLibraries(ids: string[]) {
    const unique = [...new Set(ids)]
    selectedLibraryIds.value = unique
    const targetIds = unique.length ? unique : libraries.value.map((l) => l.id)
    await ensureLibrariesLoaded(targetIds)
  }

  /** Load package tree from /packages/libraries/_tree.json */
  async function loadPackages() {
    if (loaded.value || loading.value) return
    loading.value = true

    try {
      const treeRes = await fetch('/packages/libraries/_tree.json')
      if (!treeRes.ok) {
        await loadLegacyFlatManifest()
        loaded.value = true
        return
      }
      const tree = await treeRes.json()
      treeManifest.value = tree
      const libs = Array.isArray(tree?.libraries) ? tree.libraries : []
      libraries.value = libs.map((l: any) => ({
        id: l.id,
        name: l.library?.displayName ?? l.id,
        owner: l.library?.owner ?? 'newmatik',
        sourceType: l.library?.sourceType,
        license: l.library?.license,
        redistribution: l.library?.redistribution,
        attribution: l.library?.attribution,
        packageCount: l.packageCount ?? (Array.isArray(l.packages) ? l.packages.length : 0),
      }))

      // Keep SMD behavior aligned with THT: empty selection means "all libraries".
      // This ensures package selectors can pick from any available SMD package.
      await setSelectedLibraries([])
      loaded.value = true
    } catch (err) {
      console.warn('[PackageLibrary] Failed to load package manifest', err)
    } finally {
      loading.value = false
    }
  }

  return {
    packages,
    customPackages,
    teamPackages,
    allPackages,
    loaded,
    loading,
    libraries,
    selectedLibraryIds,
    lookupMap,
    matchPackage,
    setCustomPackages,
    setTeamPackages,
    setSelectedLibraries,
    loadPackages,
  }
}

/** Normalise a package name for case-insensitive matching */
function normalise(name: string): string {
  const trimmed = name.trim()
  const withoutLibPrefix = trimmed.includes(':') ? (trimmed.split(':').pop() || trimmed) : trimmed
  return withoutLibPrefix.trim().toLowerCase()
}

/**
 * Generate normalised candidate keys for matching package names across CAD exports.
 *
 * Examples:
 * - KiCad: "Package_SO:SOIC-8_5.3x5.3mm_P1.27mm" -> ["soic-8_5.3x5.3mm_p1.27mm", "soic-8"]
 * - Eagle: "SOT23-BCE" -> ["sot23-bce", "sot23"]
 */
function normaliseCandidates(name: string): string[] {
  const base = normalise(name)
  const candidates: string[] = [base]

  const push = (v: string) => {
    const s = v.trim()
    if (s) candidates.push(s)
  }

  // IPC-style SMD passive footprint names (Altium/IPC-7351):
  // - CAPC2012X14N, RESC1608X55L, LEDM1608X09N_...
  // Convert metric size codes to our canonical imperial package names.
  // (Only apply deterministic, widely standardised mappings.)
  {
    const m = base.match(/^(capc|resc|ledm)(\d{4})/i)
    const metric = m?.[2]
    if (metric) {
      const METRIC_TO_IMPERIAL: Record<string, string> = {
        '1005': '0402',
        '1608': '0603',
        '2012': '0805',
        '3216': '1206',
        '3225': '1210',
        '4532': '1812',
      }
      const imperial = METRIC_TO_IMPERIAL[metric]
      if (imperial) {
        push(imperial)
        if (m?.[1]?.toLowerCase() === 'ledm') {
          push(`led-${imperial}`)
        }
      }
    }
  }

  // Bare chip size codes with leading zero dropped: 805 -> 0805, 603 -> 0603
  {
    const m = base.match(/^(\d{3,4})$/)
    if (m?.[1]) {
      const padded = m[1].padStart(4, '0')
      if (padded !== m[1]) push(padded)
    }
  }

  // Chip size with shape/variant prefix and optional suffix: SQ0402WID -> 0402, SQ0402L -> 0402
  {
    const m = base.match(/^(?:sq|cr|rc)(\d{3,4})\w*$/i)
    if (m?.[1]) {
      const code = m[1].padStart(4, '0')
      push(code)
    }
  }

  // Common package-without-dash forms: SOD523 -> SOD-523, SOT23 -> SOT-23
  {
    const m = base.match(/^(sod|sot|qfn|dfn|wson|xson)(\d{2,})$/)
    if (m?.[1] && m?.[2]) {
      push(`${m[1]}-${m[2]}`)
    }
  }

  // SO naming compatibility: SO-8 <-> SOIC-8 (and compact forms).
  {
    const m = base.match(/^(?:soic|so|sop)-?0*(\d+)(?:$|[^0-9].*)/i)
    if (m?.[1]) {
      const pinCount = String(Number(m[1]))
      push(`soic-${pinCount}`)
      push(`so-${pinCount}`)
      push(`soic${pinCount}`)
      push(`so${pinCount}`)
    }
  }

  // Altium TSOT-6 is typically the SOT-23-6 family.
  if (/^tsot-?6$/i.test(base)) {
    push('sot-23-6')
    push('sot23-6')
  }

  // DPAK… (IPC) should match our DPAK package name
  if (/^dpak/i.test(base)) {
    push('dpak')
  }

  // Strip anything after the first " (" or whitespace (common: "UMT3 (SOT-323)")
  {
    const beforeParen = base.split('(')[0]!.trim()
    if (beforeParen && beforeParen !== base) push(beforeParen)
    const beforeSpace = base.split(/\s+/)[0]!.trim()
    if (beforeSpace && beforeSpace !== base) push(beforeSpace)
  }

  // Split common multi-name separators: "X2SON / DQN" → ["x2son", "dqn"]
  if (base.includes('/')) {
    for (const part of base.split('/')) push(part)
  }

  // Also try the content inside parentheses: "UMT3 (SOT-323)" → "sot-323"
  for (const m of base.matchAll(/\(([^)]+)\)/g)) {
    push(m[1] ?? '')
  }

  // Separator normalisation variants
  const noSpaces = base.replace(/\s+/g, '')
  if (noSpaces !== base) push(noSpaces)
  const underscoresToHyphen = base.replace(/_/g, '-')
  if (underscoresToHyphen !== base) push(underscoresToHyphen)
  const compact = base.replace(/[\s_-]+/g, '')
  if (compact !== base) push(compact)
  const noHyphen = base.replace(/-/g, '')
  if (noHyphen !== base) push(noHyphen)
  const noUnderscore = base.replace(/_/g, '')
  if (noUnderscore !== base) push(noUnderscore)

  // KiCad-style: prefer the footprint name before param suffixes
  if (base.includes('_')) {
    candidates.push(base.split('_')[0]!)
  }

  // Common passive prefixes used by ERPs / BOM exports: C_0603 / R0402 / J_0603 / F_0603
  {
    const m = base.match(/^(?:[crljf])_?(\d{4})$/)
    if (m?.[1]) {
      push(m[1])
    }
  }

  // Common leading designator-ish prefixes: D_SOD-523, T_SOT-323
  {
    const m = base.match(/^[dt]_?((?:sod|sot)[-_ ]?\d+[a-z0-9]*)$/)
    if (m?.[1]) {
      const k = m[1].replace(/[\s_]+/g, '-')
      push(k)
      push(k.replace(/-/g, ''))
    }
  }

  // Variant-ish suffixes that often shouldn't affect matching: SOD-323HE → SOD-323
  {
    const m = base.match(/^(sod-\d+)[a-z]+$/)
    if (m?.[1]) push(m[1])
  }

  // Eagle-style transistor pinout suffixes (SOT23-BCE, SOT23-CBE, etc.)
  if (/^sot23-[a-z]{3,4}$/.test(base)) {
    candidates.push('sot23')
  }

  // Generic: drop a trailing dash-suffix when it looks like a variant (e.g. "-bce", "-dbv", "-1")
  // but keep the original first to avoid breaking legitimate hyphenated names.
  const variantStripped = base.replace(/-[a-z0-9]{1,6}$/, '')
  if (variantStripped !== base) candidates.push(variantStripped)

  // De-dupe while keeping order
  return [...new Set(candidates)]
}
