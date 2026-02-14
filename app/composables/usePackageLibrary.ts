import type { PackageDefinition } from '~/utils/package-types'

/**
 * Composable that loads package definitions from `/packages/*.json`,
 * builds a lookup map keyed by name + aliases, and exposes a match function.
 *
 * The library is loaded once (lazily on first access) and cached.
 * Custom packages (from IndexedDB) can be merged in via `setCustomPackages()`.
 */
export function usePackageLibrary() {
  const packages = ref<PackageDefinition[]>([])
  const customPackages = ref<PackageDefinition[]>([])
  const loaded = ref(false)
  const loading = ref(false)

  /** All packages: custom first (higher priority), then built-in */
  const allPackages = computed(() => [...customPackages.value, ...packages.value])

  /** Map from normalised package name -> PackageDefinition */
  const lookupMap = computed(() => {
    const map = new Map<string, PackageDefinition>()
    // Built-in first, then custom overwrites (custom has higher priority)
    for (const pkg of packages.value) {
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

  /** Load all package JSONs from /packages/ directory */
  async function loadPackages() {
    if (loaded.value || loading.value) return
    loading.value = true

    try {
      // Fetch the manifest (a JSON array of filenames)
      const manifestRes = await fetch('/packages/_manifest.json')
      if (!manifestRes.ok) {
        console.warn('[PackageLibrary] No _manifest.json found at /packages/')
        return
      }
      const filenames: string[] = await manifestRes.json()

      const results = await Promise.all(
        filenames.map(async (fname) => {
          try {
            const res = await fetch(`/packages/${fname}`)
            if (!res.ok) return null
            return (await res.json()) as PackageDefinition
          } catch {
            console.warn(`[PackageLibrary] Failed to load /packages/${fname}`)
            return null
          }
        }),
      )

      packages.value = results.filter((p): p is PackageDefinition => p !== null)
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
    allPackages,
    loaded,
    loading,
    lookupMap,
    matchPackage,
    setCustomPackages,
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

  // KiCad-style: prefer the footprint name before param suffixes
  if (base.includes('_')) {
    candidates.push(base.split('_')[0]!)
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
