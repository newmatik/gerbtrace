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
      class="grid grid-cols-[minmax(0,1fr)_3.2rem_3.2rem_2.6rem_minmax(0,1fr)_minmax(0,1fr)] gap-px px-3 py-1 text-[10px] font-medium text-neutral-400 uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-700 shrink-0"
    >
      <span>Ref</span>
      <span>X</span>
      <span>Y</span>
      <span>Rot</span>
      <span>Value</span>
      <span>Package</span>
    </div>

    <!-- Component rows -->
    <div ref="listRef" class="flex-1 overflow-y-auto">
      <div v-if="!filteredComponents.length" class="text-xs text-neutral-400 py-6 text-center">
        {{ allComponents.length === 0 ? 'No components loaded' : 'No matches' }}
      </div>
      <div
        v-for="(comp, index) in filteredComponents"
        :key="comp.designator + '-' + comp.side"
        :ref="(el) => setRowRef(comp.designator, el as HTMLElement | null)"
        class="grid grid-cols-[minmax(0,1fr)_3.2rem_3.2rem_2.6rem_minmax(0,1fr)_minmax(0,1fr)] gap-px px-3 py-1 text-[11px] cursor-pointer transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 border-b border-neutral-100 dark:border-neutral-800/50"
        :class="{
          'bg-cyan-50 dark:bg-cyan-900/20 hover:bg-cyan-100 dark:hover:bg-cyan-900/30': selectedDesignator === comp.designator,
        }"
        @click="onRowClick(comp.designator)"
      >
        <span class="font-medium truncate" :title="comp.designator">
          {{ comp.designator }}
          <span
            v-if="showSideIndicator"
            class="text-[9px] font-normal text-neutral-400 ml-0.5"
          >{{ comp.side === 'top' ? 'T' : 'B' }}</span>
        </span>
        <span class="text-neutral-500 tabular-nums">{{ comp.x.toFixed(2) }}</span>
        <span class="text-neutral-500 tabular-nums">{{ comp.y.toFixed(2) }}</span>
        <span class="text-neutral-500 tabular-nums">{{ comp.rotation.toFixed(0) }}</span>
        <span class="truncate text-neutral-500" :title="comp.value">{{ comp.value || '—' }}</span>
        <span class="truncate text-neutral-500" :title="comp.package">{{ comp.package || '—' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PnPComponent } from '~/utils/pnp-parser'
import type { AlignMode } from '~/composables/usePickAndPlace'
import type { PnPConvention } from '~/utils/pnp-conventions'
import { PNP_CONVENTION_LABELS } from '~/utils/pnp-conventions'

const props = defineProps<{
  allComponents: PnPComponent[]
  filteredComponents: PnPComponent[]
  selectedDesignator: string | null
  searchQuery: string
  alignMode: AlignMode
  hasOrigin: boolean
  originX: number | null
  originY: number | null
  showPackages: boolean
  pnpConvention: PnPConvention
}>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:showPackages': [value: boolean]
  'update:pnpConvention': [value: PnPConvention]
  select: [designator: string | null]
  startSetOrigin: []
  startComponentAlign: []
  resetOrigin: []
}>()

const conventionOptions = Object.entries(PNP_CONVENTION_LABELS) as [PnPConvention, string][]

const searchQuery = computed({
  get: () => props.searchQuery,
  set: (v: string) => emit('update:searchQuery', v),
})

const listRef = ref<HTMLElement | null>(null)

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

// Track row refs for auto-scroll
const rowRefs = new Map<string, HTMLElement>()

function setRowRef(designator: string, el: HTMLElement | null) {
  if (el) {
    rowRefs.set(designator, el)
  } else {
    rowRefs.delete(designator)
  }
}

function onRowClick(designator: string) {
  // Toggle if clicking same one
  emit('select', props.selectedDesignator === designator ? null : designator)
}

// Auto-scroll to selected component when it changes from canvas click
watch(
  () => props.selectedDesignator,
  (designator) => {
    if (!designator) return
    nextTick(() => {
      const el = rowRefs.get(designator)
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    })
  },
)
</script>
