import type { THTPackageDefinition } from '~/utils/tht-package-types'
import type { BuiltinLibraryAttribution } from '~/composables/usePackageLibrary'

export interface ThtLibraryInfo {
  id: string
  name: string
  packageCount: number
  attribution?: BuiltinLibraryAttribution
}

/**
 * Composable that manages THT package definitions:
 * merges local custom THT packages + team THT packages, builds a lookup map,
 * and exposes a match function for THT component → library matching.
 */
export function useThtPackageLibrary() {
  type BuiltinThtPackage = THTPackageDefinition & {
    libraryId?: string
    libraryName?: string
    attribution?: BuiltinLibraryAttribution
  }

  const builtInPackages = ref<BuiltinThtPackage[]>([])
  const builtInByLibrary = ref<Record<string, BuiltinThtPackage[]>>({})
  const customPackages = ref<THTPackageDefinition[]>([])
  const teamPackages = ref<THTPackageDefinition[]>([])
  const libraries = ref<ThtLibraryInfo[]>([])
  const selectedLibraryIds = ref<string[]>([])
  const loaded = ref(false)
  const loading = ref(false)

  async function safeFetchJson<T>(url: string): Promise<T | null> {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      return await res.json() as T
    } catch {
      return null
    }
  }

  /** All THT packages: local custom first (highest priority), then team */
  const allThtPackages = computed(() => [...customPackages.value, ...teamPackages.value, ...builtInPackages.value])

  /** Map from normalised package name -> THTPackageDefinition */
  const lookupMap = computed(() => {
    const map = new Map<string, THTPackageDefinition>()
    // Built-in lowest priority
    for (const pkg of builtInPackages.value) {
      map.set(normalise(pkg.name), pkg)
      if (pkg.aliases) {
        for (const alias of pkg.aliases) {
          map.set(normalise(alias), pkg)
        }
      }
    }
    // Team first, then local custom overwrites (highest priority)
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

  /** Look up a THT package definition by name */
  function matchThtPackage(packageName: string): THTPackageDefinition | undefined {
    if (!packageName) return undefined
    for (const candidate of normaliseCandidates(packageName)) {
      const hit = lookupMap.value.get(candidate)
      if (hit) return hit
    }
    return undefined
  }

  /** Set local custom THT packages */
  function setCustomPackages(pkgs: THTPackageDefinition[]) {
    customPackages.value = pkgs
  }

  /** Set team THT packages */
  function setTeamPackages(pkgs: THTPackageDefinition[]) {
    teamPackages.value = pkgs
  }

  async function ensureLibrariesLoaded(ids: string[]) {
    const target = ids.length ? ids : libraries.value.map((l) => l.id)
    const misses = target.filter((id) => !(id in builtInByLibrary.value))
    if (misses.length === 0) {
      builtInPackages.value = target.flatMap((id) => builtInByLibrary.value[id] ?? [])
      return
    }

    const next = { ...builtInByLibrary.value }
    const tree = await safeFetchJson<any>('/packages/tht-libraries/_tree.json')
    for (const id of misses) {
      if (!tree) {
        next[id] = []
        continue
      }
      const entry = (tree?.libraries ?? []).find((l: any) => l.id === id)
      if (!entry) {
        next[id] = []
        continue
      }
      const files = Array.isArray(entry.packages) ? entry.packages : []
      const loadedPkgs = await Promise.all(files.map(async (p: any) => {
        const pkg = await safeFetchJson<any>(`/packages/tht-libraries/${id}/packages/${p.file}`)
        if (!pkg) return null
        return {
          ...pkg,
          libraryId: id,
          libraryName: entry.library?.displayName ?? id,
          attribution: entry.library?.attribution,
        } as BuiltinThtPackage
      }))
      next[id] = loadedPkgs.filter((p): p is BuiltinThtPackage => p !== null)
    }
    builtInByLibrary.value = next
    builtInPackages.value = target.flatMap((id) => next[id] ?? [])
  }

  async function setSelectedLibraries(ids: string[]) {
    selectedLibraryIds.value = [...new Set(ids)]
    await ensureLibrariesLoaded(selectedLibraryIds.value)
  }

  async function loadPackages() {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      const tree = await safeFetchJson<any>('/packages/tht-libraries/_tree.json')
      if (!tree) {
        loaded.value = true
        return
      }
      const libs = Array.isArray(tree?.libraries) ? tree.libraries : []
      libraries.value = libs.map((l: any) => ({
        id: l.id,
        name: l.library?.displayName ?? l.id,
        packageCount: l.packageCount ?? (Array.isArray(l.packages) ? l.packages.length : 0),
        attribution: l.library?.attribution,
      }))
      await setSelectedLibraries([])
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  return {
    builtInPackages,
    customPackages,
    teamPackages,
    allThtPackages,
    libraries,
    selectedLibraryIds,
    loaded,
    loading,
    lookupMap,
    matchThtPackage,
    setCustomPackages,
    setTeamPackages,
    setSelectedLibraries,
    loadPackages,
  }
}

/** Normalise a THT package name for case-insensitive matching */
function normalise(name: string): string {
  const trimmed = name.trim()
  const withoutLibPrefix = trimmed.includes(':') ? (trimmed.split(':').pop() || trimmed) : trimmed
  return withoutLibPrefix.trim().toLowerCase()
}

/**
 * Generate normalised candidate keys for matching THT package names.
 * THT packages tend to have simpler names (e.g. "PinHeader-2x5", "TO-220")
 * so the candidate generation is less complex than SMD.
 */
function normaliseCandidates(name: string): string[] {
  const base = normalise(name)
  const candidates: string[] = [base]

  const push = (v: string) => {
    const s = v.trim()
    if (s && !candidates.includes(s)) candidates.push(s)
  }

  // Separator normalisation: underscores to hyphens
  const underscoresToHyphen = base.replace(/_/g, '-')
  if (underscoresToHyphen !== base) push(underscoresToHyphen)

  // Remove all separators
  const compact = base.replace(/[\s_-]+/g, '')
  if (compact !== base) push(compact)

  // No hyphen variant
  const noHyphen = base.replace(/-/g, '')
  if (noHyphen !== base) push(noHyphen)

  // Strip anything after first space or paren
  const beforeParen = base.split('(')[0]!.trim()
  if (beforeParen && beforeParen !== base) push(beforeParen)
  const beforeSpace = base.split(/\s+/)[0]!.trim()
  if (beforeSpace && beforeSpace !== base) push(beforeSpace)

  // Content inside parentheses
  for (const m of base.matchAll(/\(([^)]+)\)/g)) {
    push(m[1] ?? '')
  }

  // KiCad prefix stripping
  if (base.includes('_')) {
    push(base.split('_')[0]!)
  }

  return [...new Set(candidates)]
}
