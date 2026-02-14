/**
 * generate-common-packages.mjs
 *
 * Generates a broad set of common SMD package definitions into `public/packages/`
 * using this repo's JSON schema (see `public/packages/README.md`).
 *
 * Rules / conventions:
 * - Units are **mm**
 * - Geometry uses the repo's Mycronic/TPSys 0° baseline (handled by renderer code)
 * - Resistors + Capacitors share the same Chip package names (e.g. "0603")
 * - LEDs get their own chip-type package names (e.g. "LED-1206") with aliases like "1206 LED"
 *
 * Usage:
 *   node scripts/generate-common-packages.mjs
 */

import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { join, dirname, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PACKAGES_DIR = join(__dirname, '..', 'public', 'packages')
const MANIFEST_PATH = join(PACKAGES_DIR, '_manifest.json')

function round(n, digits = 3) {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

function chipLeadLengthForSize(code) {
  // Matches the style already present in this repo (C0402/C0603/C0805/C1206/C1812).
  const map = new Map([
    ['01005', 0.08],
    ['0201', 0.12],
    ['0402', 0.2],
    ['0603', 0.3],
    ['0805', 0.4],
    ['1206', 0.4],
    ['1210', 0.5],
    ['1812', 0.5],
    ['2010', 0.6],
    ['2220', 0.7],
    ['2512', 0.6],
    ['2920', 0.8],
  ])
  return map.get(code) ?? 0.4
}

function sanitizeFilename(name) {
  return name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/\//g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
}

function jsonStable(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

function chipPkg({ name, length, width, aliases = [], leadLength }) {
  return {
    name,
    type: 'Chip',
    ...(aliases.length ? { aliases } : {}),
    body: { length: round(length), width: round(width) },
    chip: {
      chipLength: round(length),
      leadWidth: round(width),
      leadLength: round(leadLength),
    },
  }
}

function outlinePkg({ name, length, width, aliases = [] }) {
  return {
    name,
    type: 'Outline',
    ...(aliases.length ? { aliases } : {}),
    body: { length: round(length), width: round(width) },
    outline: { length: round(length), width: round(width) },
  }
}

function threePolePkg({ name, bodyL, bodyW, widthOverLeads, ccDistance, leadWidth, leadLength, aliases = [] }) {
  return {
    name,
    type: 'ThreePole',
    ...(aliases.length ? { aliases } : {}),
    body: { length: round(bodyL), width: round(bodyW) },
    threePole: {
      widthOverLeads: round(widthOverLeads),
      ccDistance: round(ccDistance),
      leadWidth: round(leadWidth),
      leadLength: round(leadLength),
    },
  }
}

function twoSymPkg({ name, pins, pitch, bodyW, bodyL, widthOverLeads, leadWidth, leadLength, aliases = [] }) {
  return {
    name,
    type: 'TwoSymmetricLeadGroups',
    ...(aliases.length ? { aliases } : {}),
    body: { length: round(bodyL), width: round(bodyW) },
    twoSymmetric: {
      numberOfLeads: pins,
      widthOverLeads: round(widthOverLeads),
      leadPitch: round(pitch),
      leadWidth: round(leadWidth),
      leadLength: round(leadLength),
    },
  }
}

function fourSymPkg({ name, pins, pitch, body, widthOverLeads, leadWidth, leadLength, aliases = [] }) {
  return {
    name,
    type: 'FourSymmetricLeadGroups',
    ...(aliases.length ? { aliases } : {}),
    body: { length: round(body), width: round(body) },
    fourSymmetric: {
      numberOfLeads: pins,
      widthOverLeads: round(widthOverLeads),
      leadPitch: round(pitch),
      leadWidth: round(leadWidth),
      leadLength: round(leadLength),
    },
  }
}

function bgaPkg({ name, pins, pitch, rowCol, body, ballDia, aliases = [] }) {
  const [cols, rows] = rowCol
  if (cols * rows !== pins) {
    throw new Error(`BGA ${name}: grid ${cols}x${rows} does not match pins=${pins}`)
  }
  return {
    name,
    type: 'BGA',
    ...(aliases.length ? { aliases } : {}),
    body: { length: round(body), width: round(body) },
    bga: {
      leadsPerRow: cols,
      leadsPerColumn: rows,
      leadPitch: round(pitch),
      leadDiameter: round(ballDia),
      leadsPerRowInHole: 0,
      leadsPerColumnInHole: 0,
    },
  }
}

function bodyLengthFromPins(pins, pitch, endMargin = 0.8) {
  const perSide = pins / 2
  const span = (perSide - 1) * pitch
  return span + 2 * endMargin
}

function widthOverLeadsFromBody(bodyW, leadLength, sideGap = 0.45) {
  // Matches existing SO-style entries: body width + 2*(leadLength + gap)
  return bodyW + 2 * (leadLength + sideGap)
}

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function writeIfMissing(filename, obj) {
  const outPath = join(PACKAGES_DIR, filename)
  if (await exists(outPath)) return { filename, written: false }
  await writeFile(outPath, jsonStable(obj), 'utf8')
  return { filename, written: true }
}

async function rebuildManifest() {
  const entries = await readdir(PACKAGES_DIR)
  const jsonFiles = entries
    .filter((f) => extname(f).toLowerCase() === '.json')
    .filter((f) => basename(f) !== '_manifest.json')
    .sort((a, b) => a.localeCompare(b))
  await writeFile(MANIFEST_PATH, JSON.stringify(jsonFiles, null, 2) + '\n', 'utf8')
  return jsonFiles.length
}

async function main() {
  await mkdir(PACKAGES_DIR, { recursive: true })

  const writes = []

  // -------------------------------------------------------------------------
  // SECTION A — Chip passives (shared R/C/L), plus LED chip variants
  // -------------------------------------------------------------------------

  /** Standard chip sizes from the user's list. */
  const chipSizes = [
    { code: '01005', l: 0.4, w: 0.2 },
    { code: '0201', l: 0.6, w: 0.3 },
    { code: '0402', l: 1.0, w: 0.5 },
    { code: '0603', l: 1.6, w: 0.8 },
    { code: '0805', l: 2.0, w: 1.25 },
    { code: '1206', l: 3.2, w: 1.6 },
    { code: '1210', l: 3.2, w: 2.5 },
    { code: '1812', l: 4.5, w: 3.2 },
    { code: '2010', l: 5.0, w: 2.5 },
    { code: '2512', l: 6.3, w: 3.2 },
    { code: '2220', l: 5.7, w: 5.0 },
    { code: '2920', l: 7.3, w: 5.0 },
  ]

  for (const s of chipSizes) {
    const leadLength = chipLeadLengthForSize(s.code)
    const name = s.code

    writes.push(
      writeIfMissing(
        `C${s.code}.json`,
        chipPkg({
          name,
          length: s.l,
          width: s.w,
          leadLength,
          aliases: [
            `C${s.code}`,
            `R${s.code}`,
            `L${s.code}`,
            `CHIP-${s.code}`,
          ],
        }),
      ),
    )

    // LED chip variant: separate package name, but aliases include "1206 LED" etc.
    writes.push(
      writeIfMissing(
        `LED-${s.code}.json`,
        chipPkg({
          name: `LED-${s.code}`,
          length: s.l,
          width: s.w,
          leadLength,
          aliases: [
            `${s.code} LED`,
            `LED ${s.code}`,
            `LED${s.code}`,
            `CHIP-LED${s.code}`,
            `CHIP-LED${s.code.replace(/^0+/, '')}`, // e.g. 0805 -> 805 (seen in some libs)
          ],
        }),
      ),
    )
  }

  // MELF / cylindrical style (rendered as Chip rectangles here)
  const melf = [
    { name: 'Mini-MELF', l: 3.6, w: 1.4, aliases: ['MINIMELF'] },
    { name: 'MELF', l: 5.9, w: 2.2 },
    { name: 'LL-34', l: 3.4, w: 1.4 },
    { name: 'DO-213AA', l: 4.3, w: 2.0 },
    { name: 'DO-213AB', l: 6.5, w: 2.5 },
    { name: 'SOD-80C', l: 3.5, w: 1.5 },
    { name: 'SOD-80', l: 5.9, w: 2.2 },
    { name: 'SOD-110', l: 4.5, w: 2.0 },
    { name: 'SMAF', l: 3.5, w: 1.8 },
    { name: 'SMF', l: 3.7, w: 1.8 },
  ]
  for (const p of melf) {
    const file = `${sanitizeFilename(p.name)}.json`
    writes.push(
      writeIfMissing(
        file,
        chipPkg({
          name: p.name,
          length: p.l,
          width: p.w,
          leadLength: 0.3,
          aliases: p.aliases ?? [],
        }),
      ),
    )
  }

  // -------------------------------------------------------------------------
  // SECTION B — Small transistor / diode packages (SOT family)
  // -------------------------------------------------------------------------

  // Existing repo already defines SOT-23 and SOT-363; we add missing variants.
  const sotPkgs = [
    // 3-pin variants -> ThreePole
    { name: 'SOT-89', pins: 3, bodyL: 4.5, bodyW: 2.5, pitch: 1.5 },
    { name: 'SOT-323', pins: 3, bodyL: 2.0, bodyW: 1.25, pitch: 0.65 },
    { name: 'SOT-523', pins: 3, bodyL: 1.6, bodyW: 0.8, pitch: 0.5 },
    { name: 'SOT-723', pins: 3, bodyL: 1.2, bodyW: 0.8, pitch: 0.5 },
    { name: 'SC-70', pins: 3, bodyL: 2.0, bodyW: 1.25, pitch: 0.65, aliases: ['SOT-323'] },
    { name: 'SC-89', pins: 3, bodyL: 2.0, bodyW: 1.25, pitch: 0.65 },
    // 4-pin (2+2 symmetric) -> TwoSymmetric
    { name: 'SC-88', pins: 4, bodyL: 2.0, bodyW: 1.25, pitch: 0.65 },
    // 6-pin symmetric -> TwoSymmetric
    { name: 'SOT-23-6', pins: 6, bodyL: 2.9, bodyW: 1.6, pitch: 0.95 },
    { name: 'SOT-457', pins: 6, bodyL: 2.0, bodyW: 2.1, pitch: 0.65 },
    // 8-pin symmetric -> TwoSymmetric
    { name: 'SOT-23-8', pins: 8, bodyL: 3.0, bodyW: 3.0, pitch: 0.65 },
    // 5-pin odd -> Outline (schema cannot represent 3+2 lead split)
    { name: 'SOT-23-5', pins: 5, bodyL: 2.9, bodyW: 1.6, pitch: 0.95, outlineOnly: true },
    { name: 'SOT-753', pins: 5, bodyL: 1.6, bodyW: 1.6, pitch: 0.5, outlineOnly: true },
    { name: 'SC-90', pins: 5, bodyL: 2.0, bodyW: 2.1, pitch: 0.65, outlineOnly: true },
    // 4-pin but asymmetric families -> Outline
    { name: 'SOT-143', pins: 4, bodyL: 3.0, bodyW: 1.3, pitch: 1.9, outlineOnly: true },
    { name: 'SOT-343', pins: 4, bodyL: 2.0, bodyW: 2.1, pitch: 0.65, outlineOnly: true },
  ]

  for (const p of sotPkgs) {
    const filename = `${sanitizeFilename(p.name)}.json`
    if (p.outlineOnly) {
      writes.push(writeIfMissing(filename, outlinePkg({ name: p.name, length: p.bodyL, width: p.bodyW })))
      continue
    }
    if (p.pins === 3) {
      // Rough, consistent geometry similar to existing SOT-23 / SOT-223 entries.
      const leadLen = 0.35
      const leadW = 0.35
      const widthOverLeads = p.bodyW + 2 * (leadLen + 0.2)
      writes.push(
        writeIfMissing(
          filename,
          threePolePkg({
            name: p.name,
            bodyL: p.bodyL,
            bodyW: p.bodyW,
            widthOverLeads,
            ccDistance: p.pitch * 2, // 2 leads on one side
            leadWidth: leadW,
            leadLength: leadLen,
            aliases: p.aliases ?? [],
          }),
        ),
      )
      continue
    }
    if (p.pins % 2 === 0) {
      const leadLen = 0.25
      const leadW = 0.3
      const widthOverLeads = widthOverLeadsFromBody(p.bodyW, leadLen, 0.2)
      const bodyL = p.bodyL
      writes.push(
        writeIfMissing(
          filename,
          twoSymPkg({
            name: p.name,
            pins: p.pins,
            pitch: p.pitch,
            bodyW: p.bodyW,
            bodyL,
            widthOverLeads,
            leadWidth: leadW,
            leadLength: leadLen,
          }),
        ),
      )
      continue
    }
  }

  // -------------------------------------------------------------------------
  // SECTION C — SOIC / SOP / TSSOP / MSOP (TwoSymmetricLeadGroups)
  // -------------------------------------------------------------------------

  const soic = [
    { name: 'SOIC-8', pins: 8, pitch: 1.27, bodyW: 3.9, endMargin: 0.8 },
    { name: 'SOIC-14', pins: 14, pitch: 1.27, bodyW: 3.9, endMargin: 0.9 },
    { name: 'SOIC-16', pins: 16, pitch: 1.27, bodyW: 3.9, endMargin: 0.9 },
    { name: 'SOIC-18', pins: 18, pitch: 1.27, bodyW: 3.9, endMargin: 0.9 },
    { name: 'SOIC-20', pins: 20, pitch: 1.27, bodyW: 7.5, endMargin: 1.0 },
    { name: 'SOIC-24', pins: 24, pitch: 1.27, bodyW: 7.5, endMargin: 1.0 },
    { name: 'SOIC-28', pins: 28, pitch: 1.27, bodyW: 7.5, endMargin: 1.0 },
    { name: 'SOIC-32', pins: 32, pitch: 1.27, bodyW: 7.5, endMargin: 1.0 },
    { name: 'SOIC-8W', pins: 8, pitch: 1.27, bodyW: 5.3, endMargin: 0.8 },
    { name: 'SOIC-16W', pins: 16, pitch: 1.27, bodyW: 7.5, endMargin: 0.9 },
  ]

  for (const p of soic) {
    const leadLen = 0.6
    const leadW = 0.4
    const bodyL = bodyLengthFromPins(p.pins, p.pitch, p.endMargin)
    const widthOverLeads = widthOverLeadsFromBody(p.bodyW, leadLen, 0.45)
    writes.push(
      writeIfMissing(
        `${sanitizeFilename(p.name)}.json`,
        twoSymPkg({
          name: p.name,
          pins: p.pins,
          pitch: p.pitch,
          bodyW: p.bodyW,
          bodyL,
          widthOverLeads,
          leadWidth: leadW,
          leadLength: leadLen,
          aliases: [
            p.name.replace('SOIC-', 'SOIC'),
            p.name.replace('SOIC-', 'SO-'),
            p.name.replace('SOIC-', 'SO'),
          ],
        }),
      ),
    )
  }

  // TSSOP (pitch 0.65)
  const tssopPins = [8, 14, 16, 20, 24, 28, 32, 38, 44, 48]
  for (const pins of tssopPins) {
    const name = `TSSOP-${pins}`
    const pitch = 0.65
    const leadLen = 0.5
    const leadW = 0.3
    const bodyW = pins <= 20 ? 4.4 : pins <= 32 ? 6.1 : 7.8
    const bodyL = bodyLengthFromPins(pins, pitch, 0.7)
    const widthOverLeads = widthOverLeadsFromBody(bodyW, leadLen, 0.3)
    writes.push(
      writeIfMissing(
        `${sanitizeFilename(name)}.json`,
        twoSymPkg({
          name,
          pins,
          pitch,
          bodyW,
          bodyL,
          widthOverLeads,
          leadWidth: leadW,
          leadLength: leadLen,
          aliases: [name.replace('TSSOP-', 'TSSOP')],
        }),
      ),
    )
  }

  // MSOP / VSSOP
  const msop = [
    { name: 'MSOP-8', pins: 8, pitch: 0.65, bodyW: 3.0 },
    { name: 'MSOP-10', pins: 10, pitch: 0.5, bodyW: 3.0 },
    { name: 'MSOP-12', pins: 12, pitch: 0.5, bodyW: 3.0 },
    { name: 'MSOP-16', pins: 16, pitch: 0.5, bodyW: 4.4 },
    { name: 'VSSOP-8', pins: 8, pitch: 0.65, bodyW: 3.0 },
    { name: 'VSSOP-10', pins: 10, pitch: 0.5, bodyW: 3.0 },
    { name: 'VSSOP-16', pins: 16, pitch: 0.5, bodyW: 4.4 },
    { name: 'VSSOP-20', pins: 20, pitch: 0.5, bodyW: 4.4 },
    { name: 'VSSOP-24', pins: 24, pitch: 0.5, bodyW: 5.5 },
    { name: 'VSSOP-28', pins: 28, pitch: 0.5, bodyW: 5.5 },
  ]
  for (const p of msop) {
    const leadLen = 0.45
    const leadW = 0.25
    const bodyL = bodyLengthFromPins(p.pins, p.pitch, 0.6)
    const widthOverLeads = widthOverLeadsFromBody(p.bodyW, leadLen, 0.25)
    writes.push(
      writeIfMissing(
        `${sanitizeFilename(p.name)}.json`,
        twoSymPkg({
          name: p.name,
          pins: p.pins,
          pitch: p.pitch,
          bodyW: p.bodyW,
          bodyL,
          widthOverLeads,
          leadWidth: leadW,
          leadLength: leadLen,
          aliases: [p.name.replace('-', '')],
        }),
      ),
    )
  }

  // -------------------------------------------------------------------------
  // SECTION D — QFN / DFN
  // -------------------------------------------------------------------------

  const dfn = [
    { name: 'DFN-6', pins: 6, bodyL: 2, bodyW: 2, pitch: 0.5 },
    { name: 'DFN-8', pins: 8, bodyL: 3, bodyW: 3, pitch: 0.5 },
    { name: 'DFN-10', pins: 10, bodyL: 3, bodyW: 3, pitch: 0.5 },
    { name: 'DFN-12', pins: 12, bodyL: 3, bodyW: 3, pitch: 0.5 },
    { name: 'DFN-16', pins: 16, bodyL: 3, bodyW: 3, pitch: 0.5 },
    { name: 'DFN-20', pins: 20, bodyL: 4, bodyW: 4, pitch: 0.5 },
    { name: 'DFN-24', pins: 24, bodyL: 4, bodyW: 4, pitch: 0.5 },
    { name: 'DFN-28', pins: 28, bodyL: 5, bodyW: 5, pitch: 0.5 },
  ]
  for (const p of dfn) {
    const leadLen = 0.25
    const leadW = 0.35
    const widthOverLeads = Math.max(p.bodyW - 1, p.bodyW * 0.7) // follow existing DFN-ish style in repo
    writes.push(
      writeIfMissing(
        `${sanitizeFilename(p.name)}.json`,
        twoSymPkg({
          name: p.name,
          pins: p.pins,
          pitch: p.pitch,
          bodyW: p.bodyW,
          bodyL: p.bodyL,
          widthOverLeads,
          leadWidth: leadW,
          leadLength: leadLen,
          aliases: [p.name.replace('-', ''), p.name.replace('DFN-', 'DFN')],
        }),
      ),
    )
  }

  const qfn = [
    { name: 'QFN-16', pins: 16, body: 3, pitch: 0.5 },
    { name: 'QFN-20', pins: 20, body: 4, pitch: 0.5 },
    { name: 'QFN-24', pins: 24, body: 4, pitch: 0.5 },
    { name: 'QFN-28', pins: 28, body: 5, pitch: 0.5 },
    { name: 'QFN-32', pins: 32, body: 5, pitch: 0.5 },
    { name: 'QFN-40', pins: 40, body: 6, pitch: 0.5 },
    { name: 'QFN-44', pins: 44, body: 7, pitch: 0.5 },
    { name: 'QFN-48', pins: 48, body: 7, pitch: 0.5 },
    { name: 'QFN-56', pins: 56, body: 8, pitch: 0.5 },
    { name: 'QFN-64', pins: 64, body: 9, pitch: 0.5 },
    { name: 'QFN-72', pins: 72, body: 10, pitch: 0.5 },
    { name: 'QFN-80', pins: 80, body: 12, pitch: 0.5 },
    { name: 'QFN-100', pins: 100, body: 14, pitch: 0.5 },
    { name: 'QFN-144', pins: 144, body: 20, pitch: 0.5 },
  ]
  for (const p of qfn) {
    const leadLen = 0.25
    const leadW = 0.35
    const widthOverLeads = p.body + 2 // slight pad overhang
    writes.push(
      writeIfMissing(
        `${sanitizeFilename(p.name)}.json`,
        fourSymPkg({
          name: p.name,
          pins: p.pins,
          pitch: p.pitch,
          body: p.body,
          widthOverLeads,
          leadWidth: leadW,
          leadLength: leadLen,
          aliases: [p.name.replace('-', ''), p.name.replace('QFN-', 'QFN')],
        }),
      ),
    )
  }

  // -------------------------------------------------------------------------
  // SECTION E — QFP / LQFP / TQFP (FourSymmetricLeadGroups)
  // -------------------------------------------------------------------------

  const qfp = [
    { name: 'TQFP-32', pins: 32, body: 7, pitch: 0.8 },
    { name: 'TQFP-44', pins: 44, body: 10, pitch: 0.8 },
    { name: 'TQFP-64', pins: 64, body: 14, pitch: 0.8 },
    { name: 'TQFP-100', pins: 100, body: 14, pitch: 0.5 },
    { name: 'TQFP-144', pins: 144, body: 20, pitch: 0.5 },
    { name: 'LQFP-48', pins: 48, body: 7, pitch: 0.5 },
    { name: 'LQFP-64', pins: 64, body: 10, pitch: 0.5 },
    { name: 'LQFP-80', pins: 80, body: 12, pitch: 0.5 },
    { name: 'LQFP-100', pins: 100, body: 14, pitch: 0.5 },
    { name: 'LQFP-144', pins: 144, body: 20, pitch: 0.5 },
    { name: 'QFP-208', pins: 208, body: 28, pitch: 0.5 },
    { name: 'QFP-256', pins: 256, body: 32, pitch: 0.5 },
  ]

  for (const p of qfp) {
    const leadLen = 0.8
    const leadW = p.pitch <= 0.5 ? 0.25 : 0.3
    const widthOverLeads = p.body + 2 * (leadLen + 0.8)
    writes.push(
      writeIfMissing(
        `${sanitizeFilename(p.name)}.json`,
        fourSymPkg({
          name: p.name,
          pins: p.pins,
          pitch: p.pitch,
          body: p.body,
          widthOverLeads,
          leadWidth: leadW,
          leadLength: leadLen,
          aliases: [p.name.replace('-', ''), p.name.replace('QFP-', 'QFP')],
        }),
      ),
    )
  }

  // -------------------------------------------------------------------------
  // SECTION F — Power packages (best-effort using supported schema; others Outline)
  // -------------------------------------------------------------------------

  const power = [
    // Reasonable outlines or approximations; these vary by vendor.
    { name: 'DPAK', bodyL: 6.5, bodyW: 6.1, outline: true, aliases: ['TO-252', 'DPAK (TO-252)'] },
    { name: 'D2PAK', bodyL: 10.2, bodyW: 9.2, outline: true, aliases: ['TO-263', 'D2PAK (TO-263)'] },
    { name: 'D3PAK', bodyL: 9.0, bodyW: 8.0, outline: true },
    { name: 'PowerSO-8', pins: 8, pitch: 1.27, bodyW: 3.9, endMargin: 0.8, aliases: ['HSOP-8'] },
    { name: 'PowerSO-10', pins: 10, pitch: 1.0, bodyW: 3.9, endMargin: 0.8 },
    { name: 'TO-277', bodyL: 6.5, bodyW: 5.0, outline: true, aliases: ['TO-277A'] },
    { name: 'LFPAK33', bodyL: 5.0, bodyW: 6.0, outline: true },
    { name: 'LFPAK56', bodyL: 5.0, bodyW: 6.0, outline: true },
    { name: 'PowerPAK SO-8', pins: 8, pitch: 1.27, bodyW: 3.9, endMargin: 0.8, aliases: ['PowerPAKSO-8'] },
    { name: 'DirectFET', bodyL: 5.6, bodyW: 5.6, outline: true },
    { name: 'DrMOS', bodyL: 6.0, bodyW: 6.0, outline: true },
    { name: 'HTSSOP-16', pins: 16, pitch: 0.65, bodyW: 4.4, endMargin: 0.7 },
    { name: 'HTSSOP-20', pins: 20, pitch: 0.65, bodyW: 4.4, endMargin: 0.7 },
    { name: 'HTSSOP-28', pins: 28, pitch: 0.65, bodyW: 6.1, endMargin: 0.7 },
    { name: 'eTSSOP-8', pins: 8, pitch: 0.65, bodyW: 3.0, endMargin: 0.7 },
    { name: 'SOT-227', bodyL: 38.0, bodyW: 25.0, outline: true },
    { name: 'SOT-93', bodyL: 15.0, bodyW: 15.0, outline: true },
    { name: 'SOT-428', bodyL: 20.0, bodyW: 20.0, outline: true },
    { name: 'TO-263-7', bodyL: 10.2, bodyW: 9.2, outline: true, aliases: ['TO-263-7'] },
  ]

  for (const p of power) {
    const filename = `${sanitizeFilename(p.name)}.json`
    if (p.outline) {
      writes.push(writeIfMissing(filename, outlinePkg({ name: p.name, length: p.bodyL, width: p.bodyW, aliases: p.aliases ?? [] })))
      continue
    }
    // Model as TwoSymmetricLeadGroups like other SO/TSSOP shapes.
    const leadLen = 0.7
    const leadW = 0.35
    const bodyL = bodyLengthFromPins(p.pins, p.pitch, p.endMargin)
    const widthOverLeads = widthOverLeadsFromBody(p.bodyW, leadLen, 0.45)
    writes.push(
      writeIfMissing(
        filename,
        twoSymPkg({
          name: p.name,
          pins: p.pins,
          pitch: p.pitch,
          bodyW: p.bodyW,
          bodyL,
          widthOverLeads,
          leadWidth: leadW,
          leadLength: leadLen,
          aliases: p.aliases ?? [],
        }),
      ),
    )
  }

  // -------------------------------------------------------------------------
  // SECTION G — BGA / CSP / WLCSP
  // -------------------------------------------------------------------------

  const bga = [
    { name: 'uBGA-16', pins: 16, pitch: 0.5, grid: [4, 4] },
    { name: 'uBGA-24', pins: 24, pitch: 0.5, grid: [6, 4] },
    { name: 'uBGA-36', pins: 36, pitch: 0.5, grid: [6, 6] },
    { name: 'uBGA-48', pins: 48, pitch: 0.5, grid: [8, 6] },
    { name: 'uBGA-64', pins: 64, pitch: 0.5, grid: [8, 8] },
    { name: 'FBGA-100', pins: 100, pitch: 0.8, grid: [10, 10] },
    { name: 'FBGA-144', pins: 144, pitch: 0.8, grid: [12, 12] },
    { name: 'FBGA-256', pins: 256, pitch: 0.8, grid: [16, 16] },
    { name: 'LFBGA-100', pins: 100, pitch: 0.8, grid: [10, 10] },
    { name: 'LFBGA-144', pins: 144, pitch: 0.8, grid: [12, 12] },
    { name: 'LFBGA-256', pins: 256, pitch: 1.0, grid: [16, 16] },
    { name: 'WLCSP-9', pins: 9, pitch: 0.4, grid: [3, 3] },
    { name: 'WLCSP-16', pins: 16, pitch: 0.4, grid: [4, 4] },
    { name: 'WLCSP-25', pins: 25, pitch: 0.4, grid: [5, 5] },
    { name: 'WLCSP-36', pins: 36, pitch: 0.4, grid: [6, 6] },
    { name: 'WLCSP-49', pins: 49, pitch: 0.4, grid: [7, 7] },
    { name: 'WLCSP-64', pins: 64, pitch: 0.4, grid: [8, 8] },
    { name: 'BGA-324', pins: 324, pitch: 0.8, grid: [18, 18] },
    { name: 'BGA-484', pins: 484, pitch: 1.0, grid: [22, 22] },
    { name: 'BGA-676', pins: 676, pitch: 1.0, grid: [26, 26] },
  ]

  for (const p of bga) {
    const span = (Math.max(p.grid[0], p.grid[1]) - 1) * p.pitch
    const body = span + 2.0
    const ballDia = p.pitch <= 0.4 ? 0.25 : p.pitch <= 0.5 ? 0.27 : p.pitch <= 0.8 ? 0.35 : 0.45
    writes.push(
      writeIfMissing(
        `${sanitizeFilename(p.name)}.json`,
        bgaPkg({
          name: p.name,
          pins: p.pins,
          pitch: p.pitch,
          rowCol: p.grid,
          body,
          ballDia,
          aliases: [p.name.replace('-', ''), p.name.replace('BGA-', 'BGA')],
        }),
      ),
    )
  }

  // -------------------------------------------------------------------------
  // Execute writes, then rebuild manifest (clean + include new files)
  // -------------------------------------------------------------------------

  const results = await Promise.all(writes)
  const written = results.filter((r) => r.written).length
  const total = await rebuildManifest()

  // Minimal human output (script is run from CLI during dev)
  const skipped = results.length - written
  console.log(`Packages: wrote ${written}, skipped ${skipped} (already existed).`)
  console.log(`Manifest rebuilt with ${total} entries: ${MANIFEST_PATH}`)
}

main().catch(async (err) => {
  console.error(err)
  // If manifest exists, try to show it to help debugging
  try {
    const txt = await readFile(MANIFEST_PATH, 'utf8')
    console.error(`Current manifest: ${MANIFEST_PATH}\n${txt.slice(0, 2000)}${txt.length > 2000 ? '\n…' : ''}`)
  } catch {}
  process.exit(1)
})

