/**
 * Builds JPSys JetComponent, Deposit, and Pad structures from extracted
 * paste pads.  Groups pads into components, calculates deposit geometry
 * (with shrink), and computes paste volumes.
 */

import type { ExtractedPad } from './paste-extractor'
import type {
  JetComponent,
  Deposit,
  Pad,
  ShapeType,
  JpsysExportConfig,
} from './jpsys-types'
import { SHAPE_CIRCULAR, SHAPE_RECTANGULAR } from './jpsys-types'

export interface PadGroup {
  name: string
  shapeName: string
  cx: number
  cy: number
  rotation: number
  pads: ExtractedPad[]
}

/**
 * Group extracted pads into components.
 *
 * Without PnP data we use spatial clustering: pads whose centres are
 * within `clusterRadius` µm are grouped.  Each group becomes one
 * JetComponent with sequentially-numbered designators (P1, P2, ...).
 */
export function groupPadsIntoComponents(
  pads: ExtractedPad[],
  clusterRadius = 5000,
): PadGroup[] {
  const used = new Set<number>()
  const groups: PadGroup[] = []
  let compIdx = 1

  for (let i = 0; i < pads.length; i++) {
    if (used.has(i)) continue
    used.add(i)
    const members = [pads[i]!]

    const r2 = clusterRadius * clusterRadius
    const queue = [pads[i]!]
    while (queue.length) {
      const a = queue.pop()!
      for (let j = i + 1; j < pads.length; j++) {
        if (used.has(j)) continue
        const b = pads[j]!
        const dx = a.cx - b.cx
        const dy = a.cy - b.cy
        if (dx * dx + dy * dy < r2) {
          used.add(j)
          members.push(b)
          queue.push(b)
        }
      }
    }

    let gx = 0, gy = 0
    for (const p of members) { gx += p.cx; gy += p.cy }
    gx = Math.round(gx / members.length)
    gy = Math.round(gy / members.length)

    const shapeName = guessShapeName(members)

    groups.push({
      name: `P${compIdx}`,
      shapeName,
      cx: gx,
      cy: gy,
      rotation: 0,
      pads: members,
    })
    compIdx++
  }

  return groups
}

function guessShapeName(pads: ExtractedPad[]): string {
  if (pads.length === 1) {
    const p = pads[0]!
    const mm100X = Math.round(p.sizeX / 10)
    const mm100Y = Math.round(p.sizeY / 10)
    return `${String(mm100X).padStart(2, '0')}${String(mm100Y).padStart(2, '0')}`
  }
  if (pads.length === 2) {
    const p = pads[0]!
    const mm100X = Math.round(p.sizeX / 10)
    const mm100Y = Math.round(p.sizeY / 10)
    return `${String(mm100X).padStart(2, '0')}${String(mm100Y).padStart(2, '0')}`
  }
  return `GENERIC${pads.length}`
}

/**
 * Build a complete JetComponent array from grouped pads.
 */
export function buildJetComponents(
  groups: PadGroup[],
  pcbId: number,
  config: JpsysExportConfig,
  startId = 1,
): { components: JetComponent[]; nextId: number } {
  const components: JetComponent[] = []
  let id = startId

  for (let g = 0; g < groups.length; g++) {
    const group = groups[g]!
    const compId = id++
    const padsList: Pad[] = []
    const depositsList: Deposit[] = []

    for (let p = 0; p < group.pads.length; p++) {
      const raw = group.pads[p]!

      const relX = raw.cx - group.cx
      const relY = raw.cy - group.cy

      const shape: ShapeType = raw.isCircular ? SHAPE_CIRCULAR : SHAPE_RECTANGULAR

      const padId = id++
      padsList.push({
        id: padId,
        jetComponent: compId,
        padId: p,
        sizeX: raw.sizeX,
        sizeY: raw.sizeY,
        shape,
        rotation: 0,
        x: relX,
        y: relY,
      })

      const depSizeX = Math.round(raw.sizeX * config.shrinkFactor)
      const depSizeY = Math.round(raw.sizeY * config.shrinkFactor)

      const baseVolume = (depSizeX * depSizeY * config.stencilHeight) / 1e6
      const nominalVolume = baseVolume * (config.volumePercent / 100)
      const minVolume = nominalVolume * 0.9
      const maxVolume = nominalVolume * 1.1

      const depId = id++
      depositsList.push({
        id: depId,
        jetComponent: compId,
        depositId: p,
        padId: p,
        sizeX: depSizeX,
        sizeY: depSizeY,
        shape,
        rotation: 0,
        x: relX,
        y: relY,
        z: 0,
        nominalVolume,
        minVolume,
        maxVolume,
        selectedForInspection: false,
      })
    }

    components.push({
      id: compId,
      pcb: pcbId,
      componentNumber: g + 1,
      name: group.name,
      shapeName: group.shapeName,
      rotation: group.rotation,
      x: group.cx,
      y: group.cy,
      depositsList,
      padsList,
    })
  }

  return { components, nextId: id }
}
