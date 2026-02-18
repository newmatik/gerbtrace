/**
 * Serialize a PackageDefinition into a TPSys-compliant .pck text record.
 *
 * Converts from internal mm / degrees to TPSys µm / millidegrees.
 * Output matches the format exported by MYCenter / TPSys 5.x.
 */

import type {
  PackageDefinition,
  ChipPackage,
  ThreePolePackage,
  TwoSymmetricPackage,
  FourSymmetricPackage,
  TwoPlusTwoPackage,
  FourOnTwoPackage,
  BgaPackage,
  TpsysGenericPackage,
  OutlinePackage,
  MachineSettings,
  AccLevel,
  CenteringPhase,
  PackageVariation,
} from '~/utils/package-types'

// ── Unit conversion ──

function mm2um(mm: number): number {
  return Math.round(mm * 1000)
}

// ── AccLevel to TPSys keyword ──

const ACC_MAP: Record<AccLevel, string> = {
  lowest: 'ACC_LOWEST',
  low: 'ACC_LOW',
  high: 'ACC_HIGH',
  highest: 'ACC_HIGHEST',
}

function accStr(level: AccLevel | undefined): string {
  return level ? ACC_MAP[level] : 'ACC_HIGH'
}

// ── Type mapping ──
// Package type discriminators are already TPSys names, so identity mapping.

function tpsysType(pkg: PackageDefinition): string {
  return pkg.type
}

// ── P04 pin numbering ──

function pinNumbering(pkg: PackageDefinition): string {
  switch (pkg.type) {
    case 'PT_TWO_POLE':
      return 'P04 1 2 0'
    case 'PT_THREE_POLE':
      return 'P04 1 3 0'
    case 'PT_TWO_SYM': {
      const half = pkg.twoSymmetric.numberOfLeads / 2
      return `P04 1 ${half} ${half + 1} ${pkg.twoSymmetric.numberOfLeads} 0`
    }
    case 'PT_FOUR_SYM': {
      const n = pkg.fourSymmetric.numberOfLeads
      const q = n / 4
      return `P04 1 ${q} ${q + 1} ${2 * q} ${2 * q + 1} ${3 * q} ${3 * q + 1} ${n} 0`
    }
    case 'PT_TWO_PLUS_TWO': {
      const { leadsLong, leadsShort } = pkg.twoPlusTwo
      const total = 2 * leadsLong + 2 * leadsShort
      const s1 = leadsLong
      const s2 = s1 + leadsShort
      const s3 = s2 + leadsLong
      return `P04 1 ${s1} ${s1 + 1} ${s2} ${s2 + 1} ${s3} ${s3 + 1} ${total} 0`
    }
    case 'PT_FOUR_ON_TWO': {
      const { leadsPerGroup } = pkg.fourOnTwo
      const total = leadsPerGroup * 4
      const s1 = leadsPerGroup
      const s2 = 2 * leadsPerGroup
      const s3 = 3 * leadsPerGroup
      return `P04 1 ${s1} ${s1 + 1} ${s2} ${s2 + 1} ${s3} ${s3 + 1} ${total} 0`
    }
    case 'PT_BGA': {
      const total = pkg.bga.leadsPerRow * pkg.bga.leadsPerColumn
      return `P04 1 ${total} 0`
    }
    case 'PT_GENERIC': {
      const total = pkg.generic.leadGroups.reduce((sum, g) => sum + g.numLeads, 0)
      return total > 0 ? `P04 1 ${total} 0` : 'P04 1 1 0'
    }
    case 'PT_OUTLINE':
      return 'P04 1 1 0'
  }
}

// ── Lead group + P055 generation per package type ──

interface LeadGroupLine {
  p051: string
  p054: string
  p055: string
}

function chipLeadGroups(pkg: ChipPackage): LeadGroupLine[] {
  const dist = mm2um(pkg.chip.chipLength / 2)
  const padW = mm2um(pkg.chip.leadWidth)
  const padL = mm2um(pkg.chip.leadLength)
  const leadW = padW

  return [
    {
      p051: `P051 CHIP 1 0 ${dist} -90000 NORMAL`,
      p054: 'P054 BRIGHT AUTO AUTO',
      p055: `P055 ${padW} ${padW} ${padW} ${padL} ${Math.round(padL * 1.3)} ${Math.round(padL * 0.7)} 0 ${leadW} ${leadW} 0`,
    },
    {
      p051: `P051 CHIP 1 0 ${-dist} 90000 NORMAL`,
      p054: 'P054 BRIGHT AUTO AUTO',
      p055: `P055 ${padW} ${padW} ${padW} ${padL} ${Math.round(padL * 1.3)} ${Math.round(padL * 0.7)} 0 ${leadW} ${leadW} 0`,
    },
  ]
}

function threePoleLeadGroups(pkg: ThreePolePackage): LeadGroupLine[] {
  const dist = mm2um(pkg.threePole.widthOverLeads / 2)
  const ccHalf = mm2um(pkg.threePole.ccDistance / 2)
  const padW = mm2um(pkg.threePole.leadWidth)
  const padL = mm2um(pkg.threePole.leadLength)
  const ccDist = mm2um(pkg.threePole.ccDistance)

  return [
    {
      p051: `P051 GULLWING 2 ${-dist} ${ccHalf} 180000 NORMAL`,
      p054: 'P054 BRIGHT AUTO AUTO',
      p055: `P055 ${padW} ${padW} ${padW} ${padL} ${padL} ${padL} ${ccDist} ${padW} ${padW} 0`,
    },
    {
      p051: `P051 GULLWING 1 ${dist} 0 0 NORMAL`,
      p054: 'P054 BRIGHT AUTO AUTO',
      p055: `P055 ${padW} ${padW} ${padW} ${padL} ${padL} ${padL} 0 ${padW} ${padW} 0`,
    },
  ]
}

function twoSymLeadGroups(pkg: TwoSymmetricPackage): LeadGroupLine[] {
  const { numberOfLeads, widthOverLeads, leadPitch, leadWidth, leadLength } = pkg.twoSymmetric
  const half = numberOfLeads / 2
  const dist = mm2um(widthOverLeads / 2)
  const ccHalf = mm2um((half - 1) * leadPitch / 2)
  const padW = mm2um(leadWidth)
  const padL = mm2um(leadLength)
  const ccDist = mm2um(leadPitch)

  const p055 = `P055 ${padL} ${padL} ${padL} ${padW} ${padW} ${padW} ${ccDist} ${Math.round(padW / 2)} ${padW} 0`
  return [
    {
      p051: `P051 GULLWING ${half} ${-dist} ${ccHalf} 180000 NORMAL`,
      p054: 'P054 BRIGHT AUTO AUTO',
      p055,
    },
    {
      p051: `P051 GULLWING ${half} ${dist} ${-ccHalf} 0 NORMAL`,
      p054: 'P054 BRIGHT AUTO AUTO',
      p055,
    },
  ]
}

function fourSymLeadGroups(pkg: FourSymmetricPackage): LeadGroupLine[] {
  const { numberOfLeads, widthOverLeads, leadPitch, leadWidth, leadLength } = pkg.fourSymmetric
  const perSide = numberOfLeads / 4
  const tip = mm2um(widthOverLeads / 2)
  const ccHalf = mm2um((perSide - 1) * leadPitch / 2)
  const padW = mm2um(leadWidth)
  const padL = mm2um(leadLength)
  const ccDist = mm2um(leadPitch)

  const p055 = `P055 ${padL} ${padL} ${padL} ${padW} ${padW} ${padW} ${ccDist} ${Math.round(padW / 2)} ${padW} 0`
  return [
    // LEFT (180°)
    { p051: `P051 GULLWING ${perSide} ${-tip} ${ccHalf} 180000 NORMAL`, p054: 'P054 BRIGHT AUTO AUTO', p055 },
    // BOTTOM (90°): distFromCenter = -ccHalf (X half-span, negative), ccHalf = -tip (Y position, negative)
    { p051: `P051 GULLWING ${perSide} ${-ccHalf} ${-tip} 90000 NORMAL`, p054: 'P054 BRIGHT AUTO AUTO', p055 },
    // RIGHT (0°)
    { p051: `P051 GULLWING ${perSide} ${tip} ${-ccHalf} 0 NORMAL`, p054: 'P054 BRIGHT AUTO AUTO', p055 },
    // TOP (-90°): distFromCenter = ccHalf (X half-span, positive), ccHalf = tip (Y position, positive)
    { p051: `P051 GULLWING ${perSide} ${ccHalf} ${tip} -90000 NORMAL`, p054: 'P054 BRIGHT AUTO AUTO', p055 },
  ]
}

function twoPlusTwoLeadGroups(pkg: TwoPlusTwoPackage): LeadGroupLine[] {
  const { leadsLong, leadsShort, widthOverLeadsX, widthOverLeadsY, leadPitch, leadWidth, leadLength } = pkg.twoPlusTwo
  const tipX = mm2um(widthOverLeadsX / 2)
  const tipY = mm2um(widthOverLeadsY / 2)
  const ccHalfLong = mm2um((leadsLong - 1) * leadPitch / 2)
  const ccHalfShort = mm2um((leadsShort - 1) * leadPitch / 2)
  const padW = mm2um(leadWidth)
  const padL = mm2um(leadLength)
  const ccDist = mm2um(leadPitch)

  const p055 = `P055 ${padL} ${padL} ${padL} ${padW} ${padW} ${padW} ${ccDist} ${Math.round(padW / 2)} ${padW} 0`
  return [
    { p051: `P051 GULLWING ${leadsLong} ${-tipX} ${ccHalfLong} 180000 NORMAL`, p054: 'P054 BRIGHT AUTO AUTO', p055 },
    { p051: `P051 GULLWING ${leadsShort} ${-ccHalfShort} ${-tipY} 90000 NORMAL`, p054: 'P054 BRIGHT AUTO AUTO', p055 },
    { p051: `P051 GULLWING ${leadsLong} ${tipX} ${-ccHalfLong} 0 NORMAL`, p054: 'P054 BRIGHT AUTO AUTO', p055 },
    { p051: `P051 GULLWING ${leadsShort} ${ccHalfShort} ${tipY} -90000 NORMAL`, p054: 'P054 BRIGHT AUTO AUTO', p055 },
  ]
}

function fourOnTwoLeadGroups(pkg: FourOnTwoPackage): LeadGroupLine[] {
  const { leadsPerGroup, widthOverLeads, leadPitch, leadWidth, leadLength, groupGap } = pkg.fourOnTwo
  const tip = mm2um(widthOverLeads / 2)
  const groupSpan = (leadsPerGroup - 1) * leadPitch
  const halfGap = groupGap / 2
  const upperGroupCenter = halfGap + groupSpan / 2
  const lowerGroupCenter = -(halfGap + groupSpan / 2)
  const padW = mm2um(leadWidth)
  const padL = mm2um(leadLength)
  const ccDist = mm2um(leadPitch)
  const ccHalf = mm2um(groupSpan / 2)

  const p055 = `P055 ${padL} ${padL} ${padL} ${padW} ${padW} ${padW} ${ccDist} ${Math.round(padW / 2)} ${padW} 0`

  // Left side upper group, left side lower group, right side lower group, right side upper group
  return [
    { p051: `P051 GULLWING ${leadsPerGroup} ${-tip} ${mm2um(upperGroupCenter)} 180000 NORMAL`, p054: 'P054 BRIGHT AUTO AUTO', p055 },
    { p051: `P051 GULLWING ${leadsPerGroup} ${-tip} ${mm2um(lowerGroupCenter)} 180000 NORMAL`, p054: 'P054 BRIGHT AUTO AUTO', p055 },
    { p051: `P051 GULLWING ${leadsPerGroup} ${tip} ${mm2um(lowerGroupCenter)} 0 NORMAL`, p054: 'P054 BRIGHT AUTO AUTO', p055 },
    { p051: `P051 GULLWING ${leadsPerGroup} ${tip} ${mm2um(upperGroupCenter)} 0 NORMAL`, p054: 'P054 BRIGHT AUTO AUTO', p055 },
  ]
}

function bgaLeadGroups(pkg: BgaPackage): LeadGroupLine[] {
  const { leadsPerRow, leadsPerColumn, leadPitch, leadDiameter, leadsPerRowInHole = 0, leadsPerColumnInHole = 0 } = pkg.bga
  const pitch = mm2um(leadPitch)
  const startX = mm2um(-((leadsPerRow - 1) * leadPitch) / 2)
  const topY = mm2um(((leadsPerColumn - 1) * leadPitch) / 2)
  const padR = mm2um(leadDiameter / 2)

  const lines: LeadGroupLine[] = []

  // Hole region
  const holeStartCol = Math.floor((leadsPerRow - leadsPerRowInHole) / 2)
  const holeEndCol = holeStartCol + leadsPerRowInHole
  const holeStartRow = Math.floor((leadsPerColumn - leadsPerColumnInHole) / 2)
  const holeEndRow = holeStartRow + leadsPerColumnInHole

  for (let row = 0; row < leadsPerColumn; row++) {
    // For BGA rows with holes, we need to split the row
    const rowY = topY - row * pitch
    let ballsInRow = leadsPerRow
    let rowStartX = startX

    if (leadsPerRowInHole > 0 && leadsPerColumnInHole > 0 && row >= holeStartRow && row < holeEndRow) {
      // Row has a hole — emit two sub-rows (left part + right part)
      if (holeStartCol > 0) {
        lines.push({
          p051: `P051 BGAB ${holeStartCol} ${rowStartX} ${rowY} 90000 NORMAL`,
          p054: 'P054 BRIGHT AUTO AUTO',
          p055: `P055 ${padR * 2} ${padR * 2} ${padR * 2} ${padR * 2} ${padR * 2} ${padR * 2} ${pitch} 0 0 0`,
        })
      }
      const rightCount = leadsPerRow - holeEndCol
      if (rightCount > 0) {
        const rightStartX = startX + holeEndCol * pitch
        lines.push({
          p051: `P051 BGAB ${rightCount} ${rightStartX} ${rowY} 90000 NORMAL`,
          p054: 'P054 BRIGHT AUTO AUTO',
          p055: `P055 ${padR * 2} ${padR * 2} ${padR * 2} ${padR * 2} ${padR * 2} ${padR * 2} ${pitch} 0 0 0`,
        })
      }
    } else {
      lines.push({
        p051: `P051 BGAB ${ballsInRow} ${rowStartX} ${rowY} 90000 NORMAL`,
        p054: 'P054 BRIGHT AUTO AUTO',
        p055: `P055 ${padR * 2} ${padR * 2} ${padR * 2} ${padR * 2} ${padR * 2} ${padR * 2} ${pitch} 0 0 0`,
      })
    }
  }

  return lines
}

function genericLeadGroups(pkg: TpsysGenericPackage): LeadGroupLine[] {
  return pkg.generic.leadGroups.map((g) => {
    const shape = g.shape
    const dist = mm2um(g.distFromCenter)
    const cc = mm2um(g.ccHalf)
    const padW = mm2um(g.padWidth)
    const padL = mm2um(g.padLength)
    const angle = g.angleMilliDeg

    // Estimate ccDist (pitch) from leads and ccHalf
    const ccDist = g.numLeads > 1 ? Math.round(2 * Math.abs(cc) / (g.numLeads - 1)) : 0

    return {
      p051: `P051 ${shape} ${g.numLeads} ${dist} ${cc} ${angle} NORMAL`,
      p054: 'P054 BRIGHT AUTO AUTO',
      p055: `P055 ${padW} ${padW} ${padW} ${padL} ${padL} ${padL} ${ccDist} ${padW} ${padW} 0`,
    }
  })
}

function outlineLeadGroups(_pkg: OutlinePackage): LeadGroupLine[] {
  return [
    {
      p051: 'P051 OUTLINE 0 0 0 180000 NORMAL',
      p054: 'P054 BRIGHT AUTO AUTO',
      p055: `P055 0 0 0 0 0 0 0 0 0 0`,
    },
  ]
}

function getLeadGroups(pkg: PackageDefinition): LeadGroupLine[] {
  switch (pkg.type) {
    case 'PT_TWO_POLE': return chipLeadGroups(pkg)
    case 'PT_THREE_POLE': return threePoleLeadGroups(pkg)
    case 'PT_TWO_SYM': return twoSymLeadGroups(pkg)
    case 'PT_FOUR_SYM': return fourSymLeadGroups(pkg)
    case 'PT_TWO_PLUS_TWO': return twoPlusTwoLeadGroups(pkg)
    case 'PT_FOUR_ON_TWO': return fourOnTwoLeadGroups(pkg)
    case 'PT_BGA': return bgaLeadGroups(pkg)
    case 'PT_GENERIC': return genericLeadGroups(pkg)
    case 'PT_OUTLINE': return outlineLeadGroups(pkg)
  }
}

// ── Machine settings serialization ──

function serializeP022(m: MachineSettings | undefined): string {
  const nozzle = m?.mountTools?.[0] ?? 'A23'
  const pickWait = m?.pickWaitTime ?? 100
  const placeWait = m?.placeWaitTime ?? 100
  const force = m?.zMountForce ?? 3500
  const flags = m?.flags ?? {}
  return `P022 ${nozzle} ${pickWait} ${placeWait} ${Math.round(force)} 0 0 0 0 ${flags.pickPositionFeedback ?? false} ${flags.holdDuringXMove ?? false} ${flags.vacuumTest ?? false}`
}

function serializeP03(m: MachineSettings | undefined): string {
  const a = m?.accelerations ?? {}
  const precision = m?.mountPrecision === 'high' ? 'true' : 'false'
  const hydraFP = m?.hydraFinePitch ?? false
  const param = m?.motionPicking?.downSpeed ?? 100
  const param2 = 0
  return `P03 ${precision} ${accStr(a.x)} ${accStr(a.y)} ${accStr(a.tape)} ${hydraFP} ${accStr(a.theta)} ${accStr(a.z)} ${accStr(a.hydraTheta)} ${param} ${param2} ${accStr(a.hydraZ)} true`
}

function serializeP032(m: MachineSettings | undefined): string[] {
  const lines = ['P032-1 AUTO']
  if (m?.hydraTools?.length) {
    for (const tool of m.hydraTools) {
      lines.push(`P032-2 ${tool}`)
    }
  }
  return lines
}

function serializeCentering(m: MachineSettings | undefined): string[] {
  const lines: string[] = []
  const phases = m?.centering ?? [{ method: 'optical' as const }]

  for (const phase of phases) {
    if (phase.method === 'optical') {
      lines.push('P061 OPTICAL')
      const tools = phase.tools ?? ['Z_TOOL']
      for (const tool of tools) {
        lines.push(`P064-O ${tool}`)
      }
      lines.push('P064-O2 AUTO 0 0 0')
      lines.push('P064-O5 AUTO AUTO 0 50 0')
    } else if (phase.method === 'mechanical') {
      lines.push('P061 MECHANICAL')
      const mech = phase.mechanical ?? { angle: 90000, position: 'POS_MIDDLE', force: 'MIDDLE_FORCE' }
      lines.push(`P062-M ${mech.angle} 0 ${mech.position} ${mech.force}`)
      if (phase.jaw) {
        const jaw = phase.jaw
        lines.push(`P063 ${mm2um(jaw.nominal)} ${mm2um(jaw.max)} ${mm2um(jaw.min)} 0`)
      }
    }
  }

  return lines
}

function serializeVision(m: MachineSettings | undefined): string[] {
  const lines: string[] = []
  lines.push(`P07 ${m?.coplanarityCheck ?? false}`)

  const modes = m?.visionModes ?? ['standard']
  for (const mode of modes) {
    lines.push(`P071 "${mode}"`)
  }
  lines.push('P073 "NONE"')
  return lines
}

function serializeGlue(m: MachineSettings | undefined): string[] {
  const lines: string[] = []
  const glue = m?.glue ?? { mode: 'NONE' }
  lines.push(`P08 ${glue.mode}`)
  lines.push(`P083 ${glue.matching ?? 'STANDARD'}`)
  if (glue.positions?.length) {
    for (const pos of glue.positions) {
      lines.push(`P084 ${mm2um(pos.x)} ${mm2um(pos.y)} ${pos.param1} ${pos.param2}`)
    }
  } else {
    lines.push('P084 0 0 5000 30')
  }
  return lines
}

function serializeMarking(m: MachineSettings | undefined): string[] {
  const lines: string[] = []
  const marks = m?.markingPositions ?? []
  for (const mark of marks) {
    lines.push(`P09 ${mm2um(mark.x)} ${mm2um(mark.y)} ${mark.dotType}`)
  }
  return lines
}

// ── Main serializer ──

/**
 * Convert a PackageDefinition into a TPSys-compliant .pck text record.
 *
 * @param pkg The package definition (extended schema with machine settings)
 * @returns Complete .pck record text (without trailing #)
 */
export function serializeToPck(pkg: PackageDefinition): string {
  const lines: string[] = []

  // P00 — Package name
  lines.push(`P00 ${pkg.name}`)

  // P000 — Package type
  lines.push(`P000 ${tpsysType(pkg)}`)

  // P01 — Body dimensions
  const bodyX = mm2um(pkg.body.width)
  const bodyY = mm2um(pkg.body.length)
  const searchX = pkg.searchArea ? mm2um(pkg.searchArea.x) : bodyX
  const searchY = pkg.searchArea ? mm2um(pkg.searchArea.y) : bodyY
  const h = pkg.height ?? { nominal: 0, max: 0, min: 0 }
  lines.push(`P01 ${bodyX} ${bodyY} ${searchX} ${searchY} ${mm2um(h.nominal)} ${mm2um(h.max)} ${mm2um(h.min)}`)

  // P011 — Center offset
  const co = pkg.centerOffset ?? { x: 0, y: 0 }
  lines.push(`P011 ${mm2um(co.x)} ${mm2um(co.y)}`)

  // P022 — Nozzle / mount tools
  lines.push(serializeP022(pkg.machine))

  // P03 — Accuracy
  lines.push(serializeP03(pkg.machine))

  // P032 — Head assignment
  for (const line of serializeP032(pkg.machine)) {
    lines.push(line)
  }

  // P04 — Pin numbering
  lines.push(pinNumbering(pkg))

  // P051 + P054 + P055 — Lead groups
  const leadGroups = getLeadGroups(pkg)
  for (const group of leadGroups) {
    lines.push(group.p051)
    lines.push(group.p054)
    lines.push(group.p055)
  }

  // P061 + P064 — Centering
  for (const line of serializeCentering(pkg.machine)) {
    lines.push(line)
  }

  // P07 + P071 + P073 — Vision
  for (const line of serializeVision(pkg.machine)) {
    lines.push(line)
  }

  // P08 + P083 + P084 — Glue
  for (const line of serializeGlue(pkg.machine)) {
    lines.push(line)
  }

  // P09 — Marking
  for (const line of serializeMarking(pkg.machine)) {
    lines.push(line)
  }

  return lines.join('\n')
}

/**
 * Serialize a package with all its variations as separate .pck records.
 * Each record is separated by a `#` line.
 *
 * @param pkg The base package definition
 * @returns Multi-record .pck text with variations
 */
export function serializeToPckWithVariations(pkg: PackageDefinition): string {
  const records: string[] = [serializeToPck(pkg)]

  if (pkg.variations?.length) {
    for (const variation of pkg.variations) {
      const varPkg = applyVariation(pkg, variation)
      records.push(serializeToPck(varPkg))
    }
  }

  return records.join('\n#\n')
}

/**
 * Apply a variation's overrides to a base package definition.
 */
function applyVariation(base: PackageDefinition, variation: PackageVariation): PackageDefinition {
  const merged = JSON.parse(JSON.stringify(base)) as PackageDefinition
  // Rename with variation suffix
  merged.name = `${base.name}-${variation.id}`
  // Apply height override
  if (variation.height) {
    merged.height = variation.height
  }
  // Apply machine overrides
  if (variation.machine) {
    merged.machine = { ...(merged.machine ?? {}), ...variation.machine }
  }
  return merged
}
