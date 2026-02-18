/**
 * PCB pricing model derived from historical supplier quote data.
 *
 * All coefficients are medians from 4,718 ERPNext PCB Price records
 * cross-referenced with 2,806 PCB Specification records.
 *
 * The model has three cost components:
 *   1. Per-piece PCB cost: area_cm2 * BASE_RATE * layerFactor * surfaceFactor * copperFactor
 *   2. Fixed per-order costs: freight(qty) + bank charge (amortized across pieces)
 *   3. One-time NRE / tooling cost (shown separately, not amortized)
 */

export type SurfaceFinish = 'ENIG' | 'HAL'
export type CopperWeight = '1oz' | '2oz'
export type PcbThicknessMm = 0.6 | 0.8 | 1.0 | 1.2 | 1.6 | 2.0

export interface PcbParams {
  sizeX: number        // mm
  sizeY: number        // mm
  layerCount: number   // 1, 2, 4, 6, 8, 10
  surfaceFinish: SurfaceFinish
  copperWeight: CopperWeight
  /** Standard board thickness in mm (recommendation-only in v1). */
  thicknessMm?: PcbThicknessMm
}

export interface PriceTier {
  quantity: number
  piecePrice: number     // EUR — bare PCB cost per piece
  fixedPerPiece: number  // EUR — freight + bank amortized per piece
  pricePerPiece: number  // EUR — all-in per piece (piece + fixed/qty)
  total: number          // EUR — qty * pricePerPiece
}

export interface PricingResult {
  tiers: PriceTier[]
  nreCost: number   // EUR — one-time tooling / setup cost
}

// ─── Per-piece PCB cost coefficients ────────────────────────────────────

/** Base rate in EUR per cm2 (from price_per_piece at qty=100, 2L, ENIG, 1oz) */
const BASE_RATE = 0.0203

/** Layer count multipliers relative to 2-layer baseline */
const LAYER_FACTORS: Record<number, number> = {
  1: 1.0,
  2: 1.0,
  4: 1.29,
  6: 1.62,
  8: 2.46,
  10: 2.55,
}

/** Surface finish multipliers relative to ENIG baseline */
const SURFACE_FACTORS: Record<SurfaceFinish, number> = {
  HAL: 0.81,
  ENIG: 1.0,
}

/** Copper weight multipliers relative to 1oz baseline */
const COPPER_FACTORS: Record<CopperWeight, number> = {
  '1oz': 1.0,
  '2oz': 1.58,
}

// ─── Fixed per-order costs ──────────────────────────────────────────────

/** Bank charge is ~27 EUR flat regardless of quantity */
const BANK_CHARGE_EUR = 27

/**
 * Freight cost breakpoints (qty, EUR).
 * Derived from median freight across all quotes per quantity tier.
 * Between breakpoints the cost is linearly interpolated.
 */
const FREIGHT_BREAKPOINTS: [number, number][] = [
  [1, 25],
  [10, 27],
  [25, 30],
  [50, 36],
  [100, 47],
  [200, 65],
  [300, 86],
  [500, 117],
  [1000, 170],
  [2000, 327],
  [5000, 564],
]

// ─── One-time NRE / tooling cost ────────────────────────────────────────

/**
 * Median NRE cost by layer count (EUR), for quotes where NRE > 0.
 * ~53% of quotes have NRE > 0; we include it as a conservative estimate.
 */
const NRE_BY_LAYERS: Record<number, number> = {
  1: 50,
  2: 60,
  4: 95,
  6: 158,
  8: 209,
  10: 250,
}

// ─── Standard output tiers ──────────────────────────────────────────────

/** Standard quantity tiers shown in the pricing table */
export const QUANTITY_TIERS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000]

// ─── Interpolation helpers ──────────────────────────────────────────────

function interpolate(breakpoints: [number, number][], x: number): number {
  if (x <= breakpoints[0][0]) return breakpoints[0][1]
  if (x >= breakpoints[breakpoints.length - 1][0]) return breakpoints[breakpoints.length - 1][1]
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const [x0, y0] = breakpoints[i]
    const [x1, y1] = breakpoints[i + 1]
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0)
      return y0 + t * (y1 - y0)
    }
  }
  return breakpoints[0][1]
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Compute the bare PCB cost per piece (excluding freight, bank, NRE).
 */
export function computePiecePrice(params: PcbParams): number {
  const areaCm2 = (params.sizeX * params.sizeY) / 100
  const layerFactor = LAYER_FACTORS[params.layerCount] ?? LAYER_FACTORS[2]
  const surfaceFactor = SURFACE_FACTORS[params.surfaceFinish]
  const copperFactor = COPPER_FACTORS[params.copperWeight]
  return areaCm2 * BASE_RATE * layerFactor * surfaceFactor * copperFactor
}

/**
 * Compute the fixed per-order cost (freight + bank charge) for a given quantity.
 */
export function computeFixedCost(quantity: number): number {
  return interpolate(FREIGHT_BREAKPOINTS, quantity) + BANK_CHARGE_EUR
}

/**
 * Compute the one-time NRE / tooling cost based on layer count.
 */
export function computeNreCost(layerCount: number): number {
  return NRE_BY_LAYERS[layerCount] ?? NRE_BY_LAYERS[2]
}

/**
 * Compute full pricing table for all standard quantity tiers.
 * Returns null if required parameters are missing or invalid.
 */
export function computePricingTable(params: Partial<PcbParams>): PricingResult | null {
  if (!params.sizeX || !params.sizeY || !params.layerCount || !params.surfaceFinish || !params.copperWeight) {
    return null
  }
  if (params.sizeX <= 0 || params.sizeY <= 0) return null

  const fullParams: PcbParams = {
    sizeX: params.sizeX,
    sizeY: params.sizeY,
    layerCount: params.layerCount,
    surfaceFinish: params.surfaceFinish,
    copperWeight: params.copperWeight,
  }

  const piecePrice = computePiecePrice(fullParams)
  const nreCost = computeNreCost(fullParams.layerCount)

  const tiers: PriceTier[] = QUANTITY_TIERS.map((qty) => {
    const fixedTotal = computeFixedCost(qty)
    const fixedPerPiece = fixedTotal / qty
    const pricePerPiece = piecePrice + fixedPerPiece
    return {
      quantity: qty,
      piecePrice: round3(piecePrice),
      fixedPerPiece: round3(fixedPerPiece),
      pricePerPiece: round3(pricePerPiece),
      total: round2(pricePerPiece * qty),
    }
  })

  return { tiers, nreCost: round2(nreCost) }
}

function round2(n: number): number { return Math.round(n * 100) / 100 }
function round3(n: number): number { return Math.round(n * 1000) / 1000 }

/** Available layer count options */
export const LAYER_COUNT_OPTIONS = [1, 2, 4, 6, 8, 10] as const

/** Available surface finish options with display labels */
export const SURFACE_FINISH_OPTIONS: { value: SurfaceFinish; label: string }[] = [
  { value: 'ENIG', label: 'ENIG (Ni/Au)' },
  { value: 'HAL', label: 'HAL (HASL)' },
]

/** Available copper weight options with display labels */
export const COPPER_WEIGHT_OPTIONS: { value: CopperWeight; label: string }[] = [
  { value: '1oz', label: '1 oz (35 µm)' },
  { value: '2oz', label: '2 oz (70 µm)' },
]

/** Available standard board thickness options in mm */
export const PCB_THICKNESS_OPTIONS: { value: PcbThicknessMm; label: string }[] = [
  { value: 0.6, label: '0.6 mm' },
  { value: 0.8, label: '0.8 mm' },
  { value: 1.0, label: '1.0 mm' },
  { value: 1.2, label: '1.2 mm' },
  { value: 1.6, label: '1.6 mm (standard)' },
  { value: 2.0, label: '2.0 mm' },
]
