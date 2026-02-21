/**
 * Assembles a complete JPSys Layout JSON from components, path segments,
 * and panel configuration.  Handles the #ref deduplication pattern for
 * repeated PCBs in a panel.
 */

import type {
  Layout,
  BoardPosition,
  Panel,
  PanelPcbPos,
  PCB,
  PCBRef,
  JetComponent,
  SegmentOrder,
  CircularFiducialMark,
  FiducialRef,
  TrimPoint,
  JpsysExportConfig,
  EjectorProfile,
} from './jpsys-types'
import { EJECTOR_PROFILES } from './jpsys-types'

export interface PanelPlacement {
  /** Fiducial 1 position in panel coords (µm) */
  fid1X: number
  fid1Y: number
  /** Fiducial 2 position in panel coords (µm) */
  fid2X: number
  fid2Y: number
  /** Fiducial 3 position in panel coords (µm), null for 2-point */
  fid3X: number | null
  fid3Y: number | null
}

export interface SerializerInput {
  config: JpsysExportConfig
  components: JetComponent[]
  segments: SegmentOrder[]
  totalDots: number
  /** Board width in µm */
  boardWidth: number
  /** Board height in µm */
  boardHeight: number
  /** Panel placements – one per PCB instance in the panel */
  panelPlacements: PanelPlacement[]
  /** PCB-level fiducials */
  pcbFiducials: {
    fid1X: number; fid1Y: number
    fid2X: number; fid2Y: number
    fid3X: number | null; fid3Y: number | null
  }
}

let nextId = 1000

function id(): number {
  return nextId++
}

export function serializeLayout(input: SerializerInput): Layout {
  nextId = 1000
  const now = Date.now()
  const profile = EJECTOR_PROFILES[input.config.ejectorType]
  const programName = input.config.programName || 'gerbtrace-export'
  const ucName = programName.toUpperCase()

  const pcbId = id()
  const totalVolume = computeTotalVolume(input.components)

  const pcbObj: PCB = buildPCB(
    pcbId, programName, ucName, now, input, profile, totalVolume,
  )

  const panelId = id()
  const panelPcbPosList = buildPanelPcbPosList(
    panelId, ucName, pcbObj, input.panelPlacements, now,
  )

  const panelFid1 = buildDefaultFiducial(now)
  const panelFid1Ref: FiducialRef = {
    id: panelFid1.id,
    '#ref': true,
    type: 'CIRCULAR',
    normalizedUcName: panelFid1.normalizedUcName,
  }

  const outerFid1 = input.panelPlacements[0]!
  const lastPlacement = input.panelPlacements[input.panelPlacements.length - 1]!

  const panel: Panel = {
    id: panelId,
    name: programName,
    normalizedUcName: ucName,
    comment: 'Created by Gerbtrace.',
    __modifiedTime: now,
    __modifiedCount: 1,
    lifeCycleStatus: 'PRELIMINARY',
    lifeCycleStatusEditor: null,
    fiducial_1_x: outerFid1.fid1X,
    fiducial_1_y: outerFid1.fid1Y,
    fiducial_2_x: lastPlacement.fid2X,
    fiducial_2_y: lastPlacement.fid2Y,
    fiducial_3_x: null,
    fiducial_3_y: null,
    maxAngleError: 250,
    maxRelScaleError: 0.125,
    badmark_x: null,
    badmark_y: null,
    barCodeSize: null,
    barCodeAmbientRed: null,
    barCodeAmbientBlue: null,
    barCodeFrontLight: null,
    barCodeElementsPerLine: null,
    barcodePos_x: null,
    barcodePos_y: null,
    bbt_type: null,
    bbt_contrastOk: null,
    bbt_contrastLevel: null,
    bbt_size_x: null,
    bbt_size_y: null,
    bbt_useMarkOnPanel: null,
    trimAllPcbs: true,
    panelPcbPosList,
    fiducial_1: panelFid1Ref,
    fiducial_2: panelFid1Ref,
    fiducial_3: null,
  }

  const boardPosId = id()
  const layoutId = id()

  const trimPoint: TrimPoint = {
    id: id(),
    boardposition: boardPosId,
    x1: outerFid1.fid1X,
    y1: outerFid1.fid1Y,
    x2: lastPlacement.fid2X,
    y2: lastPlacement.fid2Y,
    x3: null,
    y3: null,
    machine: 0,
  }

  const boardPos: BoardPosition = {
    id: boardPosId,
    layout: layoutId,
    location: '1',
    normalizedUcLocation: '1',
    isPcb: false,
    pcb: null,
    panel,
    boardPosTrimPointsList: [trimPoint],
    heightZoneMeasurementPointList: [],
    heightZonePointList: [],
  }

  const comment = [
    `Purpose: ${input.config.ejectorType}-${profile.media.split(' ').pop()} ${input.config.volumePercent}%`,
    `Machine Type: ${input.config.machineType}`,
    'Compiler Settings: Default',
  ].join('\r\n')

  const layout: Layout = {
    id: layoutId,
    name: programName,
    normalizedUcName: ucName,
    comment,
    createTime: now,
    __modifiedTime: now,
    __modifiedCount: 1,
    modifiedBy: input.config.creator,
    lifeCycleStatus: 'PRELIMINARY',
    lifeCycleStatusEditor: null,
    clampForce: 'NORMAL',
    length: input.boardWidth,
    conveyorWidth: input.boardHeight,
    lowerLeftCornerX: Math.round(-input.boardWidth),
    lowerLeftCornerY: -9999,
    barcode: null,
    batchSize: 0,
    batchSizeType: 'LAYOUTS',
    overlapwarning: false,
    boardPosList: [boardPos],
    heightZoneList: [],
  }

  return layout
}

function buildPCB(
  pcbId: number,
  name: string,
  ucName: string,
  now: number,
  input: SerializerInput,
  profile: EjectorProfile,
  totalVolume: number,
): PCB {
  const fids = input.pcbFiducials
  const fid1 = buildDefaultFiducial(now)
  const fid2Ref: FiducialRef = {
    id: fid1.id,
    '#ref': true,
    type: 'CIRCULAR',
    normalizedUcName: fid1.normalizedUcName,
  }

  return {
    id: pcbId,
    name,
    normalizedUcName: ucName,
    comment: '',
    __modifiedTime: now,
    __modifiedCount: 1,
    lifeCycleStatusEditor: null,
    lifeCycleStatus: 'PRELIMINARY',
    fiducial_1_x: fids.fid1X,
    fiducial_1_y: fids.fid1Y,
    fiducial_2_x: fids.fid2X,
    fiducial_2_y: fids.fid2Y,
    fiducial_3_x: fids.fid3X,
    fiducial_3_y: fids.fid3Y,
    maxAngleError: 250,
    maxRelScaleError: 0.125,
    maxObstacleHeight: 0,
    badmark_x: null,
    badmark_y: null,
    barCodeSize: null,
    barCodeAmbientRed: null,
    barCodeAmbientBlue: null,
    barCodeFrontLight: null,
    barCodeElementsPerLine: null,
    barcodePos_x: null,
    barcodePos_y: null,
    totalVolume: Math.round(totalVolume),
    executionTime: estimateExecutionTime(input.totalDots, profile),
    effectiveTime: 0,
    mediaCategory: profile.mediaCategory,
    cassetteModelId: profile.cassetteModelId,
    media: profile.media,
    dotCount: input.totalDots,
    inspectionThreshold: 20,
    jetComponentsList: input.components,
    segmentOrdersList: input.segments,
    mountPosList: [],
    fiducial_1: fid1,
    fiducial_2: fid2Ref,
    fiducial_3: null,
  }
}

function buildPanelPcbPosList(
  panelId: number,
  ucName: string,
  pcb: PCB,
  placements: PanelPlacement[],
  _now: number,
): PanelPcbPos[] {
  const list: PanelPcbPos[] = []
  const pcbRef: PCBRef = {
    id: pcb.id,
    '#ref': true,
    normalizedUcName: pcb.normalizedUcName,
  }

  for (let i = 0; i < placements.length; i++) {
    const p = placements[i]!
    list.push({
      id: id(),
      panel: panelId,
      location: String(i + 1),
      name: ucName,
      normalizedUcLocation: String(i + 1),
      pcb: i === 0 ? pcb : pcbRef,
      x1: p.fid1X,
      y1: p.fid1Y,
      x2: p.fid2X,
      y2: p.fid2Y,
      x3: p.fid3X ?? 0,
      y3: p.fid3Y ?? 0,
    })
  }

  return list
}

function buildDefaultFiducial(now: number): CircularFiducialMark {
  const fId = id()
  return {
    id: fId,
    type: 'CIRCULAR',
    name: 'CIRCLE_DEFAULT',
    normalizedUcName: 'CIRCLE_DEFAULT',
    comment: 'Created by Gerbtrace.',
    phs_nom_dia: 1270,
    phs_min_dia: 1016,
    phs_max_dia: 1524,
    searchAreaWidth: 4270,
    searchAreaLength: 4270,
    color: 'BRIGHT',
    illuminationType: null,
    frontLight: null,
    ambientRed: null,
    ambientBlue: null,
    searchContrast: null,
    searchMethod: null,
    taught: null,
    __modifiedTime: now,
    __modifiedCount: 1,
  }
}

function computeTotalVolume(components: JetComponent[]): number {
  let total = 0
  for (const comp of components) {
    for (const dep of comp.depositsList) {
      total += dep.nominalVolume
    }
  }
  return total
}

function estimateExecutionTime(totalDots: number, profile: EjectorProfile): number {
  return Math.ceil(totalDots * profile.defaultDotPeriod)
}
