<template>
  <div class="h-full overflow-y-auto p-3">
    <div v-if="!line" class="h-full flex items-center justify-center text-sm text-neutral-400">
      Select a BOM line to see details
    </div>

    <div v-else class="space-y-3">
      <!-- Header -->
      <div class="flex items-center gap-2">
        <span class="flex-1 min-w-0 text-sm font-semibold text-neutral-900 dark:text-white truncate">
          {{ line.description || '(no description)' }}
        </span>
        <UBadge v-if="isLineChanged" size="xs" variant="subtle" color="warning">Edited</UBadge>
        <UBadge v-if="line.dnp" size="xs" variant="subtle" color="error">DNP</UBadge>
        <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" title="Delete BOM line" :disabled="props.locked" @click="emit('removeLine', line.id)" />
      </div>

      <div v-if="missingInPnP.length > 0" class="flex items-start gap-1.5 px-2 py-1.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
        <UIcon name="i-lucide-triangle-alert" class="text-xs shrink-0 mt-0.5" />
        <div>
          <span class="font-medium">Not found in Pick &amp; Place:</span>
          {{ missingInPnP.join(', ') }}
        </div>
      </div>

      <!-- Editable fields -->
      <fieldset class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-2.5 space-y-2 border-0 m-0 min-w-0" :disabled="props.locked">
        <div>
          <div class="text-[10px] text-neutral-400 mb-1">Description</div>
          <UInput
            :model-value="line.description"
            size="sm"
            placeholder="e.g. 1uF Ceramic Capacitor"
            :class="fieldClass('description')"
            @update:model-value="(v) => emitUpdate({ description: String(v ?? '') })"
          />
        </div>
        <div>
          <div class="text-[10px] text-neutral-400 mb-1">Comment</div>
          <UTextarea
            :model-value="line.comment"
            size="sm"
            placeholder="(optional)"
            :rows="1"
            autoresize
            :class="fieldClass('comment')"
            @update:model-value="(v) => emitUpdate({ comment: String(v ?? '') })"
          />
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div>
            <div class="text-[10px] text-neutral-400 mb-1">Package</div>
            <UInput
              :model-value="line.package"
              size="sm"
              placeholder="e.g. 0603"
              :class="fieldClass('package')"
              @update:model-value="(v) => emitUpdate({ package: String(v ?? '') })"
            />
          </div>
          <div>
            <div class="text-[10px] text-neutral-400 mb-1">Customer item</div>
            <UInput
              :model-value="line.customerItemNo"
              size="sm"
              placeholder="(optional)"
              :class="fieldClass('customerItemNo')"
              @update:model-value="(v) => emitUpdate({ customerItemNo: String(v ?? '') })"
            />
          </div>
          <div>
            <div class="text-[10px] text-neutral-400 mb-1">Qty / board</div>
            <UInput
              :model-value="String(line.quantity)"
              size="sm"
              type="number"
              min="0"
              :class="fieldClass('quantity')"
              @update:model-value="(v) => emitUpdate({ quantity: Math.max(0, Number(v ?? 0) || 0) })"
            />
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <div class="text-[10px] text-neutral-400">References</div>
            <span class="text-[10px] text-neutral-400 tabular-nums">{{ refList.length }}</span>
          </div>

          <div
            class="rounded-md border border-neutral-200 dark:border-neutral-800 p-2"
            :class="fieldClass('references')"
            @click="focusRefInput"
          >
            <div v-if="refList.length === 0" class="text-[10px] text-neutral-400">
              Type a designator and press Enter
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <UBadge
                v-for="r in refList"
                :key="r"
                size="xs"
                color="neutral"
                variant="subtle"
                class="gap-1 pr-1"
              >
                <span class="font-mono">{{ r }}</span>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-x"
                  class="!p-0.5"
                  title="Remove"
                  @click="removeRef(r)"
                />
              </UBadge>
              <UInput
                ref="refInputEl"
                v-model="refInput"
                size="xs"
                autocomplete="off"
                placeholder="Add ref..."
                :disabled="props.locked"
                class="min-w-[120px] max-w-[180px]"
                @keydown="onRefInputKeydown"
                @blur="commitRefInput"
                @paste="handleRefPaste"
              />
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-2.5 space-y-2 border-0 m-0 min-w-0" :class="manufacturersClass" :disabled="props.locked">
        <div class="flex items-center justify-between">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Manufacturers</div>
          <UButton
            v-if="hasCredentials && hasAnyMpn"
            size="xs"
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            :disabled="isFetchingAnyForLine"
            @click="refreshAllForLine"
          >
            Refresh
          </UButton>
        </div>

        <div v-if="line.manufacturers.length === 0" class="text-xs text-neutral-400 py-3 text-center">
          No manufacturers added.
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="(mfr, idx) in line.manufacturers"
            :key="idx"
            class="rounded border p-2 space-y-1.5"
            :class="[
              isManufacturerNew(mfr)
                ? 'border-amber-300/70 bg-amber-50/30 dark:border-amber-700/40 dark:bg-amber-900/10'
                : 'border-neutral-100 dark:border-neutral-800',
              { 'opacity-60': line.dnp },
            ]"
          >
            <div class="flex items-start gap-2">
              <div class="flex-1 min-w-0 grid grid-cols-2 gap-2">
                <UInput
                  :model-value="mfr.manufacturer"
                  size="sm"
                  placeholder="Manufacturer"
                  class="min-w-0 text-sm font-medium"
                  @update:model-value="(v) => updateManufacturer(idx, { manufacturer: String(v ?? '') })"
                />
                <UInput
                  :model-value="mfr.manufacturerPart"
                  size="sm"
                  placeholder="Manufacturer part number"
                  class="min-w-0 font-mono text-sm"
                  @update:model-value="(v) => updateManufacturer(idx, { manufacturerPart: String(v ?? '') })"
                />
              </div>

              <div class="flex items-center gap-1 shrink-0 pt-0.5">
                <UIcon
                  v-if="getQueueStatus(mfr.manufacturerPart) === 'fetching'"
                  name="i-lucide-loader-2"
                  class="text-[10px] text-blue-500 animate-spin shrink-0"
                />
                <UIcon
                  v-else-if="getQueueStatus(mfr.manufacturerPart) === 'error'"
                  name="i-lucide-x-circle"
                  class="text-[10px] text-red-500 shrink-0"
                  title="Pricing fetch failed"
                />
                <UButton
                  v-if="hasCredentials"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-refresh-cw"
                  :disabled="getQueueStatus(mfr.manufacturerPart) === 'fetching'"
                  title="Refresh pricing for this part"
                  @click="emit('fetchSinglePricing', mfr.manufacturerPart)"
                />
                <UButton
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  title="Remove manufacturer"
                  @click="emit('removeManufacturer', line.id, idx)"
                />
              </div>
            </div>
            <div v-if="mfr.manufacturerPart && pricingCache[mfr.manufacturerPart]" class="text-[10px] text-neutral-400 -mt-1">
              {{ formatAge(pricingCache[mfr.manufacturerPart]?.fetchedAt) }} ago
            </div>

            <template v-if="mfr.manufacturerPart">
              <template v-for="offers in [getSupplierOffers(mfr.manufacturerPart, line.quantity * boardQuantity)]" :key="mfr.manufacturerPart">
                <template v-if="offers.length > 0">
                  <button
                    class="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                    @click="togglePriceTable(mfr.manufacturerPart)"
                  >
                    <UIcon
                      :name="expandedPriceTables.has(mfr.manufacturerPart) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                      class="text-[10px]"
                    />
                    {{ offers.length }} suppliers
                  </button>
                  <div v-if="expandedPriceTables.has(mfr.manufacturerPart)" class="rounded border border-neutral-100 dark:border-neutral-800 overflow-hidden">
                    <div class="grid grid-cols-[1fr_60px_60px_70px_70px] gap-1 px-2 py-0.5 bg-neutral-50 dark:bg-neutral-800/80 text-[9px] text-neutral-400 uppercase tracking-wide font-medium">
                      <span>Supplier</span>
                      <span class="text-right">Stock</span>
                      <span class="text-right">MOQ</span>
                      <span class="text-right">Unit</span>
                      <span class="text-right">Total</span>
                    </div>
                    <div
                      v-for="(offer, oi) in offers"
                      :key="oi"
                      class="grid grid-cols-[1fr_60px_60px_70px_70px] gap-1 px-2 py-0.5 text-[10px] border-t border-neutral-50 dark:border-neutral-800/50"
                      :class="{
                        'bg-green-50/30 dark:bg-green-900/5': offer.stock >= line.quantity * boardQuantity && oi === 0,
                        'opacity-40': offer.stock < line.quantity * boardQuantity,
                      }"
                    >
                      <span class="text-neutral-600 dark:text-neutral-300 truncate" :title="offer.supplier + (offer.country ? ` (${offer.country})` : '')">
                        {{ offer.supplier }}
                      </span>
                      <span class="text-right tabular-nums" :class="offer.stock >= line.quantity * boardQuantity ? 'text-neutral-600 dark:text-neutral-300' : 'text-red-400'">
                        {{ formatNumber(offer.stock) }}
                      </span>
                      <span class="text-right tabular-nums text-neutral-500">
                        {{ formatNumber(offer.moq) }}
                      </span>
                      <template v-for="display in [getDisplayOffer(offer)]" :key="`${offer.supplier}-${oi}-${display.currency}`">
                        <span class="text-right tabular-nums font-medium" :class="offer.stock >= line.quantity * boardQuantity && oi === 0 ? 'text-green-600 dark:text-green-400' : 'text-neutral-600 dark:text-neutral-300'">
                          {{ formatCurrency(display.unitPrice, display.currency) }}
                        </span>
                        <span class="text-right tabular-nums text-neutral-500">
                          {{ formatCurrency(display.lineValue, display.currency) }}
                        </span>
                      </template>
                    </div>
                  </div>
                </template>
                <div v-else-if="!pricingCache[mfr.manufacturerPart] && !getQueueStatus(mfr.manufacturerPart)" class="text-[10px] text-neutral-400 italic pl-1">
                  No pricing data
                </div>
              </template>
            </template>
          </div>
        </div>

        <div
          v-if="inlineAddOpen"
          class="rounded border border-neutral-100 dark:border-neutral-800 p-2 space-y-1.5"
          @click.stop
        >
          <div class="flex items-start gap-2">
            <div class="flex-1 min-w-0 grid grid-cols-2 gap-2">
              <UInput
                v-model="inlineAddMfr"
                size="sm"
                placeholder="Manufacturer"
                class="min-w-0 text-sm font-medium"
                @keydown.enter="confirmInlineAdd"
              />
              <UInput
                v-model="inlineAddMpn"
                size="sm"
                placeholder="MPN"
                class="min-w-0 font-mono text-sm"
                @keydown.enter="confirmInlineAdd"
              />
            </div>
            <div class="flex items-center gap-1 shrink-0 pt-0.5">
              <UButton size="xs" color="primary" variant="soft" icon="i-lucide-check" @click="confirmInlineAdd" />
              <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-x" @click="cancelInlineAdd" />
            </div>
          </div>
        </div>
        <UButton v-else size="xs" color="primary" variant="link" icon="i-lucide-plus" @click="inlineAddOpen = true">
          Add manufacturer
        </UButton>
      </fieldset>

    </div>
  </div>
</template>

<script setup lang="ts">
import type { BomLine, BomPricingCache, BomManufacturer } from '~/utils/bom-types'
import type { ExchangeRateSnapshot, PricingQueueItem } from '~/composables/useElexessApi'
import { formatCurrency, normalizeCurrencyCode } from '~/utils/currency'

const props = defineProps<{
  line: BomLine | null
  customerBomLines: BomLine[]
  pricingCache: BomPricingCache
  hasCredentials: boolean
  isFetchingPricing: boolean
  pricingQueue: PricingQueueItem[]
  boardQuantity: number
  teamCurrency: 'USD' | 'EUR'
  exchangeRate: ExchangeRateSnapshot | null
  pnpDesignators: Set<string>
  locked?: boolean
}>()

const emit = defineEmits<{
  updateLine: [id: string, updates: Partial<BomLine>]
  removeLine: [id: string]
  removeManufacturer: [lineId: string, index: number]
  addManufacturer: [lineId: string, mfr: { manufacturer: string; manufacturerPart: string }]
  fetchSinglePricing: [partNumber: string]
  fetchAllPricing: []
}>()

const expandedPriceTables = ref(new Set<string>())
function togglePriceTable(mpn: string) {
  const next = new Set(expandedPriceTables.value)
  if (next.has(mpn)) next.delete(mpn)
  else next.add(mpn)
  expandedPriceTables.value = next
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

function parseRefs(refs: string): string[] {
  if (!refs) return []
  return refs.split(/[,;\s]+/).map(r => r.trim()).filter(Boolean)
}

const missingInPnP = computed(() => {
  if (!props.line) return []
  if (props.line.dnp || props.pnpDesignators.size === 0) return []
  return parseRefs(props.line.references).filter(r => !props.pnpDesignators.has(r))
})

function refsKey(refs: string): string {
  return parseRefs(refs).map(r => r.toUpperCase()).sort().join(',')
}

function manufacturerKey(m: BomManufacturer): string {
  return `${String(m.manufacturer ?? '').trim().toLowerCase()}|${String(m.manufacturerPart ?? '').trim().toLowerCase()}`
}

const customerBaselineByLineId = shallowRef(new Map<string, BomLine | null>())
watchEffect(() => {
  const line = props.line
  if (!line) return
  const map = customerBaselineByLineId.value
  if (map.has(line.id)) return

  const direct = props.customerBomLines.find(l => l.id === line.id)
  if (direct) {
    map.set(line.id, direct)
    return
  }

  const byRefs = new Map<string, BomLine>()
  for (const l of props.customerBomLines) {
    const k = refsKey(l.references)
    if (k && !byRefs.has(k)) byRefs.set(k, l)
  }
  const rk = refsKey(line.references)
  map.set(line.id, rk ? (byRefs.get(rk) ?? null) : null)
})

const baselineLine = computed(() => {
  const line = props.line
  if (!line) return null
  return customerBaselineByLineId.value.get(line.id) ?? null
})

const isLineChanged = computed(() => {
  const line = props.line
  const base = baselineLine.value
  if (!line) return false
  if (!base) return true

  const fieldsEqual =
    String(line.description ?? '').trim() === String(base.description ?? '').trim()
    && String(line.comment ?? '').trim() === String(base.comment ?? '').trim()
    && String(line.package ?? '').trim() === String(base.package ?? '').trim()
    && refsKey(line.references) === refsKey(base.references)
    && line.type === base.type
    && line.quantity === base.quantity
    && !!line.dnp === !!base.dnp
    && !!line.customerProvided === !!base.customerProvided
    && String(line.customerItemNo ?? '').trim() === String(base.customerItemNo ?? '').trim()

  if (!fieldsEqual) return true

  const a = (line.manufacturers ?? []).map(manufacturerKey).sort()
  const b = (base.manufacturers ?? []).map(manufacturerKey).sort()
  if (a.length !== b.length) return true
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return true
  }
  return false
})

function emitUpdate(updates: Partial<BomLine>) {
  if (props.locked) return
  if (!props.line) return
  emit('updateLine', props.line.id, updates)
}

type FieldKey = 'description' | 'comment' | 'package' | 'references' | 'customerItemNo' | 'quantity'
function fieldClass(key: FieldKey) {
  const line = props.line
  const base = baselineLine.value
  if (!line) return ''
  if (!base) return 'ring-1 ring-amber-400/40'
  const changed = (() => {
    switch (key) {
      case 'description': return String(line.description ?? '').trim() !== String(base.description ?? '').trim()
      case 'comment': return String(line.comment ?? '').trim() !== String(base.comment ?? '').trim()
      case 'package': return String(line.package ?? '').trim() !== String(base.package ?? '').trim()
      case 'references': return refsKey(line.references) !== refsKey(base.references)
      case 'customerItemNo': return String(line.customerItemNo ?? '').trim() !== String(base.customerItemNo ?? '').trim()
      case 'quantity': return Number(line.quantity ?? 0) !== Number(base.quantity ?? 0)
    }
  })()
  return changed ? 'ring-1 ring-amber-400/40 bg-amber-50/40 dark:bg-amber-900/10' : ''
}

const baselineManufacturerKeys = computed(() => {
  const base = baselineLine.value
  if (!base) return new Set<string>()
  return new Set((base.manufacturers ?? []).map(manufacturerKey))
})

function isManufacturerNew(mfr: BomManufacturer): boolean {
  if (!baselineLine.value) return true
  return !baselineManufacturerKeys.value.has(manufacturerKey(mfr))
}

const manufacturersClass = computed(() => {
  const line = props.line
  const base = baselineLine.value
  if (!line) return ''
  if (!base) return 'ring-1 ring-amber-400/40'
  const a = (line.manufacturers ?? []).map(manufacturerKey).sort()
  const b = (base.manufacturers ?? []).map(manufacturerKey).sort()
  if (a.length !== b.length) return 'ring-1 ring-amber-400/40 bg-amber-50/20 dark:bg-amber-900/10'
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return 'ring-1 ring-amber-400/40 bg-amber-50/20 dark:bg-amber-900/10'
  }
  return ''
})

// Queue helpers
function getQueueStatus(partNumber: string): PricingQueueItem['status'] | null {
  const item = props.pricingQueue.find(i => i.partNumber === partNumber)
  return item?.status ?? null
}

const hasAnyMpn = computed(() => {
  const line = props.line
  if (!line) return false
  return line.manufacturers.some(m => !!m.manufacturerPart)
})

const isFetchingAnyForLine = computed(() => {
  const line = props.line
  if (!line) return false
  return line.manufacturers.some(m => m.manufacturerPart && getQueueStatus(m.manufacturerPart) === 'fetching')
})

function refreshAllForLine() {
  if (props.locked) return
  emit('fetchAllPricing')
}

// Pricing helpers (copied from BomPanel)
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

interface DisplayOffer {
  unitPrice: number
  lineValue: number
  currency: string
}

interface PriceBreak {
  quantity?: number
  price?: number
  currency?: string
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

function conversionRate(from: string, to: string): number | null {
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

function comparableUnitPrice(offer: SupplierOffer): number {
  const converted = convertAmount(offer.unitPrice, offer.currency, props.teamCurrency)
  return converted ?? offer.unitPrice
}

function getSupplierOffers(mpn: string, totalQty: number): SupplierOffer[] {
  const entry = props.pricingCache[mpn]
  if (!entry?.data) return []
  const results = entry.data?.results
  if (!Array.isArray(results) || results.length === 0) return []
  const candidates: SupplierOffer[] = []
  const seenSuppliers = new Set<string>()
  for (const r of results) {
    if (!r.pricebreaks || r.pricebreaks.length === 0) continue
    const tier = pickTierPrice(r.pricebreaks, totalQty)
    if (!tier) continue
    candidates.push({
      supplier: r.supplier || 'Unknown',
      country: r.country || '',
      stock: r.current_stock ?? 0,
      moq: r.moq ?? 0,
      leadtime: r.current_leadtime ?? null,
      unitPrice: tier.price,
      currency: tier.currency,
      lineValue: tier.price * totalQty,
    })
  }
  const offers: SupplierOffer[] = []
  for (const offer of candidates.sort((a, b) => comparableUnitPrice(a) - comparableUnitPrice(b))) {
    const key = offer.supplier
    if (seenSuppliers.has(key)) continue
    seenSuppliers.add(key)
    offers.push(offer)
  }
  return offers.sort((a, b) => comparableUnitPrice(a) - comparableUnitPrice(b))
}

function getDisplayOffer(offer: SupplierOffer): DisplayOffer {
  const unitPrice = convertAmount(offer.unitPrice, offer.currency, props.teamCurrency)
  const lineValue = convertAmount(offer.lineValue, offer.currency, props.teamCurrency)
  if (unitPrice == null || lineValue == null) {
    return { unitPrice: offer.unitPrice, lineValue: offer.lineValue, currency: offer.currency }
  }
  return { unitPrice, lineValue, currency: props.teamCurrency }
}

function formatAge(ts: any): string {
  try {
    const t = typeof ts === 'string' ? Date.parse(ts) : Number(ts)
    if (!Number.isFinite(t)) return ''
    const s = Math.max(0, (Date.now() - t) / 1000)
    if (s < 60) return `${Math.round(s)}s`
    if (s < 3600) return `${Math.round(s / 60)}m`
    return `${Math.round(s / 3600)}h`
  } catch {
    return ''
  }
}

// References editor
const refList = computed(() => {
  const line = props.line
  if (!line) return []
  return parseRefs(line.references).map(r => r.toUpperCase())
})

function setRefs(next: string[]) {
  const uniq = Array.from(new Set(next.map(r => r.trim()).filter(Boolean)))
  emitUpdate({ references: uniq.join(', ') })
}

function removeRef(ref: string) {
  if (props.locked) return
  setRefs(refList.value.filter(r => r !== ref))
}

const refInput = ref('')
const refInputEl = ref<{ inputRef?: { focus?: () => void } } | null>(null)

function focusRefInput() {
  if (props.locked) return
  refInputEl.value?.inputRef?.focus?.()
}

function commitRefInput() {
  if (props.locked) return
  const next = parseRefs(refInput.value).map(r => r.toUpperCase())
  if (next.length > 0) setRefs([...refList.value, ...next])
  refInput.value = ''
}

function onRefInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',' || event.key === ' ' || event.key === 'Tab') {
    event.preventDefault()
    commitRefInput()
  }
}

function handleRefPaste(event: ClipboardEvent) {
  if (props.locked) return
  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (!text) return
  const next = parseRefs(text).map(r => r.toUpperCase())
  if (next.length === 0) return
  event.preventDefault()
  setRefs([...refList.value, ...next])
  refInput.value = ''
}

function updateManufacturer(index: number, updates: Partial<BomManufacturer>) {
  if (props.locked) return
  const line = props.line
  if (!line) return
  const next = [...(line.manufacturers ?? [])]
  const current = next[index]
  if (!current) return
  next[index] = {
    manufacturer: updates.manufacturer ?? current.manufacturer,
    manufacturerPart: updates.manufacturerPart ?? current.manufacturerPart,
  }
  emitUpdate({ manufacturers: next })
}

// Inline add manufacturer
const inlineAddOpen = ref(false)
const inlineAddMfr = ref('')
const inlineAddMpn = ref('')

function cancelInlineAdd() {
  inlineAddOpen.value = false
  inlineAddMfr.value = ''
  inlineAddMpn.value = ''
}

function confirmInlineAdd() {
  if (props.locked) return
  const line = props.line
  if (!line) return
  const mfr = inlineAddMfr.value.trim()
  const mpn = inlineAddMpn.value.trim()
  if (!mfr && !mpn) return
  emit('addManufacturer', line.id, { manufacturer: mfr, manufacturerPart: mpn })
  cancelInlineAdd()
}
</script>

