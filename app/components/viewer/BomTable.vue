<template>
  <div class="h-full min-h-0 flex flex-col overflow-hidden">
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
        class="text-[10px] px-1.5 py-0.5 rounded-full border transition-colors flex items-center gap-0.5"
        :class="hideDnp
          ? 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
          : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'"
        @click="hideDnp = !hideDnp"
      >
        Hide DNP
        <span class="tabular-nums opacity-60">{{ dnpCount }}</span>
      </button>
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
      <span class="flex-1" />
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
      </div>
      <div class="flex items-center gap-1">
        <button
          class="text-[10px] px-1.5 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-green-600 dark:hover:text-green-400 hover:border-green-300 dark:hover:border-green-600 transition-colors flex items-center gap-0.5"
          title="Add BOM line"
          :disabled="props.locked"
          @click="emit('addLine')"
        >
          <UIcon name="i-lucide-plus" class="text-[10px]" />
          Add Item
        </button>
        <template v-if="!props.locked">
          <div v-if="showNewGroupInput" class="flex items-center gap-1">
            <input
              v-model="newGroupName"
              class="min-w-0 w-28 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded px-1.5 py-0.5 text-[10px] outline-none focus:border-primary"
              placeholder="Group name"
              @keydown.enter="commitNewGroup"
              @keydown.escape="showNewGroupInput = false; newGroupName = ''"
              @blur="commitNewGroup"
              @vue:mounted="($event as any).el?.focus()"
            />
          </div>
          <button
            v-else
            class="text-[10px] px-1.5 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-green-600 dark:hover:text-green-400 hover:border-green-300 dark:hover:border-green-600 transition-colors flex items-center gap-0.5"
            title="Add group"
            @click="showNewGroupInput = true"
          >
            <UIcon name="i-lucide-folder-plus" class="text-[10px]" />
            Add Group
          </button>
        </template>
      </div>
    </div>

    <!-- Pricing queue status strip -->
    <div v-if="pricingQueue.length > 0" class="mx-3 mb-2 rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
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

      <div v-if="queueTotal > 0" class="h-0.5 bg-neutral-100 dark:bg-neutral-800">
        <div
          class="h-full transition-all duration-300"
          :class="queueErrors > 0 ? 'bg-amber-500' : 'bg-blue-500'"
          :style="{ width: `${(queueDone / queueTotal) * 100}%` }"
        />
      </div>

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

    <div v-if="!hasCredentials && bomLines.length > 0" class="mx-3 mb-2 px-2 py-1.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
      Elexess API not configured. Set credentials in Team Settings to fetch pricing.
    </div>

    <!-- Table -->
    <div class="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
      <div v-if="bomLines.length === 0" class="text-center py-8">
        <UIcon name="i-lucide-clipboard-list" class="text-3xl text-neutral-300 dark:text-neutral-600 mb-2" />
        <p class="text-xs text-neutral-400">No BOM data yet.</p>
        <p class="text-[10px] text-neutral-400 mt-1">
          Import a BOM file (.csv, .xlsx) via the Files tab, or add lines manually.
        </p>
      </div>

      <div v-else class="space-y-1">
        <template v-for="(row, rowIdx) in displayRows" :key="row.kind === 'line' ? row.line.id : row.kind === 'group' ? row.group.id : 'ungrouped'">
          <!-- Ungrouped section header -->
          <div
            v-if="row.kind === 'ungrouped' && hasGroups"
            class="flex items-center gap-2 px-2 py-1.5 text-[10px] select-none"
            @dragover.prevent
            @drop.prevent="onDropOnUngrouped()"
          >
            <span class="font-medium text-neutral-500 dark:text-neutral-400">Ungrouped</span>
            <span class="text-neutral-400">({{ row.count }})</span>
          </div>

          <!-- Group header -->
          <div
            v-else-if="row.kind === 'group'"
            class="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-neutral-100/80 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/40 text-[10px] select-none"
            @dragover.prevent
            @drop.prevent="onDropOnGroup(row.group.id)"
          >
            <button class="shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300" @click="emit('updateGroup', row.group.id, { collapsed: !row.group.collapsed })">
              <UIcon :name="row.group.collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'" class="text-xs" />
            </button>
            <template v-if="editingGroupId === row.group.id">
              <input
                v-model="editingGroupName"
                class="flex-1 min-w-0 bg-white dark:bg-neutral-900 border border-primary rounded px-1.5 py-0.5 text-[10px] outline-none"
                @keydown.enter="commitGroupRename(row.group.id)"
                @keydown.escape="editingGroupId = null"
                @blur="commitGroupRename(row.group.id)"
                @vue:mounted="($event as any).el?.focus()"
              />
            </template>
            <template v-else>
              <span class="font-medium text-neutral-700 dark:text-neutral-200 truncate flex-1 min-w-0 cursor-pointer" @dblclick="startGroupRename(row.group)">{{ row.group.name }}</span>
            </template>
            <span class="text-neutral-400 shrink-0">({{ row.count }})</span>
            <UButton v-if="!props.locked" size="xs" color="neutral" variant="ghost" icon="i-lucide-trash-2" class="!p-0.5" title="Delete group" @click="emit('removeGroup', row.group.id)" />
          </div>

          <!-- BOM line -->
          <div
            v-else-if="row.kind === 'line'"
            :ref="(el) => { if (el) lineRefs[row.line.id] = el as HTMLElement }"
            class="rounded-lg border transition-colors cursor-pointer"
            :class="[
              selectedLineId === row.line.id
                ? 'border-blue-400/40 bg-blue-50/70 dark:border-blue-500/30 dark:bg-blue-500/10'
                : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600',
              dragOverTarget === row.line.id && dragLineId !== row.line.id ? 'ring-2 ring-primary/40' : '',
            ]"
            draggable="true"
            @click="emit('selectLine', row.line.id)"
            @dragstart="onDragStart($event, row.line.id)"
            @dragend="onDragEnd"
            @dragover="onDragOverLine($event, row.line.id)"
            @dragleave="dragOverTarget === row.line.id && (dragOverTarget = null)"
            @drop.prevent="onDropOnLine(row.line.id)"
          >
            <div class="px-2.5 py-1.5 flex items-center gap-2" :class="{ 'opacity-40': row.line.dnp }">
              <span class="text-[10px] font-mono text-neutral-500 dark:text-neutral-400 shrink-0 w-[60px] truncate" :title="row.line.references">
                {{ row.line.references || '--' }}
              </span>
              <span
                v-if="isLineChanged(row.line)"
                class="text-[9px] px-1.5 py-0.5 rounded-full border shrink-0"
                :class="editedBadgeClass"
                title="This line differs from the original customer BOM"
              >
                Edited
              </span>
              <UIcon
                v-if="getMissingInPnP(row.line).length > 0"
                name="i-lucide-triangle-alert"
                class="text-[10px] text-amber-500 shrink-0"
                :title="`Not in PnP: ${getMissingInPnP(row.line).join(', ')}`"
              />
              <span
                class="text-[11px] flex-1 truncate"
                :class="row.line.dnp ? 'line-through text-neutral-400 dark:text-neutral-500' : 'text-neutral-800 dark:text-neutral-200'"
                :title="row.line.description"
              >
                {{ row.line.description || '(no description)' }}
              </span>
              <span
                v-if="row.line.dnp"
                class="text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"
              >
                DNP
              </span>
              <span
                v-if="row.line.customerProvided"
                class="text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20"
              >
                CP
              </span>
              <button
                class="text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 transition-colors"
                :disabled="props.locked"
                :class="typeClass(row.line.type)"
                title="Click to change type"
                @click.stop="cycleType(row.line)"
              >
                {{ row.line.type }}
              </button>
              <UIcon
                v-if="props.aiSuggestions?.[row.line.id]"
                name="i-lucide-sparkles"
                class="text-[10px] text-violet-500 shrink-0"
                title="Spark has suggestions for this line"
              />
              <div class="shrink-0 text-right" @click.stop>
                <input
                  v-if="editingQtyId === row.line.id"
                  ref="qtyInputRef"
                  v-model.number="editingQtyValue"
                  type="number"
                  min="0"
                  class="w-12 text-[10px] tabular-nums bg-neutral-100 dark:bg-neutral-800 border border-primary rounded px-1 py-0.5 outline-none text-center"
                  @keydown.enter="commitQty(row.line.id)"
                  @keydown.escape="cancelQty"
                  @blur="commitQty(row.line.id)"
                />
                <button
                  v-else
                  class="text-[10px] text-neutral-500 tabular-nums hover:text-primary transition-colors"
                  :disabled="props.locked"
                  :title="`${row.line.quantity} per board × ${boardQuantity} boards — click to edit`"
                  @click.stop="startQtyEdit(row.line)"
                >
                  {{ row.line.quantity }}x
                  <span v-if="boardQuantity > 1" class="text-neutral-400">({{ formatNumber(row.line.quantity * boardQuantity) }})</span>
                </button>
              </div>
              <template v-if="!row.line.dnp">
                <template v-for="offer in [getLineBestOffer(row.line)]" :key="'price'">
                  <template v-if="offer">
                    <template v-for="display in [getDisplayOffer(offer)]" :key="`${row.line.id}-${display.currency}`">
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
        </template>

      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { BomLine, BomPricingCache, BomAiSuggestions, BomGroup } from '~/utils/bom-types'
import { BOM_LINE_TYPES } from '~/utils/bom-types'
import type { ExchangeRateSnapshot, PricingQueueItem } from '~/composables/useElexessApi'
import { formatCurrency, normalizeCurrencyCode } from '~/utils/currency'

const props = defineProps<{
  bomLines: BomLine[]
  customerBomLines: BomLine[]
  filteredLines: BomLine[]
  searchQuery: string
  pricingCache: BomPricingCache
  hasCredentials: boolean
  isFetchingPricing: boolean
  pricingQueue: PricingQueueItem[]
  boardQuantity: number
  teamCurrency: 'USD' | 'EUR'
  exchangeRate: ExchangeRateSnapshot | null
  pnpDesignators: Set<string>
  selectedLineId: string | null
  locked?: boolean
  aiSuggestions?: BomAiSuggestions
  groups: BomGroup[]
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'addLine': [line?: Partial<BomLine>]
  'updateLine': [id: string, updates: Partial<BomLine>]
  'removeLine': [id: string]
  'addManufacturer': [lineId: string, mfr: { manufacturer: string; manufacturerPart: string }]
  'fetchSinglePricing': [partNumber: string]
  'selectLine': [id: string]
  'addGroup': [name: string]
  'removeGroup': [groupId: string]
  'updateGroup': [groupId: string, updates: Partial<Omit<BomGroup, 'id'>>]
  'assignGroup': [lineId: string, groupId: string | null]
  'moveLineBefore': [draggedId: string, targetId: string]
  'moveLineToEnd': [draggedId: string]
}>()

const lineRefs = reactive<Record<string, HTMLElement>>({})

watch(() => props.selectedLineId, (id) => {
  if (!id) return
  nextTick(() => {
    const el = lineRefs[id]
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
})

const searchQuery = computed({
  get: () => props.searchQuery,
  set: v => emit('update:searchQuery', v),
})

type FilterKey = 'smd' | 'tht' | 'dnp' | 'cp' | 'no-mfr' | 'no-price' | 'missing-pnp'
const activeFilters = ref(new Set<FilterKey>())
const hideDnp = ref(true)
const sortBy = ref<'designator' | 'price'>('designator')

function toggleFilter(key: FilterKey) {
  const next = new Set(activeFilters.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  activeFilters.value = next
}

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

function cycleType(line: BomLine) {
  if (props.locked) return
  const idx = BOM_LINE_TYPES.indexOf(line.type)
  const next = BOM_LINE_TYPES[(idx + 1) % BOM_LINE_TYPES.length]
  emit('updateLine', line.id, { type: next })
}

// Inline quantity editing
const editingQtyId = ref<string | null>(null)
const editingQtyValue = ref(1)
const qtyInputRef = ref<HTMLInputElement | null>(null)

function startQtyEdit(line: BomLine) {
  if (props.locked) return
  editingQtyId.value = line.id
  editingQtyValue.value = line.quantity
  nextTick(() => { qtyInputRef.value?.select() })
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

// Queue strip
const queueExpanded = ref(false)
const queueTotal = computed(() => props.pricingQueue.length)
const queueDone = computed(() => props.pricingQueue.filter(i => i.status === 'done' || i.status === 'error').length)
const queueErrors = computed(() => props.pricingQueue.filter(i => i.status === 'error').length)

watch(() => props.isFetchingPricing, (fetching) => { if (fetching) queueExpanded.value = true })
watch(() => props.pricingQueue.length, (len) => { if (len === 0) queueExpanded.value = false })

// PnP mismatch helpers
function parseRefs(refs: string): string[] {
  if (!refs) return []
  return refs.split(/[,;\s]+/).map(r => r.trim()).filter(Boolean)
}

function refsKey(refs: string): string {
  return parseRefs(refs).map(r => r.toUpperCase()).sort().join(',')
}

function manufacturerKey(m: { manufacturer: string; manufacturerPart: string }): string {
  return `${String(m.manufacturer ?? '').trim().toLowerCase()}|${String(m.manufacturerPart ?? '').trim().toLowerCase()}`
}

const customerBaselineByLineId = computed(() => {
  const byId = new Map(props.customerBomLines.map(l => [l.id, l]))
  const byRefs = new Map<string, BomLine>()
  for (const l of props.customerBomLines) {
    const key = refsKey(l.references)
    if (key && !byRefs.has(key)) byRefs.set(key, l)
  }

  const map = new Map<string, BomLine | null>()
  for (const line of props.bomLines) {
    const direct = byId.get(line.id)
    if (direct) {
      map.set(line.id, direct)
      continue
    }
    const rk = refsKey(line.references)
    map.set(line.id, rk ? (byRefs.get(rk) ?? null) : null)
  }
  return map
})

function isLineChanged(line: BomLine): boolean {
  const base = customerBaselineByLineId.value.get(line.id)
  if (!base) return true

  // When the source BOM has no type column the parser defaults to 'Other'.
  // Changing from that default is enrichment, not a user edit.
  const typeMatches = base.type === 'Other' || line.type === base.type

  const fieldsEqual =
    String(line.description ?? '').trim() === String(base.description ?? '').trim()
    && String(line.comment ?? '').trim() === String(base.comment ?? '').trim()
    && String(line.package ?? '').trim() === String(base.package ?? '').trim()
    && refsKey(line.references) === refsKey(base.references)
    && typeMatches
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
}

function getMissingInPnP(line: BomLine): string[] {
  if (line.dnp || props.pnpDesignators.size === 0) return []
  return parseRefs(line.references).filter(r => !props.pnpDesignators.has(r))
}

// Pricing helpers (copied from BomPanel)
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
    const key = offer.supplier
    if (seenSuppliers.has(key)) continue
    seenSuppliers.add(key)
    offers.push(offer)
  }
  return offers.sort((a, b) => comparableUnitPrice(a) - comparableUnitPrice(b))
}

function getLineBestOffer(line: BomLine): SupplierOffer | null {
  const totalQty = line.quantity * props.boardQuantity
  let best: SupplierOffer | null = null
  for (const mfr of line.manufacturers) {
    const offers = getSupplierOffers(mfr.manufacturerPart, totalQty)
    for (const offer of offers) {
      if (offer.stock < totalQty) continue
      if (!best || comparableUnitPrice(offer) < comparableUnitPrice(best)) best = offer
      break
    }
  }
  return best
}

function getDisplayOffer(offer: SupplierOffer): DisplayOffer {
  const unitPrice = convertAmount(offer.unitPrice, offer.currency, props.teamCurrency)
  const lineValue = convertAmount(offer.lineValue, offer.currency, props.teamCurrency)
  if (unitPrice == null || lineValue == null) {
    return { unitPrice: offer.unitPrice, lineValue: offer.lineValue, currency: offer.currency }
  }
  return { unitPrice, lineValue, currency: props.teamCurrency }
}

function lineHasPrice(line: BomLine): boolean {
  return !!getLineBestOffer(line)
}

function lineHasManufacturer(line: BomLine): boolean {
  return (line.manufacturers?.length ?? 0) > 0
}

const filterDefs = computed(() => {
  const lines = props.filteredLines
  const counts = {
    smd: lines.filter(l => l.type === 'SMD').length,
    tht: lines.filter(l => l.type === 'THT').length,
    dnp: lines.filter(l => l.dnp).length,
    cp: lines.filter(l => l.customerProvided).length,
    'no-mfr': lines.filter(l => !lineHasManufacturer(l)).length,
    'no-price': lines.filter(l => !lineHasPrice(l)).length,
    'missing-pnp': lines.filter(l => getMissingInPnP(l).length > 0).length,
  }
  return [
    { key: 'smd' as const, label: 'SMD', count: counts.smd, activeClass: 'border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' },
    { key: 'tht' as const, label: 'THT', count: counts.tht, activeClass: 'border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20' },
    { key: 'dnp' as const, label: 'DNP', count: counts.dnp, activeClass: 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20' },
    { key: 'cp' as const, label: 'CP', count: counts.cp, activeClass: 'border-teal-300 dark:border-teal-700 text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20' },
    { key: 'no-mfr' as const, label: 'No Mfr', count: counts['no-mfr'], activeClass: 'border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' },
    { key: 'no-price' as const, label: 'No Price', count: counts['no-price'], activeClass: 'border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20' },
    { key: 'missing-pnp' as const, label: 'Missing PnP', count: counts['missing-pnp'], activeClass: 'border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20' },
  ]
})

const dnpCount = computed(() => props.filteredLines.filter(l => l.dnp).length)
const editedBadgeClass = 'border-yellow-300/70 dark:border-yellow-700/50 text-yellow-700 dark:text-yellow-300 bg-yellow-50/70 dark:bg-yellow-900/20'

function applyFilters(lines: BomLine[]): BomLine[] {
  let result = lines
  const filters = activeFilters.value
  if (hideDnp.value && !filters.has('dnp')) {
    result = result.filter(line => !line.dnp)
  }
  if (filters.size > 0) {
    result = result.filter(line => {
      if (filters.has('smd') && line.type === 'SMD') return true
      if (filters.has('tht') && line.type === 'THT') return true
      if (filters.has('dnp') && line.dnp) return true
      if (filters.has('cp') && line.customerProvided) return true
      if (filters.has('no-mfr') && !lineHasManufacturer(line)) return true
      if (filters.has('no-price') && !lineHasPrice(line)) return true
      if (filters.has('missing-pnp') && getMissingInPnP(line).length > 0) return true
      return false
    })
  }
  return result
}

function sortLines(lines: BomLine[]): BomLine[] {
  if (sortBy.value === 'price') {
    return [...lines].sort((a, b) => (getLineBestOffer(b)?.lineValue ?? -1) - (getLineBestOffer(a)?.lineValue ?? -1))
  }
  if (sortBy.value === 'designator') {
    return [...lines].sort((a, b) => (a.references || '\uffff').localeCompare((b.references || '\uffff'), undefined, { numeric: true }))
  }
  return lines
}

type DisplayRow =
  | { kind: 'ungrouped'; count: number }
  | { kind: 'group'; group: BomGroup; count: number }
  | { kind: 'line'; line: BomLine }

const hasGroups = computed(() => props.groups.length > 0)

const displayRows = computed<DisplayRow[]>(() => {
  const filtered = applyFilters(props.filteredLines)

  if (!hasGroups.value) {
    return sortLines(filtered).map(line => ({ kind: 'line' as const, line }))
  }

  const groupIds = new Set(props.groups.map(g => g.id))
  const ungrouped: BomLine[] = []
  const byGroup = new Map<string, BomLine[]>()
  for (const g of props.groups) byGroup.set(g.id, [])

  for (const line of filtered) {
    const gid = line.groupId
    if (gid && groupIds.has(gid)) {
      byGroup.get(gid)!.push(line)
    } else {
      ungrouped.push(line)
    }
  }

  const rows: DisplayRow[] = []
  const sortedUngrouped = sortLines(ungrouped)
  rows.push({ kind: 'ungrouped', count: sortedUngrouped.length })
  for (const line of sortedUngrouped) rows.push({ kind: 'line', line })

  for (const group of props.groups) {
    const lines = sortLines(byGroup.get(group.id) ?? [])
    rows.push({ kind: 'group', group, count: lines.length })
    if (!group.collapsed) {
      for (const line of lines) rows.push({ kind: 'line', line })
    }
  }

  return rows
})

// Keep displayLines for backward compat (used by watcher)
const displayLines = computed(() =>
  displayRows.value.filter((r): r is { kind: 'line'; line: BomLine } => r.kind === 'line').map(r => r.line),
)

// ── Drag and drop ──
const dragLineId = ref<string | null>(null)
const dragOverTarget = ref<string | null>(null)

function onDragStart(e: DragEvent, lineId: string) {
  if (props.locked) { e.preventDefault(); return }
  dragLineId.value = lineId
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', lineId)
  }
}

function onDragEnd() {
  dragLineId.value = null
  dragOverTarget.value = null
}

function onDragOverLine(e: DragEvent, lineId: string) {
  e.preventDefault()
  dragOverTarget.value = lineId
}

function onDropOnLine(lineId: string) {
  const dragged = dragLineId.value
  if (!dragged || dragged === lineId) return
  const targetLine = props.bomLines.find(l => l.id === lineId)
  if (targetLine) {
    emit('assignGroup', dragged, targetLine.groupId ?? null)
  }
  emit('moveLineBefore', dragged, lineId)
  dragLineId.value = null
  dragOverTarget.value = null
}

function onDropOnGroup(groupId: string) {
  const dragged = dragLineId.value
  if (!dragged) return
  emit('assignGroup', dragged, groupId)
  dragLineId.value = null
  dragOverTarget.value = null
}

function onDropOnUngrouped() {
  const dragged = dragLineId.value
  if (!dragged) return
  emit('assignGroup', dragged, null)
  dragLineId.value = null
  dragOverTarget.value = null
}

// ── Group editing ──
const editingGroupId = ref<string | null>(null)
const editingGroupName = ref('')
const newGroupName = ref('')
const showNewGroupInput = ref(false)

function startGroupRename(group: BomGroup) {
  if (props.locked) return
  editingGroupId.value = group.id
  editingGroupName.value = group.name
}

function commitGroupRename(groupId: string) {
  if (props.locked) { editingGroupId.value = null; return }
  const name = editingGroupName.value.trim()
  if (name) emit('updateGroup', groupId, { name })
  editingGroupId.value = null
}

function commitNewGroup() {
  const name = newGroupName.value.trim()
  if (name) emit('addGroup', name)
  newGroupName.value = ''
  showNewGroupInput.value = false
}
</script>

