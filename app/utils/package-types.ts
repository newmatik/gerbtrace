/**
 * Package type definitions and geometry computation.
 *
 * Each package type (Chip, ThreePole, TwoSymmetric, FourSymmetric, BGA, Outline)
 * defines its lead/pad geometry parameters. The `computeFootprint()` function converts
 * any PackageDefinition into a normalised list of shapes (rectangles, circles, rounded rects)
 * centered at (0, 0) in mm, ready for rotation and rendering.
 *
 * ── Coordinate system ──
 *
 *   +X = right,  −X = left
 *   +Y = up,     −Y = down
 *   Component center is at (0, 0).
 *
 * Rotation is applied externally by the renderer. Note that **PnP rotation sign**
 * depends on the selected PnP convention (CW-positive vs CCW-positive).
 * We normalise direction + offset via `app/utils/pnp-conventions.ts`.
 *
 * ── Package convention ──
 *
 * ALL packages are defined in **Mycronic / TPSys** convention.
 *
 * **Authoritative baseline (from MYCenter screenshots):**
 * - **Chip (two-terminal)** at 0°: body vertical (length along +Y), pad/terminal 1 at TOP.
 * - **Multi-pin** at 0°: pin 1 / A1 at UPPER-LEFT (−X, +Y).
 *
 * The PnP convention selector converts FROM the customer's PnP file convention
 * (IPC / IEC / Mycronic) TO this Mycronic/TPSys baseline for display only.
 *
 * Important: different PnP sources use different rotation directions.
 * - IPC / IEC exports are typically **CCW-positive**
 * - Mycronic/TPSys PnP files are **CW-positive** (confirmed)
 *
 * See public/packages/README.md for the authoritative orientation guide.
 * See public/packages/TPSYS-FORMAT.md for complete pck.pck format documentation.
 */

import { PNP_CONVENTIONS, type PnPConvention } from '~/utils/pnp-conventions'

// ── PnP Convention / Standard ──

/**
 * The orientation standard used by the PnP file (provided by the customer).
 *
 * Our package footprints are ALL defined in Mycronic/TPSys convention.
 * The renderer converts from the PnP standard to our baseline using
 * `getConventionRotationOffset()`.
 *
 * The SAME offset applies to ALL package types (including Chip):
 *   Mycronic:    0° — our baseline, no conversion needed
 *   IPC-7351:    +270° (≡ −90°) — Mycronic 0° = IPC 90° CCW
 *   IEC 61188-7: +90°           — Mycronic 0° = IEC 270° CCW
 */
/**
 * Rotation transform to map a PnP file's rotation values into our baseline.
 *
 * We treat the PnP file's rotation as either CCW-positive or CW-positive depending
 * on convention, then apply an offset so that 0° in that convention matches our
 * Mycronic/TPSys package 0° baseline.
 *
 * Output is in **degrees CCW** (top view), suitable for renderer math:
 *   rotationCCW = direction * pnpRotation + offsetDeg
 *
 * Where:
 * - direction = +1 for CCW-positive inputs (IPC/IEC)
 * - direction = -1 for CW-positive inputs (Mycronic)
 *
 * Offsets (to baseline), derived from authoritative MYCenter orientation:
 * - Multi-pin packages: Mycronic ≈ IPC baseline (pin 1 upper-left)
 * - Chip is special: Mycronic 0° has pad1 TOP, IPC 0° has pad1 LEFT
 * - IEC differs mainly by pin-1 corner (multi-pin) and two-terminal polarity
 */
export interface PnPRotationTransform {
  /** +1 if PnP angles are CCW-positive, -1 if CW-positive */
  direction: 1 | -1
  /** Degrees CCW to add after direction normalization */
  offsetDeg: number
}

export function getConventionRotationTransform(
  pkg: PackageDefinition,
  convention: PnPConvention,
): PnPRotationTransform {
  const cfg = PNP_CONVENTIONS[convention]
  const direction: 1 | -1 = cfg.rotationPositive === 'ccw' ? 1 : -1
  const offsetDeg = cfg.offsetDegByType[pkg.type] ?? 0
  return { direction, offsetDeg }
}

// ── Shape primitives (all coords in mm, centered at component origin) ──

export interface RectShape {
  kind: 'rect'
  cx: number
  cy: number
  w: number
  h: number
  role: 'body' | 'pad' | 'pin1'
}

export interface CircleShape {
  kind: 'circle'
  cx: number
  cy: number
  r: number
  role: 'body' | 'pad' | 'pin1'
}

export interface RoundedRectShape {
  kind: 'roundedRect'
  cx: number
  cy: number
  w: number
  h: number
  r: number
  role: 'body' | 'pad'
}

export type FootprintShape = RectShape | CircleShape | RoundedRectShape

// ── Package type parameter interfaces ──

export interface ChipParams {
  /** Distance between outer edges of terminals, measured along Y at Mycronic/TPSys 0° */
  chipLength: number
  /** Width of each terminal (X extent at 0°) */
  leadWidth: number
  /** Length of each terminal (Y extent at 0°) */
  leadLength: number
}

export interface ThreePoleParams {
  /** Total span tip-to-tip across all leads, measured along X at 0° */
  widthOverLeads: number
  /** Center-to-center distance between the two leads on the same side, measured along Y at 0° */
  ccDistance: number
  /** Width of each lead (Y extent at 0°) */
  leadWidth: number
  /** Length of each lead (X extent at 0°) */
  leadLength: number
}

export interface TwoSymmetricParams {
  /** Total number of leads (must be even, split equally left/right) */
  numberOfLeads: number
  /** Total span tip-to-tip across both lead rows, measured along X at 0° */
  widthOverLeads: number
  /** Center-to-center distance between adjacent leads on the same side, measured along Y at 0° */
  leadPitch: number
  /** Width of each lead (Y extent at 0°) */
  leadWidth: number
  /** Length of each lead (X extent at 0°) */
  leadLength: number
}

export interface FourSymmetricParams {
  /** Total number of leads (must be multiple of 4, split equally across all 4 sides) */
  numberOfLeads: number
  /** Total span tip-to-tip (same for both axes since the package is symmetric) */
  widthOverLeads: number
  /** Center-to-center distance between adjacent leads on any side */
  leadPitch: number
  /** Width of each lead (perpendicular to lead protrusion direction) */
  leadWidth: number
  /** Length of each lead (in protrusion direction) */
  leadLength: number
}

export interface BgaParams {
  /** Number of columns (leads per row along X) */
  leadsPerRow: number
  /** Number of rows (leads per column along Y) */
  leadsPerColumn: number
  /** Center-to-center ball pitch (same in X and Y) */
  leadPitch: number
  /** Diameter of each ball pad */
  leadDiameter: number
  /** Columns removed from center (hole) — 0 for full grid */
  leadsPerRowInHole?: number
  /** Rows removed from center (hole) — 0 for full grid */
  leadsPerColumnInHole?: number
}

export interface OutlineParams {
  /** Total length (Y extent at 0°) */
  length: number
  /** Total width (X extent at 0°) */
  width: number
}

/**
 * TPSys PT_GENERIC lead group definition (in mm / millidegrees).
 * This is used to render packages that can't be expressed by the simplified
 * parametric schemas above (e.g. SOT-223: 3 leads + tab).
 */
export interface TpsysGenericLeadGroup {
  /** Lead shape from TPSys P051 (we currently render gullwing-like as rectangles) */
  shape: 'GULLWING' | 'FLAT' | 'J_LEAD'
  /** Number of leads in this group */
  numLeads: number
  /** Distance from component center to the lead row center (signed), in mm */
  distFromCenter: number
  /** Half-span across the leads in this group (signed), in mm */
  ccHalf: number
  /** Group angle in TPSys millidegrees (0/90000/180000/-90000) */
  angleMilliDeg: number
  /** Pad length in protrusion direction (TPSys P055 padW), in mm */
  padLength: number
  /** Pad width along pitch direction (TPSys P055 padL), in mm */
  padWidth: number
}

export interface TpsysGenericParams {
  leadGroups: TpsysGenericLeadGroup[]
}

// ── Package definition (the JSON schema) ──

export interface PackageBody {
  /** Body length (long dimension) — Y extent at Mycronic/TPSys 0° */
  length: number
  /** Body width (short dimension) — X extent at Mycronic/TPSys 0° */
  width: number
}

interface PackageBase {
  name: string
  aliases?: string[]
  body: PackageBody
}

export interface ChipPackage extends PackageBase { type: 'Chip'; chip: ChipParams }
export interface ThreePolePackage extends PackageBase { type: 'ThreePole'; threePole: ThreePoleParams }
export interface TwoSymmetricPackage extends PackageBase { type: 'TwoSymmetricLeadGroups'; twoSymmetric: TwoSymmetricParams }
export interface FourSymmetricPackage extends PackageBase { type: 'FourSymmetricLeadGroups'; fourSymmetric: FourSymmetricParams }
export interface BgaPackage extends PackageBase { type: 'BGA'; bga: BgaParams }
export interface OutlinePackage extends PackageBase { type: 'Outline'; outline: OutlineParams }
export interface TpsysGenericPackage extends PackageBase { type: 'PT_GENERIC'; generic: TpsysGenericParams }

export type PackageDefinition =
  | ChipPackage
  | ThreePolePackage
  | TwoSymmetricPackage
  | FourSymmetricPackage
  | BgaPackage
  | OutlinePackage
  | TpsysGenericPackage

// ── Geometry computation ──

/**
 * Compute the footprint shapes for a package, centered at (0, 0).
 * All coordinates in mm. The caller applies rotation + translation.
 */
export function computeFootprint(pkg: PackageDefinition): FootprintShape[] {
  switch (pkg.type) {
    case 'Chip': return computeChip(pkg)
    case 'ThreePole': return computeThreePole(pkg)
    case 'TwoSymmetricLeadGroups': return computeTwoSymmetric(pkg)
    case 'FourSymmetricLeadGroups': return computeFourSymmetric(pkg)
    case 'BGA': return computeBga(pkg)
    case 'Outline': return computeOutline(pkg)
    case 'PT_GENERIC': return computeTpsysGeneric(pkg)
  }
}

// ── Chip: 2 pads top/bottom, body in center (Mycronic/TPSys 0°) ──
// 0°: body vertical (length along Y), pad 1 at TOP (+Y), pad 2 at BOTTOM (−Y).

function computeChip(pkg: ChipPackage): FootprintShape[] {
  const { chipLength, leadWidth, leadLength } = pkg.chip
  const { length: bodyL, width: bodyW } = pkg.body
  const shapes: FootprintShape[] = []

  // Body — centered at origin, width along X, length along Y
  shapes.push({ kind: 'rect', cx: 0, cy: 0, w: bodyW, h: bodyL, role: 'body' })

  // Pads: pad 1 at +Y (top), pad 2 at -Y (bottom)
  const padCy = chipLength / 2 - leadLength / 2
  shapes.push({ kind: 'rect', cx: 0, cy: padCy, w: leadWidth, h: leadLength, role: 'pin1' })
  shapes.push({ kind: 'rect', cx: 0, cy: -padCy, w: leadWidth, h: leadLength, role: 'pad' })

  return shapes
}

// ── ThreePole: 2 leads on one side, 1 on opposite (SOT-23 style) ──
// Internal: computed at IPC 0° then post-rotated 90° CCW → Mycronic 0°.
// IPC 0°: body.width along X, body.length along Y. Leads 1,2 at −X, lead 3 at +X.
// After toMycronic(): body becomes horizontal, leads at ±Y.

function computeThreePole(pkg: ThreePolePackage): FootprintShape[] {
  const { widthOverLeads, ccDistance, leadWidth, leadLength } = pkg.threePole
  const { length: bodyL, width: bodyW } = pkg.body
  const shapes: FootprintShape[] = []

  // Body — centered at origin, width along X, length along Y
  shapes.push({ kind: 'rect', cx: 0, cy: 0, w: bodyW, h: bodyL, role: 'body' })

  // Lead tip X position (from center)
  const tipX = widthOverLeads / 2
  const halfCC = ccDistance / 2
  const leadCx = -(tipX - leadLength / 2)

  // Left side: lead 1 at upper-left (+Y), lead 2 at lower-left (−Y)
  shapes.push({ kind: 'rect', cx: leadCx, cy: halfCC, w: leadLength, h: leadWidth, role: 'pin1' })
  shapes.push({ kind: 'rect', cx: leadCx, cy: -halfCC, w: leadLength, h: leadWidth, role: 'pad' })

  // Right side: lead 3 centered
  shapes.push({ kind: 'rect', cx: tipX - leadLength / 2, cy: 0, w: leadLength, h: leadWidth, role: 'pad' })

  return shapes
}

// ── TwoSymmetricLeadGroups: leads on 2 opposite sides (SO, SSOP, MSOP) ──
// Internal: computed at IPC 0° then post-rotated 90° CCW → Mycronic 0°.
// IPC 0°: body.width along X, body.length along Y. Leads on ±X sides.
// After toMycronic(): body becomes horizontal, leads at ±Y.

function computeTwoSymmetric(pkg: TwoSymmetricPackage): FootprintShape[] {
  const { numberOfLeads, widthOverLeads, leadPitch, leadWidth, leadLength } = pkg.twoSymmetric
  const { length: bodyL, width: bodyW } = pkg.body
  const shapes: FootprintShape[] = []

  // Body — centered at origin, width along X, length along Y
  shapes.push({ kind: 'rect', cx: 0, cy: 0, w: bodyW, h: bodyL, role: 'body' })

  const leadsPerSide = numberOfLeads / 2
  const tipX = widthOverLeads / 2

  // Lead positions along Y — pin 1 at top (+Y), going downward
  const totalSpan = (leadsPerSide - 1) * leadPitch
  const topY = totalSpan / 2

  for (let i = 0; i < leadsPerSide; i++) {
    const y = topY - i * leadPitch
    // Left side (−X): pins 1…N/2, top to bottom
    shapes.push({
      kind: 'rect',
      cx: -(tipX - leadLength / 2),
      cy: y,
      w: leadLength,
      h: leadWidth,
      role: i === 0 ? 'pin1' : 'pad',
    })
    // Right side (+X): pins N/2+1…N, bottom to top (mirrored numbering)
    shapes.push({ kind: 'rect', cx: tipX - leadLength / 2, cy: -y, w: leadLength, h: leadWidth, role: 'pad' })
  }

  return shapes
}

// ── FourSymmetricLeadGroups: leads on all 4 sides (QFP, QFN) ──
// Internal: computed at IPC 0° then post-rotated 90° CCW → Mycronic 0°.
// IPC 0°: body.width along X, body.length along Y. Leads on all 4 sides.
// After toMycronic(): body and leads rotated 90° CCW.

function computeFourSymmetric(pkg: FourSymmetricPackage): FootprintShape[] {
  const { numberOfLeads, widthOverLeads, leadPitch, leadWidth, leadLength } = pkg.fourSymmetric
  const { length: bodyL, width: bodyW } = pkg.body
  const shapes: FootprintShape[] = []

  // Body — centered at origin, width along X, length along Y
  shapes.push({ kind: 'rect', cx: 0, cy: 0, w: bodyW, h: bodyL, role: 'body' })

  const leadsPerSide = numberOfLeads / 4
  const tipOffset = widthOverLeads / 2
  const totalSpan = (leadsPerSide - 1) * leadPitch
  const topPos = totalSpan / 2

  for (let i = 0; i < leadsPerSide; i++) {
    const pos = topPos - i * leadPitch  // top to bottom for left side
    // Left side (−X): pins top → bottom
    shapes.push({
      kind: 'rect',
      cx: -(tipOffset - leadLength / 2),
      cy: pos,
      w: leadLength,
      h: leadWidth,
      role: i === 0 ? 'pin1' : 'pad',
    })
    // Right side (+X): pins bottom → top
    shapes.push({ kind: 'rect', cx: tipOffset - leadLength / 2, cy: -pos, w: leadLength, h: leadWidth, role: 'pad' })
    // Bottom side (−Y): pins left → right
    shapes.push({ kind: 'rect', cx: -pos, cy: -(tipOffset - leadLength / 2), w: leadWidth, h: leadLength, role: 'pad' })
    // Top side (+Y): pins right → left
    shapes.push({ kind: 'rect', cx: pos, cy: tipOffset - leadLength / 2, w: leadWidth, h: leadLength, role: 'pad' })
  }

  return shapes
}

// ── BGA: ball grid array ──
// Internal: computed at IPC 0° then post-rotated 90° CCW → Mycronic 0°.
// IPC 0°: body.width along X, body.length along Y. Pin A1 at upper-left.
// After toMycronic(): grid and A1 marker rotated 90° CCW.

function computeBga(pkg: BgaPackage): FootprintShape[] {
  const { leadsPerRow, leadsPerColumn, leadPitch, leadDiameter, leadsPerRowInHole = 0, leadsPerColumnInHole = 0 } = pkg.bga
  const { length: bodyL, width: bodyW } = pkg.body
  const shapes: FootprintShape[] = []

  // Body — centered at origin, width along X, length along Y
  shapes.push({ kind: 'rect', cx: 0, cy: 0, w: bodyW, h: bodyL, role: 'body' })

  const r = leadDiameter / 2
  // Grid origin: column 1 at left (−X), row A at top (+Y)
  const startX = -((leadsPerRow - 1) * leadPitch) / 2
  const topY = ((leadsPerColumn - 1) * leadPitch) / 2

  // Hole region (centered)
  const holeStartCol = Math.floor((leadsPerRow - leadsPerRowInHole) / 2)
  const holeEndCol = holeStartCol + leadsPerRowInHole
  const holeStartRow = Math.floor((leadsPerColumn - leadsPerColumnInHole) / 2)
  const holeEndRow = holeStartRow + leadsPerColumnInHole

  for (let row = 0; row < leadsPerColumn; row++) {
    for (let col = 0; col < leadsPerRow; col++) {
      // Skip the hole
      if (leadsPerRowInHole > 0 && leadsPerColumnInHole > 0) {
        if (col >= holeStartCol && col < holeEndCol && row >= holeStartRow && row < holeEndRow) {
          continue
        }
      }
      const cx = startX + col * leadPitch
      const cy = topY - row * leadPitch  // row 0 (A) at top, increasing downward
      shapes.push({ kind: 'circle', cx, cy, r, role: row === 0 && col === 0 ? 'pin1' : 'pad' })
    }
  }

  return shapes
}

// ── Outline: body only, no leads ──
// At 0°: outline.width along X, outline.length along Y.
// Used for generic packages with no defined lead geometry.

function computeOutline(pkg: OutlinePackage): FootprintShape[] {
  const { length, width } = pkg.outline
  return [
    { kind: 'rect', cx: 0, cy: 0, w: width, h: length, role: 'body' },
  ]
}

// ── TPSys PT_GENERIC: render from lead groups ──
// This follows TPSys semantics (P051 + P055) as stored in `pkg.generic.leadGroups`.
function computeTpsysGeneric(pkg: TpsysGenericPackage): FootprintShape[] {
  const shapes: FootprintShape[] = []
  const { length: bodyL, width: bodyW } = pkg.body
  shapes.push({ kind: 'rect', cx: 0, cy: 0, w: bodyW, h: bodyL, role: 'body' })

  const groups = pkg.generic.leadGroups ?? []
  if (!Array.isArray(groups) || groups.length === 0) return shapes

  const normAngle = (md: number) => {
    const a = ((md % 360000) + 360000) % 360000
    // normalize -90000 → 270000
    return a
  }

  // Generate pads per group. We mark the first pad we emit as pin1 for visibility.
  let emittedAny = false
  for (const g of groups) {
    if (!g || !Number.isFinite(g.numLeads) || g.numLeads <= 0) continue
    const n = Math.round(g.numLeads)
    const a = normAngle(g.angleMilliDeg)

    const padL = g.padLength
    const padW = g.padWidth
    if (![padL, padW, g.distFromCenter, g.ccHalf].every(Number.isFinite)) continue

    const axisHalf = Math.abs(g.ccHalf)
    const positions: number[] = []
    if (n === 1) {
      positions.push(0)
    } else {
      const pitch = (2 * axisHalf) / (n - 1)
      for (let i = 0; i < n; i++) {
        positions.push(axisHalf - i * pitch)
      }
    }

    const protrudeX = a === 0 || a === 180000
    const protrudeY = a === 90000 || a === 270000
    if (!(protrudeX || protrudeY)) continue

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]!
      const role: RectShape['role'] = !emittedAny ? 'pin1' : 'pad'
      emittedAny = true

      if (protrudeX) {
        // Leads on left/right → row center is at X = distFromCenter, spread in Y
        shapes.push({ kind: 'rect', cx: g.distFromCenter, cy: p, w: padL, h: padW, role })
      } else {
        // Leads on top/bottom → row center is at Y = distFromCenter, spread in X
        shapes.push({ kind: 'rect', cx: p, cy: g.distFromCenter, w: padW, h: padL, role })
      }
    }
  }

  return shapes
}
