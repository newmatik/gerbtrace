/**
 * Package type definitions and geometry computation.
 *
 * Each package type uses the TPSys technical name (PT_TWO_POLE, PT_THREE_POLE, PT_TWO_SYM,
 * PT_FOUR_SYM, PT_TWO_PLUS_TWO, PT_FOUR_ON_TWO, PT_BGA, PT_OUTLINE, PT_GENERIC).
 * The `computeFootprint()` function converts
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

// ── Machine settings interfaces (MYCenter tabs) ──

export type AccLevel = 'lowest' | 'low' | 'high' | 'highest'

export interface MachineFlags {
  pickPositionFeedback?: boolean
  holdDuringXMove?: boolean
  vacuumTest?: boolean
  hydraHoverPick?: boolean
  hydraExtensiveReject?: boolean
}

export interface CenteringPhase {
  method: 'optical' | 'mechanical' | 'dip'
  // --- Optical phase fields (P064-O) ---
  tools?: string[]
  coarseSearchMethod?: string
  usableCameras?: string[]
  presentationAngle?: string
  unusableCameras?: string[]
  illumination?: {
    zIllumination?: string
    darkField?: number
    ambientLight?: number
    frontLight?: number
  }
  // --- Mechanical phase fields (P062-M + P063) ---
  mechanical?: {
    angle: number
    position: string
    force: string
  }
  jaw?: { nominal: number; max: number; min: number }
  // --- Dip phase fields ---
  dip?: {
    cavityId?: string
    angle?: number
  }
}

export interface GlueConfig {
  mode: string
  matching?: string
  positions?: Array<{ x: number; y: number; param1: number; param2: number }>
}

export interface MarkingPosition {
  x: number
  y: number
  dotType: string
}

export interface MachineSettings {
  // --- General tab fields (P022 + P032) ---
  mountTools?: string[]
  hydraTools?: string[]
  toolTopOffset?: number
  pickWaitTime?: number
  placeWaitTime?: number
  zMountForce?: number
  zMountForceLow?: boolean
  flags?: MachineFlags

  // --- Accelerations tab fields (P03) ---
  mountPrecision?: 'low' | 'normal' | 'high'
  hydraFinePitch?: boolean
  accelerations?: {
    x?: AccLevel
    y?: AccLevel
    tape?: AccLevel
    theta?: AccLevel
    z?: AccLevel
    hydraTheta?: AccLevel
    hydraZ?: AccLevel
  }
  motionPicking?: { downSpeed?: number; downSpeedAuto?: boolean }
  motionPlacing?: {
    upDistance?: number
    upSpeed?: number
    downSpeed?: number
    downSpeedAuto?: boolean
  }

  // --- Index marks tab fields ---
  indexMark?: {
    type?: string
    offset?: { x: number; y: number }
    size?: number
    minCorrelation?: number
  }

  // --- Centering phases tab fields (P061 + P062-M + P063 + P064-O) ---
  centering?: CenteringPhase[]

  // --- Glue dots tab fields (P08/P083/P084 + P09) ---
  glue?: GlueConfig
  markingPositions?: MarkingPosition[]

  // --- Vision fields (shown in centering tab) ---
  visionLighting?: { brightness: string; modes: string[] }
  visionModes?: string[]
  coplanarityCheck?: boolean
}

export interface PackageVariation {
  id: string
  label?: string
  height?: { nominal: number; min: number; max: number }
  machine?: Partial<MachineSettings>
}

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

/**
 * PT_TWO_PLUS_TWO: asymmetric quad — different lead counts on long vs short sides.
 * TPSys manual section 6.6.7.
 */
export interface TwoPlusTwoParams {
  /** Leads per long side (left/right) */
  leadsLong: number
  /** Leads per short side (top/bottom) */
  leadsShort: number
  /** Tip-to-tip span across left-right sides */
  widthOverLeadsX: number
  /** Tip-to-tip span across top-bottom sides */
  widthOverLeadsY: number
  leadPitch: number
  leadWidth: number
  leadLength: number
}

/**
 * PT_FOUR_ON_TWO: 4 lead groups arranged on 2 sides with a gap between groups.
 * TPSys manual section 6.6.8.
 */
export interface FourOnTwoParams {
  /** Leads per group (4 groups total, 2 per side) */
  leadsPerGroup: number
  /** Tip-to-tip span across left-right sides */
  widthOverLeads: number
  leadPitch: number
  leadWidth: number
  leadLength: number
  /** C-C distance between last lead of group 1 and first of group 2 on same side */
  groupGap: number
}

// ── Package definition (the JSON schema) ──

export interface PackageBody {
  /** Body length (long dimension) — Y extent at Mycronic/TPSys 0° */
  length: number
  /** Body width (short dimension) — X extent at Mycronic/TPSys 0° */
  width: number
}

export interface PackageBase {
  name: string
  aliases?: string[]
  body: PackageBody
  provenance?: {
    owner?: string
    sourceLibrary?: string
    sourceType?: string
    sourceFile?: string
    sourceFootprint?: string
  }

  // Physical properties (from P01, P011)
  height?: { nominal: number; min: number; max: number }
  searchArea?: { x: number; y: number }
  centerOffset?: { x: number; y: number }

  // Machine settings
  machine?: MachineSettings

  // Variations (height / centering overrides)
  variations?: PackageVariation[]
}

export interface ChipPackage extends PackageBase { type: 'PT_TWO_POLE'; chip: ChipParams }
export interface ThreePolePackage extends PackageBase { type: 'PT_THREE_POLE'; threePole: ThreePoleParams }
export interface TwoSymmetricPackage extends PackageBase { type: 'PT_TWO_SYM'; twoSymmetric: TwoSymmetricParams }
export interface FourSymmetricPackage extends PackageBase { type: 'PT_FOUR_SYM'; fourSymmetric: FourSymmetricParams }
export interface TwoPlusTwoPackage extends PackageBase { type: 'PT_TWO_PLUS_TWO'; twoPlusTwo: TwoPlusTwoParams }
export interface FourOnTwoPackage extends PackageBase { type: 'PT_FOUR_ON_TWO'; fourOnTwo: FourOnTwoParams }
export interface BgaPackage extends PackageBase { type: 'PT_BGA'; bga: BgaParams }
export interface OutlinePackage extends PackageBase { type: 'PT_OUTLINE'; outline: OutlineParams }
export interface TpsysGenericPackage extends PackageBase { type: 'PT_GENERIC'; generic: TpsysGenericParams }

export type PackageDefinition =
  | ChipPackage
  | ThreePolePackage
  | TwoSymmetricPackage
  | FourSymmetricPackage
  | TwoPlusTwoPackage
  | FourOnTwoPackage
  | BgaPackage
  | OutlinePackage
  | TpsysGenericPackage

/** All valid package type discriminator values. */
export const PACKAGE_TYPES = [
  'PT_TWO_POLE',
  'PT_THREE_POLE',
  'PT_TWO_SYM',
  'PT_FOUR_SYM',
  'PT_TWO_PLUS_TWO',
  'PT_FOUR_ON_TWO',
  'PT_BGA',
  'PT_OUTLINE',
  'PT_GENERIC',
] as const

const LEGACY_TYPE_MAP: Record<string, PackageDefinition['type']> = {
  Chip: 'PT_TWO_POLE',
  ThreePole: 'PT_THREE_POLE',
  TwoSymmetricLeadGroups: 'PT_TWO_SYM',
  FourSymmetricLeadGroups: 'PT_FOUR_SYM',
  TwoPlusTwo: 'PT_TWO_PLUS_TWO',
  FourOnTwo: 'PT_FOUR_ON_TWO',
  BGA: 'PT_BGA',
  Outline: 'PT_OUTLINE',
}

/**
 * Normalize a package definition that may use legacy type discriminators
 * (e.g. 'Chip' instead of 'PT_TWO_POLE') from older stored records.
 */
export function normalizePackageType(pkg: Record<string, any>): Record<string, any> {
  const mapped = LEGACY_TYPE_MAP[pkg.type]
  if (mapped) return { ...pkg, type: mapped }
  return pkg
}

/**
 * Authoritative human-readable labels for each TPSys package type.
 * Use this everywhere in the UI instead of ad-hoc label maps.
 */
export const PACKAGE_TYPE_LABELS: Record<PackageDefinition['type'], string> = {
  PT_TWO_POLE: 'Chip (2-pole)',
  PT_THREE_POLE: 'SOT (3-pole)',
  PT_TWO_SYM: 'SOIC / SSOP (2-sym)',
  PT_FOUR_SYM: 'QFP / QFN (4-sym)',
  PT_TWO_PLUS_TWO: 'Asymmetric Quad (2+2)',
  PT_FOUR_ON_TWO: '4-on-2',
  PT_BGA: 'BGA',
  PT_OUTLINE: 'Outline',
  PT_GENERIC: 'Generic',
}

// ── Geometry computation ──

/**
 * Compute the footprint shapes for a package, centered at (0, 0).
 * All coordinates in mm. The caller applies rotation + translation.
 */
export function computeFootprint(pkg: PackageDefinition): FootprintShape[] {
  const fallback = bodyOnlyFootprint(pkg as unknown as Partial<PackageBase>)
  switch (pkg.type) {
    case 'PT_TWO_POLE':
      if (!hasFiniteNumbers((pkg as any)?.chip?.chipLength, (pkg as any)?.chip?.leadWidth, (pkg as any)?.chip?.leadLength)) return fallback
      return computeChip(pkg)
    case 'PT_THREE_POLE':
      if (!hasFiniteNumbers((pkg as any)?.threePole?.widthOverLeads, (pkg as any)?.threePole?.ccDistance, (pkg as any)?.threePole?.leadWidth, (pkg as any)?.threePole?.leadLength)) return fallback
      return computeThreePole(pkg)
    case 'PT_TWO_SYM':
      if (!hasFiniteNumbers((pkg as any)?.twoSymmetric?.numberOfLeads, (pkg as any)?.twoSymmetric?.widthOverLeads, (pkg as any)?.twoSymmetric?.leadPitch, (pkg as any)?.twoSymmetric?.leadWidth, (pkg as any)?.twoSymmetric?.leadLength)) return fallback
      return computeTwoSymmetric(pkg)
    case 'PT_FOUR_SYM':
      if (!hasFiniteNumbers((pkg as any)?.fourSymmetric?.numberOfLeads, (pkg as any)?.fourSymmetric?.widthOverLeads, (pkg as any)?.fourSymmetric?.leadPitch, (pkg as any)?.fourSymmetric?.leadWidth, (pkg as any)?.fourSymmetric?.leadLength)) return fallback
      return computeFourSymmetric(pkg)
    case 'PT_TWO_PLUS_TWO':
      if (!hasFiniteNumbers((pkg as any)?.twoPlusTwo?.leadsLong, (pkg as any)?.twoPlusTwo?.leadsShort, (pkg as any)?.twoPlusTwo?.widthOverLeadsX, (pkg as any)?.twoPlusTwo?.widthOverLeadsY, (pkg as any)?.twoPlusTwo?.leadPitch, (pkg as any)?.twoPlusTwo?.leadWidth, (pkg as any)?.twoPlusTwo?.leadLength)) return fallback
      return computeTwoPlusTwo(pkg)
    case 'PT_FOUR_ON_TWO':
      if (!hasFiniteNumbers((pkg as any)?.fourOnTwo?.leadsPerGroup, (pkg as any)?.fourOnTwo?.widthOverLeads, (pkg as any)?.fourOnTwo?.leadPitch, (pkg as any)?.fourOnTwo?.leadWidth, (pkg as any)?.fourOnTwo?.leadLength, (pkg as any)?.fourOnTwo?.groupGap)) return fallback
      return computeFourOnTwo(pkg)
    case 'PT_BGA':
      if (!hasFiniteNumbers((pkg as any)?.bga?.leadsPerRow, (pkg as any)?.bga?.leadsPerColumn, (pkg as any)?.bga?.leadPitch, (pkg as any)?.bga?.leadDiameter)) return fallback
      return computeBga(pkg)
    case 'PT_OUTLINE':
      if (!hasFiniteNumbers((pkg as any)?.outline?.length, (pkg as any)?.outline?.width)) return fallback
      return computeOutline(pkg)
    case 'PT_GENERIC':
      if (!(pkg as any)?.generic?.leadGroups) return fallback
      return computeTpsysGeneric(pkg)
  }
}

function hasFiniteNumbers(...vals: unknown[]): boolean {
  return vals.every(v => Number.isFinite(v))
}

function bodyOnlyFootprint(pkg: Partial<PackageBase>): FootprintShape[] {
  const bodyL = pkg?.body?.length
  const bodyW = pkg?.body?.width
  if (!hasFiniteNumbers(bodyL, bodyW)) return []
  return [{ kind: 'rect', cx: 0, cy: 0, w: bodyW!, h: bodyL!, role: 'body' }]
}

// ── Chip: 2 pads top/bottom, body in center (Mycronic/TPSys 0°) ──
// 0°: body vertical (length along Y), pad 1 at TOP (+Y), pad 2 at BOTTOM (−Y).

function computeChip(pkg: ChipPackage): FootprintShape[] {
  const { chipLength, leadWidth, leadLength } = pkg.chip
  const { length: bodyL, width: bodyW } = pkg.body ?? { length: 0, width: 0 }
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
  const { length: bodyL, width: bodyW } = pkg.body ?? { length: 0, width: 0 }
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
  const { length: bodyL, width: bodyW } = pkg.body ?? { length: 0, width: 0 }
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
  const { length: bodyL, width: bodyW } = pkg.body ?? { length: 0, width: 0 }
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

// ── TwoPlusTwo: asymmetric quad — different lead counts on long vs short sides ──
// Left/right sides have leadsLong leads, top/bottom have leadsShort leads.
// Pin 1 at upper-left, numbering goes CCW (left-bottom-right-top).

function computeTwoPlusTwo(pkg: TwoPlusTwoPackage): FootprintShape[] {
  const { leadsLong, leadsShort, widthOverLeadsX, widthOverLeadsY, leadPitch, leadWidth, leadLength } = pkg.twoPlusTwo
  const { length: bodyL, width: bodyW } = pkg.body ?? { length: 0, width: 0 }
  const shapes: FootprintShape[] = []

  shapes.push({ kind: 'rect', cx: 0, cy: 0, w: bodyW, h: bodyL, role: 'body' })

  const tipX = widthOverLeadsX / 2
  const tipY = widthOverLeadsY / 2

  // Left side leads (leadsLong count, along Y)
  const spanLong = (leadsLong - 1) * leadPitch
  const topLong = spanLong / 2
  for (let i = 0; i < leadsLong; i++) {
    const y = topLong - i * leadPitch
    shapes.push({
      kind: 'rect',
      cx: -(tipX - leadLength / 2),
      cy: y,
      w: leadLength,
      h: leadWidth,
      role: i === 0 ? 'pin1' : 'pad',
    })
  }

  // Bottom side leads (leadsShort count, along X)
  const spanShort = (leadsShort - 1) * leadPitch
  const leftShort = -spanShort / 2
  for (let i = 0; i < leadsShort; i++) {
    const x = leftShort + i * leadPitch
    shapes.push({ kind: 'rect', cx: x, cy: -(tipY - leadLength / 2), w: leadWidth, h: leadLength, role: 'pad' })
  }

  // Right side leads (leadsLong count, along Y, bottom to top)
  for (let i = 0; i < leadsLong; i++) {
    const y = -topLong + i * leadPitch
    shapes.push({ kind: 'rect', cx: tipX - leadLength / 2, cy: y, w: leadLength, h: leadWidth, role: 'pad' })
  }

  // Top side leads (leadsShort count, along X, right to left)
  for (let i = 0; i < leadsShort; i++) {
    const x = spanShort / 2 - i * leadPitch
    shapes.push({ kind: 'rect', cx: x, cy: tipY - leadLength / 2, w: leadWidth, h: leadLength, role: 'pad' })
  }

  return shapes
}

// ── FourOnTwo: 4 lead groups on 2 sides, with gap between groups per side ──
// Left and right sides each have 2 groups separated by a gap.

function computeFourOnTwo(pkg: FourOnTwoPackage): FootprintShape[] {
  const { leadsPerGroup, widthOverLeads, leadPitch, leadWidth, leadLength, groupGap } = pkg.fourOnTwo
  const { length: bodyL, width: bodyW } = pkg.body ?? { length: 0, width: 0 }
  const shapes: FootprintShape[] = []

  shapes.push({ kind: 'rect', cx: 0, cy: 0, w: bodyW, h: bodyL, role: 'body' })

  const tipX = widthOverLeads / 2
  // Total span of one group
  const groupSpan = (leadsPerGroup - 1) * leadPitch
  // Distance from center to middle of gap
  const halfGap = groupGap / 2

  // Upper group center Y, lower group center Y
  const upperGroupCenter = halfGap + groupSpan / 2
  const lowerGroupCenter = -(halfGap + groupSpan / 2)

  let first = true
  for (const side of [-1, 1] as const) {
    const cx = side * (tipX - leadLength / 2)
    for (const groupCenterY of [upperGroupCenter, lowerGroupCenter]) {
      const topY = groupCenterY + groupSpan / 2
      for (let i = 0; i < leadsPerGroup; i++) {
        const y = topY - i * leadPitch
        shapes.push({
          kind: 'rect',
          cx,
          cy: y,
          w: leadLength,
          h: leadWidth,
          role: first ? 'pin1' : 'pad',
        })
        first = false
      }
    }
  }

  return shapes
}

// ── BGA: ball grid array ──
// Internal: computed at IPC 0° then post-rotated 90° CCW → Mycronic 0°.
// IPC 0°: body.width along X, body.length along Y. Pin A1 at upper-left.
// After toMycronic(): grid and A1 marker rotated 90° CCW.

function computeBga(pkg: BgaPackage): FootprintShape[] {
  const { leadsPerRow, leadsPerColumn, leadPitch, leadDiameter, leadsPerRowInHole = 0, leadsPerColumnInHole = 0 } = pkg.bga
  const { length: bodyL, width: bodyW } = pkg.body ?? { length: 0, width: 0 }
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
  const bodyL = pkg?.body?.length
  const bodyW = pkg?.body?.width
  if (hasFiniteNumbers(bodyL, bodyW)) {
    shapes.push({ kind: 'rect', cx: 0, cy: 0, w: bodyW!, h: bodyL!, role: 'body' })
  }

  const groups = pkg.generic?.leadGroups ?? []
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

    const protrudeX = a === 0 || a === 180000
    const protrudeY = a === 90000 || a === 270000
    if (!(protrudeX || protrudeY)) continue

    // For left/right (angle 0/180000): distFromCenter = X row position, ccHalf = Y half-span
    // For top/bottom (angle 90000/270000): distFromCenter = X half-span, ccHalf = Y row position
    // This is how TPSys stores the parameters — they swap meaning based on orientation.
    const axisHalf = protrudeX ? Math.abs(g.ccHalf) : Math.abs(g.distFromCenter)
    const positions: number[] = []
    if (n === 1) {
      positions.push(0)
    } else {
      const pitch = (2 * axisHalf) / (n - 1)
      for (let i = 0; i < n; i++) {
        positions.push(axisHalf - i * pitch)
      }
    }

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]!
      const role: RectShape['role'] = !emittedAny ? 'pin1' : 'pad'
      emittedAny = true

      if (protrudeX) {
        // Leads on left/right → row center is at X = distFromCenter, spread in Y
        shapes.push({ kind: 'rect', cx: g.distFromCenter, cy: p, w: padL, h: padW, role })
      } else {
        // Leads on top/bottom → spread in X, row center at Y = ccHalf
        shapes.push({ kind: 'rect', cx: p, cy: g.ccHalf, w: padW, h: padL, role })
      }
    }
  }

  return shapes
}
