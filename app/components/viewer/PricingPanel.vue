<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <div class="flex-1 overflow-y-auto">
      <div class="p-4 space-y-3">
        <div class="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
          Price Estimate
        </div>

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
          <!-- Board summary -->
          <div class="text-[10px] text-neutral-400 space-y-0.5 pb-1">
            <div class="flex items-center gap-1.5">
              <span>{{ pcbData!.sizeX }} x {{ pcbData!.sizeY }} mm</span>
              <span class="opacity-40">|</span>
              <span>{{ pcbData!.layerCount }}L</span>
              <span class="opacity-40">|</span>
              <span>{{ pcbData!.surfaceFinish }}</span>
              <span class="opacity-40">|</span>
              <span>{{ pcbData!.copperWeight }}</span>
            </div>
            <div class="tabular-nums">
              Board area: {{ ((pcbData!.sizeX! * pcbData!.sizeY!) / 100).toFixed(1) }} cm²
            </div>
            <div class="tabular-nums">
              Thickness: {{ pcbData!.thicknessMm ?? 1.6 }} mm (panel recommendation only in v1)
            </div>
          </div>

          <!-- NRE cost -->
          <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/15 text-xs">
            <div class="flex items-center gap-1.5">
              <span class="text-amber-600 dark:text-amber-400 font-medium">NRE / Tooling</span>
              <span class="text-[10px] text-neutral-400">(one-time)</span>
            </div>
            <span class="font-medium tabular-nums">{{ formatEur(pricingResult.nreCost) }}</span>
          </div>

          <!-- Table -->
          <div class="border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
            <table class="w-full text-xs">
              <thead>
                <tr class="bg-neutral-50 dark:bg-neutral-800/60 text-neutral-500 dark:text-neutral-400 text-[10px] uppercase tracking-wider">
                  <th class="text-left font-medium px-3 py-2">Qty</th>
                  <th class="text-right font-medium px-3 py-2">PCB</th>
                  <th class="text-right font-medium px-3 py-2">Ship</th>
                  <th class="text-right font-medium px-3 py-2">All-in / pc</th>
                  <th class="text-right font-medium px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(tier, i) in pricingResult.tiers"
                  :key="tier.quantity"
                  class="border-t border-neutral-100 dark:border-neutral-800 transition-colors"
                  :class="i === bestValueIndex
                    ? 'bg-primary/5 dark:bg-primary/10'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/30'"
                >
                  <td class="px-3 py-2 tabular-nums font-medium">
                    <div class="flex items-center gap-1.5">
                      {{ formatQty(tier.quantity) }}
                      <span
                        v-if="i === bestValueIndex"
                        class="text-[9px] px-1 py-px rounded bg-primary/15 text-primary font-medium"
                      >
                        best
                      </span>
                    </div>
                  </td>
                  <td class="px-3 py-2 tabular-nums text-right text-neutral-400">
                    {{ formatEur(tier.piecePrice) }}
                  </td>
                  <td class="px-3 py-2 tabular-nums text-right text-neutral-400">
                    {{ formatEur(tier.fixedPerPiece) }}
                  </td>
                  <td class="px-3 py-2 tabular-nums text-right font-medium">
                    {{ formatEur(tier.pricePerPiece) }}
                  </td>
                  <td class="px-3 py-2 tabular-nums text-right font-medium">
                    {{ formatEur(tier.total) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Disclaimer -->
          <p class="text-[10px] text-neutral-400 leading-relaxed pt-1">
            Estimates based on historical supplier data. Includes freight and bank charges. NRE is a one-time tooling cost. Request a formal quote for exact pricing.
          </p>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computePricingTable } from '~/utils/pcb-pricing'
import type { SurfaceFinish, CopperWeight, PcbThicknessMm, PricingResult } from '~/utils/pcb-pricing'

interface PcbData {
  sizeX?: number
  sizeY?: number
  layerCount?: number
  surfaceFinish?: SurfaceFinish
  copperWeight?: CopperWeight
  thicknessMm?: PcbThicknessMm
}

const props = defineProps<{
  pcbData: PcbData | null | undefined
}>()

const pricingResult = computed<PricingResult | null>(() => {
  if (!props.pcbData) return null
  return computePricingTable(props.pcbData)
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

/** Index of the tier with the best price-per-piece efficiency gain */
const bestValueIndex = computed(() => {
  const tiers = pricingResult.value?.tiers
  if (!tiers || tiers.length < 2) return -1
  let bestIdx = 0
  let bestRatio = 0
  for (let i = 1; i < tiers.length; i++) {
    const prev = tiers[i - 1]
    const curr = tiers[i]
    const priceDrop = (prev.pricePerPiece - curr.pricePerPiece) / prev.pricePerPiece
    const qtyIncrease = curr.quantity / prev.quantity
    const ratio = priceDrop / qtyIncrease
    if (ratio > bestRatio) {
      bestRatio = ratio
      bestIdx = i
    }
  }
  return bestIdx
})

function formatQty(n: number): string {
  return n.toLocaleString('en-US')
}

function formatEur(n: number): string {
  return `€${n.toFixed(n < 1 ? 3 : 2)}`
}
</script>
