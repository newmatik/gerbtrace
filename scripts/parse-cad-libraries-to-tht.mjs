import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const SOURCES_PATH = path.join(ROOT, 'scripts', 'cad-library-sources.json')
const LIB_ROOT = path.join(ROOT, '.local', 'libraries')
const OUT_ROOT = path.join(ROOT, 'public', 'packages', 'tht-libraries')
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
  const tokens = normalized.split('-').filter(Boolean)
  if (tokens.length < 3) return normalized

  const head = [tokens[0]]
  let i = 1
  if (tokens[i]) {
    head.push(tokens[i])
    i += 1
  }
  if (tokens[i] && /^\d{1,3}$/.test(tokens[i]) && /^\d{1,3}$/.test(head[1] ?? '')) {
    head.push(tokens[i])
    i += 1
  }
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

function round(v, p = 3) {
  const m = 10 ** p
  return Math.round(v * m) / m
}

function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function listFilesRecursive(rootDir, ext, maxFiles = 4000) {
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
        if (!e.name.startsWith('.')) stack.push(full)
        continue
      }
      if (e.isFile() && full.toLowerCase().endsWith(ext)) out.push(full)
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

function parseKicadThtPads(content) {
  const pads = []
  for (const line of content.split(/\r?\n/)) {
    if (!line.includes('(pad')) continue
    const num = line.match(/\(pad\s+"?([^\s")]+)"?/)
    const padHead = line.match(/\(pad\s+"?[^\s")]+"?\s+([^\s)]+)\s+([^\s)]+)/)
    const kind = padHead?.[1]?.toLowerCase()
    const shape = padHead?.[2]?.toLowerCase() ?? 'circle'
    if (kind !== 'thru_hole') continue
    const at = line.match(/\(at\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/)
    const size = line.match(/\(size\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/)
    const drill = line.match(/\(drill\s+(-?\d+(?:\.\d+)?)/)
    if (!at || !size) continue
    pads.push({
      num: num?.[1] ?? '',
      x: Number(at[1]),
      y: Number(at[2]),
      w: Math.abs(Number(size[1])),
      h: Math.abs(Number(size[2])),
      drill: Math.abs(Number(drill?.[1] ?? 0)),
      shape,
    })
  }
  return pads
}

function parseKicadGraphicShapes(content) {
  const shapes = []

  const lineRgx = /\(fp_line\s+\(start\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)\s+\(end\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)[\s\S]*?\(layer\s+"?([^"\s)]+)"?\)[\s\S]*?\(width\s+(-?\d+(?:\.\d+)?)\)/g
  let m
  while ((m = lineRgx.exec(content)) != null) {
    const layer = m[5]
    if (layer !== 'F.Fab' && layer !== 'F.SilkS') continue
    shapes.push({
      kind: 'line',
      role: 'body',
      x1: Number(m[1]),
      y1: Number(m[2]),
      x2: Number(m[3]),
      y2: Number(m[4]),
      strokeWidth: Math.max(0.1, Number(m[6])),
      color: layer === 'F.Fab' ? '#6b7280' : '#9ca3af',
    })
  }

  const rectRgx = /\(fp_rect\s+\(start\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)\s+\(end\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)[\s\S]*?\(layer\s+"?([^"\s)]+)"?\)/g
  while ((m = rectRgx.exec(content)) != null) {
    const layer = m[5]
    if (layer !== 'F.Fab' && layer !== 'F.SilkS') continue
    const x1 = Number(m[1]); const y1 = Number(m[2]); const x2 = Number(m[3]); const y2 = Number(m[4])
    shapes.push({
      kind: 'roundedRect',
      role: 'body',
      x: round((x1 + x2) / 2),
      y: round((y1 + y2) / 2),
      width: round(Math.abs(x2 - x1)),
      height: round(Math.abs(y2 - y1)),
      cornerRadius: round(Math.min(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 0.06),
      color: layer === 'F.Fab' ? '#374151' : '#4b5563',
      strokeColor: '#6b7280',
    })
  }

  const circleRgx = /\(fp_circle\s+\(center\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)\s+\(end\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)[\s\S]*?\(layer\s+"?([^"\s)]+)"?\)/g
  while ((m = circleRgx.exec(content)) != null) {
    const layer = m[5]
    if (layer !== 'F.Fab' && layer !== 'F.SilkS') continue
    const cx = Number(m[1]); const cy = Number(m[2]); const ex = Number(m[3]); const ey = Number(m[4])
    const r = Math.hypot(ex - cx, ey - cy)
    if (!Number.isFinite(r) || r < 0.05) continue
    shapes.push({
      kind: 'circle',
      role: 'body',
      x: round(cx),
      y: round(cy),
      radius: round(r),
      color: layer === 'F.Fab' ? '#374151' : '#4b5563',
      strokeColor: '#6b7280',
    })
  }

  const arcRgx = /\(fp_arc\s+\(start\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)\s+\(mid\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)\s+\(end\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)[\s\S]*?\(layer\s+"?([^"\s)]+)"?\)[\s\S]*?\(width\s+(-?\d+(?:\.\d+)?)\)/g
  while ((m = arcRgx.exec(content)) != null) {
    const layer = m[7]
    if (layer !== 'F.Fab' && layer !== 'F.SilkS') continue
    const sx = Number(m[1]); const sy = Number(m[2])
    const mx = Number(m[3]); const my = Number(m[4])
    const ex = Number(m[5]); const ey = Number(m[6])
    const width = Math.max(0.1, Number(m[8]))
    const color = layer === 'F.Fab' ? '#6b7280' : '#9ca3af'

    // Approximate arc with short line segments (renderer has no native arc primitive).
    const pts = approximateArcPoints(sx, sy, mx, my, ex, ey, 10)
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1]
      const p1 = pts[i]
      shapes.push({
        kind: 'line',
        role: 'body',
        x1: round(p0.x),
        y1: round(p0.y),
        x2: round(p1.x),
        y2: round(p1.y),
        strokeWidth: width,
        color,
      })
    }
  }

  const polyRgx = /\(fp_poly\s+\(pts\s+([\s\S]*?)\)\s+[\s\S]*?\(layer\s+"?([^"\s)]+)"?\)[\s\S]*?\(width\s+(-?\d+(?:\.\d+)?)\)/g
  while ((m = polyRgx.exec(content)) != null) {
    const ptsRaw = m[1]
    const layer = m[2]
    if (layer !== 'F.Fab' && layer !== 'F.SilkS') continue
    const width = Math.max(0.1, Number(m[3]))
    const color = layer === 'F.Fab' ? '#6b7280' : '#9ca3af'
    const pts = []
    const xyRgx = /\(xy\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\)/g
    let xm
    while ((xm = xyRgx.exec(ptsRaw)) != null) {
      pts.push({ x: Number(xm[1]), y: Number(xm[2]) })
    }
    if (pts.length < 2) continue
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1]
      const p1 = pts[i]
      shapes.push({
        kind: 'line',
        role: 'body',
        x1: round(p0.x),
        y1: round(p0.y),
        x2: round(p1.x),
        y2: round(p1.y),
        strokeWidth: width,
        color,
      })
    }
    const first = pts[0]
    const last = pts[pts.length - 1]
    if (Math.hypot(first.x - last.x, first.y - last.y) > 0.01) {
      shapes.push({
        kind: 'line',
        role: 'body',
        x1: round(last.x),
        y1: round(last.y),
        x2: round(first.x),
        y2: round(first.y),
        strokeWidth: width,
        color,
      })
    }
  }

  return simplifyGraphicShapes(shapes, 120)
}

function approximateArcPoints(sx, sy, mx, my, ex, ey, segments = 10) {
  // Compute circumcenter from three points; if degenerate, fallback to polyline.
  const d = 2 * (sx * (my - ey) + mx * (ey - sy) + ex * (sy - my))
  if (Math.abs(d) < 1e-6) {
    return [{ x: sx, y: sy }, { x: mx, y: my }, { x: ex, y: ey }]
  }
  const ux = ((sx * sx + sy * sy) * (my - ey) + (mx * mx + my * my) * (ey - sy) + (ex * ex + ey * ey) * (sy - my)) / d
  const uy = ((sx * sx + sy * sy) * (ex - mx) + (mx * mx + my * my) * (sx - ex) + (ex * ex + ey * ey) * (mx - sx)) / d
  const r = Math.hypot(sx - ux, sy - uy)
  if (!Number.isFinite(r) || r < 1e-6) {
    return [{ x: sx, y: sy }, { x: mx, y: my }, { x: ex, y: ey }]
  }

  const a0 = Math.atan2(sy - uy, sx - ux)
  let a1 = Math.atan2(ey - uy, ex - ux)
  const amid = Math.atan2(my - uy, mx - ux)

  // Choose direction that passes near mid point.
  const norm = (a) => {
    let v = a
    while (v <= -Math.PI) v += 2 * Math.PI
    while (v > Math.PI) v -= 2 * Math.PI
    return v
  }
  const ccwMid = norm(amid - a0)
  const ccwEnd = norm(a1 - a0)
  const useCcw = ccwEnd >= 0 ? ccwMid >= 0 && ccwMid <= ccwEnd : ccwMid >= 0 || ccwMid <= ccwEnd
  if (useCcw && a1 < a0) a1 += Math.PI * 2
  if (!useCcw && a1 > a0) a1 -= Math.PI * 2

  const pts = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const a = a0 + (a1 - a0) * t
    pts.push({ x: ux + Math.cos(a) * r, y: uy + Math.sin(a) * r })
  }
  return pts
}

function simplifyGraphicShapes(shapes, maxShapes = 120) {
  const nonLines = shapes.filter((s) => s.kind !== 'line')
  const lines = shapes.filter((s) => s.kind === 'line')

  const dedup = new Map()
  for (const ln of lines) {
    const len = Math.hypot(ln.x2 - ln.x1, ln.y2 - ln.y1)
    if (len < 0.18) continue
    const keyA = `${round(ln.x1, 2)},${round(ln.y1, 2)}|${round(ln.x2, 2)},${round(ln.y2, 2)}|${round(ln.strokeWidth, 2)}`
    const keyB = `${round(ln.x2, 2)},${round(ln.y2, 2)}|${round(ln.x1, 2)},${round(ln.y1, 2)}|${round(ln.strokeWidth, 2)}`
    if (dedup.has(keyA) || dedup.has(keyB)) continue
    dedup.set(keyA, { ...ln, _len: len })
  }

  const prunedLines = [...dedup.values()]
    .sort((a, b) => b._len - a._len)
    .slice(0, Math.max(0, maxShapes - nonLines.length))
    .map(({ _len, ...rest }) => rest)

  return [...nonLines, ...prunedLines]
}

function inferBodyBounds(pads, graphics) {
  const xs = []
  const ys = []
  for (const p of pads) {
    xs.push(p.x - p.w / 2, p.x + p.w / 2)
    ys.push(p.y - p.h / 2, p.y + p.h / 2)
  }
  for (const s of graphics) {
    if (s.kind === 'line') {
      xs.push(s.x1, s.x2); ys.push(s.y1, s.y2)
    } else if (s.kind === 'circle') {
      xs.push(s.x - s.radius, s.x + s.radius); ys.push(s.y - s.radius, s.y + s.radius)
    } else if (s.kind === 'rect' || s.kind === 'roundedRect') {
      xs.push(s.x - s.width / 2, s.x + s.width / 2); ys.push(s.y - s.height / 2, s.y + s.height / 2)
    }
  }
  if (!xs.length || !ys.length) return null
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

function buildThtPackage(name, pads, graphics = []) {
  if (!pads.length) return null
  if (pads.length > 300) return null

  const hasExplicitPin1 = pads.some((p) => p.num === '1')
  const pin1 = pads.find((p) => p.num === '1') ?? pads[0]
  const shapes = []
  const bodyBounds = inferBodyBounds(pads, graphics)
  if (bodyBounds) {
    const bodyW = round(Math.max(1, (bodyBounds.maxX - bodyBounds.minX) + 0.8))
    const bodyH = round(Math.max(1, (bodyBounds.maxY - bodyBounds.minY) + 0.8))
    const cx = round((bodyBounds.minX + bodyBounds.maxX) / 2)
    const cy = round((bodyBounds.minY + bodyBounds.maxY) / 2)
    // Always draw a dark body underneath graphics for realistic appearance.
    shapes.push({
      kind: 'roundedRect',
      role: 'body',
      x: cx,
      y: cy,
      width: bodyW,
      height: bodyH,
      cornerRadius: round(Math.min(bodyW, bodyH) * 0.08),
      color: '#1f2937',
      strokeColor: '#111827',
    })
  }
  shapes.push(...graphics)

  for (const p of pads) {
    const role = p.num === '1' ? 'pin1' : 'pin'
    const w = round(Math.max(0.2, p.w))
    const h = round(Math.max(0.2, p.h))
    const shape = p.shape || 'circle'

    if (shape === 'rect') {
      shapes.push({
        kind: 'rect',
        role,
        x: round(p.x),
        y: round(p.y),
        width: w,
        height: h,
      })
    } else if (shape === 'oval' || shape === 'roundrect') {
      shapes.push({
        kind: 'roundedRect',
        role,
        x: round(p.x),
        y: round(p.y),
        width: w,
        height: h,
        cornerRadius: round(Math.min(w, h) * 0.45),
      })
    } else {
      shapes.push({
        kind: 'circle',
        role,
        x: round(p.x),
        y: round(p.y),
        radius: round(Math.max(0.15, Math.min(w, h) / 2)),
      })
    }

    // Render the drill as a dark inner hole for through-hole realism.
    if (p.drill > 0.1) {
      shapes.push({
        kind: 'circle',
        role: 'body',
        x: round(p.x),
        y: round(p.y),
        radius: round(Math.max(0.08, p.drill / 2)),
        color: '#111827',
        strokeColor: '#1f2937',
      })
    }
  }

  // Only add fallback polarity dot when source does not provide explicit pin-1 numbering.
  if (pin1 && !hasExplicitPin1) {
    const base = Math.max(0.2, median(pads.map((p) => Math.min(p.w, p.h))) * 0.25)
    const markerR = round(base)
    shapes.push({
      kind: 'circle',
      role: 'polarity-marker',
      x: round(pin1.x - markerR * 1.8),
      y: round(pin1.y + markerR * 1.8),
      radius: markerR,
      color: '#ef4444',
    })
  }

  return {
    name,
    aliases: [],
    bodyColor: '#333333',
    bodyStrokeColor: '#555555',
    pinColor: '#c0c0c0',
    pinStrokeColor: '#808080',
    shapes,
  }
}

async function main() {
  const allSources = (await readJson(SOURCES_PATH)).sources ?? []
  const sources = allSources.filter((s) => s.enabled !== false && s.tool === 'KiCad')

  await fs.mkdir(OUT_ROOT, { recursive: true })
  await fs.mkdir(REPORTS_DIR, { recursive: true })

  const activeIds = new Set(sources.map((s) => sanitizeId(s.id)))
  try {
    const existing = await fs.readdir(OUT_ROOT, { withFileTypes: true })
    for (const entry of existing) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith('_')) continue
      if (activeIds.has(entry.name)) continue
      await fs.rm(path.join(OUT_ROOT, entry.name), { recursive: true, force: true })
    }
  } catch {}

  for (const source of sources) {
    const libraryId = sanitizeId(source.id)
    const repoPath = path.join(LIB_ROOT, source.licenseBucket, source.owner, source.repo)
    const libraryDir = path.join(OUT_ROOT, libraryId)
    const packageDir = path.join(libraryDir, 'packages')
    await fs.rm(packageDir, { recursive: true, force: true })
    await fs.mkdir(packageDir, { recursive: true })

    const report = { source: source.id, parsed: 0, emitted: 0, skipped: [] }
    const files = await listFilesRecursive(repoPath, '.kicad_mod')
    const sourceStemSet = new Set(
      files.map((file) => normaliseName(path.basename(file, '.kicad_mod')).toLowerCase()),
    )
    const seen = new Set()

    for (const file of files) {
      let raw = ''
      try {
        raw = await fs.readFile(file, 'utf8')
      } catch {
        continue
      }
      const stem = path.basename(file, '.kicad_mod')
      const stemName = canonicaliseKicadName(normaliseName(stem))
      if (isIgnoredFootprintName(stemName)) {
        report.skipped.push({ file: path.relative(ROOT, file), reason: 'mounting_hole_filtered' })
        continue
      }
      const thermalBaseName = stemName
        .replace(/-THERMAL-VIAS?/ig, '')
        .replace(/-TOP-TENTED/ig, '')
      const isThermalVariant = thermalBaseName !== stemName
      if (isThermalVariant && sourceStemSet.has(thermalBaseName.toLowerCase())) {
        report.skipped.push({ file: path.relative(ROOT, file), reason: 'thermal_variant_base_exists' })
        continue
      }
      const pads = parseKicadThtPads(raw)
      if (!pads.length) continue
      report.parsed++
      const graphics = parseKicadGraphicShapes(raw)
      const pkg = buildThtPackage(stemName, pads, graphics)
      if (!pkg) {
        report.skipped.push({ file: path.relative(ROOT, file), reason: 'not_translatable_tht' })
        continue
      }
      const key = pkg.name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const enriched = {
        ...pkg,
        provenance: {
          owner: 'newmatik',
          sourceLibrary: libraryId,
          sourceType: source.tool,
          sourceFile: path.relative(ROOT, file),
          sourceFootprint: stem,
        },
      }
      await fs.writeFile(path.join(packageDir, `${pkg.name}.json`), JSON.stringify(enriched, null, 2) + '\n', 'utf8')
      report.emitted++
    }

    const prunedThermalVariants = await pruneThermalViaVariants(packageDir)
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
        sourceType: `${source.tool}-THT`,
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
        source: { id: source.id, path: path.relative(ROOT, repoPath) },
      }
      await fs.writeFile(path.join(libraryDir, 'library.json'), JSON.stringify(libraryMeta, null, 2) + '\n', 'utf8')
    }

    await fs.writeFile(path.join(REPORTS_DIR, `${libraryId}.json`), JSON.stringify(report, null, 2) + '\n', 'utf8')
  }
}

main().catch((err) => {
  console.error('[parse-cad-libraries-to-tht] Failed:', err)
  process.exitCode = 1
})
