/**
 * JPSys path planner.
 *
 * Converts JetComponent deposit geometries into an optimized sequence of
 * SegmentOrder entries that describe the physical jetting head movement.
 *
 * Algorithm:
 *  1. For each deposit, plan serpentine fill strips.
 *  2. Order components via nearest-neighbour TSP heuristic.
 *  3. Assemble segments with sequential orderNumber.
 */

import type {
  JetComponent,
  Deposit,
  SegmentOrder,
  EjectorProfile,
} from './jpsys-types'
import { EJECTOR_PROFILES, type EjectorType } from './jpsys-types'

interface StripSegment {
  x: number
  y: number
  vx: number
  vy: number
  dotCount: number
  diameter: number
  dotPeriod: number
}

/**
 * Plan the complete jetting path for all components on a PCB.
 */
export function planPath(
  components: JetComponent[],
  pcbId: number,
  ejectorType: EjectorType,
  startId = 1,
): { segments: SegmentOrder[]; nextId: number; totalDots: number } {
  const profile = EJECTOR_PROFILES[ejectorType]

  const allStrips: { strips: StripSegment[]; compX: number; compY: number; compIdx: number }[] = []

  for (let i = 0; i < components.length; i++) {
    const comp = components[i]!
    const strips = planComponentStrips(comp, profile)
    allStrips.push({ strips, compX: comp.x, compY: comp.y, compIdx: i })
  }

  const order = nearestNeighbourOrder(allStrips.map(s => ({ x: s.compX, y: s.compY })))

  const segments: SegmentOrder[] = []
  let id = startId
  let orderNumber = 1
  let totalDots = 0

  for (const idx of order) {
    const entry = allStrips[idx]!
    for (const strip of entry.strips) {
      segments.push({
        id: id++,
        pcb: pcbId,
        orderNumber,
        x: strip.x,
        y: strip.y,
        z: 0,
        vx: strip.vx,
        vy: strip.vy,
        diameter: strip.diameter,
        dotPeriod: strip.dotPeriod,
        dotCount: strip.dotCount,
        arcSegmentRadius: null,
      })
      totalDots += strip.dotCount
      orderNumber++
    }
  }

  return { segments, nextId: id, totalDots }
}

/**
 * Plan serpentine fill strips for all deposits in a component.
 * Deposit positions are relative to the component centre; the strips
 * are emitted in absolute PCB coordinates.
 */
function planComponentStrips(
  comp: JetComponent,
  profile: EjectorProfile,
): StripSegment[] {
  const strips: StripSegment[] = []
  const dotDia = profile.maxDiameter
  const dotPeriod = profile.defaultDotPeriod
  const velocity = profile.defaultVelocity

  const depositOrder = orderDepositsWithinComponent(comp.depositsList)

  for (const deposit of depositOrder) {
    const absX = comp.x + deposit.x
    const absY = comp.y + deposit.y

    const depStrips = planDepositFill(
      absX, absY,
      deposit.sizeX, deposit.sizeY,
      dotDia, dotPeriod, velocity,
    )
    strips.push(...depStrips)
  }

  return strips
}

/**
 * Order deposits within a component to minimise repositioning.
 * Sort by Y then X for a simple scanline approach.
 */
function orderDepositsWithinComponent(deposits: Deposit[]): Deposit[] {
  return [...deposits].sort((a, b) => a.y - b.y || a.x - b.x)
}

/**
 * Fill a single rectangular deposit with serpentine strips that cover
 * the FULL deposit area edge-to-edge.
 *
 * The sweep direction is chosen along the longest deposit axis.
 * Strips alternate direction for serpentine movement.
 *
 * Velocity is derived from the dot spacing so that dots are evenly
 * distributed across the entire sweep length, matching how MYCenter
 * computes per-segment velocities.
 */
function planDepositFill(
  cx: number,
  cy: number,
  sizeX: number,
  sizeY: number,
  dotDia: number,
  dotPeriod: number,
  _velocity: number,
): StripSegment[] {
  const strips: StripSegment[] = []

  const sweepHorizontal = sizeX >= sizeY
  const sweepLen = sweepHorizontal ? sizeX : sizeY
  const perpLen = sweepHorizontal ? sizeY : sizeX

  const stripPitch = dotDia * 0.9

  const numStrips = Math.max(1, Math.ceil(perpLen / stripPitch))
  const dotsPerStrip = Math.max(2, Math.ceil(sweepLen / (dotDia * 0.7)) + 1)

  const dotSpacing = sweepLen / Math.max(1, dotsPerStrip - 1)
  const sweepVelocity = (dotSpacing / dotPeriod) / 1e6

  const actualStripPitch = numStrips > 1
    ? perpLen / (numStrips - 1)
    : 0

  const halfPerp = numStrips > 1 ? perpLen / 2 : 0
  const halfSweep = sweepLen / 2

  for (let s = 0; s < numStrips; s++) {
    const perpOffset = -halfPerp + s * actualStripPitch
    const forward = s % 2 === 0

    let startX: number, startY: number, vx: number, vy: number

    if (sweepHorizontal) {
      startX = forward ? Math.round(cx - halfSweep) : Math.round(cx + halfSweep)
      startY = Math.round(cy + perpOffset)
      vx = forward ? sweepVelocity : -sweepVelocity
      vy = 0
    } else {
      startX = Math.round(cx + perpOffset)
      startY = forward ? Math.round(cy - halfSweep) : Math.round(cy + halfSweep)
      vx = 0
      vy = forward ? sweepVelocity : -sweepVelocity
    }

    strips.push({
      x: startX,
      y: startY,
      vx,
      vy,
      dotCount: dotsPerStrip,
      diameter: dotDia,
      dotPeriod,
    })
  }

  return strips
}

/**
 * Nearest-neighbour TSP heuristic starting from index 0.
 * Returns the visitation order as an array of indices.
 */
function nearestNeighbourOrder(
  points: { x: number; y: number }[],
): number[] {
  if (points.length === 0) return []
  if (points.length === 1) return [0]

  const visited = new Set<number>()
  const order: number[] = []

  let current = 0
  visited.add(current)
  order.push(current)

  while (order.length < points.length) {
    let bestDist = Infinity
    let bestIdx = -1

    for (let i = 0; i < points.length; i++) {
      if (visited.has(i)) continue
      const dx = points[current]!.x - points[i]!.x
      const dy = points[current]!.y - points[i]!.y
      const dist = dx * dx + dy * dy
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = i
      }
    }

    if (bestIdx < 0) break
    visited.add(bestIdx)
    order.push(bestIdx)
    current = bestIdx
  }

  return order
}
