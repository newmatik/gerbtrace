/**
 * Enrich existing JSON packages with machine parameters from MYCenter .pck exports.
 *
 * For each JSON package in public/packages/:
 * 1. Find matching .pck files in public/mycenter-packages/ (by name and aliases)
 * 2. Parse the .pck file and extract machine parameters
 * 3. Identify variations (height, centering) from multiple matching .pck files
 * 4. Write enriched JSON files (preserving existing geometry)
 *
 * Usage: node scripts/enrich-packages.mjs [--dry-run]
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { parsePckRecord, mapAccLevel } from './pck-parser.mjs'

const PACKAGES_DIR = path.resolve(process.cwd(), 'public', 'packages')
const MYCENTER_DIR = path.resolve(process.cwd(), 'public', 'mycenter-packages')
const DRY_RUN = process.argv.includes('--dry-run')

// ── Variation detection patterns ──

/** Strip height suffix like -04, -07, -10 (exactly 2 digits after dash at end) */
const HEIGHT_SUFFIX_RE = /-(\d{2})$/

/** Strip centering variant suffixes */
const CENTERING_SUFFIXES = [
  /\s+Hydra$/i,
  /\s+no\s+Hydra$/i,
  /\s+ohne\s+Hydra$/i,
  /\s+Midas$/i,
  /\s+Langsam$/i,
  /\s+NO\s+HYDRA$/i,
]

/** Strip variant IDs (numeric suffixes like 330032, 164027) */
const VARIANT_ID_RE = /\s+\d{5,}$/

/** Strip dimension suffixes like 2x1.4x1.2 */
const DIMENSION_SUFFIX_RE = /\s+\d+[.,]\d+x\d+[.,]\d+.*$/i

/** Strip pitch suffix like -0.80, -0.50, -0.65 */
const PITCH_SUFFIX_RE = /-\d+[.,]\d+$/

/** Strip body-width suffix like -BW:4.3, -BW:3.1 (and anything after it) */
const BW_SUFFIX_RE = /-BW:[^\s]+.*$/i

/** Strip qualifier suffixes: mech, opt, new, HUS, THE, frt, am, etc. */
const QUALIFIER_SUFFIXES = [
  /\s+mech\.?$/i,
  /\s+opt\.?$/i,
  /\s+new$/i,
  /\s+HUS$/i,
  /\s+THE$/i,
  /\s+frt$/i,
  /\s+am$/i,
  /\s+rb$/i,
  /\s+EHE$/i,
]

/** Strip pin-count suffix like -3, -5 at end (for SOT-523-3 → SOT-523) */
const PIN_COUNT_SUFFIX_RE = /-(\d)$/

/**
 * Extract the base name from a .pck filename for matching.
 * Returns { baseName, heightVariant, centeringVariant }
 */
function parsePckFilename(filename) {
  let name = filename.replace(/\.pck$/i, '')
  let heightVariant = null
  let centeringVariant = null

  // Check for centering variant
  for (const re of CENTERING_SUFFIXES) {
    const match = name.match(re)
    if (match) {
      if (/hydra/i.test(match[0]) && !/no|ohne/i.test(match[0])) {
        centeringVariant = 'hydra'
      } else if (/no|ohne/i.test(match[0])) {
        centeringVariant = 'slow'
      } else if (/midas/i.test(match[0])) {
        centeringVariant = 'slow'
      } else if (/langsam/i.test(match[0])) {
        centeringVariant = 'slow'
      }
      name = name.replace(re, '')
      break
    }
  }

  // Strip qualifier suffixes (mech, opt, new, etc.)
  for (const re of QUALIFIER_SUFFIXES) {
    name = name.replace(re, '')
  }

  // Strip variant IDs (5+ digit numbers)
  name = name.replace(VARIANT_ID_RE, '')
  // Strip dimension suffixes (2x1.4x1.2)
  name = name.replace(DIMENSION_SUFFIX_RE, '')
  // Strip body-width suffix (-BW:4.3 ...)
  name = name.replace(BW_SUFFIX_RE, '')
  // Strip pitch suffix (-0.80, -0.65, etc.)
  name = name.replace(PITCH_SUFFIX_RE, '')

  // Check for height variant (must be exactly 2 digits after dash).
  // Only treat as height if the remaining base ends with a digit — i.e. chip sizes
  // like 0402-07, or dimension-encoded names like DFN08p20x20-05.
  // Do NOT strip pin counts like HTSSOP-28, SOT-23, DFN-16, SOD-80.
  const heightMatch = name.match(HEIGHT_SUFFIX_RE)
  if (heightMatch) {
    const potentialBase = name.replace(HEIGHT_SUFFIX_RE, '').trim()
    if (/\d$/.test(potentialBase)) {
      heightVariant = heightMatch[1]
      name = potentialBase
    }
  }

  return { baseName: name.trim(), heightVariant, centeringVariant }
}

/**
 * Normalise a name for matching (lowercase, strip common prefixes/suffixes).
 */
function normalise(name) {
  return name.trim().toLowerCase().replace(/[_\s-]+/g, '')
}

/**
 * Build a lookup index from all .pck files.
 * Each file is indexed under its normalised base name (with height stripped if applicable),
 * AND under the full normalised filename (no height stripping) as a secondary key.
 * Key = normalised name, Value = array of { filename, parsed data }
 */
async function buildPckIndex() {
  const entries = await fs.readdir(MYCENTER_DIR, { withFileTypes: true })
  const pckFiles = entries.filter((e) => e.isFile() && e.name.endsWith('.pck')).map((e) => e.name)

  console.log(`Found ${pckFiles.length} .pck files in mycenter-packages/`)

  /** @type {Map<string, Array<{ filename: string, baseName: string, heightVariant: string|null, centeringVariant: string|null }>>} */
  const index = new Map()

  for (const filename of pckFiles) {
    const parsed = parsePckFilename(filename)
    const { baseName, heightVariant, centeringVariant } = parsed
    const entry = { filename, baseName, heightVariant, centeringVariant }
    const key = normalise(baseName)

    if (!index.has(key)) index.set(key, [])
    index.get(key).push(entry)

    // Also index under the full normalised filename (before height stripping)
    // so that names with embedded pin counts or sizes are still findable.
    const fullName = filename.replace(/\.pck$/i, '')
    // Strip only centering and qualifier suffixes for the full key
    let fullNorm = fullName
    for (const re of CENTERING_SUFFIXES) fullNorm = fullNorm.replace(re, '')
    for (const re of QUALIFIER_SUFFIXES) fullNorm = fullNorm.replace(re, '')
    fullNorm = fullNorm.replace(VARIANT_ID_RE, '')
    const fullKey = normalise(fullNorm)
    if (fullKey !== key) {
      if (!index.has(fullKey)) index.set(fullKey, [])
      // Mark these as found via full-name key (keep original parsed variants)
      index.get(fullKey).push(entry)
    }
  }

  return index
}

/**
 * Find matching .pck files for a JSON package.
 * Tries the package name and all aliases, with multiple matching strategies:
 * 1. Exact normalised match
 * 2. With pin-count suffix stripped (SOT-523 → SOT-523-3.pck)
 * 3. MELF-style prefix match (MELF → MELF2012.pck)
 * 4. With "p" dimension encoding (QFN-10-1.9x1.9-P0.50 → QFN10p19x19)
 */
function findMatchingPckFiles(pkg, pckIndex) {
  const candidates = [pkg.name, ...(pkg.aliases ?? [])]
  const matches = new Set()

  for (const candidate of candidates) {
    const key = normalise(candidate)

    // Strategy 1: exact normalised match
    const found = pckIndex.get(key)
    if (found) {
      for (const entry of found) matches.add(JSON.stringify(entry))
    }

    // Strategy 2: try adding common pin-count suffixes for SOT/SOD packages
    // e.g. SOT-89 → sot893, SOT-523 → sot5233
    if (!found) {
      for (const suffix of ['3', '5', '6', '8']) {
        const withSuffix = pckIndex.get(key + suffix)
        if (withSuffix) {
          for (const entry of withSuffix) matches.add(JSON.stringify(entry))
        }
      }
    }
  }

  // Strategy 3: prefix matching — try ALL candidates (name + aliases) at once
  if (matches.size === 0) {
    for (const candidate of candidates) {
      const candKey = normalise(candidate)
      if (candKey.length < 3) continue // too short for prefix matching

      for (const [indexKey, entries] of pckIndex) {
        if (indexKey.startsWith(candKey) && indexKey.length > candKey.length) {
          const remainder = indexKey.slice(candKey.length)
          // Accept if remainder is:
          // - dimension-coded: p30x30, 17x17
          // - single variant letter: b, a, c (SOT-883B, TO-277A)
          // - starts with body-width or pitch info
          if (/^p\d|^\d+x|^[a-z]$|^bw/i.test(remainder)) {
            for (const entry of entries) matches.add(JSON.stringify(entry))
          }
        }

        // Also: index key is prefix of our candidate (e.g. indexKey "sot23" matches candidate "sot233pin")
        // This helps when our name has MORE detail than the .pck filename
        if (candKey.startsWith(indexKey) && candKey.length > indexKey.length) {
          const remainder = candKey.slice(indexKey.length)
          // Only accept if the "extra" part is dimension/pitch info, not a different package
          if (/^p\d|^\d+x/.test(remainder)) {
            for (const entry of entries) matches.add(JSON.stringify(entry))
          }
        }
      }
    }
  }

  return [...matches].map((s) => JSON.parse(s))
}

/**
 * Convert a parsed PckRecord into our machine settings format.
 */
function extractMachineSettings(pckRecord) {
  const m = {}

  // Mount tools (from P022 nozzle)
  if (pckRecord.nozzle.nozzle) {
    m.mountTools = [pckRecord.nozzle.nozzle]
  }

  // HYDRA tools (from P032-2)
  if (pckRecord.headAssignment.heads.length) {
    m.hydraTools = pckRecord.headAssignment.heads.filter(Boolean)
  }

  // Pick/place timing (from P022 params)
  if (pckRecord.nozzle.params.length >= 3) {
    m.pickWaitTime = pckRecord.nozzle.params[0]
    m.placeWaitTime = pckRecord.nozzle.params[1]
    m.zMountForce = pckRecord.nozzle.params[2]
  }

  // Flags (from P022 flags)
  if (pckRecord.nozzle.flags.length >= 3) {
    m.flags = {
      pickPositionFeedback: pckRecord.nozzle.flags[0] ?? false,
      holdDuringXMove: pckRecord.nozzle.flags[1] ?? false,
      vacuumTest: pckRecord.nozzle.flags[2] ?? false,
    }
  }

  // Accelerations (from P03)
  if (pckRecord.accuracy.levels.length >= 7) {
    const levels = pckRecord.accuracy.levels
    m.accelerations = {
      x: mapAccLevel(levels[0]),
      y: mapAccLevel(levels[1]),
      tape: mapAccLevel(levels[2]),
      theta: mapAccLevel(levels[3]),
      z: mapAccLevel(levels[4]),
      hydraTheta: mapAccLevel(levels[5]),
      hydraZ: mapAccLevel(levels[6]),
    }
  }
  if (pckRecord.accuracy.hydraFinePitch) {
    m.hydraFinePitch = true
  }

  // Centering phases
  if (pckRecord.centering.length) {
    m.centering = pckRecord.centering.map((phase) => {
      const cp = { method: phase.method === 'MECHANICAL' ? 'mechanical' : 'optical' }
      if (phase.tools?.length) {
        cp.tools = phase.tools
      }
      if (phase.mechanical) {
        cp.mechanical = {
          angle: phase.mechanical.angle,
          position: phase.mechanical.position,
          force: phase.mechanical.force,
        }
      }
      if (phase.jaw) {
        cp.jaw = { ...phase.jaw }
      }
      return cp
    })
  }

  // Vision modes
  const allVision = [...(pckRecord.visionModes071 ?? []), ...(pckRecord.visionModes073 ?? [])]
    .filter((v) => v !== 'NONE')
  if (allVision.length) {
    m.visionModes = [...new Set(allVision)]
  }

  // Coplanarity
  m.coplanarityCheck = pckRecord.coplanarity

  // Glue
  if (pckRecord.glue.mode !== 'NONE') {
    m.glue = {
      mode: pckRecord.glue.mode,
      matching: pckRecord.glue.matching,
      positions: pckRecord.glue.positions,
    }
  }

  // Marking
  if (pckRecord.markingPositions.length) {
    m.markingPositions = pckRecord.markingPositions
  }

  return m
}

/**
 * Build variations from matching .pck files with height or centering suffixes.
 */
async function buildVariations(matches, mycenterDir) {
  const variations = []

  for (const match of matches) {
    if (!match.heightVariant && !match.centeringVariant) continue

    const filePath = path.join(mycenterDir, match.filename)
    const text = await fs.readFile(filePath, 'utf8')
    const pckRecord = parsePckRecord(text)

    const variation = {
      id: match.heightVariant || match.centeringVariant,
    }

    if (match.heightVariant) {
      variation.id = match.heightVariant
      variation.label = `H${(pckRecord.height.nominal || 0).toFixed(1)}`
      if (pckRecord.height.nominal > 0) {
        variation.height = { ...pckRecord.height }
      }
    }

    if (match.centeringVariant) {
      variation.id = match.centeringVariant
      variation.label = match.centeringVariant === 'hydra' ? 'Hydra' : 'Slow (no Hydra)'
      // Extract machine overrides for the centering variant
      const machineOverrides = {}
      if (pckRecord.centering.length) {
        const hasHydraTool = pckRecord.centering.some(
          (p) => p.tools?.includes('HYDRA_TOOL'),
        )
        if (match.centeringVariant === 'hydra' && hasHydraTool) {
          machineOverrides.centering = extractMachineSettings(pckRecord).centering
          if (pckRecord.visionModes071.includes('hydra') || pckRecord.visionModes073.includes('hydra')) {
            machineOverrides.visionModes = [...new Set([...(pckRecord.visionModes071 ?? []), ...(pckRecord.visionModes073 ?? [])].filter((v) => v !== 'NONE'))]
          }
        }
        if (match.centeringVariant === 'slow') {
          machineOverrides.centering = extractMachineSettings(pckRecord).centering
        }
      }
      if (Object.keys(machineOverrides).length) {
        variation.machine = machineOverrides
      }
    }

    variations.push(variation)
  }

  return variations
}

/**
 * Enrich a single JSON package with data from matching .pck files.
 */
async function enrichPackage(pkgPath, pckIndex, mycenterDir) {
  const raw = await fs.readFile(pkgPath, 'utf8')
  const pkg = JSON.parse(raw)
  const filename = path.basename(pkgPath)

  const matches = findMatchingPckFiles(pkg, pckIndex)
  if (!matches.length) {
    return { filename, matched: false, changes: [] }
  }

  // Find the "base" match (no height or centering variant).
  // If no pure base exists, fall back to the first available match to still extract machine data.
  let baseMatch = matches.find((m) => !m.heightVariant && !m.centeringVariant)
  if (!baseMatch) {
    // Prefer a match with only height (over centering) as it's closer to the base config
    baseMatch = matches.find((m) => m.heightVariant && !m.centeringVariant)
      || matches[0] // last resort: use any match
  }
  const changes = []
  const usedFallback = baseMatch && (baseMatch.heightVariant || baseMatch.centeringVariant)

  if (baseMatch) {
    // Parse the base .pck file
    const pckPath = path.join(mycenterDir, baseMatch.filename)
    const pckText = await fs.readFile(pckPath, 'utf8')
    const pckRecord = parsePckRecord(pckText)

    // Extract height (only if not already set)
    if (!pkg.height && pckRecord.height.nominal > 0) {
      pkg.height = { ...pckRecord.height }
      changes.push('height')
    }

    // Extract search area
    if (!pkg.searchArea && (pckRecord.searchArea.x > 0 || pckRecord.searchArea.y > 0)) {
      pkg.searchArea = { ...pckRecord.searchArea }
      changes.push('searchArea')
    }

    // Extract center offset
    if (!pkg.centerOffset && (pckRecord.centerOffset.x !== 0 || pckRecord.centerOffset.y !== 0)) {
      pkg.centerOffset = { ...pckRecord.centerOffset }
      changes.push('centerOffset')
    }

    // Extract machine settings (only if not already set)
    if (!pkg.machine) {
      const machine = extractMachineSettings(pckRecord)
      if (Object.keys(machine).length) {
        pkg.machine = machine
        changes.push(usedFallback ? 'machine(fallback)' : 'machine')
      }
    }
  }

  // Build variations from variant matches
  const variantMatches = matches.filter((m) => m.heightVariant || m.centeringVariant)
  if (variantMatches.length && !pkg.variations?.length) {
    const variations = await buildVariations(variantMatches, mycenterDir)
    if (variations.length) {
      pkg.variations = variations
      changes.push(`variations(${variations.length})`)
    }
  }

  return { filename, matched: true, matchCount: matches.length, changes, pkg }
}

// ── Main ──

async function main() {
  console.log(`Enriching packages from ${PACKAGES_DIR}`)
  console.log(`Using .pck data from ${MYCENTER_DIR}`)
  if (DRY_RUN) console.log('** DRY RUN — no files will be written **\n')

  // Build index
  const pckIndex = await buildPckIndex()

  // List JSON packages
  const manifest = JSON.parse(await fs.readFile(path.join(PACKAGES_DIR, '_manifest.json'), 'utf8'))
  console.log(`\nProcessing ${manifest.length} JSON packages...\n`)

  let enriched = 0
  let unmatched = 0
  let unchanged = 0

  for (const jsonFile of manifest) {
    const pkgPath = path.join(PACKAGES_DIR, jsonFile)
    try {
      const result = await enrichPackage(pkgPath, pckIndex, MYCENTER_DIR)

      if (!result.matched) {
        console.log(`  ✗ ${result.filename} — no matching .pck found`)
        unmatched++
        continue
      }

      if (!result.changes.length) {
        unchanged++
        continue
      }

      console.log(`  ✓ ${result.filename} — enriched: ${result.changes.join(', ')} (${result.matchCount} .pck match(es))`)
      enriched++

      if (!DRY_RUN) {
        await fs.writeFile(pkgPath, JSON.stringify(result.pkg, null, 2) + '\n')
      }
    } catch (err) {
      console.error(`  ✗ ${jsonFile} — ERROR: ${err.message}`)
    }
  }

  console.log(`\n── Summary ──`)
  console.log(`  Enriched:  ${enriched}`)
  console.log(`  Unchanged: ${unchanged}`)
  console.log(`  Unmatched: ${unmatched}`)
  console.log(`  Total:     ${manifest.length}`)
  if (DRY_RUN) console.log('\n** Dry run complete. Run without --dry-run to apply changes. **')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
