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
        title="Sort by total price (cheapest first)"
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
          class="text-[10px] px-1.5 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-green-600 dark:hover:text-green-400 hover:border-green-300 dark:hover:border-green-600 transition-colors flex items-center gap-0.5"
          title="Add BOM line"
          @click="openEditModal(null)"
        >
          <UIcon name="i-lucide-plus" class="text-[10px]" />
          Add
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
          class="rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors cursor-pointer"
          @click="toggleExpanded(line.id)"
        >
          <!-- Compact row -->
          <div
            class="px-2.5 py-1.5 flex items-center gap-2"
            :class="{ 'opacity-40': line.dnp }"
          >
            <UIcon
              :name="expandedIds.has(line.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
              class="text-[10px] text-neutral-400 shrink-0"
            />
            <span class="text-[10px] font-mono text-neutral-500 dark:text-neutral-400 shrink-0 w-[60px] truncate" :title="line.references">
              {{ line.references || '--' }}
            </span>
            <span
              class="text-[11px] flex-1 truncate"
              :class="line.dnp ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-800 dark:text-neutral-200'"
              :title="line.description"
            >
              {{ line.description || '(no description)' }}
            </span>
            <!-- DNP badge -->
            <button
              class="text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 transition-colors"
              :class="line.dnp
                ? 'border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                : 'border-transparent text-transparent pointer-events-none'"
              :title="line.dnp ? 'Click to remove DNP' : ''"
              @click.stop="toggleDnp(line)"
            >
              DNP
            </button>
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
                  <span class="text-[10px] text-green-600 dark:text-green-400 font-medium shrink-0 tabular-nums">
                    {{ formatCurrency(offer.unitPrice, offer.currency) }}/pc
                  </span>
                  <span class="text-[10px] text-neutral-400 shrink-0 tabular-nums">
                    {{ formatCurrency(offer.lineValue, offer.currency) }}
                  </span>
                </template>
              </template>
            </template>
            <!-- Context actions -->
            <div class="flex items-center gap-0.5 shrink-0">
              <button
                class="text-neutral-400 hover:transition-colors shrink-0"
                :class="line.dnp ? 'text-red-400 hover:text-red-500' : 'hover:text-amber-500'"
                :title="line.dnp ? 'Remove DNP' : 'Mark as DNP'"
                @click.stop="toggleDnp(line)"
              >
                <UIcon name="i-lucide-circle-slash" class="text-xs" />
              </button>
              <button
                class="text-neutral-400 hover:text-primary transition-colors shrink-0"
                title="Edit"
                @click.stop="openEditModal(line)"
              >
                <UIcon name="i-lucide-pencil" class="text-xs" />
              </button>
            </div>
          </div>

          <!-- Expanded detail -->
          <div v-if="expandedIds.has(line.id)" class="px-2.5 pb-2.5 pt-0.5 border-t border-neutral-100 dark:border-neutral-800" :class="{ 'opacity-50': line.dnp }" @click.stop>
            <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] mb-2">
              <div v-if="line.dnp"><span class="text-red-500 font-medium">Do Not Populate</span></div>
              <div v-if="line.package"><span class="text-neutral-400">Package:</span> {{ line.package }}</div>
              <div v-if="line.customerItemNo"><span class="text-neutral-400">Cust. Item:</span> {{ line.customerItemNo }}</div>
              <div v-if="line.customerProvided"><span class="text-amber-500">Customer Provided</span></div>
              <div v-if="line.comment"><span class="text-neutral-400">Comment:</span> {{ line.comment }}</div>
              <div v-if="boardQuantity > 1">
                <span class="text-neutral-400">Total pcs:</span>
                <span class="font-medium"> {{ formatNumber(line.quantity * boardQuantity) }}</span>
              </div>
            </div>

            <!-- Manufacturers & supplier offers -->
            <div class="space-y-2">
              <div
                v-for="(mfr, idx) in line.manufacturers"
                :key="idx"
                class="space-y-1"
              >
                <!-- MPN header -->
                <div class="flex items-center gap-2">
                  <span class="text-[10px] text-neutral-600 dark:text-neutral-300 font-medium">{{ mfr.manufacturer || '(unknown)' }}</span>
                  <span class="text-[10px] font-mono text-neutral-500">{{ mfr.manufacturerPart }}</span>
                  <!-- Queue status indicator for this MPN -->
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
                  <button
                    v-if="hasCredentials && mfr.manufacturerPart"
                    class="text-neutral-400 hover:text-blue-500 transition-colors shrink-0"
                    title="Refresh pricing for this part"
                    :disabled="getQueueStatus(mfr.manufacturerPart) === 'fetching'"
                    @click.stop="handleRefreshSingle(mfr.manufacturerPart)"
                  >
                    <UIcon name="i-lucide-refresh-cw" class="text-[10px]" />
                  </button>
                  <span v-if="pricingCache[mfr.manufacturerPart]" class="text-[10px] text-neutral-400 ml-auto shrink-0">
                    {{ formatAge(pricingCache[mfr.manufacturerPart]?.fetchedAt) }}
                  </span>
                </div>

                <!-- Supplier offers table -->
                <div v-if="getSupplierOffers(mfr.manufacturerPart, line.quantity * boardQuantity).length > 0" class="rounded border border-neutral-100 dark:border-neutral-800 overflow-hidden">
                  <!-- Table header -->
                  <div class="grid grid-cols-[1fr_60px_60px_70px_70px] gap-1 px-2 py-0.5 bg-neutral-50 dark:bg-neutral-800/80 text-[9px] text-neutral-400 uppercase tracking-wide font-medium">
                    <span>Supplier</span>
                    <span class="text-right">Stock</span>
                    <span class="text-right">MOQ</span>
                    <span class="text-right">Unit</span>
                    <span class="text-right">Total</span>
                  </div>
                  <!-- Supplier rows -->
                  <div
                    v-for="(offer, oi) in getSupplierOffers(mfr.manufacturerPart, line.quantity * boardQuantity)"
                    :key="oi"
                    class="grid grid-cols-[1fr_60px_60px_70px_70px] gap-1 px-2 py-0.5 text-[10px] border-t border-neutral-50 dark:border-neutral-800/50"
                    :class="{ 'bg-green-50/30 dark:bg-green-900/5': oi === 0 }"
                  >
                    <span class="text-neutral-600 dark:text-neutral-300 truncate" :title="offer.supplier + (offer.country ? ` (${offer.country})` : '')">
                      {{ offer.supplier }}
                    </span>
                    <span class="text-right tabular-nums" :class="offer.stock > 0 ? 'text-neutral-600 dark:text-neutral-300' : 'text-red-400'">
                      {{ formatNumber(offer.stock) }}
                    </span>
                    <span class="text-right tabular-nums text-neutral-500">
                      {{ formatNumber(offer.moq) }}
                    </span>
                    <span class="text-right tabular-nums font-medium" :class="oi === 0 ? 'text-green-600 dark:text-green-400' : 'text-neutral-600 dark:text-neutral-300'">
                      {{ formatCurrency(offer.unitPrice, offer.currency) }}
                    </span>
                    <span class="text-right tabular-nums text-neutral-500">
                      {{ formatCurrency(offer.lineValue, offer.currency) }}
                    </span>
                  </div>
                </div>

                <!-- No pricing data -->
                <div v-else-if="!pricingCache[mfr.manufacturerPart] && !getQueueStatus(mfr.manufacturerPart)" class="text-[10px] text-neutral-400 italic pl-1">
                  No pricing data
                </div>
              </div>

              <!-- Inline add manufacturer -->
              <div v-if="inlineAddLineId === line.id" class="flex items-center gap-1.5 mt-1" @click.stop>
                <input
                  v-model="inlineAddMfr"
                  type="text"
                  placeholder="Manufacturer"
                  class="flex-1 text-[10px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-1.5 py-0.5 outline-none focus:border-primary transition-colors"
                  @keydown.enter="confirmInlineAdd(line.id)"
                />
                <input
                  v-model="inlineAddMpn"
                  type="text"
                  placeholder="MPN"
                  class="flex-1 text-[10px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-1.5 py-0.5 outline-none focus:border-primary transition-colors"
                  @keydown.enter="confirmInlineAdd(line.id)"
                />
                <button
                  class="text-green-500 hover:text-green-600 transition-colors shrink-0"
                  title="Add"
                  @click.stop="confirmInlineAdd(line.id)"
                >
                  <UIcon name="i-lucide-check" class="text-xs" />
                </button>
                <button
                  class="text-neutral-400 hover:text-neutral-600 transition-colors shrink-0"
                  title="Cancel"
                  @click.stop="cancelInlineAdd"
                >
                  <UIcon name="i-lucide-x" class="text-xs" />
                </button>
              </div>
              <button
                v-else
                class="text-[10px] text-primary hover:text-primary/80 font-medium mt-0.5"
                @click.stop="startInlineAdd(line.id)"
              >
                + Add Manufacturer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit modal -->
    <BomLineEditModal
      v-model:open="showEditModal"
      :line="editingLine"
      @save="handleLineSave"
      @delete="handleLineDelete"
    />
  </div>
</template>

<script setup lang="ts">
import type { BomLine, BomPricingCache } from '~/utils/bom-types'
import { BOM_LINE_TYPES } from '~/utils/bom-types'
import type { PricingQueueItem } from '~/composables/useElexessApi'

const props = defineProps<{
  bomLines: BomLine[]
  filteredLines: BomLine[]
  searchQuery: string
  pricingCache: BomPricingCache
  hasCredentials: boolean
  isFetchingPricing: boolean
  pricingQueue: PricingQueueItem[]
  boardQuantity: number
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:boardQuantity': [value: number]
  'addLine': [line?: Partial<BomLine>]
  'updateLine': [id: string, updates: Partial<BomLine>]
  'removeLine': [id: string]
  'addManufacturer': [lineId: string, mfr: { manufacturer: string; manufacturerPart: string }]
  'fetchAllPricing': []
  'fetchSinglePricing': [partNumber: string]
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

type FilterKey = 'smd' | 'tht' | 'dnp' | 'no-mfr' | 'no-price'
const activeFilters = ref(new Set<FilterKey>())
const sortBy = ref<'designator' | 'price'>('designator')

function toggleFilter(key: FilterKey) {
  const next = new Set(activeFilters.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  activeFilters.value = next
}

function lineHasPrice(line: BomLine): boolean {
  for (const mfr of line.manufacturers) {
    const entry = props.pricingCache[mfr.manufacturerPart]
    if (entry?.data?.results?.length > 0) return true
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

// Expanded rows
const expandedIds = ref(new Set<string>())

function toggleExpanded(id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
  expandedIds.value = new Set(expandedIds.value)
}

// Edit modal
const showEditModal = ref(false)
const editingLine = ref<BomLine | null>(null)

function openEditModal(line: BomLine | null) {
  editingLine.value = line
  showEditModal.value = true
}

function handleLineSave(line: BomLine) {
  if (editingLine.value) {
    emit('updateLine', line.id, line)
  } else {
    emit('addLine', line)
  }
}

function handleLineDelete(id: string) {
  emit('removeLine', id)
}

function handleRefreshSingle(partNumber: string) {
  emit('fetchSinglePricing', partNumber)
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

// ── DNP toggle ──

function toggleDnp(line: BomLine) {
  emit('updateLine', line.id, { dnp: !line.dnp })
}

// ── Inline add manufacturer ──

const inlineAddLineId = ref<string | null>(null)
const inlineAddMfr = ref('')
const inlineAddMpn = ref('')

function startInlineAdd(lineId: string) {
  inlineAddLineId.value = lineId
  inlineAddMfr.value = ''
  inlineAddMpn.value = ''
}

function cancelInlineAdd() {
  inlineAddLineId.value = null
  inlineAddMfr.value = ''
  inlineAddMpn.value = ''
}

function confirmInlineAdd(lineId: string) {
  const mfr = inlineAddMfr.value.trim()
  const mpn = inlineAddMpn.value.trim()
  if (!mfr && !mpn) return
  emit('addManufacturer', lineId, { manufacturer: mfr, manufacturerPart: mpn })
  cancelInlineAdd()
}

// ── Queue computed helpers ──

const queueExpanded = ref(false)

const queueTotal = computed(() => props.pricingQueue.length)
const queueDone = computed(() => props.pricingQueue.filter(i => i.status === 'done' || i.status === 'error').length)
const queueErrors = computed(() => props.pricingQueue.filter(i => i.status === 'error').length)

function getQueueStatus(partNumber: string): PricingQueueItem['status'] | null {
  const item = props.pricingQueue.find(i => i.partNumber === partNumber)
  return item?.status ?? null
}

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

// ── Elexess pricing extraction ──
// Elexess response: { results: [{ supplier, country, current_stock, moq, current_leadtime, pricebreaks: [{ quantity, price, currency }] }] }

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

/**
 * Pick the best price tier for a given quantity from an array of pricebreaks.
 * Returns the tier whose quantity is <= totalQty and closest to it,
 * or the first tier if qty is below all tiers.
 */
function pickTierPrice(pricebreaks: any[], totalQty: number): { price: number; currency: string } | null {
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

/**
 * Extract supplier offers from cached Elexess data for an MPN.
 * Returns offers sorted by unit price (cheapest first), deduplicated by supplier.
 */
function getSupplierOffers(mpn: string, totalQty: number): SupplierOffer[] {
  const entry = props.pricingCache[mpn]
  if (!entry?.data) return []
  const results = entry.data?.results
  if (!Array.isArray(results) || results.length === 0) return []

  const offers: SupplierOffer[] = []
  const seenSuppliers = new Set<string>()

  for (const r of results) {
    if (!r.pricebreaks || r.pricebreaks.length === 0) continue
    const tier = pickTierPrice(r.pricebreaks, totalQty)
    if (!tier) continue

    // Deduplicate by supplier — keep cheapest
    const key = `${r.supplier}-${tier.currency}`
    if (seenSuppliers.has(key)) continue
    seenSuppliers.add(key)

    offers.push({
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

  return offers.sort((a, b) => a.unitPrice - b.unitPrice)
}

/**
 * Get the cheapest supplier offer across all MPNs for a BOM line.
 */
function getLineBestOffer(line: BomLine): SupplierOffer | null {
  const totalQty = line.quantity * props.boardQuantity
  let best: SupplierOffer | null = null
  for (const mfr of line.manufacturers) {
    const offers = getSupplierOffers(mfr.manufacturerPart, totalQty)
    if (offers.length > 0 && (!best || offers[0].unitPrice < best.unitPrice)) {
      best = offers[0]
    }
  }
  return best
}

function formatCurrency(value: number, currency: string): string {
  if (value < 0.01) {
    return `${currency} ${value.toFixed(4)}`
  }
  return `${currency} ${value.toFixed(2)}`
}

function formatAge(fetchedAt: string | undefined): string {
  if (!fetchedAt) return ''
  const ms = Date.now() - new Date(fetchedAt).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
</script>
