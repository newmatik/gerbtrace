<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Search bar -->
    <div class="p-3 pb-2">
      <div class="relative">
        <UIcon
          name="i-lucide-search"
          class="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 text-xs"
        />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Filter BOM lines..."
          class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md pl-7 pr-6 py-1.5 outline-none placeholder:text-neutral-400 focus:border-primary transition-colors"
        />
        <button
          v-if="searchQuery"
          class="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
          @click="searchQuery = ''"
        >
          <UIcon name="i-lucide-x" class="text-xs" />
        </button>
      </div>
    </div>

    <!-- Filter chips + sort -->
    <div class="flex items-center gap-1.5 px-3 pb-1.5 flex-wrap">
      <button
        v-for="f in filterDefs"
        :key="f.key"
        class="text-[10px] px-1.5 py-0.5 rounded-full border transition-colors flex items-center gap-0.5"
        :class="activeFilters.has(f.key)
          ? f.activeClass
          : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'"
        @click="toggleFilter(f.key)"
      >
        {{ f.label }}
        <span class="tabular-nums opacity-60">{{ f.count }}</span>
      </button>
      <!-- Spacer -->
      <span class="flex-1" />
      <!-- Sort controls -->
      <button
        class="text-[10px] px-1.5 py-0.5 rounded-full border transition-colors flex items-center gap-0.5"
        :class="sortBy === 'designator'
          ? 'border-primary/40 text-primary bg-primary/5'
          : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'"
        title="Sort by designator"
        @click="sortBy = 'designator'"
      >
        <UIcon name="i-lucide-arrow-down-a-z" class="text-[10px]" />
        Ref
      </button>
      <button
        class="text-[10px] px-1.5 py-0.5 rounded-full border transition-colors flex items-center gap-0.5"
        :class="sortBy === 'price'
          ? 'border-primary/40 text-primary bg-primary/5'
          : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'"
        title="Sort by total price (highest first)"
        @click="sortBy = 'price'"
      >
        <UIcon name="i-lucide-arrow-down-0-1" class="text-[10px]" />
        Price
      </button>
    </div>

    <!-- Toolbar -->
    <div class="flex items-center justify-between px-3 pb-1.5 gap-1">
      <div class="flex items-center gap-2">
        <span class="text-[10px] text-neutral-400">
          {{ displayLines.length }}/{{ bomLines.length }} lines
        </span>
        <!-- Board quantity input -->
        <div class="flex items-center gap-1">
          <label class="text-[10px] text-neutral-400">Boards:</label>
          <input
            :value="boardQuantity"
            type="number"
            min="1"
            class="w-14 text-[10px] tabular-nums bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-1.5 py-0.5 outline-none focus:border-primary transition-colors text-center"
            @input="handleBoardQtyInput"
          />
        </div>
      </div>
      <div class="flex items-center gap-1">
        <button
          v-if="hasCredentials"
          class="text-[10px] px-1.5 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-600 transition-colors flex items-center gap-0.5"
          title="Fetch pricing for all manufacturer parts from Elexess"
          :disabled="isFetchingPricing"
          @click="emit('fetchAllPricing')"
        >
          <UIcon :name="isFetchingPricing ? 'i-lucide-loader-2' : 'i-lucide-refresh-cw'" class="text-[10px]" :class="{ 'animate-spin': isFetchingPricing }" />
          <span>{{ isFetchingPricing ? `${queueDone}/${queueTotal}` : 'Fetch Prices' }}</span>
        </button>
        <button
          v-if="cpLines.length > 0"
          class="text-[10px] px-1.5 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 transition-colors flex items-center gap-0.5"
          :class="cpCopied
            ? 'text-green-600 dark:text-green-400 border-green-300 dark:border-green-600'
            : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-600'"
          :title="`Copy ${cpLines.length} customer-provided items to clipboard`"
          @click="copyCpItems"
        >
          <UIcon :name="cpCopied ? 'i-lucide-check' : 'i-lucide-clipboard-copy'" class="text-[10px]" />
          CP
        </button>
        <button
          class="text-[10px] px-1.5 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-green-600 dark:hover:text-green-400 hover:border-green-300 dark:hover:border-green-600 transition-colors flex items-center gap-0.5"
          title="Add BOM line"
          @click="emit('addLine')"
        >
          <UIcon name="i-lucide-plus" class="text-[10px]" />
          Add Item
        </button>
      </div>
    </div>

    <!-- Pricing queue status strip -->
    <div v-if="pricingQueue.length > 0" class="mx-3 mb-2 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
      <!-- Summary bar (clickable to expand) -->
      <button
        class="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
        @click="queueExpanded = !queueExpanded"
      >
        <UIcon
          :name="queueExpanded ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          class="text-[10px] text-neutral-400 shrink-0"
        />
        <UIcon
          v-if="isFetchingPricing"
          name="i-lucide-loader-2"
          class="text-[10px] text-blue-500 animate-spin shrink-0"
        />
        <UIcon
          v-else-if="queueErrors > 0"
          name="i-lucide-alert-triangle"
          class="text-[10px] text-amber-500 shrink-0"
        />
        <UIcon
          v-else
          name="i-lucide-check-circle"
          class="text-[10px] text-green-500 shrink-0"
        />
        <span class="text-[10px] text-neutral-600 dark:text-neutral-300 flex-1">
          <template v-if="isFetchingPricing">Fetching pricing... {{ queueDone }}/{{ queueTotal }}</template>
          <template v-else-if="queueErrors > 0">Done with {{ queueErrors }} error{{ queueErrors > 1 ? 's' : '' }}</template>
          <template v-else>All {{ queueTotal }} prices fetched</template>
        </span>
      </button>

      <!-- Progress bar -->
      <div v-if="queueTotal > 0" class="h-0.5 bg-neutral-100 dark:bg-neutral-800">
        <div
          class="h-full transition-all duration-300"
          :class="queueErrors > 0 ? 'bg-amber-500' : 'bg-blue-500'"
          :style="{ width: `${(queueDone / queueTotal) * 100}%` }"
        />
      </div>

      <!-- Expanded queue items -->
      <div v-if="queueExpanded" class="max-h-40 overflow-y-auto border-t border-neutral-100 dark:border-neutral-800">
        <div
          v-for="item in pricingQueue"
          :key="item.partNumber"
          class="flex items-center gap-2 px-2.5 py-1 text-[10px]"
          :class="{
            'bg-blue-50/50 dark:bg-blue-900/10': item.status === 'fetching',
            'opacity-50': item.status === 'done',
          }"
        >
          <UIcon
            v-if="item.status === 'pending'"
            name="i-lucide-clock"
            class="text-neutral-400 shrink-0"
          />
          <UIcon
            v-else-if="item.status === 'fetching'"
            name="i-lucide-loader-2"
            class="text-blue-500 animate-spin shrink-0"
          />
          <UIcon
            v-else-if="item.status === 'done'"
            name="i-lucide-check"
            class="text-green-500 shrink-0"
          />
          <UIcon
            v-else
            name="i-lucide-x-circle"
            class="text-red-500 shrink-0"
          />
          <span class="font-mono text-neutral-600 dark:text-neutral-300 truncate">{{ item.partNumber }}</span>
          <span class="text-neutral-400 capitalize shrink-0">{{ item.status }}</span>
        </div>
      </div>
    </div>

    <!-- Elexess warning -->
    <div v-if="!hasCredentials && bomLines.length > 0" class="mx-3 mb-2 px-2 py-1.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
      Elexess API not configured. Set credentials in Team Settings to fetch pricing.
    </div>
    <div
      v-if="mismatchSummary"
      class="mx-3 mb-2 px-2 py-1.5 text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-1.5"
    >
      <UIcon name="i-lucide-triangle-alert" class="shrink-0" />
      <span>
        {{ mismatchSummary.linesWithMissing }} BOM line{{ mismatchSummary.linesWithMissing === 1 ? '' : 's' }}
        contain designators missing in PnP
        ({{ mismatchSummary.uniqueMissingRefs }} unique refs).
      </span>
    </div>

    <!-- BOM table -->
    <div class="flex-1 overflow-y-auto px-3 pb-3">
      <div v-if="bomLines.length === 0" class="text-center py-8">
        <UIcon name="i-lucide-clipboard-list" class="text-3xl text-neutral-300 dark:text-neutral-600 mb-2" />
        <p class="text-xs text-neutral-400">No BOM data yet.</p>
        <p class="text-[10px] text-neutral-400 mt-1">
          Import a BOM file (.csv, .xlsx) via the Files tab, or add lines manually.
        </p>
      </div>

      <div v-else class="space-y-1">
        <div
          v-for="line in displayLines"
          :key="line.id"
          class="rounded-lg border transition-colors cursor-pointer"
          :class="selectedLineId === line.id
            ? 'border-blue-400/40 bg-blue-50/70 dark:border-blue-500/30 dark:bg-blue-500/10'
            : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'"
          @click="emit('selectLine', line.id)"
        >
          <div
            class="px-2.5 py-1.5 flex items-center gap-2"
            :class="{ 'opacity-40': line.dnp }"
          >
            <span class="text-[10px] font-mono text-neutral-500 dark:text-neutral-400 shrink-0 w-[60px] truncate" :title="line.references">
              {{ line.references || '--' }}
            </span>
            <UIcon
              v-if="getMissingInPnP(line).length > 0"
              name="i-lucide-triangle-alert"
              class="text-[10px] text-amber-500 shrink-0"
              :title="`Not in PnP: ${getMissingInPnP(line).join(', ')}`"
            />
            <span
              class="text-[11px] flex-1 truncate"
              :class="line.dnp ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-800 dark:text-neutral-200'"
              :title="line.description"
            >
              {{ line.description || '(no description)' }}
            </span>
            <!-- DNP badge -->
            <span
              v-if="line.dnp"
              class="text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
            >
              DNP
            </span>
            <!-- CP badge -->
            <span
              v-if="line.customerProvided"
              class="text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20"
            >
              CP
            </span>
            <!-- Type badge (click to cycle) -->
            <button
              class="text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 transition-colors"
              :class="typeClass(line.type)"
              title="Click to change type"
              @click.stop="cycleType(line)"
            >
              {{ line.type }}
            </button>
            <!-- Quantity (click to edit inline) -->
            <div class="shrink-0 text-right" @click.stop>
              <input
                v-if="editingQtyId === line.id"
                ref="qtyInputRef"
                v-model.number="editingQtyValue"
                type="number"
                min="0"
                class="w-12 text-[10px] tabular-nums bg-neutral-100 dark:bg-neutral-800 border border-primary rounded px-1 py-0.5 outline-none text-center"
                @keydown.enter="commitQty(line.id)"
                @keydown.escape="cancelQty"
                @blur="commitQty(line.id)"
              />
              <button
                v-else
                class="text-[10px] text-neutral-500 tabular-nums hover:text-primary transition-colors"
                :title="`${line.quantity} per board × ${boardQuantity} boards — click to edit`"
                @click.stop="startQtyEdit(line)"
              >
                {{ line.quantity }}x
                <span v-if="boardQuantity > 1" class="text-neutral-400">({{ formatNumber(line.quantity * boardQuantity) }})</span>
              </button>
            </div>
            <!-- Pricing badge: unit price + line value -->
            <template v-if="!line.dnp">
              <template v-for="offer in [getLineBestOffer(line)]" :key="'price'">
                <template v-if="offer">
                  <template v-for="display in [getDisplayOffer(offer)]" :key="`${line.id}-${display.currency}`">
                    <span class="text-[10px] text-green-600 dark:text-green-400 font-medium shrink-0 tabular-nums">
                      {{ formatCurrency(display.unitPrice, display.currency) }}/pc
                    </span>
                    <span class="text-[10px] text-neutral-400 shrink-0 tabular-nums">
                      {{ formatCurrency(display.lineValue, display.currency) }}
                    </span>
                  </template>
                </template>
              </template>
            </template>
          </div>

        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { BomLine, BomPricingCache } from '~/utils/bom-types'
import { BOM_LINE_TYPES } from '~/utils/bom-types'
import type { ExchangeRateSnapshot, PricingQueueItem } from '~/composables/useElexessApi'
import { formatCurrency, normalizeCurrencyCode } from '~/utils/currency'

const props = defineProps<{
  bomLines: BomLine[]
  filteredLines: BomLine[]
  searchQuery: string
  pricingCache: BomPricingCache
  hasCredentials: boolean
  isFetchingPricing: boolean
  pricingQueue: PricingQueueItem[]
  boardQuantity: number
  teamCurrency: 'USD' | 'EUR'
  exchangeRate: ExchangeRateSnapshot | null
  /** Set of designators present in PnP data (SMD + THT, excluding DNP) */
  pnpDesignators: Set<string>
  selectedLineId: string | null
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:boardQuantity': [value: number]
  'addLine': [line?: Partial<BomLine>]
  'updateLine': [id: string, updates: Partial<BomLine>]
  'removeLine': [id: string]
  'fetchAllPricing': []
  'selectLine': [id: string]
}>()

const searchQuery = computed({
  get: () => props.searchQuery,
  set: (v) => emit('update:searchQuery', v),
})

function handleBoardQtyInput(e: Event) {
  const val = parseInt((e.target as HTMLInputElement).value, 10)
  if (val > 0 && !isNaN(val)) {
    emit('update:boardQuantity', val)
  }
}

// ── Filter chips + sort ──

type FilterKey = 'smd' | 'tht' | 'dnp' | 'cp' | 'no-mfr' | 'no-price'
const activeFilters = ref(new Set<FilterKey>())
const sortBy = ref<'designator' | 'price'>('designator')

function toggleFilter(key: FilterKey) {
  const next = new Set(activeFilters.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  activeFilters.value = next
}

function lineHasPrice(line: BomLine): boolean {
  const totalQty = line.quantity * props.boardQuantity
  for (const mfr of line.manufacturers) {
    if (getSupplierOffers(mfr.manufacturerPart, totalQty).length > 0) return true
  }
  return false
}

function lineHasManufacturer(line: BomLine): boolean {
  return line.manufacturers.length > 0 && line.manufacturers.some(m => !!m.manufacturerPart)
}

const filterDefs = computed(() => {
  const lines = props.filteredLines
  return [
    { key: 'smd' as FilterKey, label: 'SMD', count: lines.filter(l => l.type === 'SMD').length, activeClass: 'border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' },
    { key: 'tht' as FilterKey, label: 'THT', count: lines.filter(l => l.type === 'THT').length, activeClass: 'border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20' },
    { key: 'dnp' as FilterKey, label: 'DNP', count: lines.filter(l => l.dnp).length, activeClass: 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20' },
    { key: 'cp' as FilterKey, label: 'CP', count: lines.filter(l => l.customerProvided).length, activeClass: 'border-teal-300 dark:border-teal-700 text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20' },
    { key: 'no-mfr' as FilterKey, label: 'No MFR', count: lines.filter(l => !lineHasManufacturer(l)).length, activeClass: 'border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' },
    { key: 'no-price' as FilterKey, label: 'No Price', count: lines.filter(l => !lineHasPrice(l)).length, activeClass: 'border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20' },
  ]
})

/** Apply local filters and sorting on top of the text-search filteredLines. */
const displayLines = computed(() => {
  let lines = props.filteredLines
  const filters = activeFilters.value

  if (filters.size > 0) {
    lines = lines.filter(line => {
      if (filters.has('smd') && line.type === 'SMD') return true
      if (filters.has('tht') && line.type === 'THT') return true
      if (filters.has('dnp') && line.dnp) return true
      if (filters.has('cp') && line.customerProvided) return true
      if (filters.has('no-mfr') && !lineHasManufacturer(line)) return true
      if (filters.has('no-price') && !lineHasPrice(line)) return true
      return false
    })
  }

  if (sortBy.value === 'price') {
    lines = [...lines].sort((a, b) => {
      const pa = getLineBestOffer(a)?.lineValue ?? -1
      const pb = getLineBestOffer(b)?.lineValue ?? -1
      return pb - pa
    })
  } else {
    lines = [...lines].sort((a, b) => {
      const ra = a.references || '\uffff'
      const rb = b.references || '\uffff'
      return ra.localeCompare(rb, undefined, { numeric: true })
    })
  }

  return lines
})

// ── Copy CP items to clipboard ──

const cpLines = computed(() => props.bomLines.filter(l => l.customerProvided && !l.dnp))
const cpCopied = ref(false)
let cpCopyTimeout: ReturnType<typeof setTimeout> | undefined

function copyCpItems() {
  if (cpLines.value.length === 0) return
  const text = cpLines.value.map((line) => {
    const refs = line.references || '—'
    const parts = [line.description, line.package, line.type].filter(Boolean).join('/')
    return `${refs} = ${parts}`
  }).join('\n')
  navigator.clipboard.writeText(text).then(() => {
    cpCopied.value = true
    if (cpCopyTimeout) clearTimeout(cpCopyTimeout)
    cpCopyTimeout = setTimeout(() => { cpCopied.value = false }, 1500)
  })
}

// ── Inline type cycling ──

function cycleType(line: BomLine) {
  const idx = BOM_LINE_TYPES.indexOf(line.type)
  const next = BOM_LINE_TYPES[(idx + 1) % BOM_LINE_TYPES.length]
  emit('updateLine', line.id, { type: next })
}

// ── Inline quantity editing ──

const editingQtyId = ref<string | null>(null)
const editingQtyValue = ref(1)
const qtyInputRef = ref<HTMLInputElement | null>(null)

function startQtyEdit(line: BomLine) {
  editingQtyId.value = line.id
  editingQtyValue.value = line.quantity
  nextTick(() => {
    qtyInputRef.value?.select()
  })
}

function commitQty(lineId: string) {
  if (editingQtyId.value !== lineId) return
  const val = editingQtyValue.value
  if (typeof val === 'number' && val >= 0 && !isNaN(val)) {
    emit('updateLine', lineId, { quantity: val })
  }
  editingQtyId.value = null
}

function cancelQty() {
  editingQtyId.value = null
}

// ── Inline add manufacturer ──


// ── Queue computed helpers ──

const queueExpanded = ref(false)

const queueTotal = computed(() => props.pricingQueue.length)
const queueDone = computed(() => props.pricingQueue.filter(i => i.status === 'done' || i.status === 'error').length)
const queueErrors = computed(() => props.pricingQueue.filter(i => i.status === 'error').length)

// Auto-expand queue when fetching starts, collapse when done
watch(() => props.isFetchingPricing, (fetching) => {
  if (fetching) queueExpanded.value = true
})

watch(() => props.pricingQueue.length, (len) => {
  if (len === 0) queueExpanded.value = false
})

// ── Helpers ──

function formatNumber(n: number): string {
  return n.toLocaleString()
}

function typeClass(type: string) {
  switch (type) {
    case 'SMD': return 'border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
    case 'THT': return 'border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20'
    case 'Mounting': return 'border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20'
    default: return 'border-neutral-200 dark:border-neutral-700 text-neutral-500'
  }
}

// ── BOM ↔ PnP mismatch helpers ──

/**
 * Parse comma-separated references into individual designators.
 */
function parseRefs(refs: string): string[] {
  if (!refs) return []
  return refs.split(/[,;\s]+/).map(r => r.trim()).filter(Boolean)
}

/**
 * Get designators from a BOM line that are missing in PnP data.
 * DNP lines return empty (no warning needed).
 * Returns empty when no PnP data is loaded (no false positives).
 */
function getMissingInPnP(line: BomLine): string[] {
  if (line.dnp || props.pnpDesignators.size === 0) return []
  return parseRefs(line.references).filter(r => !props.pnpDesignators.has(r))
}

const mismatchSummary = computed<{
  linesWithMissing: number
  uniqueMissingRefs: number
} | null>(() => {
  if (props.pnpDesignators.size === 0) return null
  let linesWithMissing = 0
  const missingRefs = new Set<string>()
  for (const line of props.bomLines) {
    const missing = getMissingInPnP(line)
    if (missing.length === 0) continue
    linesWithMissing++
    for (const ref of missing) missingRefs.add(ref)
  }
  if (linesWithMissing === 0) return null
  return {
    linesWithMissing,
    uniqueMissingRefs: missingRefs.size,
  }
})

// ── Elexess pricing extraction ──
// Elexess response: { results: [{ supplier, country, current_stock, moq, current_leadtime, pricebreaks: [{ quantity, price, currency }] }] }

interface SupplierOffer {
  supplier: string
  country: string
  stock: number
  moq: number
  breakQty: number
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

/**
 * Pick the best price tier for a given quantity from an array of pricebreaks.
 * Returns the tier whose quantity is <= totalQty and closest to it,
 * or the first tier if qty is below all tiers.
 */
interface PriceBreak {
  quantity?: number
  price?: number
  currency?: string
}

function pickTierPrice(pricebreaks: PriceBreak[], totalQty: number): { price: number; currency: string; quantity: number } | null {
  if (!pricebreaks || pricebreaks.length === 0) return null
  const eligible = pricebreaks
    .map(tier => ({
      quantity: Number(tier.quantity),
      price: Number(tier.price),
      currency: tier.currency || 'EUR',
    }))
    .filter(tier =>
      Number.isFinite(tier.quantity)
      && tier.quantity > 0
      && tier.quantity <= totalQty
      && Number.isFinite(tier.price)
      && tier.price >= 0,
    )
  if (!eligible.length) return null
  const best = eligible.sort((a, b) => a.quantity - b.quantity)[eligible.length - 1]
  return { price: best.price, currency: best.currency, quantity: best.quantity }
}

/**
 * Extract supplier offers from cached Elexess data for an MPN.
 * Returns offers sorted by unit price (cheapest first), deduplicated by supplier.
 */
function getSupplierOffers(mpn: string, totalQty: number): SupplierOffer[] {
  const entry = props.pricingCache[mpn]
  if (!entry?.data) return []
  const results = entry.data?.results
  if (!Array.isArray(results) || results.length === 0) return []

  const candidates: SupplierOffer[] = []
  const seenSuppliers = new Set<string>()

  for (const r of results) {
    if (!r.pricebreaks || r.pricebreaks.length === 0) continue
    const moq = Math.max(0, Number(r.moq ?? 0) || 0)
    if (moq > totalQty) continue
    const tier = pickTierPrice(r.pricebreaks, totalQty)
    if (!tier) continue

    candidates.push({
      supplier: r.supplier || 'Unknown',
      country: r.country || '',
      stock: r.current_stock ?? 0,
      moq,
      breakQty: tier.quantity,
      leadtime: r.current_leadtime ?? null,
      unitPrice: tier.price,
      currency: tier.currency,
      lineValue: tier.price * totalQty,
    })
  }

  const offers: SupplierOffer[] = []
  for (const offer of candidates.sort((a, b) => comparableUnitPrice(a) - comparableUnitPrice(b))) {
    // Deduplicate by supplier after conversion to the team currency.
    const key = offer.supplier
    if (seenSuppliers.has(key)) continue
    seenSuppliers.add(key)
    offers.push(offer)
  }

  return offers.sort((a, b) => comparableUnitPrice(a) - comparableUnitPrice(b))
}

/**
 * Get the cheapest supplier offer across all MPNs for a BOM line.
 * Only considers suppliers with enough stock to fulfil the total quantity.
 */
function getLineBestOffer(line: BomLine): SupplierOffer | null {
  const totalQty = line.quantity * props.boardQuantity
  let best: SupplierOffer | null = null
  for (const mfr of line.manufacturers) {
    const offers = getSupplierOffers(mfr.manufacturerPart, totalQty)
    for (const offer of offers) {
      if (offer.stock < totalQty) continue
      if (!best || comparableUnitPrice(offer) < comparableUnitPrice(best)) {
        best = offer
      }
      break // offers are sorted by price, first with stock wins for this MPN
    }
  }
  return best
}

function comparableUnitPrice(offer: SupplierOffer): number {
  const converted = convertAmount(offer.unitPrice, offer.currency, props.teamCurrency)
  return converted ?? offer.unitPrice
}

function getDisplayOffer(offer: SupplierOffer): DisplayOffer {
  const unitPrice = convertAmount(offer.unitPrice, offer.currency, props.teamCurrency)
  const lineValue = convertAmount(offer.lineValue, offer.currency, props.teamCurrency)
  if (unitPrice == null || lineValue == null) {
    return {
      unitPrice: offer.unitPrice,
      lineValue: offer.lineValue,
      currency: offer.currency,
    }
  }
  return {
    unitPrice,
    lineValue,
    currency: props.teamCurrency,
  }
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

</script>
