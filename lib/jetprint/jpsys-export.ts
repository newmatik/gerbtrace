/**
 * JPSys export orchestrator.
 *
 * Ties together paste extraction, component building, path planning,
 * and JSON serialization into a single callable pipeline.
 */

import type { ImageTree } from '../gerber/types'
import type { Layout, JpsysExportConfig } from './jpsys-types'
import { JPSYS_EXPORT_DEFAULTS } from './jpsys-types'
import { extractPastePads, type ExtractedPad } from './paste-extractor'
import { groupPadsIntoComponents, buildJetComponents } from './component-builder'
import { planPath } from './path-planner'
import { serializeLayout, type PanelPlacement } from './jpsys-serializer'

export interface JpsysExportOptions {
  /** Parsed paste layer ImageTree */
  pasteTree: ImageTree
  /** Board width in mm (before rotation) */
  boardWidthMm: number
  /** Board height in mm (before rotation) */
  boardHeightMm: number
  /**
   * Board rotation in degrees as set on the canvas (0, 90, 180, 270).
   * Pads are extracted in Gerber coordinates; this rotation transforms
   * them into the machine conveyor orientation.
   */
  boardRotationDeg?: number
  /**
   * Panel placements in mm.  Each entry describes where one PCB
   * instance sits within the panel.  If only a single PCB (no panel),
   * pass a single entry with fiducial positions matching the board corners.
   */
  panelPlacementsMm?: {
    fid1X: number; fid1Y: number
    fid2X: number; fid2Y: number
    fid3X?: number; fid3Y?: number
  }[]
  /** Override default export configuration */
  config?: Partial<JpsysExportConfig>
}

/**
 * Rotate extracted pads around their collective centre by the given
 * angle (degrees CCW).  Also swaps sizeX/sizeY for 90/270 rotations
 * so the pad dimensions align with the new orientation.
 */
function rotatePads(pads: ExtractedPad[], angleDeg: number): ExtractedPad[] {
  if (angleDeg === 0) return pads
  const rad = (angleDeg * Math.PI) / 180
  const cosA = Math.round(Math.cos(rad) * 1e6) / 1e6
  const sinA = Math.round(Math.sin(rad) * 1e6) / 1e6
  const swap = angleDeg === 90 || angleDeg === 270 || angleDeg === -90

  let cx = 0, cy = 0
  for (const p of pads) { cx += p.cx; cy += p.cy }
  cx /= pads.length; cy /= pads.length

  return pads.map(p => {
    const dx = p.cx - cx
    const dy = p.cy - cy
    return {
      cx: Math.round(cx + dx * cosA - dy * sinA),
      cy: Math.round(cy + dx * sinA + dy * cosA),
      sizeX: swap ? p.sizeY : p.sizeX,
      sizeY: swap ? p.sizeX : p.sizeY,
      isCircular: p.isCircular,
    }
  })
}

/**
 * Generate a complete JPSys Layout JSON from a paste layer.
 */
export function generateJpsysProgram(options: JpsysExportOptions): Layout {
  const config: JpsysExportConfig = { ...JPSYS_EXPORT_DEFAULTS, ...options.config }
  const rotDeg = options.boardRotationDeg ?? 0

  let pads = extractPastePads(options.pasteTree)
  if (pads.length === 0) {
    throw new Error('No paste pads found in the provided layer')
  }

  if (rotDeg !== 0) {
    pads = rotatePads(pads, rotDeg)
  }

  const groups = groupPadsIntoComponents(pads)

  const pcbId = 100
  let nextId = 200

  const { components, nextId: afterComp } = buildJetComponents(groups, pcbId, config, nextId)
  nextId = afterComp

  const { segments, nextId: afterPath, totalDots } = planPath(
    components, pcbId, config.ejectorType, nextId,
  )
  nextId = afterPath

  const isSwapped = rotDeg === 90 || rotDeg === 270
  const boardWidth = Math.round((isSwapped ? options.boardHeightMm : options.boardWidthMm) * 1000)
  const boardHeight = Math.round((isSwapped ? options.boardWidthMm : options.boardHeightMm) * 1000)

  const panelPlacements: PanelPlacement[] = (options.panelPlacementsMm ?? [
    defaultSinglePcbPlacement(boardWidth, boardHeight),
  ]).map(p => ({
    fid1X: Math.round(p.fid1X * 1000),
    fid1Y: Math.round(p.fid1Y * 1000),
    fid2X: Math.round(p.fid2X * 1000),
    fid2Y: Math.round(p.fid2Y * 1000),
    fid3X: p.fid3X != null ? Math.round(p.fid3X * 1000) : null,
    fid3Y: p.fid3Y != null ? Math.round(p.fid3Y * 1000) : null,
  }))

  const pcbFid = panelPlacements[0]!

  return serializeLayout({
    config,
    components,
    segments,
    totalDots,
    boardWidth,
    boardHeight,
    panelPlacements,
    pcbFiducials: {
      fid1X: pcbFid.fid1X,
      fid1Y: pcbFid.fid1Y,
      fid2X: pcbFid.fid2X,
      fid2Y: pcbFid.fid2Y,
      fid3X: pcbFid.fid3X,
      fid3Y: pcbFid.fid3Y,
    },
  })
}

function defaultSinglePcbPlacement(widthUm: number, heightUm: number) {
  return {
    fid1X: 1.3,
    fid1Y: 1.3,
    fid2X: (widthUm - 1300) / 1000,
    fid2Y: (heightUm - 1300) / 1000,
    fid3X: undefined as number | undefined,
    fid3Y: undefined as number | undefined,
  }
}

/**
 * Export the Layout as a downloadable JSON string.
 */
export function exportJpsysJson(layout: Layout): string {
  return JSON.stringify(layout, null, 2)
}
