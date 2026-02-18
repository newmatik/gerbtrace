/**
 * cleanup-packages.mjs
 *
 * Cleans up `public/packages/` to follow docs:
 * - `docs/package-canonical-naming-rules.md`
 * - `docs/packages.md`
 *
 * What it does:
 * - Merges duplicate definitions that only differ by naming (e.g. `C0603` -> `0603`)
 * - Creates canonical package filenames + `name` values
 * - Preserves geometry by preferring already-canonical files when present
 * - Unions + de-dupes aliases so older names still match
 * - Rebuilds `public/packages/_manifest.json` to exactly match the folder
 *
 * Usage:
 *   node scripts/cleanup-packages.mjs
 */

import { readFile, writeFile, readdir, unlink } from 'node:fs/promises'
import { join, extname } from 'node:path'

const PACKAGES_DIR = join(process.cwd(), 'public', 'packages')
const MANIFEST_PATH = join(PACKAGES_DIR, '_manifest.json')

function jsonStable(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

function uniq(arr) {
  return [...new Set(arr)]
}

function isChipSizeCode(s) {
  return /^(01005|0201|0402|0603|0805|1206|1210|1812|2010|2220|2512|2920)$/.test(s)
}

function formatPitch(pitch) {
  // Always 2 decimals like P0.50
  return Number(pitch).toFixed(2)
}

function formatDim(dim) {
  // Keep integers clean (5 -> "5"), else keep up to 2 decimals trimmed (1.25 -> "1.25")
  const n = Number(dim)
  if (Number.isInteger(n)) return String(n)
  return String(Number(n.toFixed(2)))
}

function canonicalizeFilenameBase(pkg) {
  const name = pkg.name

  // Chip passives: canonical is bare size code, no C/R/L prefix.
  // Some files currently store `name` as the size already; duplicates come from filenames like C0603.json.
  if (pkg.type === 'PT_TWO_POLE') {
    if (isChipSizeCode(name)) return name
    const m = name.match(/^(LED-)(01005|0201|0402|0603|0805|1206|1210|1812|2010|2220|2512|2920)$/)
    if (m) return name // LED-xxxx stays canonical as-is
  }

  // BGA: canonical should include pins + grid + pitch when known/ambiguous.
  // Example legacy export name: BGA100C65P10X10_800X800X170 -> BGA-100-10x10-P0.65
  if (pkg.type === 'PT_BGA') {
    const m = name.match(/^BGA(\d+)C(\d+)P(\d+)X(\d+)(?:_.+)?$/i)
    if (m) {
      const pins = Number(m[1])
      const pitch = Number(m[2]) / 100
      const cols = Number(m[3])
      const rows = Number(m[4])
      return `BGA-${pins}-${cols}x${rows}-P${pitch.toFixed(2)}`
    }
  }

  // DO-214 naming: canonical prefers SMA/SMB/SMC (common BOM naming)
  if (/^DO-?214AC$/i.test(name)) return 'SMA'
  if (/^DO-?214AA$/i.test(name)) return 'SMB'
  if (/^DO-?214AB$/i.test(name)) return 'SMC'

  // SOIC family: canonical wants SO-<pins>
  if (pkg.type === 'PT_TWO_SYM') {
    const m1 = name.match(/^SOIC-?(\d+)(W)?$/i)
    if (m1 && !m1[2]) return `SO-${Number(m1[1])}`
    const m2 = name.match(/^SO(\d+)$/i)
    if (m2) return `SO-${Number(m2[1])}`
    const m3 = name.match(/^SO-(\d+)$/i)
    if (m3) return `SO-${Number(m3[1])}`

    // SSOP / QSOP: prefer dashed form (SSOP-24, QSOP-16)
    const ssop = name.match(/^SSOP-?(\d+)$/i)
    if (ssop) return `SSOP-${Number(ssop[1])}`
    const qsop = name.match(/^QSOP-?(\d+)$/i)
    if (qsop) return `QSOP-${Number(qsop[1])}`
  }

  // QFN/DFN: canonical wants pins + body + pitch in name
  // Example: QFN-32-5x5-P0.50
  if (pkg.type === 'PT_FOUR_SYM' || pkg.type === 'PT_TWO_SYM') {
    const qfn = name.match(/^QFN-?(\d+)$/i) || name.match(/^QFN(\d+)$/i)
    if (qfn) {
      const pins = Number(qfn[1])
      const L = pkg.body?.length
      const W = pkg.body?.width
      // If it's a true 4-side QFN, use fourSymmetric pitch; otherwise fall back to twoSymmetric pitch.
      const pitch = pkg.fourSymmetric?.leadPitch ?? pkg.twoSymmetric?.leadPitch
      if (L != null && W != null && pitch != null) {
        return `QFN-${pins}-${formatDim(L)}x${formatDim(W)}-P${formatPitch(pitch)}`
      }
    }
    const dfn = name.match(/^DFN-?(\d+)$/i) || name.match(/^DFN(\d+)$/i)
    if (dfn && pkg.twoSymmetric) {
      const pins = Number(dfn[1])
      const L = pkg.body?.length
      const W = pkg.body?.width
      const pitch = pkg.twoSymmetric.leadPitch
      if (L != null && W != null && pitch != null) {
        return `DFN-${pins}-${formatDim(L)}x${formatDim(W)}-P${formatPitch(pitch)}`
      }
    }
  }

  // Default: keep as-is
  return name
}

function canonicalNameFromBase(base) {
  return base
}

function isAlreadyCanonicalFile(fname, pkg) {
  const base = fname.replace(/\.json$/i, '')
  return base === canonicalizeFilenameBase(pkg)
}

async function main() {
  const files = (await readdir(PACKAGES_DIR))
    .filter((f) => extname(f).toLowerCase() === '.json')
    .filter((f) => f !== '_manifest.json')

  const entries = []
  for (const file of files) {
    const raw = await readFile(join(PACKAGES_DIR, file), 'utf8')
    try {
      const pkg = JSON.parse(raw)
      entries.push({ file, pkg })
    } catch (e) {
      throw new Error(`Failed parsing ${file}: ${e}`)
    }
  }

  // Group by canonical base (which also becomes canonical "name")
  const groups = new Map()
  for (const { file, pkg } of entries) {
    const canonBase = canonicalizeFilenameBase(pkg)
    const arr = groups.get(canonBase) ?? []
    arr.push({ file, pkg })
    groups.set(canonBase, arr)
  }

  const toDelete = []
  const toWrite = []

  for (const [canonBase, items] of groups) {
    // Choose base (prefer already-canonical file, else first)
    const preferred =
      items.find((it) => isAlreadyCanonicalFile(it.file, it.pkg)) ??
      items.find((it) => it.pkg?.name === canonBase) ??
      items[0]

    const basePkg = structuredClone(preferred.pkg)
    basePkg.name = canonicalNameFromBase(canonBase)

    // Merge aliases: include all names + aliases from all items
    const aliases = []
    for (const it of items) {
      const p = it.pkg
      if (p?.name && p.name !== basePkg.name) aliases.push(p.name)
      if (Array.isArray(p?.aliases)) {
        for (const a of p.aliases) {
          if (a && a !== basePkg.name) aliases.push(a)
        }
      }
    }

    // Canonical special cases:
    // - Chip sizes should accept Cxxxx/Rxxxx/Lxxxx as aliases
    if (basePkg.type === 'PT_TWO_POLE' && isChipSizeCode(basePkg.name)) {
      aliases.push(`C${basePkg.name}`, `R${basePkg.name}`, `L${basePkg.name}`, `CHIP-${basePkg.name}`)
    }
    // - SO canonical should accept SOIC variants
    if (basePkg.type === 'PT_TWO_SYM' && /^SO-\d+$/.test(basePkg.name)) {
      const pins = basePkg.name.split('-')[1]
      aliases.push(`SO${pins}`, `SOIC-${pins}`, `SOIC${pins}`, `SO-${String(pins).padStart(2, '0')}`)
    }

    const finalAliases = uniq(aliases.map(String))
      .map((a) => a.trim())
      .filter((a) => a.length > 0 && a !== basePkg.name)
    if (finalAliases.length) basePkg.aliases = finalAliases
    else delete basePkg.aliases

    const canonFilename = `${canonBase}.json`
    toWrite.push({ file: canonFilename, pkg: basePkg })

    // Delete all non-canonical source files (except the canonical target)
    for (const it of items) {
      if (it.file !== canonFilename) {
        // Keep if it is the preferred file and already canonical name but filename mismatched?
        // No: we normalize everything to canonFilename.
        toDelete.push(it.file)
      }
    }
  }

  // Write canonical files
  for (const w of toWrite) {
    await writeFile(join(PACKAGES_DIR, w.file), jsonStable(w.pkg), 'utf8')
  }

  // Delete old files (skip if it was just overwritten as canonical)
  const canonSet = new Set(toWrite.map((w) => w.file))
  const deleteSet = new Set(toDelete.filter((f) => !canonSet.has(f)))
  for (const f of deleteSet) {
    await unlink(join(PACKAGES_DIR, f))
  }

  // Rebuild manifest
  const finalFiles = (await readdir(PACKAGES_DIR))
    .filter((f) => extname(f).toLowerCase() === '.json')
    .filter((f) => f !== '_manifest.json')
    .sort((a, b) => a.localeCompare(b))
  await writeFile(MANIFEST_PATH, JSON.stringify(finalFiles, null, 2) + '\n', 'utf8')

  console.log(`Cleaned packages: ${files.length} -> ${finalFiles.length}`)
  console.log(`Rebuilt manifest with ${finalFiles.length} entries`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

