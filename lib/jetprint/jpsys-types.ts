/**
 * Mycronic JPSys JSON program types.
 *
 * All spatial values are in micrometers (µm), rotations in millidegrees,
 * volumes in nanoliters (nL), velocities in m/s, and time in seconds
 * unless otherwise noted.
 */

// ---------------------------------------------------------------------------
// Ejector profiles
// ---------------------------------------------------------------------------

export interface EjectorProfile {
  cassetteModelId: number
  media: string
  mediaCategory: string
  minDiameter: number // µm
  maxDiameter: number // µm
  defaultDotPeriod: number // seconds
  defaultVelocity: number // m/s
}

export const EJECTOR_AG04: EjectorProfile = {
  cassetteModelId: 2130714632,
  media: 'MY600 Senju M705-LFAC19',
  mediaCategory: 'Paste, LeadFree',
  minDiameter: 330,
  maxDiameter: 520,
  defaultDotPeriod: 1 / 300, // ~0.00333s
  defaultVelocity: 0.10,
}

export const EJECTOR_AR02: EjectorProfile = {
  cassetteModelId: 2130808852,
  media: 'AR Tamura T6',
  mediaCategory: 'Paste, LeadFree',
  minDiameter: 219,
  maxDiameter: 250,
  defaultDotPeriod: 0.005, // ~200 Hz
  defaultVelocity: 0.024,
}

export type EjectorType = 'AG04' | 'AR02'

/**
 * Without the FinePitch option enabled, JPSys enforces this as the
 * minimum dot diameter.  Segments below this threshold are raised
 * to this value on layout load.
 */
export const FINE_PITCH_MIN_DIAMETER = 300 // µm

export const EJECTOR_PROFILES: Record<EjectorType, EjectorProfile> = {
  AG04: EJECTOR_AG04,
  AR02: EJECTOR_AR02,
}

// ---------------------------------------------------------------------------
// Shape enum
// ---------------------------------------------------------------------------

export const SHAPE_CIRCULAR = 1 as const
export const SHAPE_RECTANGULAR = 2 as const
export type ShapeType = typeof SHAPE_CIRCULAR | typeof SHAPE_RECTANGULAR

// ---------------------------------------------------------------------------
// Lifecycle and clamp
// ---------------------------------------------------------------------------

export type LifeCycleStatus = 'PRELIMINARY' | 'RELEASED' | 'DISCONTINUED'
export type ClampForce = 'NORMAL' | 'LOW' | 'HIGH'

// ---------------------------------------------------------------------------
// Fiducial marks
// ---------------------------------------------------------------------------

export interface CircularFiducialMark {
  id: number
  type: 'CIRCULAR'
  name: string
  normalizedUcName: string
  comment: string
  phs_nom_dia: number
  phs_min_dia: number
  phs_max_dia: number
  searchAreaWidth: number
  searchAreaLength: number
  color: 'BRIGHT' | 'DARK'
  illuminationType: string | null
  frontLight: number | null
  ambientRed: number | null
  ambientBlue: number | null
  searchContrast: null
  searchMethod: null
  taught: null
  __modifiedTime: number
  __modifiedCount: number
}

export interface RectangularFiducialMark {
  id: number
  type: 'RECTANGULAR'
  name: string
  normalizedUcName: string
  comment: string
  phs_nom_width: number
  phs_min_width: number
  phs_max_width: number
  phs_nom_length: number
  phs_min_length: number
  phs_max_length: number
  searchAreaWidth: number
  searchAreaLength: number
  color: 'BRIGHT' | 'DARK'
  illuminationType: string | null
  frontLight: number | null
  ambientRed: number | null
  ambientBlue: number | null
  searchContrast: null
  searchMethod: null
  taught: null
  __modifiedTime: number
  __modifiedCount: number
}

export type FiducialMark = CircularFiducialMark | RectangularFiducialMark

export interface FiducialRef {
  id: number
  '#ref': true
  type: 'CIRCULAR' | 'RECTANGULAR'
  normalizedUcName: string
}

export type FiducialOrRef = FiducialMark | FiducialRef

// ---------------------------------------------------------------------------
// Pad
// ---------------------------------------------------------------------------

export interface Pad {
  id: number
  jetComponent: number
  padId: number
  sizeX: number
  sizeY: number
  shape: ShapeType
  rotation: number
  x: number
  y: number
}

// ---------------------------------------------------------------------------
// Deposit
// ---------------------------------------------------------------------------

export interface Deposit {
  id: number
  jetComponent: number
  depositId: number
  padId: number
  sizeX: number
  sizeY: number
  shape: ShapeType
  rotation: number
  x: number
  y: number
  z: number
  nominalVolume: number
  minVolume: number
  maxVolume: number
  selectedForInspection: boolean
}

// ---------------------------------------------------------------------------
// JetComponent
// ---------------------------------------------------------------------------

export interface JetComponent {
  id: number
  pcb: number
  componentNumber: number
  name: string
  shapeName: string
  rotation: number
  x: number
  y: number
  depositsList: Deposit[]
  padsList: Pad[]
}

// ---------------------------------------------------------------------------
// SegmentOrder (path movement)
// ---------------------------------------------------------------------------

export interface SegmentOrder {
  id: number
  pcb: number
  orderNumber: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  diameter: number
  dotPeriod: number
  dotCount: number
  arcSegmentRadius: number | null
}

// ---------------------------------------------------------------------------
// PCB
// ---------------------------------------------------------------------------

export interface PCB {
  id: number
  name: string
  normalizedUcName: string
  comment: string
  __modifiedTime: number
  __modifiedCount: number
  lifeCycleStatusEditor: string | null
  lifeCycleStatus: LifeCycleStatus
  fiducial_1_x: number
  fiducial_1_y: number
  fiducial_2_x: number
  fiducial_2_y: number
  fiducial_3_x: number | null
  fiducial_3_y: number | null
  maxAngleError: number
  maxRelScaleError: number
  maxObstacleHeight: number
  badmark_x: number | null
  badmark_y: number | null
  barCodeSize: number | null
  barCodeAmbientRed: number | null
  barCodeAmbientBlue: number | null
  barCodeFrontLight: number | null
  barCodeElementsPerLine: number | null
  barcodePos_x: number | null
  barcodePos_y: number | null
  totalVolume: number
  executionTime: number
  effectiveTime: number
  mediaCategory: string
  cassetteModelId: number
  media: string
  dotCount: number
  inspectionThreshold: number
  jetComponentsList: JetComponent[]
  segmentOrdersList: SegmentOrder[]
  mountPosList: unknown[]
  fiducial_1: FiducialMark | FiducialRef
  fiducial_2: FiducialMark | FiducialRef
  fiducial_3: FiducialMark | FiducialRef | null
}

export interface PCBRef {
  id: number
  '#ref': true
  normalizedUcName: string
}

export type PCBOrRef = PCB | PCBRef

// ---------------------------------------------------------------------------
// Panel PCB position
// ---------------------------------------------------------------------------

export interface PanelPcbPos {
  id: number
  panel: number
  location: string
  name: string
  normalizedUcLocation: string
  pcb: PCBOrRef
  x1: number
  y1: number
  x2: number
  y2: number
  x3: number
  y3: number
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export interface Panel {
  id: number
  name: string
  normalizedUcName: string
  comment: string
  __modifiedTime: number
  __modifiedCount: number
  lifeCycleStatus: LifeCycleStatus
  lifeCycleStatusEditor: string | null
  fiducial_1_x: number
  fiducial_1_y: number
  fiducial_2_x: number
  fiducial_2_y: number
  fiducial_3_x: number | null
  fiducial_3_y: number | null
  maxAngleError: number
  maxRelScaleError: number
  badmark_x: number | null
  badmark_y: number | null
  barCodeSize: number | null
  barCodeAmbientRed: number | null
  barCodeAmbientBlue: number | null
  barCodeFrontLight: number | null
  barCodeElementsPerLine: number | null
  barcodePos_x: number | null
  barcodePos_y: number | null
  bbt_type: string | null
  bbt_contrastOk: number | null
  bbt_contrastLevel: number | null
  bbt_size_x: number | null
  bbt_size_y: number | null
  bbt_useMarkOnPanel: boolean | null
  trimAllPcbs: boolean
  panelPcbPosList: PanelPcbPos[]
  fiducial_1: FiducialOrRef
  fiducial_2: FiducialOrRef
  fiducial_3: FiducialOrRef | null
}

// ---------------------------------------------------------------------------
// Trim point
// ---------------------------------------------------------------------------

export interface TrimPoint {
  id: number
  boardposition: number
  x1: number
  y1: number
  x2: number
  y2: number
  x3: number | null
  y3: number | null
  machine: number
}

// ---------------------------------------------------------------------------
// Board position
// ---------------------------------------------------------------------------

export interface BoardPosition {
  id: number
  layout: number
  location: string
  normalizedUcLocation: string
  isPcb: boolean
  pcb: null
  panel: Panel
  boardPosTrimPointsList: TrimPoint[]
  heightZoneMeasurementPointList: unknown[]
  heightZonePointList: unknown[]
}

// ---------------------------------------------------------------------------
// Layout (root)
// ---------------------------------------------------------------------------

export interface Layout {
  id: number
  name: string
  normalizedUcName: string
  comment: string
  createTime: number
  __modifiedTime: number
  __modifiedCount: number
  modifiedBy: string
  lifeCycleStatus: LifeCycleStatus
  lifeCycleStatusEditor: string | null
  clampForce: ClampForce
  length: number
  conveyorWidth: number
  lowerLeftCornerX: number
  lowerLeftCornerY: number
  barcode: string | null
  batchSize: number
  batchSizeType: 'LAYOUTS'
  overlapwarning: boolean
  boardPosList: BoardPosition[]
  heightZoneList: unknown[]
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

export function isPCBRef(pcb: PCBOrRef): pcb is PCBRef {
  return '#ref' in pcb && (pcb as PCBRef)['#ref'] === true
}

export function isFiducialRef(f: FiducialOrRef | null): f is FiducialRef {
  return f !== null && '#ref' in f && (f as FiducialRef)['#ref'] === true
}

export function isCircularFiducial(f: FiducialMark): f is CircularFiducialMark {
  return f.type === 'CIRCULAR'
}

export function isRectangularFiducial(f: FiducialMark): f is RectangularFiducialMark {
  return f.type === 'RECTANGULAR'
}

// ---------------------------------------------------------------------------
// Export configuration
// ---------------------------------------------------------------------------

export interface JpsysExportConfig {
  ejectorType: EjectorType
  volumePercent: number
  stencilHeight: number // µm, default 127
  shrinkFactor: number // default 0.96
  machineType: string // e.g. "MY500_S3"
  programName: string
  creator: string
}

export const JPSYS_EXPORT_DEFAULTS: Readonly<JpsysExportConfig> = {
  ejectorType: 'AG04',
  volumePercent: 100,
  stencilHeight: 127,
  shrinkFactor: 0.96,
  machineType: 'MY500_S3',
  programName: '',
  creator: 'gerbtrace',
}
