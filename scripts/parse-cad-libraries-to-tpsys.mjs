import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import crypto from 'node:crypto'

const ROOT = process.cwd()
const SOURCES_PATH = path.join(ROOT, 'scripts', 'cad-library-sources.json')
const LIB_ROOT = path.join(ROOT, '.local', 'libraries')
const OUT_ROOT = path.join(ROOT, 'public', 'packages', 'libraries')
const REPORTS_DIR = path.join(OUT_ROOT, '_reports')

function normaliseName(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_\s]+/g, '-')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase()
}

function canonicaliseKicadName(name) {
  // 1) Family normalization: SO/SOP -> SOIC.
  const normalized = name
    .replace(/^SOIC-0*(\d+)(?=$|-)/i, 'SOIC-$1')
    .replace(/^SO-0*(\d+)(?=$|-)/i, 'SOIC-$1')
    .replace(/^SOP-0*(\d+)(?=$|-)/i, 'SOIC-$1')

  // 2) KLC-inspired structure:
  //    <PKG>-<PINCOUNT>[-<SPECIAL>]_<FIELD>_<FIELD>...
  //    Keep package/pin identifiers in the dash segment and move dimensions/
  //    pitch/modifiers/options to underscore fields.
  const tokens = normalized.split('-').filter(Boolean)
  if (tokens.length < 3) return normalized

  const head = [tokens[0]]
  let i = 1
  if (tokens[i]) {
    head.push(tokens[i])
    i += 1
  }
  // F2.4 style non-standard pin numbering: PKG-12-16
  if (tokens[i] && /^\d{1,3}$/.test(tokens[i]) && /^\d{1,3}$/.test(head[1] ?? '')) {
    head.push(tokens[i])
    i += 1
  }
  // KiCad special pad count fields (EP/SH/MP) stay in head.
  if (tokens[i] && /^\d+(EP|SH|MP)$/i.test(tokens[i])) {
    head.push(tokens[i])
    i += 1
  }

  const tail = tokens.slice(i)
  if (!tail.length) return head.join('-')

  const compactTail = []
  for (let t = 0; t < tail.length; t++) {
    const cur = tail[t]
    const next = tail[t + 1]
    if (cur === 'THERMAL' && next === 'VIAS') {
      compactTail.push('THERMALVIAS')
      t += 1
      continue
    }
    if (cur === 'TOP' && next === 'TENTED') {
      compactTail.push('TOPTENTED')
      t += 1
      continue
    }
    if (cur === 'HAND' && next === 'SOLDERING') {
      compactTail.push('HANDSOLDERING')
      t += 1
      continue
    }
    compactTail.push(cur)
  }
  return `${head.join('-')}_${compactTail.join('_')}`
}

function isIgnoredFootprintName(name) {
  return /MOUNTING[-_ ]?HOLE/i.test(name)
}

function sanitizeId(raw) {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function round(value, places = 3) {
  const p = 10 ** places
  return Math.round(value * p) / p
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function listFilesRecursive(rootDir, extensions, maxFiles = 3000) {
  const out = []
  const stack = [rootDir]
  while (stack.length > 0 && out.length < maxFiles) {
    const dir = stack.pop()
    let entries = []
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name.startsWith('.')) continue
        stack.push(full)
        continue
      }
      if (!e.isFile()) continue
      const ext = path.extname(e.name).toLowerCase()
      if (extensions.includes(ext)) out.push(full)
      if (out.length >= maxFiles) break
    }
  }
  return out
}

async function pruneThermalViaVariants(packageDir) {
  let entries = []
  try {
    entries = await fs.readdir(packageDir, { withFileTypes: true })
  } catch {
    return 0
  }
  const files = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.json'))
    .map((e) => e.name)
  const names = new Set(files.map((f) => f.replace(/\.json$/i, '')))
  let removed = 0
  for (const file of files) {
    const name = file.replace(/\.json$/i, '')
    if (!/-THERMAL-VIAS?/i.test(name)) continue
    const base = name
      .replace(/-THERMAL-VIAS?/ig, '')
      .replace(/-TOP-TENTED/ig, '')
    if (!base || !names.has(base)) continue
    await fs.rm(path.join(packageDir, file), { force: true })
    removed++
  }
  return removed
}

function parseKicadPads(content) {
  const pads = []
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    if (!line.includes('(pad')) continue
    const num = line.match(/\(pad\s+([^\s)]+)/)
    const kind = line.match(/\(pad\s+[^\s)]+\s+([^\s)]+)/)
    const at = line.match(/\(at\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/)
    const size = line.match(/\(size\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/)
    if (!at || !size || !kind) continue
    if (kind[1]?.toLowerCase() !== 'smd') continue
    pads.push({
      num: num?.[1] ?? '',
      kind: kind[1] ?? '',
      x: Number(at[1]),
      y: Number(at[2]),
      w: Math.abs(Number(size[1])),
      h: Math.abs(Number(size[2])),
    })
  }
  return pads
}

function parseEaglePads(content) {
  const pads = []
  const rgx = /<smd[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*dx="([^"]+)"[^>]*dy="([^"]+)"/gi
  let m
  while ((m = rgx.exec(content)) != null) {
    pads.push({
      x: Number(m[1]),
      y: Number(m[2]),
      w: Math.abs(Number(m[3])),
      h: Math.abs(Number(m[4])),
    })
  }
  return pads
}

function parseLibrePads(content) {
  const pads = []
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    if (!/\bpad\b/i.test(line)) continue
    const at = line.match(/\(position\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/i)
    const size = line.match(/\(size\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/i)
    if (!at || !size) continue
    pads.push({
      x: Number(at[1]),
      y: Number(at[2]),
      w: Math.abs(Number(size[1])),
      h: Math.abs(Number(size[2])),
    })
  }
  return pads
}

function bboxFromPads(pads) {
  const xs = []
  const ys = []
  for (const p of pads) {
    xs.push(p.x - p.w / 2, p.x + p.w / 2)
    ys.push(p.y - p.h / 2, p.y + p.h / 2)
  }
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { minX, maxX, minY, maxY, width: maxX - minX, length: maxY - minY }
}

function classifyPadsToPackage(name, pads) {
  if (!pads.length) return null
  const box = bboxFromPads(pads)
  const body = {
    length: round(Math.max(0.5, box.length * 0.7)),
    width: round(Math.max(0.5, box.width * 0.7)),
  }
  const count = pads.length
  const xVals = [...new Set(pads.map((p) => round(p.x, 2)))].length
  const yVals = [...new Set(pads.map((p) => round(p.y, 2)))].length
  const avgW = round(pads.reduce((acc, p) => acc + p.w, 0) / count)
  const avgH = round(pads.reduce((acc, p) => acc + p.h, 0) / count)

  if (count === 2) {
    return {
      name,
      type: 'PT_TWO_POLE',
      body,
      chip: {
        chipLength: round(Math.max(body.length, box.length)),
        leadWidth: round(Math.max(0.1, Math.min(avgW, avgH))),
        leadLength: round(Math.max(0.1, Math.max(avgW, avgH))),
      },
    }
  }

  if (count === 3) {
    return {
      name,
      type: 'PT_THREE_POLE',
      body,
      threePole: {
        widthOverLeads: round(Math.max(box.width, box.length)),
        ccDistance: round(Math.max(0.2, Math.min(box.width, box.length) / 2)),
        leadWidth: round(Math.max(0.1, Math.min(avgW, avgH))),
        leadLength: round(Math.max(0.1, Math.max(avgW, avgH))),
      },
    }
  }

  const looksGrid = xVals >= 3 && yVals >= 3 && xVals * yVals === count
  if (looksGrid) {
    return {
      name,
      type: 'PT_BGA',
      body,
      bga: {
        leadsPerRow: xVals,
        leadsPerColumn: yVals,
        leadPitch: round(Math.max(box.width / Math.max(1, xVals - 1), box.length / Math.max(1, yVals - 1))),
        leadDiameter: round(Math.max(0.1, Math.min(avgW, avgH))),
      },
    }
  }

  if (xVals <= 2 || yVals <= 2) {
    return {
      name,
      type: 'PT_TWO_SYM',
      body,
      twoSymmetric: {
        numberOfLeads: count % 2 === 0 ? count : count + 1,
        widthOverLeads: round(Math.max(box.width, box.length)),
        leadPitch: round(Math.max(0.2, Math.min(box.width, box.length) / Math.max(1, count / 2 - 1))),
        leadWidth: round(Math.max(0.1, Math.min(avgW, avgH))),
        leadLength: round(Math.max(0.1, Math.max(avgW, avgH))),
      },
    }
  }

  if (count >= 4 && count % 4 === 0) {
    return {
      name,
      type: 'PT_FOUR_SYM',
      body,
      fourSymmetric: {
        numberOfLeads: count,
        widthOverLeads: round(Math.max(box.width, box.length)),
        leadPitch: round(Math.max(0.2, (box.width + box.length) / 2 / Math.max(1, count / 4))),
        leadWidth: round(Math.max(0.1, Math.min(avgW, avgH))),
        leadLength: round(Math.max(0.1, Math.max(avgW, avgH))),
      },
    }
  }

  return {
    name,
    type: 'PT_GENERIC',
    body,
    generic: {
      leadGroups: [
        {
          shape: 'GULLWING',
          numLeads: count,
          distFromCenter: 0,
          ccHalf: round(Math.max(box.width, box.length) / 2),
          angleMilliDeg: 0,
          padLength: round(Math.max(avgW, avgH)),
          padWidth: round(Math.min(avgW, avgH)),
        },
      ],
    },
  }
}

function packageSignature(pkg) {
  return crypto.createHash('sha1').update(JSON.stringify(pkg)).digest('hex').slice(0, 12)
}

function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2
  return sorted[mid]
}

function parsePitchFromName(name) {
  const m = name.match(/(?:^|[-_])P(\d+(?:\.\d+)?)MM(?:$|[-_])/i)
  if (!m?.[1]) return null
  return Number(m[1])
}

function parseBodyDimsFromName(name) {
  const m = name.match(/(?:^|[-_])(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)MM(?:$|[-_])/i)
  if (!m?.[1] || !m?.[2]) return null
  const width = Number(m[1])
  const length = Number(m[2])
  if (!Number.isFinite(width) || !Number.isFinite(length)) return null
  // Naming convention in KiCad footprints is typically <X>x<Y>mm.
  return { width, length }
}

function isLikelyTranslatablePackageName(name) {
  return /(QFN|DFN|XDFN|WSON|VSON|SON|LFCSP|SOIC|TSSOP|SSOP|MSOP|QSOP|TFSOP|SOT|SOD|SC[-_]?|DO[-_]?|TO[-_]?|QFP|LQFP|TQFP|PLCC|LCC|BGA|LGA)/i.test(name)
}

function extractLeadCountFromName(name) {
  const m = name.match(/(?:QFN|DFN|XDFN|WSON|VSON|SON|LFCSP|SOIC|TSSOP|SSOP|MSOP|QSOP|TFSOP|SOT|SOD|SC|DO|TO|QFP|LQFP|TQFP|PLCC|LCC|BGA|LGA)[-_]?(\d{1,3})/i)
  if (!m?.[1]) return null
  return Number(m[1])
}

function derivePitchFromPads(pads) {
  if (pads.length < 3) return null
  const byX = new Map()
  const byY = new Map()
  for (const p of pads) {
    const xk = round(p.x, 3)
    const yk = round(p.y, 3)
    if (!byX.has(xk)) byX.set(xk, [])
    if (!byY.has(yk)) byY.set(yk, [])
    byX.get(xk).push(p)
    byY.get(yk).push(p)
  }
  const groups = [...byX.values(), ...byY.values()].filter((g) => g.length >= 2)
  const allDiffs = []
  for (const g of groups) {
    const xs = g.map((p) => p.x).sort((a, b) => a - b)
    const ys = g.map((p) => p.y).sort((a, b) => a - b)
    for (let i = 1; i < xs.length; i++) allDiffs.push(Math.abs(xs[i] - xs[i - 1]))
    for (let i = 1; i < ys.length; i++) allDiffs.push(Math.abs(ys[i] - ys[i - 1]))
  }
  const filtered = allDiffs.filter((d) => d > 0.05)
  if (!filtered.length) return null
  return round(median(filtered))
}

function normalisePadsForTwoSym(pads) {
  const xVals = [...new Set(pads.map((p) => round(p.x, 3)))].length
  const yVals = [...new Set(pads.map((p) => round(p.y, 3)))].length
  // Two-symmetric packages in our TPSys baseline are modeled as left/right rows.
  // If source footprint is top/bottom, rotate it by swapping axes.
  const rotate = yVals < xVals
  if (!rotate) return { pads, rotated: false }
  return {
    rotated: true,
    pads: pads.map((p) => ({
      ...p,
      x: p.y,
      y: p.x,
      w: p.h,
      h: p.w,
    })),
  }
}

function derivePitchWithinRows(pads) {
  const rows = new Map()
  for (const p of pads) {
    const k = round(p.x, 3)
    if (!rows.has(k)) rows.set(k, [])
    rows.get(k).push(p)
  }
  const diffs = []
  for (const row of rows.values()) {
    const ys = row.map((p) => p.y).sort((a, b) => a - b)
    for (let i = 1; i < ys.length; i++) {
      const d = Math.abs(ys[i] - ys[i - 1])
      if (d > 0.05) diffs.push(d)
    }
  }
  if (!diffs.length) return null
  return round(median(diffs))
}

function classifyKiCadFootprint(stem, pads) {
  if (!isLikelyTranslatablePackageName(stem)) return null
  const name = normaliseName(stem)
  const hasEp = /(?:^|[-_])\d*EP(?:$|[-_])/i.test(stem) || /EXPOSED/i.test(stem)
  const namedLeads = extractLeadCountFromName(stem)
  const bodyFromName = parseBodyDimsFromName(stem)

  let workPads = [...pads]
  if (hasEp && namedLeads && pads.length > namedLeads) {
    // Usually EP is the largest central pad in DFN/QFN footprints.
    const sortedByArea = [...pads].sort((a, b) => (b.w * b.h) - (a.w * a.h))
    const epCandidate = sortedByArea[0]
    workPads = pads.filter((p) => p !== epCandidate)
  }

  if (!workPads.length) return null
  const { pads: orientedPads } = normalisePadsForTwoSym(workPads)
  const box = bboxFromPads(orientedPads)

  const body = {
    length: round(Math.max(0.3, bodyFromName?.length ?? box.length)),
    width: round(Math.max(0.3, bodyFromName?.width ?? box.width)),
  }

  const leadCount = namedLeads ?? workPads.length
  const isFour = /(QFN|QFP|LQFP|TQFP|PLCC|LCC|LGA|LFCSP|VQFN|WQFN|UQFN|WFQFN)/i.test(stem) && leadCount >= 8 && leadCount % 4 === 0
  if (isFour) {
    const leadLength = round(Math.max(0.1, median(orientedPads.map((p) => Math.max(p.w, p.h)))))
    const leadWidth = round(Math.max(0.1, median(orientedPads.map((p) => Math.min(p.w, p.h)))))
    const pitch = parsePitchFromName(stem) ?? derivePitchFromPads(orientedPads)
    const maxAbsX = Math.max(...orientedPads.map((p) => Math.abs(p.x))) + leadLength / 2
    const maxAbsY = Math.max(...orientedPads.map((p) => Math.abs(p.y))) + leadLength / 2
    return {
      name,
      type: 'PT_FOUR_SYM',
      body,
      fourSymmetric: {
        numberOfLeads: leadCount,
        widthOverLeads: round(2 * Math.max(maxAbsX, maxAbsY)),
        leadPitch: round(pitch ?? 0.5),
        leadWidth,
        leadLength,
      },
    }
  }

  const isTwo = /(DFN|XDFN|WSON|VSON|SON|SOIC|TSSOP|SSOP|MSOP|QSOP|TFSOP|SOT|SOD|SC[-_]?|DO[-_]?|TO[-_]?)/i.test(stem) && leadCount >= 2
  if (isTwo && leadCount % 2 === 0) {
    const leadLength = round(Math.max(0.1, median(orientedPads.map((p) => p.w))))
    const leadWidth = round(Math.max(0.1, median(orientedPads.map((p) => p.h))))
    const pitch = derivePitchWithinRows(orientedPads) ?? parsePitchFromName(stem) ?? derivePitchFromPads(orientedPads)
    const tipHalf = Math.max(...orientedPads.map((p) => Math.abs(p.x))) + leadLength / 2
    return {
      name,
      type: 'PT_TWO_SYM',
      body,
      twoSymmetric: {
        numberOfLeads: leadCount,
        widthOverLeads: round(2 * tipHalf),
        leadPitch: round(pitch ?? 0.5),
        leadWidth,
        leadLength,
      },
    }
  }

  if (/(SOT|SC[-_]?|TO[-_]?)/i.test(stem) && leadCount === 3) {
    const leadLength = round(Math.max(0.1, median(orientedPads.map((p) => Math.max(p.w, p.h)))))
    const leadWidth = round(Math.max(0.1, median(orientedPads.map((p) => Math.min(p.w, p.h)))))
    const maxAbs = Math.max(box.width, box.length)
    return {
      name,
      type: 'PT_THREE_POLE',
      body,
      threePole: {
        widthOverLeads: round(maxAbs),
        ccDistance: round(Math.max(0.2, Math.min(box.width, box.length) / 2)),
        leadWidth,
        leadLength,
      },
    }
  }

  const fallback = classifyPadsToPackage(name, orientedPads)
  if (fallback && fallback.type !== 'PT_OUTLINE') {
    return fallback
  }

  // Last-chance heuristic: allow simple 2-pad SMD chip-like packages
  // (e.g. bare 0603/0805 style names that do not carry a family prefix).
  if (orientedPads.length === 2 && !/(USB|HDMI|SWITCH|JUMPER|PINHEADER|TEST|PROBE|ANTENNA|MODULE|WIFI|BLUETOOTH|RF)/i.test(stem)) {
    const leadLength = round(Math.max(0.1, median(orientedPads.map((p) => Math.max(p.w, p.h)))))
    const leadWidth = round(Math.max(0.1, median(orientedPads.map((p) => Math.min(p.w, p.h)))))
    return {
      name,
      type: 'PT_TWO_POLE',
      body,
      chip: {
        chipLength: round(Math.max(body.length, box.length)),
        leadWidth,
        leadLength,
      },
    }
  }

  return null
}

async function main() {
  const allSources = (await readJson(SOURCES_PATH)).sources ?? []
  const sources = allSources.filter((s) => s.enabled !== false)
  await fs.mkdir(OUT_ROOT, { recursive: true })
  await fs.mkdir(REPORTS_DIR, { recursive: true })

  const allGlobalKeys = new Set()
  // Keep Newmatik built-ins as global canonical owner, avoid cross-library collisions.
  try {
    const builtinsDir = path.join(OUT_ROOT, 'newmatik', 'packages')
    const entries = await fs.readdir(builtinsDir, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isFile() || !e.name.toLowerCase().endsWith('.json')) continue
      try {
        const pkg = await readJson(path.join(builtinsDir, e.name))
        const key = normaliseName(pkg?.name ?? e.name).toLowerCase()
        allGlobalKeys.add(key)
        if (Array.isArray(pkg?.aliases)) {
          for (const alias of pkg.aliases) {
            const aKey = normaliseName(alias).toLowerCase()
            if (aKey) allGlobalKeys.add(aKey)
          }
        }
      } catch {
        // Ignore malformed package; checker catches this later.
      }
    }
  } catch {
    // Newmatik may not exist yet; parser still works.
  }

  // Remove stale output directories for disabled/removed sources.
  const activeIds = new Set(sources.map((s) => sanitizeId(s.id)))
  activeIds.add('newmatik')
  try {
    const existing = await fs.readdir(OUT_ROOT, { withFileTypes: true })
    for (const entry of existing) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith('_')) continue
      if (activeIds.has(entry.name)) continue
      await fs.rm(path.join(OUT_ROOT, entry.name), { recursive: true, force: true })
    }
  } catch {
    // Best-effort cleanup.
  }

  for (const source of sources) {
    const libraryId = sanitizeId(source.id)
    const repoPath = path.join(LIB_ROOT, source.licenseBucket, source.owner, source.repo)
    const libraryDir = path.join(OUT_ROOT, libraryId)
    const packageDir = path.join(libraryDir, 'packages')
    await fs.rm(packageDir, { recursive: true, force: true })
    await fs.mkdir(packageDir, { recursive: true })

    const exts = source.tool === 'KiCad'
      ? ['.kicad_mod']
      : source.tool === 'Eagle'
        ? ['.lbr']
        : ['.lp', '.lplib']
    const files = await listFilesRecursive(repoPath, exts)
    const report = { source: source.id, parsed: 0, emitted: 0, skipped: [], collisions: [] }
    const localKeys = new Set()
    const geometryByKey = new Map()

    for (const file of files) {
      let raw = ''
      try {
        raw = await fs.readFile(file, 'utf8')
      } catch {
        continue
      }
      const stem = path.basename(file, path.extname(file))
      const canonicalNameRaw = normaliseName(stem)
      const canonicalName = source.tool === 'KiCad'
        ? canonicaliseKicadName(canonicalNameRaw)
        : canonicalNameRaw
      if (isIgnoredFootprintName(canonicalName)) {
        report.skipped.push({ file: path.relative(ROOT, file), reason: 'mounting_hole_filtered' })
        continue
      }
      const thermalBaseName = canonicalName
        .replace(/-THERMAL-VIAS?/ig, '')
        .replace(/-TOP-TENTED/ig, '')
      const isThermalVariant = thermalBaseName !== canonicalName
      let pads = []
      if (source.tool === 'KiCad') pads = parseKicadPads(raw)
      else if (source.tool === 'Eagle') pads = parseEaglePads(raw)
      else pads = parseLibrePads(raw)

      if (!pads.length) {
        report.skipped.push({ file: path.relative(ROOT, file), reason: 'no_pads' })
        continue
      }
      const parsed = source.tool === 'KiCad'
        ? classifyKiCadFootprint(stem, pads)
        : classifyPadsToPackage(canonicalName, pads)
      report.parsed++
      if (!parsed) {
        report.skipped.push({ file: path.relative(ROOT, file), reason: 'not_translatable_tpsys' })
        continue
      }
      parsed.name = canonicalName

      const key = canonicalName.toLowerCase()
      const thermalBaseKey = thermalBaseName.toLowerCase()
      if (isThermalVariant && (localKeys.has(thermalBaseKey) || allGlobalKeys.has(thermalBaseKey))) {
        report.skipped.push({ file: path.relative(ROOT, file), reason: 'thermal_variant_base_exists' })
        continue
      }
      const signature = packageSignature(parsed)
      const prev = geometryByKey.get(key)
      if (prev && prev.signature !== signature) {
        report.collisions.push({ key, kept: prev.file, dropped: path.relative(ROOT, file) })
        continue
      }
      if (localKeys.has(key) || allGlobalKeys.has(key)) {
        continue
      }

      const enriched = {
        ...parsed,
        aliases: parsed.aliases ?? [],
        provenance: {
          owner: 'newmatik',
          sourceLibrary: libraryId,
          sourceType: source.tool,
          sourceFile: path.relative(ROOT, file),
          sourceFootprint: stem,
        },
      }

      const outFile = `${canonicalName}.json`
      await fs.writeFile(path.join(packageDir, outFile), JSON.stringify(enriched, null, 2) + '\n', 'utf8')
      localKeys.add(key)
      allGlobalKeys.add(key)
      geometryByKey.set(key, { signature, file: path.relative(ROOT, file) })
      report.emitted++
    }

    const prunedThermalVariants = source.tool === 'KiCad'
      ? await pruneThermalViaVariants(packageDir)
      : 0
    if (prunedThermalVariants > 0) {
      report.emitted = Math.max(0, report.emitted - prunedThermalVariants)
      report.prunedThermalVariants = prunedThermalVariants
    }

    if (report.emitted === 0) {
      await fs.rm(libraryDir, { recursive: true, force: true })
    } else {
      const libraryMeta = {
        id: libraryId,
        displayName: source.displayName ?? source.repo,
        owner: 'newmatik',
        sourceType: source.tool,
        license: source.license,
        redistribution: source.redistribution,
        attribution: {
          upstreamOwner: source.owner,
          upstreamRepo: source.repo,
          upstreamUrl: source.url,
          notice: source.redistribution === 'conditional'
            ? 'Redistribution terms are conditional. Review upstream license text before publishing.'
            : 'Attribution retained from upstream source metadata.',
        },
        source: {
          id: source.id,
          path: path.relative(ROOT, repoPath),
        },
      }
      await fs.writeFile(path.join(libraryDir, 'library.json'), JSON.stringify(libraryMeta, null, 2) + '\n', 'utf8')
    }

    await fs.writeFile(path.join(REPORTS_DIR, `${libraryId}.json`), JSON.stringify(report, null, 2) + '\n', 'utf8')
  }
}

main().catch((err) => {
  console.error('[parse-cad-libraries-to-tpsys] Failed:', err)
  process.exitCode = 1
})
