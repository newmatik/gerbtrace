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
          placeholder="Search components..."
          class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md pl-7 pr-2 py-1.5 outline-none placeholder:text-neutral-400 focus:border-primary transition-colors"
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

    <!-- Package controls row -->
    <div class="flex items-center justify-between px-3 pb-1 gap-1">
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-[10px] text-neutral-400">
          {{ filteredComponents.length }}/{{ allComponents.length }}
          <span v-if="dnpCount > 0" class="text-orange-400 ml-0.5" :title="`${dnpCount} DNP`">
            ({{ dnpCount }} DNP)
          </span>
        </span>
        <button
          class="text-[10px] px-1 py-0.5 rounded transition-colors flex items-center gap-0.5"
          :class="showPackages
            ? 'text-pink-500 dark:text-pink-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'"
          :title="showPackages ? 'Hide package outlines' : 'Show package outlines'"
          @click="$emit('update:showPackages', !showPackages)"
        >
          <UIcon name="i-lucide-box" class="text-[10px]" />
          <span>Pkg</span>
        </button>
      </div>

      <!-- Convention selector -->
      <select
        :value="pnpConvention"
        class="text-[10px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-1 py-0.5 outline-none text-neutral-500 dark:text-neutral-400 cursor-pointer"
        title="PnP orientation standard"
        @change="$emit('update:pnpConvention', ($event.target as HTMLSelectElement).value as PnPConvention)"
      >
        <option v-for="[value, label] in conventionOptions" :key="value" :value="value">
          {{ label }}
        </option>
      </select>
    </div>

    <!-- Alignment controls -->
    <div class="flex items-center justify-between px-3 pb-1.5 gap-1">
      <div class="flex items-center gap-0 shrink-0"></div>

      <!-- Origin coordinates (inline, between counter and buttons) -->
      <span
        v-if="hasOrigin && !isAligning"
        class="text-[10px] text-green-600 dark:text-green-400 tabular-nums shrink-0"
        title="PnP origin in Gerber coordinates"
      >{{ originX!.toFixed(3) }}, {{ originY!.toFixed(3) }}</span>

      <div class="flex items-center gap-1">
        <!-- Reset origin -->
        <button
          v-if="hasOrigin"
          class="text-[10px] text-neutral-400 hover:text-red-400 transition-colors"
          title="Reset alignment"
          @click="$emit('resetOrigin')"
        >
          <UIcon name="i-lucide-x" class="text-[10px]" />
        </button>

        <!-- Align button (component-based) -->
        <button
          v-if="selectedDesignator && !isAligning"
          class="text-[10px] px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          :title="`Align using ${selectedDesignator}`"
          @click="$emit('startComponentAlign')"
        >
          <UIcon name="i-lucide-locate" class="text-[11px]" />
          <span>Align</span>
        </button>

        <!-- Active alignment status -->
        <span
          v-if="isAligning"
          class="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-400/50 flex items-center gap-1"
        >
          <UIcon name="i-lucide-locate" class="text-[11px]" />
          <span>{{ alignStatusText }}</span>
        </span>

        <!-- Set 0/0 button -->
        <button
          v-if="!isAligning"
          class="text-[10px] px-1.5 py-0.5 rounded transition-colors flex items-center gap-1"
          :class="hasOrigin
            ? 'text-green-600 dark:text-green-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'"
          title="Set the 0/0 coordinate on the PCB"
          @click="$emit('startSetOrigin')"
        >
          <UIcon name="i-lucide-crosshair" class="text-[11px]" />
          <span>0/0</span>
        </button>
      </div>
    </div>

    <!-- Table header -->
    <div
      class="grid grid-cols-[1rem_3.6rem_3.2rem_3.2rem_4rem_2.4rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)] gap-x-2 px-3 py-1 text-[10px] font-medium text-neutral-400 uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-700 shrink-0"
    >
      <!-- DNP indicator header (non-sortable) -->
      <span class="flex items-center justify-center" title="DNP indicator"></span>
      <button
        v-for="col in sortColumns"
        :key="col.key"
        class="flex items-center gap-0.5 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors text-left"
        :class="{ 'text-neutral-600 dark:text-neutral-200': sortKey === col.key }"
        @click="toggleSort(col.key)"
      >
        <span>{{ col.label }}</span>
        <UIcon
          v-if="sortKey === col.key"
          :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="text-[9px] shrink-0"
        />
      </button>
    </div>

    <!-- Component rows (virtualized) -->
    <div ref="listRef" class="flex-1 overflow-y-auto">
      <div v-if="!filteredComponents.length" class="text-xs text-neutral-400 py-6 text-center">
        {{ allComponents.length === 0 ? 'No components loaded' : 'No matches' }}
      </div>
      <div
        v-else
        :style="{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }"
      >
        <div
          v-for="vRow in rowVirtualizer.getVirtualItems()"
          :key="sortedComponents[vRow.index].designator + '-' + sortedComponents[vRow.index].side"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${vRow.size}px`,
            transform: `translateY(${vRow.start}px)`,
          }"
          class="grid grid-cols-[1rem_3.6rem_3.2rem_3.2rem_4rem_2.4rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)] gap-x-2 px-3 py-1 text-[11px] cursor-pointer transition-colors border-b border-neutral-100 dark:border-neutral-800/50"
          :class="{
            'bg-cyan-50 dark:bg-cyan-900/20 hover:bg-cyan-100 dark:hover:bg-cyan-900/30': selectedDesignator === sortedComponents[vRow.index].designator && !sortedComponents[vRow.index].dnp,
            'hover:bg-neutral-100 dark:hover:bg-neutral-800': selectedDesignator !== sortedComponents[vRow.index].designator && !sortedComponents[vRow.index].dnp,
            'opacity-40': sortedComponents[vRow.index].dnp,
          }"
          @click="onRowClick(sortedComponents[vRow.index].designator)"
        >
          <!-- DNP toggle / indicator -->
          <button
            class="flex items-center justify-center shrink-0 transition-colors"
            :title="sortedComponents[vRow.index].dnp ? 'Remove DNP mark' : 'Mark as Do Not Populate'"
            @click.stop="emit('toggle:dnp', sortedComponents[vRow.index].key)"
          >
            <span
              class="h-2.5 w-2.5 rounded-full"
              :class="sortedComponents[vRow.index].dnp
                ? 'bg-red-500'
                : 'bg-transparent border border-neutral-300/70 dark:border-neutral-700/70'"
            />
          </button>

          <span class="font-medium truncate" :title="sortedComponents[vRow.index].designator" :class="{ 'line-through': sortedComponents[vRow.index].dnp }">
            {{ sortedComponents[vRow.index].designator }}
            <span
              v-if="showSideIndicator"
              class="text-[9px] font-normal text-neutral-400 ml-0.5"
            >{{ sortedComponents[vRow.index].side === 'top' ? 'T' : 'B' }}</span>
          </span>
          <span class="text-neutral-500 tabular-nums">{{ sortedComponents[vRow.index].x.toFixed(2) }}</span>
          <span class="text-neutral-500 tabular-nums">{{ sortedComponents[vRow.index].y.toFixed(2) }}</span>
          <div class="flex items-center gap-0.5" @click.stop>
            <input
              type="number"
              step="0.1"
              :value="formatRotation(sortedComponents[vRow.index].rotation)"
              class="rotation-input w-8 min-w-0 rounded px-1 py-0.5 tabular-nums outline-none border bg-transparent transition-colors"
              :class="sortedComponents[vRow.index].rotationOverridden
                ? 'text-amber-600 dark:text-amber-300 border-transparent focus:border-amber-300/70 dark:focus:border-amber-500/50 focus:bg-amber-50/60 dark:focus:bg-amber-500/10'
                : 'text-neutral-500 border-transparent focus:border-neutral-300 dark:focus:border-neutral-600 focus:bg-neutral-50 dark:focus:bg-neutral-800/70'"
              :title="sortedComponents[vRow.index].rotationOverridden
                ? `Original: ${formatRotation(sortedComponents[vRow.index].originalRotation)}°`
                : 'Rotation (deg)'"
              @mousedown.stop
              @keydown.enter.prevent="commitRotation(sortedComponents[vRow.index], $event)"
              @blur="commitRotation(sortedComponents[vRow.index], $event)"
            />
            <button
              v-if="selectedDesignator === sortedComponents[vRow.index].designator"
              class="shrink-0 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
              title="Rotate 90° CCW"
              @mousedown.stop
              @click.stop="rotateCCW(sortedComponents[vRow.index])"
            >
              <UIcon name="i-lucide-rotate-ccw" class="text-[10px]" />
            </button>
            <button
              v-if="sortedComponents[vRow.index].rotationOverridden"
              class="shrink-0 text-amber-600/90 dark:text-amber-300/90 hover:text-red-500 transition-colors"
              title="Reset to original rotation"
              @mousedown.stop
              @click.stop="emit('reset:rotation', { key: sortedComponents[vRow.index].key })"
            >
              <UIcon name="i-lucide-undo-2" class="text-[10px]" />
            </button>
          </div>
          <!-- Polarized toggle -->
          <div class="flex items-center justify-center" @click.stop>
            <input
              type="checkbox"
              class="h-3 w-3 rounded border-neutral-300 dark:border-neutral-600 text-primary focus:ring-primary/50 cursor-pointer"
              :checked="sortedComponents[vRow.index].polarized"
              :title="sortedComponents[vRow.index].polarized ? 'Polarized (pin 1 marked)' : 'Not polarized (no pin 1 marker)'"
              @change="emit('update:polarized', { key: sortedComponents[vRow.index].key, polarized: ($event.target as HTMLInputElement).checked })"
            />
          </div>
          <span class="truncate text-neutral-500" :title="sortedComponents[vRow.index].value">{{ sortedComponents[vRow.index].value || '—' }}</span>
          <!-- CAD Package (customer footprint name) -->
          <span class="truncate text-neutral-500" :title="sortedComponents[vRow.index].cadPackage">{{ sortedComponents[vRow.index].cadPackage || '—' }}</span>
          <!-- Package (our matched package) -->
          <select
            class="text-[11px] bg-transparent border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700 rounded px-1 py-0.5 outline-none text-neutral-600 dark:text-neutral-300 cursor-pointer"
            :class="sortedComponents[vRow.index].packageMapped ? 'text-blue-700 dark:text-blue-300' : ''"
            :value="sortedComponents[vRow.index].matchedPackage"
            title="Matched package (library)"
            @mousedown.stop
            @change="emit('update:packageMapping', { cadPackage: sortedComponents[vRow.index].cadPackage, packageName: ($event.target as HTMLSelectElement).value || null })"
          >
            <option value="">—</option>
            <option v-for="p in packageOptions" :key="p" :value="p">
              {{ p }}
            </option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVirtualizer } from '@tanstack/vue-virtual'
import type { EditablePnPComponent } from '~/composables/usePickAndPlace'
import type { AlignMode } from '~/composables/usePickAndPlace'
import type { PnPConvention } from '~/utils/pnp-conventions'
import { PNP_CONVENTION_LABELS } from '~/utils/pnp-conventions'

const props = defineProps<{
  allComponents: EditablePnPComponent[]
  filteredComponents: EditablePnPComponent[]
  selectedDesignator: string | null
  searchQuery: string
  alignMode: AlignMode
  hasOrigin: boolean
  originX: number | null
  originY: number | null
  showPackages: boolean
  pnpConvention: PnPConvention
  packageOptions: string[]
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:showPackages': [value: boolean]
  'update:pnpConvention': [value: PnPConvention]
  select: [designator: string | null]
  startSetOrigin: []
  startComponentAlign: []
  resetOrigin: []
  'update:rotation': [payload: { key: string; rotation: number }]
  'reset:rotation': [payload: { key: string }]
  'toggle:dnp': [key: string]
  'update:packageMapping': [payload: { cadPackage: string; packageName: string | null }]
  'update:polarized': [payload: { key: string; polarized: boolean }]
}>()

const conventionOptions = Object.entries(PNP_CONVENTION_LABELS) as [PnPConvention, string][]

// DNP count
const dnpCount = computed(() => props.allComponents.filter(c => c.dnp).length)

// --- Sorting ---
type SortKey = 'ref' | 'x' | 'y' | 'rot' | 'pol' | 'value' | 'cadPackage' | 'package'

const sortColumns: { key: SortKey; label: string }[] = [
  { key: 'ref', label: 'Ref' },
  { key: 'x', label: 'X' },
  { key: 'y', label: 'Y' },
  { key: 'rot', label: 'Rot' },
  { key: 'pol', label: 'Pol' },
  { key: 'value', label: 'Value' },
  { key: 'cadPackage', label: 'CAD Pkg' },
  { key: 'package', label: 'Package' },
]

const sortKey = ref<SortKey | null>(null)
const sortAsc = ref(true)

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    if (sortAsc.value) {
      sortAsc.value = false
    } else {
      // Third click resets to unsorted
      sortKey.value = null
      sortAsc.value = true
    }
  } else {
    sortKey.value = key
    sortAsc.value = true
  }
}

/** Natural-order compare for designator strings (e.g. C1, C2, C10). */
function naturalCompare(a: string, b: string): number {
  const re = /(\d+)|(\D+)/g
  const aParts = a.match(re) || []
  const bParts = b.match(re) || []
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const ap = aParts[i] ?? ''
    const bp = bParts[i] ?? ''
    const an = Number(ap)
    const bn = Number(bp)
    if (!isNaN(an) && !isNaN(bn)) {
      if (an !== bn) return an - bn
    } else {
      const cmp = ap.localeCompare(bp)
      if (cmp !== 0) return cmp
    }
  }
  return 0
}

const sortedComponents = computed(() => {
  const list = props.filteredComponents
  const key = sortKey.value
  if (!key) return list

  const dir = sortAsc.value ? 1 : -1
  return [...list].sort((a, b) => {
    let cmp = 0
    switch (key) {
      case 'ref':
        cmp = naturalCompare(a.designator, b.designator)
        break
      case 'x':
        cmp = a.x - b.x
        break
      case 'y':
        cmp = a.y - b.y
        break
      case 'rot':
        cmp = a.rotation - b.rotation
        break
      case 'pol':
        cmp = (a.polarized ? 1 : 0) - (b.polarized ? 1 : 0)
        break
      case 'value':
        cmp = (a.value || '').localeCompare(b.value || '')
        break
      case 'cadPackage':
        cmp = (a.cadPackage || '').localeCompare(b.cadPackage || '')
        break
      case 'package':
        cmp = (a.matchedPackage || '').localeCompare(b.matchedPackage || '')
        break
    }
    return cmp * dir
  })
})

const localSearch = ref(props.searchQuery)
let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined

watch(localSearch, (v) => {
  clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => emit('update:searchQuery', v), 150)
})
watch(() => props.searchQuery, (v) => {
  if (v !== localSearch.value) localSearch.value = v
})

const searchQuery = computed({
  get: () => localSearch.value,
  set: (v: string) => { localSearch.value = v },
})

const listRef = ref<HTMLElement | null>(null)

const ROW_HEIGHT = 25

const rowVirtualizer = useVirtualizer(
  computed(() => ({
    count: sortedComponents.value.length,
    getScrollElement: () => listRef.value,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  })),
)

const isAligning = computed(() => props.alignMode !== 'idle')

const alignStatusText = computed(() => {
  switch (props.alignMode) {
    case 'set-origin': return 'Click 0/0...'
    case 'align-single': return 'Click center...'
    case 'align-first': return 'Click 1st pad...'
    case 'align-second': return 'Click 2nd pad...'
    default: return ''
  }
})

// Show side indicator (T/B) when components from both sides exist
const showSideIndicator = computed(() => {
  const sides = new Set(props.allComponents.map(c => c.side))
  return sides.size > 1
})

// Build a designator → sorted-index lookup for scroll-to-selection
const designatorIndexMap = computed(() => {
  const map = new Map<string, number>()
  sortedComponents.value.forEach((c, i) => map.set(c.designator, i))
  return map
})

function onRowClick(designator: string) {
  // Toggle if clicking same one
  emit('select', props.selectedDesignator === designator ? null : designator)
}

function formatRotation(rotation: number): string {
  if (Number.isInteger(rotation)) return rotation.toString()
  return rotation.toFixed(2).replace(/\.?0+$/, '')
}

/** Normalise any rotation value into the 0–359 range. */
function normaliseRotation(deg: number): number {
  return ((deg % 360) + 360) % 360
}

function commitRotation(comp: EditablePnPComponent, event: Event) {
  const input = event.target as HTMLInputElement | null
  if (!input) return
  const raw = input.value.trim()
  if (!raw) {
    input.value = formatRotation(comp.rotation)
    return
  }
  const next = Number(raw)
  if (!Number.isFinite(next)) {
    input.value = formatRotation(comp.rotation)
    return
  }
  emit('update:rotation', { key: comp.key, rotation: normaliseRotation(next) })
}

/** Rotate 90° counter-clockwise: 0 → 270 → 180 → 90 → 0 … */
function rotateCCW(comp: EditablePnPComponent) {
  emit('update:rotation', { key: comp.key, rotation: normaliseRotation(comp.rotation - 90) })
}

// Auto-scroll to selected component when it changes from canvas click
watch(
  () => props.selectedDesignator,
  (designator) => {
    if (!designator) return
    const idx = designatorIndexMap.value.get(designator)
    if (idx != null) {
      rowVirtualizer.value.scrollToIndex(idx, { align: 'auto' })
    }
  },
)
</script>

<style scoped>
.rotation-input {
  appearance: textfield;
}

.rotation-input::-webkit-outer-spin-button,
.rotation-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
