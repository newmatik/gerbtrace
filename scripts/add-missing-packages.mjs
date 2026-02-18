/**
 * add-missing-packages.mjs
 *
 * Adds the "missing everyday packages" requested in the issue:
 * - SO-10 / SO-12 / SO-22 / SO-26
 * - SSOP-16 / SSOP-20 / SSOP-28, QSOP-16 / QSOP-24
 * - SOT-563 / SOT-666 / SOT-883
 * - QFN pitch alternates (0.40 / 0.65) for common bodies
 * - DFN workhorse sizes (2x3 bodies)
 * - PLCC / SOJ legacy
 * - SMA/SMB/SMC + SOD-123FL/W
 * - oscillator/crystal outline sizes (2016/2520/3225/5032/7050)
 *
 * It only writes files that are missing. After running, run:
 *   node scripts/cleanup-packages.mjs
 *
 * Usage:
 *   node scripts/add-missing-packages.mjs
 */

import { mkdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const PACKAGES_DIR = join(process.cwd(), 'public', 'packages')

async function exists(p) {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

function jsonStable(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

async function writeIfMissing(filename, obj) {
  const p = join(PACKAGES_DIR, filename)
  if (await exists(p)) return false
  await writeFile(p, jsonStable(obj), 'utf8')
  return true
}

function twoSym({ name, pins, pitch, bodyL, bodyW, widthOverLeads, leadWidth, leadLength, aliases = [] }) {
  return {
    name,
    type: 'PT_TWO_SYM',
    body: { length: bodyL, width: bodyW },
    twoSymmetric: {
      numberOfLeads: pins,
      widthOverLeads,
      leadPitch: pitch,
      leadWidth,
      leadLength,
    },
    ...(aliases.length ? { aliases } : {}),
  }
}

function fourSym({ name, pins, pitch, body, widthOverLeads, leadWidth, leadLength, aliases = [] }) {
  return {
    name,
    type: 'PT_FOUR_SYM',
    body: { length: body, width: body },
    fourSymmetric: {
      numberOfLeads: pins,
      widthOverLeads,
      leadPitch: pitch,
      leadWidth,
      leadLength,
    },
    ...(aliases.length ? { aliases } : {}),
  }
}

function threePole({ name, bodyL, bodyW, widthOverLeads, ccDistance, leadWidth, leadLength, aliases = [] }) {
  return {
    name,
    type: 'PT_THREE_POLE',
    body: { length: bodyL, width: bodyW },
    threePole: {
      widthOverLeads,
      ccDistance,
      leadWidth,
      leadLength,
    },
    ...(aliases.length ? { aliases } : {}),
  }
}

function chip({ name, bodyL, bodyW, leadLength, aliases = [] }) {
  return {
    name,
    type: 'PT_TWO_POLE',
    body: { length: bodyL, width: bodyW },
    chip: { chipLength: bodyL, leadWidth: bodyW, leadLength },
    ...(aliases.length ? { aliases } : {}),
  }
}

function outline({ name, L, W, aliases = [] }) {
  return {
    name,
    type: 'PT_OUTLINE',
    body: { length: L, width: W },
    outline: { length: L, width: W },
    ...(aliases.length ? { aliases } : {}),
  }
}

async function main() {
  await mkdir(PACKAGES_DIR, { recursive: true })

  let written = 0

  // 1) SO everyday: canonical SO-xx, aliases SOIC-xx etc.
  written += (await writeIfMissing(
    'SO-10.json',
    twoSym({
      name: 'SO-10',
      pins: 10,
      pitch: 1.27,
      bodyL: 4.9,
      bodyW: 3.9,
      widthOverLeads: 6.0,
      leadWidth: 0.4,
      leadLength: 0.6,
      aliases: ['SO10', 'SOIC-10', 'SOIC10', 'SO-10'],
    }),
  )) ? 1 : 0

  written += (await writeIfMissing(
    'SO-12.json',
    twoSym({
      name: 'SO-12',
      pins: 12,
      pitch: 1.27,
      bodyL: 5.0,
      bodyW: 3.9,
      widthOverLeads: 6.0,
      leadWidth: 0.4,
      leadLength: 0.6,
      aliases: ['SO12', 'SOIC-12', 'SOIC12'],
    }),
  )) ? 1 : 0

  written += (await writeIfMissing(
    'SO-22.json',
    twoSym({
      name: 'SO-22',
      pins: 22,
      pitch: 1.27,
      bodyL: 12.0,
      bodyW: 7.5,
      widthOverLeads: 10.3,
      leadWidth: 0.4,
      leadLength: 0.6,
      aliases: ['SO22', 'SOIC-22', 'SOIC22'],
    }),
  )) ? 1 : 0

  written += (await writeIfMissing(
    'SO-26.json',
    twoSym({
      name: 'SO-26',
      pins: 26,
      pitch: 1.27,
      bodyL: 14.0,
      bodyW: 7.5,
      widthOverLeads: 10.3,
      leadWidth: 0.4,
      leadLength: 0.6,
      aliases: ['SO26', 'SOIC-26', 'SOIC26'],
    }),
  )) ? 1 : 0

  // 1B) SSOP / QSOP families
  const ssopPitch = 0.635
  written += (await writeIfMissing(
    'SSOP-16.json',
    twoSym({
      name: 'SSOP-16',
      pins: 16,
      pitch: ssopPitch,
      bodyL: 6.2,
      bodyW: 5.3,
      widthOverLeads: 6.9,
      leadWidth: 0.3,
      leadLength: 0.5,
      aliases: ['SSOP16'],
    }),
  )) ? 1 : 0
  written += (await writeIfMissing(
    'SSOP-20.json',
    twoSym({
      name: 'SSOP-20',
      pins: 20,
      pitch: ssopPitch,
      bodyL: 7.2,
      bodyW: 5.3,
      widthOverLeads: 6.9,
      leadWidth: 0.3,
      leadLength: 0.5,
      aliases: ['SSOP20'],
    }),
  )) ? 1 : 0
  written += (await writeIfMissing(
    'SSOP-28.json',
    twoSym({
      name: 'SSOP-28',
      pins: 28,
      pitch: ssopPitch,
      bodyL: 10.2,
      bodyW: 5.3,
      widthOverLeads: 6.9,
      leadWidth: 0.3,
      leadLength: 0.5,
      aliases: ['SSOP28'],
    }),
  )) ? 1 : 0

  written += (await writeIfMissing(
    'QSOP-16.json',
    twoSym({
      name: 'QSOP-16',
      pins: 16,
      pitch: ssopPitch,
      bodyL: 4.9,
      bodyW: 3.9,
      widthOverLeads: 5.5,
      leadWidth: 0.28,
      leadLength: 0.45,
      aliases: ['QSOP16'],
    }),
  )) ? 1 : 0
  written += (await writeIfMissing(
    'QSOP-24.json',
    twoSym({
      name: 'QSOP-24',
      pins: 24,
      pitch: ssopPitch,
      bodyL: 7.6,
      bodyW: 3.9,
      widthOverLeads: 5.5,
      leadWidth: 0.28,
      leadLength: 0.45,
      aliases: ['QSOP24'],
    }),
  )) ? 1 : 0

  // 2) Tiny transistor/logic packages
  written += (await writeIfMissing(
    'SOT-563.json',
    twoSym({
      name: 'SOT-563',
      pins: 6,
      pitch: 0.5,
      bodyL: 1.6,
      bodyW: 1.6,
      widthOverLeads: 2.2,
      leadWidth: 0.3,
      leadLength: 0.2,
      aliases: ['SC-74A', 'SOT563', 'TSOT-563'],
    }),
  )) ? 1 : 0

  written += (await writeIfMissing(
    'SOT-666.json',
    twoSym({
      name: 'SOT-666',
      pins: 6,
      pitch: 0.5,
      bodyL: 1.6,
      bodyW: 1.6,
      widthOverLeads: 2.2,
      leadWidth: 0.3,
      leadLength: 0.2,
      aliases: ['SC-75', 'SOT666', 'SC-70-6'],
    }),
  )) ? 1 : 0

  written += (await writeIfMissing(
    'SOT-883.json',
    threePole({
      name: 'SOT-883',
      bodyL: 1.0,
      bodyW: 0.6,
      widthOverLeads: 1.4,
      ccDistance: 0.65,
      leadWidth: 0.2,
      leadLength: 0.2,
      aliases: ['XDFN-3'],
    }),
  )) ? 1 : 0

  // 3) QFN pitch alternates
  const qfnLeadWidth = 0.35
  const qfnLeadLength = 0.25
  written += (await writeIfMissing(
    'QFN-32-5x5-P0.40.json',
    fourSym({ name: 'QFN-32-5x5-P0.40', pins: 32, pitch: 0.4, body: 5, widthOverLeads: 7, leadWidth: qfnLeadWidth, leadLength: qfnLeadLength, aliases: ['QFN32-0.40', 'QFN-32-0.40'] }),
  )) ? 1 : 0
  written += (await writeIfMissing(
    'QFN-48-7x7-P0.40.json',
    fourSym({ name: 'QFN-48-7x7-P0.40', pins: 48, pitch: 0.4, body: 7, widthOverLeads: 9, leadWidth: qfnLeadWidth, leadLength: qfnLeadLength, aliases: ['QFN48-0.40', 'QFN-48-0.40'] }),
  )) ? 1 : 0
  written += (await writeIfMissing(
    'QFN-64-9x9-P0.40.json',
    fourSym({ name: 'QFN-64-9x9-P0.40', pins: 64, pitch: 0.4, body: 9, widthOverLeads: 11, leadWidth: qfnLeadWidth, leadLength: qfnLeadLength, aliases: ['QFN64-0.40', 'QFN-64-0.40'] }),
  )) ? 1 : 0

  written += (await writeIfMissing(
    'QFN-32-5x5-P0.65.json',
    fourSym({ name: 'QFN-32-5x5-P0.65', pins: 32, pitch: 0.65, body: 5, widthOverLeads: 7, leadWidth: qfnLeadWidth, leadLength: qfnLeadLength, aliases: ['QFN32-0.65', 'QFN-32-0.65'] }),
  )) ? 1 : 0
  written += (await writeIfMissing(
    'QFN-44-7x7-P0.65.json',
    fourSym({ name: 'QFN-44-7x7-P0.65', pins: 44, pitch: 0.65, body: 7, widthOverLeads: 9, leadWidth: qfnLeadWidth, leadLength: qfnLeadLength, aliases: ['QFN44-0.65', 'QFN-44-0.65'] }),
  )) ? 1 : 0
  written += (await writeIfMissing(
    'QFN-64-9x9-P0.65.json',
    fourSym({ name: 'QFN-64-9x9-P0.65', pins: 64, pitch: 0.65, body: 9, widthOverLeads: 11, leadWidth: qfnLeadWidth, leadLength: qfnLeadLength, aliases: ['QFN64-0.65', 'QFN-64-0.65'] }),
  )) ? 1 : 0

  // 3C) DFN workhorse sizes (2x3)
  written += (await writeIfMissing(
    'DFN-8-2x3-P0.50.json',
    twoSym({
      name: 'DFN-8-2x3-P0.50',
      pins: 8,
      pitch: 0.5,
      bodyL: 3.0,
      bodyW: 2.0,
      widthOverLeads: 1.3,
      leadWidth: 0.6,
      leadLength: 0.25,
      aliases: ['DFN-8-2x3', 'XDFN-8-2x3'],
    }),
  )) ? 1 : 0
  written += (await writeIfMissing(
    'DFN-10-2x3-P0.50.json',
    twoSym({
      name: 'DFN-10-2x3-P0.50',
      pins: 10,
      pitch: 0.5,
      bodyL: 3.0,
      bodyW: 2.0,
      widthOverLeads: 1.3,
      leadWidth: 0.55,
      leadLength: 0.25,
      aliases: ['DFN-10-2x3', 'XDFN-10-2x3'],
    }),
  )) ? 1 : 0
  written += (await writeIfMissing(
    'DFN-6-2x3-P0.95.json',
    twoSym({
      name: 'DFN-6-2x3-P0.95',
      pins: 6,
      pitch: 0.95,
      bodyL: 3.0,
      bodyW: 2.0,
      widthOverLeads: 1.3,
      leadWidth: 0.6,
      leadLength: 0.25,
      aliases: ['DFN-6-2x3', 'SOT-23-6-DFN'],
    }),
  )) ? 1 : 0

  // 4) J-lead / legacy (approximated with standard lead-group models for rendering)
  written += (await writeIfMissing(
    'PLCC-44.json',
    fourSym({
      name: 'PLCC-44',
      pins: 44,
      pitch: 1.27,
      body: 16,
      widthOverLeads: 20,
      leadWidth: 0.6,
      leadLength: 1.0,
      aliases: ['PLCC44'],
    }),
  )) ? 1 : 0
  written += (await writeIfMissing(
    'PLCC-68.json',
    fourSym({
      name: 'PLCC-68',
      pins: 68,
      pitch: 1.27,
      body: 24,
      widthOverLeads: 28,
      leadWidth: 0.6,
      leadLength: 1.0,
      aliases: ['PLCC68'],
    }),
  )) ? 1 : 0

  written += (await writeIfMissing(
    'SOJ-32.json',
    twoSym({
      name: 'SOJ-32',
      pins: 32,
      pitch: 1.27,
      bodyL: 20.0,
      bodyW: 7.5,
      widthOverLeads: 10.3,
      leadWidth: 0.4,
      leadLength: 0.6,
      aliases: ['SOJ32'],
    }),
  )) ? 1 : 0
  written += (await writeIfMissing(
    'SOJ-40.json',
    twoSym({
      name: 'SOJ-40',
      pins: 40,
      pitch: 1.27,
      bodyL: 26.0,
      bodyW: 10.3,
      widthOverLeads: 13.0,
      leadWidth: 0.4,
      leadLength: 0.6,
      aliases: ['SOJ40'],
    }),
  )) ? 1 : 0

  // 5) Diodes: canonical SMA/SMB/SMC + SOD-123FL/W
  written += (await writeIfMissing(
    'SMA.json',
    chip({
      name: 'SMA',
      bodyL: 4.6,
      bodyW: 2.6,
      leadLength: 0.6,
      aliases: ['DO-214AC', 'DO214AC'],
    }),
  )) ? 1 : 0
  written += (await writeIfMissing(
    'SMB.json',
    chip({
      name: 'SMB',
      bodyL: 5.9,
      bodyW: 3.2,
      leadLength: 0.7,
      aliases: ['DO-214AA', 'DO214AA'],
    }),
  )) ? 1 : 0
  written += (await writeIfMissing(
    'SMC.json',
    chip({
      name: 'SMC',
      bodyL: 7.2,
      bodyW: 6.2,
      leadLength: 0.8,
      aliases: ['DO-214AB', 'DO214AB'],
    }),
  )) ? 1 : 0

  written += (await writeIfMissing(
    'SOD-123FL.json',
    chip({
      name: 'SOD-123FL',
      bodyL: 3.7,
      bodyW: 1.7,
      leadLength: 0.3,
      aliases: ['SOD123FL'],
    }),
  )) ? 1 : 0
  written += (await writeIfMissing(
    'SOD-123W.json',
    chip({
      name: 'SOD-123W',
      bodyL: 3.7,
      bodyW: 1.7,
      leadLength: 0.3,
      aliases: ['SOD123W'],
    }),
  )) ? 1 : 0

  // 6) Oscillator/crystal outlines (keep simple: outline-only)
  written += (await writeIfMissing('2016.json', outline({ name: '2016', L: 2.0, W: 1.6, aliases: ['OSC-2016', 'XTAL-2016'] }))) ? 1 : 0
  written += (await writeIfMissing('2520.json', outline({ name: '2520', L: 2.5, W: 2.0, aliases: ['OSC-2520', 'XTAL-2520'] }))) ? 1 : 0
  written += (await writeIfMissing('3225.json', outline({ name: '3225', L: 3.2, W: 2.5, aliases: ['OSC-3225', 'XTAL-3225'] }))) ? 1 : 0
  written += (await writeIfMissing('5032.json', outline({ name: '5032', L: 5.0, W: 3.2, aliases: ['OSC-5032', 'XTAL-5032'] }))) ? 1 : 0
  written += (await writeIfMissing('7050.json', outline({ name: '7050', L: 7.0, W: 5.0, aliases: ['OSC-7050', 'XTAL-7050'] }))) ? 1 : 0

  console.log(`Wrote ${written} missing package files.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

