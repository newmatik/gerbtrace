<template>
  <div class="w-full h-full flex flex-col overflow-y-auto p-5">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-4">
      <div class="flex-1 min-w-0">
        <h2 class="text-sm font-semibold text-neutral-800 dark:text-neutral-100 truncate">
          {{ line.references || '(no references)' }}
        </h2>
        <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
          {{ line.description || '(no description)' }}
        </p>
      </div>
      <UBadge v-if="line.dnp" color="error" size="sm" variant="subtle">DNP</UBadge>
      <UBadge :color="typeColor" size="sm" variant="subtle">{{ line.type }}</UBadge>
    </div>

    <!-- PnP mismatch warning -->
    <div
      v-if="missingInPnP.length > 0"
      class="flex items-start gap-2 mb-4 px-3 py-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800"
    >
      <UIcon name="i-lucide-triangle-alert" class="text-sm shrink-0 mt-0.5" />
      <div>
        <span class="font-medium">Not found in Pick &amp; Place:</span>
        {{ missingInPnP.join(', ') }}
      </div>
    </div>

    <!-- Properties -->
    <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-xs mb-5">
      <div v-if="line.package" class="flex items-center gap-2">
        <span class="text-neutral-400">Package</span>
        <span class="font-medium text-neutral-700 dark:text-neutral-200">{{ line.package }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-neutral-400">Qty / Board</span>
        <span class="font-medium text-neutral-700 dark:text-neutral-200">{{ line.quantity }}</span>
      </div>
      <div v-if="boardQuantity > 1" class="flex items-center gap-2">
        <span class="text-neutral-400">Total pcs</span>
        <span class="font-medium text-neutral-700 dark:text-neutral-200">{{ (line.quantity * boardQuantity).toLocaleString() }}</span>
      </div>
      <div v-if="line.customerItemNo" class="flex items-center gap-2">
        <span class="text-neutral-400">Customer Item</span>
        <span class="font-medium text-neutral-700 dark:text-neutral-200">{{ line.customerItemNo }}</span>
      </div>
      <div v-if="line.customerProvided" class="flex items-center gap-2">
        <span class="text-amber-500 font-medium">Customer Provided</span>
      </div>
      <div v-if="line.comment" class="col-span-2 flex items-start gap-2">
        <span class="text-neutral-400 shrink-0">Comment</span>
        <span class="text-neutral-700 dark:text-neutral-200">{{ line.comment }}</span>
      </div>
    </div>

    <!-- Manufacturers & pricing -->
    <div class="space-y-4 flex-1">
      <h3 class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
        Manufacturer Parts
      </h3>

      <div v-if="line.manufacturers.length === 0" class="text-xs text-neutral-400">
        No manufacturer parts defined.
      </div>

      <div
        v-for="(mfr, idx) in line.manufacturers"
        :key="idx"
        class="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 space-y-2"
      >
        <div class="flex items-center gap-2">
          <span class="text-xs text-neutral-700 dark:text-neutral-200 font-medium">{{ mfr.manufacturer || '(unknown)' }}</span>
          <span class="text-xs font-mono text-neutral-500">{{ mfr.manufacturerPart }}</span>
          <UIcon
            v-if="getQueueStatus(mfr.manufacturerPart) === 'fetching'"
            name="i-lucide-loader-2"
            class="text-xs text-blue-500 animate-spin shrink-0"
          />
          <UIcon
            v-else-if="getQueueStatus(mfr.manufacturerPart) === 'error'"
            name="i-lucide-x-circle"
            class="text-xs text-red-500 shrink-0"
            title="Pricing fetch failed"
          />
          <UButton
            v-if="hasCredentials && mfr.manufacturerPart"
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            title="Refresh pricing"
            :disabled="getQueueStatus(mfr.manufacturerPart) === 'fetching'"
            @click="$emit('fetchSinglePricing', mfr.manufacturerPart)"
          />
          <span v-if="pricingCache[mfr.manufacturerPart]" class="text-[10px] text-neutral-400 ml-auto">
            {{ formatAge(pricingCache[mfr.manufacturerPart]?.fetchedAt) }}
          </span>
        </div>

        <!-- Supplier offers table -->
        <template v-if="getSupplierOffers(mfr.manufacturerPart).length > 0">
          <div class="rounded border border-neutral-100 dark:border-neutral-800 overflow-hidden">
            <div class="grid grid-cols-[1fr_70px_60px_80px_80px] gap-1 px-3 py-1.5 bg-neutral-50 dark:bg-neutral-800/80 text-[10px] text-neutral-400 uppercase tracking-wide font-medium">
              <span>Supplier</span>
              <span class="text-right">Stock</span>
              <span class="text-right">MOQ</span>
              <span class="text-right">Unit</span>
              <span class="text-right">Total</span>
            </div>
            <div
              v-for="(offer, oi) in getSupplierOffers(mfr.manufacturerPart)"
              :key="oi"
              class="grid grid-cols-[1fr_70px_60px_80px_80px] gap-1 px-3 py-1.5 text-xs border-t border-neutral-50 dark:border-neutral-800/50"
              :class="{
                'bg-green-50/30 dark:bg-green-900/5': offer.stock >= totalQty && oi === 0,
                'opacity-40': offer.stock < totalQty,
              }"
            >
              <span class="text-neutral-600 dark:text-neutral-300 truncate" :title="offer.supplier + (offer.country ? ` (${offer.country})` : '')">
                {{ offer.supplier }}
              </span>
              <span class="text-right tabular-nums" :class="offer.stock >= totalQty ? 'text-neutral-600 dark:text-neutral-300' : 'text-red-400'">
                {{ offer.stock.toLocaleString() }}
              </span>
              <span class="text-right tabular-nums text-neutral-500">
                {{ offer.moq.toLocaleString() }}
              </span>
              <span
                class="text-right tabular-nums font-medium"
                :class="offer.stock >= totalQty && oi === 0 ? 'text-green-600 dark:text-green-400' : 'text-neutral-600 dark:text-neutral-300'"
              >
                {{ formatCurrency(getDisplayPrice(offer).unitPrice, getDisplayPrice(offer).currency) }}
              </span>
              <span class="text-right tabular-nums text-neutral-500">
                {{ formatCurrency(getDisplayPrice(offer).lineValue, getDisplayPrice(offer).currency) }}
              </span>
            </div>
          </div>
        </template>
        <div v-else-if="!pricingCache[mfr.manufacturerPart] && !getQueueStatus(mfr.manufacturerPart)" class="text-xs text-neutral-400 italic">
          No pricing data available
        </div>
      </div>

      <!-- Add manufacturer -->
      <div v-if="inlineAddActive" class="flex items-center gap-2">
        <UInput
          v-model="inlineAddMfr"
          size="xs"
          placeholder="Manufacturer"
          class="flex-1"
          @keydown.enter="confirmInlineAdd"
        />
        <UInput
          v-model="inlineAddMpn"
          size="xs"
          placeholder="MPN"
          class="flex-1"
          @keydown.enter="confirmInlineAdd"
        />
        <UButton size="xs" color="primary" variant="soft" icon="i-lucide-check" @click="confirmInlineAdd" />
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="inlineAddActive = false" />
      </div>
      <UButton
        v-else
        size="xs"
        color="primary"
        variant="ghost"
        icon="i-lucide-plus"
        @click="inlineAddActive = true; inlineAddMfr = ''; inlineAddMpn = ''"
      >
        Add Manufacturer
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { BomLine, BomPricingCache } from '~/utils/bom-types'
import type { ExchangeRateSnapshot, PricingQueueItem } from '~/composables/useElexessApi'
import { formatCurrency, normalizeCurrencyCode } from '~/utils/currency'

interface SupplierOffer {
  supplier: string
  country: string
  stock: number
  moq: number
  leadtime: number | null
  unitPrice: number
  currency: string
  lineValue: number
}

const props = defineProps<{
  line: BomLine
  pricingCache: BomPricingCache
  boardQuantity: number
  teamCurrency: 'USD' | 'EUR'
  exchangeRate: ExchangeRateSnapshot | null
  hasCredentials: boolean
  pnpDesignators: Set<string>
}>()

const emit = defineEmits<{
  'updateLine': [id: string, updates: Partial<BomLine>]
  'removeLine': [id: string]
  'addManufacturer': [lineId: string, mfr: { manufacturer: string; manufacturerPart: string }]
  'fetchSinglePricing': [partNumber: string]
}>()

const totalQty = computed(() => props.line.quantity * props.boardQuantity)

const typeColor = computed(() => {
  switch (props.line.type) {
    case 'SMD': return 'info' as const
    case 'THT': return 'primary' as const
    default: return 'neutral' as const
  }
})

function parseRefs(refs: string): string[] {
  if (!refs) return []
  return refs.split(/[,;\s]+/).map(r => r.trim()).filter(Boolean)
}

const missingInPnP = computed(() => {
  if (props.line.dnp || props.pnpDesignators.size === 0) return []
  return parseRefs(props.line.references).filter(r => !props.pnpDesignators.has(r))
})

function getQueueStatus(partNumber: string): string | null {
  return null
}

interface PriceBreak { quantity?: number; price?: number; currency?: string }

function pickTierPrice(pricebreaks: PriceBreak[], qty: number): { price: number; currency: string } | null {
  if (!pricebreaks?.length) return null
  const sorted = [...pricebreaks].sort((a, b) => (a.quantity ?? 0) - (b.quantity ?? 0))
  let best = sorted[0]
  for (const tier of sorted) {
    if ((tier.quantity ?? 0) <= qty) best = tier
    else break
  }
  if (best?.price === undefined) return null
  return { price: Number(best.price), currency: best.currency || 'EUR' }
}

function getSupplierOffers(mpn: string): SupplierOffer[] {
  const entry = props.pricingCache[mpn]
  if (!entry?.data) return []
  const results = entry.data?.results
  if (!Array.isArray(results) || !results.length) return []
  const qty = totalQty.value
  const candidates: SupplierOffer[] = []
  const seen = new Set<string>()
  for (const r of results) {
    if (!r.pricebreaks?.length) continue
    const tier = pickTierPrice(r.pricebreaks, qty)
    if (!tier) continue
    candidates.push({
      supplier: r.supplier || 'Unknown',
      country: r.country || '',
      stock: r.current_stock ?? 0,
      moq: r.moq ?? 0,
      leadtime: r.current_leadtime ?? null,
      unitPrice: tier.price,
      currency: tier.currency,
      lineValue: tier.price * qty,
    })
  }
  const offers: SupplierOffer[] = []
  for (const o of candidates.sort((a, b) => comparableUnitPrice(a) - comparableUnitPrice(b))) {
    if (seen.has(o.supplier)) continue
    seen.add(o.supplier)
    offers.push(o)
  }
  return offers
}

function comparableUnitPrice(offer: SupplierOffer): number {
  return convertAmount(offer.unitPrice, offer.currency, props.teamCurrency) ?? offer.unitPrice
}

function getDisplayPrice(offer: SupplierOffer) {
  const up = convertAmount(offer.unitPrice, offer.currency, props.teamCurrency)
  const lv = convertAmount(offer.lineValue, offer.currency, props.teamCurrency)
  if (up == null || lv == null) return { unitPrice: offer.unitPrice, lineValue: offer.lineValue, currency: offer.currency }
  return { unitPrice: up, lineValue: lv, currency: props.teamCurrency }
}

function convertAmount(value: number, fromCurrency: string, toCurrency: 'USD' | 'EUR'): number | null {
  if (!Number.isFinite(value)) return null
  const from = normalizeCurrencyCode(fromCurrency)
  const to = toCurrency.toUpperCase()
  if (!from) return null
  if (from === to) return value
  const rate = conversionRate(from, to)
  if (rate == null) return null
  return value * rate
}

function conversionRate(from: string, to: string): number | null {
  const s = props.exchangeRate
  if (!s) return null
  const src = normalizeCurrencyCode(s.sourceCurrency)
  const tgt = normalizeCurrencyCode(s.targetCurrency)
  if (!src || !tgt) return null
  const rate = Number(s.rate)
  if (!Number.isFinite(rate) || rate <= 0) return null
  if (src === from && tgt === to) return rate
  if (src === to && tgt === from) return 1 / rate
  return null
}

function formatAge(fetchedAt: string | undefined): string {
  if (!fetchedAt) return ''
  const ms = Date.now() - new Date(fetchedAt).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const inlineAddActive = ref(false)
const inlineAddMfr = ref('')
const inlineAddMpn = ref('')

function confirmInlineAdd() {
  const mfr = inlineAddMfr.value.trim()
  const mpn = inlineAddMpn.value.trim()
  if (!mfr && !mpn) return
  emit('addManufacturer', props.line.id, { manufacturer: mfr, manufacturerPart: mpn })
  inlineAddActive.value = false
}
</script>
