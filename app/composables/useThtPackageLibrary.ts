import type { THTPackageDefinition } from '~/utils/tht-package-types'
import type { BuiltinLibraryAttribution } from '~/composables/usePackageLibrary'

export interface ThtLibraryInfo {
  id: string
  name: string
  packageCount: number
  attribution?: BuiltinLibraryAttribution
}

interface TreePackageEntry {
  file: string
  name: string
  aliases?: string[]
  libraryId: string
  libraryName: string
  attribution?: BuiltinLibraryAttribution
}

type BuiltinThtPackage = THTPackageDefinition & {
  libraryId?: string
  libraryName?: string
  attribution?: BuiltinLibraryAttribution
}

const FETCH_CONCURRENCY = 6

async function fetchConcurrent<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let idx = 0
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++
      results[i] = await tasks[i]!()
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()))
  return results
}

/**
 * Composable that manages THT package definitions:
 * merges local custom THT packages + team THT packages, builds a lookup map,
 * and exposes a match function for THT component → library matching.
 *
 * Package geometry is loaded lazily: on init only tree metadata is fetched.
 * Call prefetchPackagesForBoard() with the package names from PnP data
 * to load only the packages actually needed.
 */
export function useThtPackageLibrary() {
  const treeEntries = ref<TreePackageEntry[]>([])
  const fullPackageCache = ref<Record<string, BuiltinThtPackage>>({})
  const customPackages = ref<THTPackageDefinition[]>([])
  const teamPackages = ref<THTPackageDefinition[]>([])
  const libraries = ref<ThtLibraryInfo[]>([])
  const selectedLibraryIds = ref<string[]>([])
  const loaded = ref(false)
  const loading = ref(false)

  const selectedTreeEntries = computed(() => {
    if (selectedLibraryIds.value.length === 0) return treeEntries.value
    const ids = new Set(selectedLibraryIds.value)
    return treeEntries.value.filter((e) => ids.has(e.libraryId))
  })

  const builtInPackages = computed<BuiltinThtPackage[]>(() => {
    return selectedTreeEntries.value.map((entry) => {
      const cached = fullPackageCache.value[cacheKey(entry.libraryId, entry.file)]
      if (cached) return cached
      return {
        name: entry.name,
        aliases: entry.aliases,
        shapes: [],
        libraryId: entry.libraryId,
        libraryName: entry.libraryName,
        attribution: entry.attribution,
      } as BuiltinThtPackage
    })
  })

  const allThtPackages = computed(() => [...customPackages.value, ...teamPackages.value, ...builtInPackages.value])

  const lookupMap = computed(() => {
    const map = new Map<string, THTPackageDefinition>()
    for (const pkg of builtInPackages.value) {
      map.set(normalise(pkg.name), pkg)
      if (pkg.aliases) {
        for (const alias of pkg.aliases) map.set(normalise(alias), pkg)
      }
    }
    for (const pkg of teamPackages.value) {
      map.set(normalise(pkg.name), pkg)
      if (pkg.aliases) {
        for (const alias of pkg.aliases) map.set(normalise(alias), pkg)
      }
    }
    for (const pkg of customPackages.value) {
      map.set(normalise(pkg.name), pkg)
      if (pkg.aliases) {
        for (const alias of pkg.aliases) map.set(normalise(alias), pkg)
      }
    }
    return map
  })

  function matchThtPackage(packageName: string): THTPackageDefinition | undefined {
    if (!packageName) return undefined
    for (const candidate of normaliseCandidates(packageName)) {
      const hit = lookupMap.value.get(candidate)
      if (hit) return hit
    }
    return undefined
  }

  function setCustomPackages(pkgs: THTPackageDefinition[]) {
    customPackages.value = pkgs
  }

  function setTeamPackages(pkgs: THTPackageDefinition[]) {
    teamPackages.value = pkgs
  }

  function setSelectedLibraries(ids: string[]) {
    selectedLibraryIds.value = [...new Set(ids)]
  }

  /**
   * Fetch full geometry for packages matching the given names.
   * Only fetches packages not already cached. Uses concurrency limiting.
   */
  async function prefetchPackagesForBoard(packageNames: string[]) {
    const needed = new Map<string, TreePackageEntry>()
    for (const name of packageNames) {
      for (const candidate of normaliseCandidates(name)) {
        for (const entry of selectedTreeEntries.value) {
          const key = cacheKey(entry.libraryId, entry.file)
          if (fullPackageCache.value[key]) continue
          const entryNames = [normalise(entry.name), ...(entry.aliases ?? []).map(normalise)]
          if (entryNames.includes(candidate) && !needed.has(key)) {
            needed.set(key, entry)
          }
        }
      }
    }

    if (needed.size === 0) return

    const entries = [...needed.entries()]
    const tasks = entries.map(([, entry]) => async () => {
      try {
        const res = await fetch(`/packages/tht-libraries/${entry.libraryId}/packages/${entry.file}`)
        if (!res.ok) return null
        const pkg = await res.json() as THTPackageDefinition
        return {
          ...pkg,
          libraryId: entry.libraryId,
          libraryName: entry.libraryName,
          attribution: entry.attribution,
        } as BuiltinThtPackage
      } catch {
        return null
      }
    })

    const results = await fetchConcurrent(tasks, FETCH_CONCURRENCY)
    const next = { ...fullPackageCache.value }
    for (let i = 0; i < entries.length; i++) {
      const pkg = results[i]
      if (pkg) next[entries[i]![0]] = pkg
    }
    fullPackageCache.value = next
  }

  async function loadPackages() {
    if (loaded.value || loading.value) return
    loading.value = true
    try {
      const res = await fetch('/packages/tht-libraries/_tree.json')
      if (!res.ok) { loaded.value = true; return }
      const tree = await res.json()
      const libs = Array.isArray(tree?.libraries) ? tree.libraries : []

      libraries.value = libs.map((l: any) => ({
        id: l.id,
        name: l.library?.displayName ?? l.id,
        packageCount: l.packageCount ?? (Array.isArray(l.packages) ? l.packages.length : 0),
        attribution: l.library?.attribution,
      }))

      const entries: TreePackageEntry[] = []
      for (const lib of libs) {
        const pkgs = Array.isArray(lib.packages) ? lib.packages : []
        for (const p of pkgs) {
          entries.push({
            file: p.file,
            name: p.name,
            aliases: Array.isArray(p.aliases) ? p.aliases : undefined,
            libraryId: lib.id,
            libraryName: lib.library?.displayName ?? lib.id,
            attribution: lib.library?.attribution,
          })
        }
      }
      treeEntries.value = entries
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
    prefetchPackagesForBoard,
    loadPackages,
  }
}

function cacheKey(libraryId: string, file: string) {
  return `${libraryId}/${file}`
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
