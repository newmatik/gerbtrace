import type { THTPackageDefinition } from '~/utils/tht-package-types'

/**
 * Composable that manages THT package definitions:
 * merges local custom THT packages + team THT packages, builds a lookup map,
 * and exposes a match function for THT component → library matching.
 */
export function useThtPackageLibrary() {
  const customPackages = ref<THTPackageDefinition[]>([])
  const teamPackages = ref<THTPackageDefinition[]>([])

  /** All THT packages: local custom first (highest priority), then team */
  const allThtPackages = computed(() => [...customPackages.value, ...teamPackages.value])

  /** Map from normalised package name -> THTPackageDefinition */
  const lookupMap = computed(() => {
    const map = new Map<string, THTPackageDefinition>()
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

  return {
    customPackages,
    teamPackages,
    allThtPackages,
    lookupMap,
    matchThtPackage,
    setCustomPackages,
    setTeamPackages,
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
