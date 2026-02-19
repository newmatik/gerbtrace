<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <div class="flex-1 overflow-y-auto">
      <div class="p-4 space-y-3">
        <!-- Missing parameters hint -->
        <div v-if="!pricingResult" class="text-xs text-neutral-400 py-6 text-center space-y-2">
          <UIcon name="i-lucide-calculator" class="text-2xl opacity-40" />
          <p>Fill in all PCB parameters to see pricing.</p>
          <p class="text-[10px]">
            Missing:
            <span class="text-amber-500">{{ missingFields.join(', ') }}</span>
          </p>
        </div>

        <!-- Pricing table -->
        <template v-else>
          <!-- Table -->
          <div class="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <table class="w-full text-xs">
              <thead>
                <tr class="bg-neutral-50 dark:bg-neutral-800/60 text-neutral-500 dark:text-neutral-400 text-[10px] uppercase tracking-wider">
                  <th class="text-left font-medium px-3 py-2">Qty</th>
                  <th class="text-right font-medium px-3 py-2">Assembly</th>
                  <th class="text-right font-medium px-3 py-2">BOM</th>
                  <th class="text-right font-medium px-3 py-2">PCB</th>
                  <th class="text-right font-medium px-3 py-2">Markup 20%</th>
                  <th class="text-right font-medium px-3 py-2">Sum / pc</th>
                  <th class="text-right font-medium px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="tier in pricingResult.tiers"
                  :key="tier.quantity"
                  class="border-t border-neutral-100 dark:border-neutral-800 transition-colors cursor-pointer"
                  :class="tier.quantity === selectedQuantityModel
                    ? 'bg-blue-50/60 dark:bg-blue-900/20'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/30'"
                  @click="selectedQuantityModel = tier.quantity"
                >
                  <td class="px-3 py-2 tabular-nums font-medium">
                    <div class="flex items-center gap-1.5">
                      {{ formatQty(tier.quantity) }}
                    </div>
                  </td>
                  <td class="px-3 py-2 tabular-nums text-right text-neutral-400">
                    {{ formatEur(getAssemblyPerPiece(tier.quantity)) }}
                  </td>
                  <template v-for="bomSummary in [getBomSummary(tier.quantity)]" :key="`${tier.quantity}-bom`">
                    <td class="px-3 py-2 tabular-nums text-right text-neutral-400">
                      <span>{{ formatEur(getBomPerPiece(bomSummary, tier.quantity)) }}</span>
                      <span v-if="bomSummary.missingLines > 0" class="ml-1 text-[9px] text-neutral-400">
                        partial
                      </span>
                    </td>
                    <td class="px-3 py-2 tabular-nums text-right text-neutral-400">
                      {{ formatEur(getPcbPerPiece(tier)) }}
                    </td>
                    <td class="px-3 py-2 tabular-nums text-right text-neutral-400">
                      {{ formatEur(getMarkupPerPiece(tier, bomSummary)) }}
                    </td>
                    <td class="px-3 py-2 tabular-nums text-right font-medium">
                      {{ formatEur(getSumPerPiece(tier, bomSummary)) }}
                    </td>
                    <td class="px-3 py-2 tabular-nums text-right font-semibold">
                      {{ formatEur(getTotalForTier(tier, bomSummary)) }}
                    </td>
                  </template>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- NRE / Tooling -->
          <div class="px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-700 text-xs space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-neutral-700 dark:text-neutral-200 font-medium">NRE / Tooling</span>
              <span class="text-[10px] text-neutral-400">(one-time)</span>
            </div>
            <div class="space-y-0.5">
              <div class="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                <span>PCB tooling</span>
                <span class="tabular-nums">{{ formatEur(pricingResult.nreCost) }}</span>
              </div>
              <div class="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                <span>PCBA tooling</span>
                <span class="tabular-nums">{{ formatEur(PCBA_TOOLING_COST_EUR) }}</span>
              </div>
              <div class="flex items-center justify-between pt-1 border-t border-neutral-200 dark:border-neutral-700">
                <span class="font-medium text-neutral-700 dark:text-neutral-200">Total tooling</span>
                <span class="font-medium tabular-nums text-neutral-700 dark:text-neutral-200">{{ formatEur(getTotalToolingCost(pricingResult.nreCost)) }}</span>
              </div>
            </div>
          </div>

          <div
            v-if="selectedTier && selectedBomSummary"
            class="px-3 py-2 rounded-lg bg-blue-50/60 dark:bg-blue-900/20 border border-blue-200/70 dark:border-blue-800/60 text-xs space-y-1"
          >
            <div class="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
              <span>Selected quantity</span>
              <span class="tabular-nums">{{ formatQty(selectedTier.quantity) }} pcs</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="font-medium text-neutral-700 dark:text-neutral-200">Grand total (incl. tooling)</span>
              <span class="font-semibold tabular-nums text-neutral-800 dark:text-neutral-100">
                {{ formatEur(getGrandTotalWithTooling(selectedTier, selectedBomSummary)) }}
              </span>
            </div>
            <div class="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
              <span>Assembly time estimate / board</span>
              <span class="tabular-nums">~{{ formatMinutes(estimatedAssemblyMinutesPerBoard) }} min</span>
            </div>
            <div class="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
              <span>Labor estimate / board (@ €0.01533/s)</span>
              <span class="tabular-nums">{{ formatEur(estimatedLaborCostPerBoard) }}</span>
            </div>
            <div class="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
              <span>Estimated boards per shift (8h)</span>
              <span class="tabular-nums">{{ estimatedBoardsPerShift }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computePricingTable } from '~/utils/pcb-pricing'
import type { SurfaceFinish, CopperWeight, PcbThicknessMm, PricingResult } from '~/utils/pcb-pricing'
import type { BomLine, BomPricingCache } from '~/utils/bom-types'
import type { ExchangeRateSnapshot } from '~/composables/useElexessApi'
import { formatCurrency, normalizeCurrencyCode } from '~/utils/currency'

interface PcbData {
  sizeX?: number
  sizeY?: number
  layerCount?: number
  surfaceFinish?: SurfaceFinish
  copperWeight?: CopperWeight
  thicknessMm?: PcbThicknessMm
}

interface BomSummary {
  total: number
  pricedLines: number
  missingLines: number
}

interface SupplierOffer {
  supplier: string
  stock: number
  unitPrice: number
  currency: string
  lineValue: number
}

interface PriceBreak {
  quantity?: number
  price?: number
  currency?: string
}

const props = defineProps<{
  pcbData: PcbData | null | undefined
  bomLines: BomLine[]
  pricingCache: BomPricingCache
  exchangeRate: ExchangeRateSnapshot | null
  pricingQuantities: number[]
  selectedQuantity?: number | null
}>()

const emit = defineEmits<{
  'update:selectedQuantity': [value: number]
}>()

const normalizedQuantities = computed(() =>
  Array.from(
    new Set(
      (props.pricingQuantities ?? [])
        .map(v => Number(v))
        .filter(v => Number.isFinite(v) && v >= 1)
        .map(v => Math.round(v)),
    ),
  ).sort((a, b) => a - b),
)

const pricingResult = computed<PricingResult | null>(() => {
  if (!props.pcbData) return null
  return computePricingTable(props.pcbData, normalizedQuantities.value)
})

const missingFields = computed(() => {
  const d = props.pcbData ?? {}
  const missing: string[] = []
  if (!d.sizeX) missing.push('Size X')
  if (!d.sizeY) missing.push('Size Y')
  if (!d.layerCount) missing.push('Layers')
  if (!d.surfaceFinish) missing.push('Surface Finish')
  if (!d.copperWeight) missing.push('Copper Weight')
  return missing
})

const selectedQuantityModel = computed<number | null>({
  get: () => Number.isFinite(Number(props.selectedQuantity)) ? Number(props.selectedQuantity) : null,
  set: (value) => {
    if (!Number.isFinite(Number(value))) return
    emit('update:selectedQuantity', Number(value))
  },
})

watch(pricingResult, (result) => {
  const tiers = result?.tiers ?? []
  if (!tiers.length) {
    return
  }
  if (!tiers.some(tier => tier.quantity === selectedQuantityModel.value)) {
    selectedQuantityModel.value = tiers[0].quantity
  }
}, { immediate: true })

const selectedTier = computed(() => {
  const tiers = pricingResult.value?.tiers ?? []
  if (!tiers.length) return null
  return tiers.find(tier => tier.quantity === selectedQuantityModel.value) ?? tiers[0]
})

const selectedBomSummary = computed(() => {
  if (!selectedTier.value) return null
  return getBomSummary(selectedTier.value.quantity)
})

function formatQty(n: number): string {
  return n.toLocaleString('en-US')
}

function formatEur(n: number): string {
  return formatCurrency(n, 'EUR')
}

function formatMinutes(n: number): string {
  return n.toFixed(1)
}

function conversionRate(from: 'USD' | 'EUR', to: 'USD' | 'EUR'): number | null {
  const snapshot = props.exchangeRate
  if (!snapshot) return null
  const source = normalizeCurrencyCode(snapshot.sourceCurrency)
  const target = normalizeCurrencyCode(snapshot.targetCurrency)
  if (!source || !target) return null
  const rate = Number(snapshot.rate)
  if (!Number.isFinite(rate) || rate <= 0) return null
  if (source === from && target === to) return rate
  if (source === to && target === from) return 1 / rate
  return null
}

function convertAmountToEur(value: number, fromCurrency: string): number | null {
  if (!Number.isFinite(value)) return null
  const from = normalizeCurrencyCode(fromCurrency)
  if (!from) return null
  if (from === 'EUR') return value
  const rate = conversionRate(from, 'EUR')
  if (rate == null) return null
  return value * rate
}

function pickTierPrice(pricebreaks: PriceBreak[], totalQty: number): { price: number; currency: string } | null {
  if (!pricebreaks || pricebreaks.length === 0) return null
  const sorted = [...pricebreaks].sort((a, b) => (a.quantity ?? 0) - (b.quantity ?? 0))
  let best = sorted[0]
  for (const tier of sorted) {
    if ((tier.quantity ?? 0) <= totalQty) best = tier
    else break
  }
  if (best?.price === undefined) return null
  return { price: Number(best.price), currency: best.currency || 'EUR' }
}

function getSupplierOffers(mpn: string, totalQty: number): SupplierOffer[] {
  const entry = props.pricingCache[mpn]
  if (!entry?.data) return []
  const results = entry.data?.results
  if (!Array.isArray(results) || results.length === 0) return []

  const offers: SupplierOffer[] = []
  for (const result of results) {
    if (!result.pricebreaks || result.pricebreaks.length === 0) continue
    const tier = pickTierPrice(result.pricebreaks, totalQty)
    if (!tier) continue
    offers.push({
      supplier: result.supplier || 'Unknown',
      stock: result.current_stock ?? 0,
      unitPrice: tier.price,
      currency: tier.currency,
      lineValue: tier.price * totalQty,
    })
  }

  const uniqueBySupplier = new Map<string, SupplierOffer>()
  for (const offer of offers) {
    const converted = convertAmountToEur(offer.unitPrice, offer.currency)
    const current = uniqueBySupplier.get(offer.supplier)
    if (!current) {
      uniqueBySupplier.set(offer.supplier, offer)
      continue
    }
    const currentConverted = convertAmountToEur(current.unitPrice, current.currency)
    if (converted != null && currentConverted != null) {
      if (converted < currentConverted) uniqueBySupplier.set(offer.supplier, offer)
    } else if (offer.unitPrice < current.unitPrice) {
      uniqueBySupplier.set(offer.supplier, offer)
    }
  }
  return [...uniqueBySupplier.values()]
}

function getLineBestOffer(line: BomLine, boards: number): SupplierOffer | null {
  const totalQty = line.quantity * boards
  if (totalQty <= 0) return null
  let best: SupplierOffer | null = null
  for (const mfr of line.manufacturers ?? []) {
    const offers = getSupplierOffers(mfr.manufacturerPart, totalQty)
    for (const offer of offers) {
      if (offer.stock < totalQty) continue
      if (!best) {
        best = offer
        continue
      }
      const bestConverted = convertAmountToEur(best.unitPrice, best.currency)
      const offerConverted = convertAmountToEur(offer.unitPrice, offer.currency)
      if (bestConverted != null && offerConverted != null) {
        if (offerConverted < bestConverted) best = offer
      } else if (offer.unitPrice < best.unitPrice) {
        best = offer
      }
    }
  }
  return best
}

function computeBomSummary(boards: number): BomSummary {
  let total = 0
  let pricedLines = 0
  let missingLines = 0
  for (const line of props.bomLines) {
    if (line.dnp || line.customerProvided || line.quantity <= 0) continue
    const best = getLineBestOffer(line, boards)
    if (!best) {
      missingLines++
      continue
    }
    const lineValueEur = convertAmountToEur(best.lineValue, best.currency)
    if (lineValueEur == null) {
      missingLines++
      continue
    }
    total += lineValueEur
    pricedLines++
  }
  return {
    total,
    pricedLines,
    missingLines,
  }
}

const bomSummaryByQty = computed(() => {
  const map = new Map<number, BomSummary>()
  for (const qty of normalizedQuantities.value) {
    map.set(qty, computeBomSummary(qty))
  }
  return map
})

function getBomSummary(qty: number): BomSummary {
  return bomSummaryByQty.value.get(qty) ?? { total: 0, pricedLines: 0, missingLines: 0 }
}

function getBomPerPiece(summary: BomSummary, qty: number): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0
  return summary.total / qty
}

const ASSEMBLY_COST_SMD_EUR = 0.02
const ASSEMBLY_COST_THT_EUR = 0.1
const KITTING_COST_PER_SMD_LINE_EUR = 5
const ORDER_OVERHEAD_EUR = 200
const PCBA_TOOLING_COST_EUR = 100
const MARKUP_RATE = 0.2
const LABOR_RATE_PER_SECOND_EUR = 0.01533
const SHIFT_SECONDS = 8 * 60 * 60

const smdLineCount = computed(() => {
  let count = 0
  for (const line of props.bomLines) {
    if (line.dnp || !Number.isFinite(line.quantity) || line.quantity <= 0) continue
    if (line.type === 'SMD') count++
  }
  return count
})

const thtLineCount = computed(() => {
  let count = 0
  for (const line of props.bomLines) {
    if (line.dnp || !Number.isFinite(line.quantity) || line.quantity <= 0) continue
    if (line.type === 'THT') count++
  }
  return count
})

const smdComponentsPerBoard = computed(() => {
  let count = 0
  for (const line of props.bomLines) {
    if (line.dnp || !Number.isFinite(line.quantity) || line.quantity <= 0) continue
    if (line.type === 'SMD') count += line.quantity
  }
  return count
})

const thtComponentsPerBoard = computed(() => {
  let count = 0
  for (const line of props.bomLines) {
    if (line.dnp || !Number.isFinite(line.quantity) || line.quantity <= 0) continue
    if (line.type === 'THT') count += line.quantity
  }
  return count
})

const estimatedAssemblySecondsPerBoard = computed(() => {
  const smdSeconds = smdComponentsPerBoard.value * 1.2
  const thtBaseSeconds = thtComponentsPerBoard.value * 3
  const thtPinSeconds = thtComponentsPerBoard.value * 1.5
  return smdSeconds + thtBaseSeconds + thtPinSeconds
})

const estimatedAssemblyMinutesPerBoard = computed(() => estimatedAssemblySecondsPerBoard.value / 60)
const estimatedLaborCostPerBoard = computed(() => estimatedAssemblySecondsPerBoard.value * LABOR_RATE_PER_SECOND_EUR)
const estimatedBoardsPerShift = computed(() => {
  const seconds = estimatedAssemblySecondsPerBoard.value
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return Math.max(1, Math.floor(SHIFT_SECONDS / seconds))
})

const assemblyVariablePerPiece = computed(() =>
  (smdComponentsPerBoard.value * ASSEMBLY_COST_SMD_EUR) + (thtComponentsPerBoard.value * ASSEMBLY_COST_THT_EUR),
)

function getAssemblyPerPiece(qty: number): number {
  if (!Number.isFinite(qty) || qty <= 0) return assemblyVariablePerPiece.value
  const perOrderCost = (smdLineCount.value * KITTING_COST_PER_SMD_LINE_EUR) + ORDER_OVERHEAD_EUR
  return assemblyVariablePerPiece.value + (perOrderCost / qty)
}

function getMarkupPerPiece(tier: PricingResult['tiers'][number], summary: BomSummary): number {
  return (getPcbPerPiece(tier) + getBomPerPiece(summary, tier.quantity)) * MARKUP_RATE
}

function getPcbPerPiece(tier: PricingResult['tiers'][number]): number {
  return tier.piecePrice + tier.freightPerPiece
}

function getTotalToolingCost(pcbToolingCost: number): number {
  return pcbToolingCost + PCBA_TOOLING_COST_EUR
}

function getSumPerPiece(tier: PricingResult['tiers'][number], summary: BomSummary): number {
  return getAssemblyPerPiece(tier.quantity) + getPcbPerPiece(tier) + getBomPerPiece(summary, tier.quantity) + getMarkupPerPiece(tier, summary)
}

function getTotalForTier(tier: PricingResult['tiers'][number], summary: BomSummary): number {
  return getSumPerPiece(tier, summary) * tier.quantity
}

function getGrandTotalWithTooling(tier: PricingResult['tiers'][number], summary: BomSummary): number {
  return getTotalForTier(tier, summary) + getTotalToolingCost(pricingResult.value?.nreCost ?? 0)
}
</script>
