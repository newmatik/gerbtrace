<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Filter bar -->
    <div class="p-3 pb-2">
      <div class="relative">
        <UIcon
          name="i-lucide-search"
          class="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 text-xs"
        />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Filter components..."
          class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md pl-7 pr-6 py-1.5 outline-none placeholder:text-neutral-400 focus:border-primary transition-colors"
        />
        <button
          v-if="hasActiveFiltersOrSearch"
          class="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
          title="Clear all filters"
          @click="clearAll"
        >
          <UIcon name="i-lucide-x" class="text-xs" />
        </button>
      </div>
    </div>

    <!-- Filter toggles -->
    <div class="flex flex-wrap items-center gap-1 px-3 pb-1.5">
      <template v-if="allComponents.length > 0">
        <button
          v-for="filter in filterOptions"
          :key="filter.key"
          class="text-[10px] px-1.5 py-0.5 rounded-full border transition-colors"
          :class="activeFilters.has(filter.key)
            ? 'bg-primary/10 border-primary/30 text-primary dark:text-primary-300'
            : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600'"
          :title="filter.title"
          @click="emit('toggle:filter', filter.key)"
        >
          {{ filter.label }}
        </button>
      </template>
      <span class="flex-1" />
      <button
        class="text-[10px] px-1.5 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-green-600 dark:hover:text-green-400 hover:border-green-300 dark:hover:border-green-600 transition-colors flex items-center gap-0.5"
        title="Add component — click to place, click again to confirm or pick two points for center"
        @click="emit('addComponent')"
      >
        <UIcon name="i-lucide-plus" class="text-[10px]" />
        Add
      </button>
      <button
        class="text-[10px] px-1.5 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors flex items-center gap-0.5"
        title="Create a component group"
        @click="createGroup"
      >
        <UIcon name="i-lucide-folder-plus" class="text-[10px]" />
        Group
      </button>
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
          :class="showCoords
            ? 'text-blue-500 dark:text-blue-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'"
          :title="showCoords ? 'Hide X/Y coordinates' : 'Show X/Y coordinates'"
          @click="showCoords = !showCoords"
        >
          <UIcon name="i-lucide-map-pin" class="text-[10px]" />
          <span>XY</span>
        </button>
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
      <USelect
        :model-value="pnpConvention"
        size="xs"
        class="w-36"
        :items="conventionSelectItems"
        value-key="value"
        label-key="label"
        title="PnP orientation standard"
        @update:model-value="$emit('update:pnpConvention', String($event) as PnPConvention)"
      />
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
      class="grid gap-x-2 px-3 py-1 text-[10px] font-medium text-neutral-400 uppercase tracking-wider border-b border-neutral-200 dark:border-neutral-700 shrink-0"
      :style="{ gridTemplateColumns: gridCols }"
    >
      <!-- DNP indicator header (non-sortable) -->
      <span class="flex items-center justify-center" title="DNP indicator"></span>
      <button
        v-for="col in visibleSortColumns"
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
      <!-- Actions column header -->
      <span />
    </div>

    <!-- Component rows (virtualized) -->
    <div ref="listRef" class="flex-1 overflow-y-auto">
      <div v-if="!groupedRows.length" class="text-xs text-neutral-400 py-6 text-center">
        {{ allComponents.length === 0 ? 'No components loaded' : 'No matches' }}
      </div>
      <div
        v-else
        :style="{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }"
      >
        <div
          v-for="vRow in rowVirtualizer.getVirtualItems()"
          :key="groupedRows[vRow.index].kind === 'group'
            ? `group-${groupedRows[vRow.index].group.id}`
            : groupedRows[vRow.index].kind === 'ungrouped'
              ? 'group-ungrouped'
            : `${groupedRows[vRow.index].component.key}-${groupedRows[vRow.index].component.side}`"
          :style="{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${vRow.size}px`,
            transform: `translateY(${vRow.start}px)`,
            gridTemplateColumns: gridCols,
          }"
          class="group/row px-3 py-1 text-[11px] transition-colors border-b border-neutral-100 dark:border-neutral-800/50"
        >
          <div
            v-if="groupedRows[vRow.index].kind === 'ungrouped'"
            class="flex items-center gap-2 w-full text-[10px]"
            @dragover.prevent="onUngroupedDragOver"
            @drop.prevent="onDropToUngrouped()"
          >
            <span class="font-medium text-neutral-700 dark:text-neutral-200 truncate">
              No section
            </span>
            <span class="text-neutral-400">({{ groupedRows[vRow.index].count }})</span>
          </div>

          <div
            v-else-if="groupedRows[vRow.index].kind === 'group'"
            class="flex items-center gap-2 w-full text-[10px]"
            :class="groupedRows[vRow.index].group.hidden ? 'opacity-60' : ''"
            draggable="true"
            @dragstart="onGroupDragStart($event, groupedRows[vRow.index].group.id)"
            @dragover.prevent="onGroupHeaderDragOver"
            @drop.prevent="onDropToGroup(groupedRows[vRow.index].group.id)"
            @dragend="onGroupDragEnd"
          >
            <button
              class="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
              :title="groupedRows[vRow.index].group.collapsed ? 'Expand group' : 'Collapse group'"
              @click.stop="emit('toggle:groupCollapsed', groupedRows[vRow.index].group.id)"
            >
              <UIcon
                :name="groupedRows[vRow.index].group.collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
                class="text-[11px]"
              />
            </button>
            <template v-if="editingGroupId === groupedRows[vRow.index].group.id">
              <input
                v-model="editingGroupName"
                type="text"
                class="text-[10px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-1 py-0.5 outline-none min-w-24"
                @click.stop
              />
              <input
                v-model="editingGroupComment"
                type="text"
                placeholder="Comment"
                class="text-[10px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-1 py-0.5 outline-none min-w-32"
                @click.stop
              />
              <button
                class="text-neutral-400 hover:text-green-600 dark:hover:text-green-300 transition-colors"
                title="Save group details"
                @click.stop="saveGroupMeta(groupedRows[vRow.index].group.id)"
              >
                <UIcon name="i-lucide-check" class="text-[11px]" />
              </button>
              <button
                class="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                title="Cancel editing"
                @click.stop="cancelGroupMetaEdit()"
              >
                <UIcon name="i-lucide-x" class="text-[11px]" />
              </button>
            </template>
            <template v-else>
              <span class="font-medium text-neutral-700 dark:text-neutral-200 truncate">
                {{ groupedRows[vRow.index].group.name }}
              </span>
              <button
                class="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                title="Edit group name/comment"
                @click.stop="startGroupMetaEdit(groupedRows[vRow.index].group)"
              >
                <UIcon name="i-lucide-pencil" class="text-[10px]" />
              </button>
            </template>
            <span class="text-neutral-400">({{ groupedRows[vRow.index].count }})</span>
            <span
              v-if="groupedRows[vRow.index].group.comment && editingGroupId !== groupedRows[vRow.index].group.id"
              class="truncate text-neutral-500"
              :title="groupedRows[vRow.index].group.comment"
            >
              - {{ groupedRows[vRow.index].group.comment }}
            </span>
            <span class="flex-1" />
            <button
              class="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
              :title="groupedRows[vRow.index].group.hidden ? 'Show group' : 'Hide group'"
              @click.stop="emit('toggle:groupHidden', groupedRows[vRow.index].group.id)"
            >
              <UIcon
                :name="groupedRows[vRow.index].group.hidden ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                class="text-[11px]"
              />
            </button>
            <button
              class="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move group up"
              :disabled="!canMoveGroup(groupedRows[vRow.index].group.id, -1)"
              @click.stop="moveGroup(groupedRows[vRow.index].group.id, -1)"
            >
              <UIcon name="i-lucide-chevron-up" class="text-[11px]" />
            </button>
            <button
              class="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move group down"
              :disabled="!canMoveGroup(groupedRows[vRow.index].group.id, 1)"
              @click.stop="moveGroup(groupedRows[vRow.index].group.id, 1)"
            >
              <UIcon name="i-lucide-chevron-down" class="text-[11px]" />
            </button>
            <button
              class="text-neutral-400 hover:text-red-500 transition-colors"
              title="Delete group"
              @click.stop="emit('delete:group', groupedRows[vRow.index].group.id)"
            >
              <UIcon name="i-lucide-trash-2" class="text-[11px]" />
            </button>
          </div>

          <div
            v-else
            class="grid gap-x-2 cursor-pointer"
            :style="{ gridTemplateColumns: gridCols }"
            draggable="true"
            :class="{
              'bg-cyan-50 dark:bg-cyan-900/20 hover:bg-cyan-100 dark:hover:bg-cyan-900/30': selectedDesignator === groupedRows[vRow.index].component.designator && !groupedRows[vRow.index].component.dnp,
              'hover:bg-neutral-100 dark:hover:bg-neutral-800': selectedDesignator !== groupedRows[vRow.index].component.designator && !groupedRows[vRow.index].component.dnp,
              'opacity-40': groupedRows[vRow.index].component.dnp && activeFilters.size === 0,
            }"
            @dragstart="onDragStart($event, groupedRows[vRow.index].component)"
            @dragover.prevent="onComponentRowDragOver"
            @drop.prevent="onDropBeforeComponent(groupedRows[vRow.index].component.key)"
            @dragend="onDragEnd"
            @click="onRowClick(groupedRows[vRow.index].component.designator)"
            @dblclick="emit('edit', groupedRows[vRow.index].component)"
          >
            <!-- DNP toggle / indicator -->
            <button
              class="flex items-center justify-center shrink-0 transition-colors"
              :title="groupedRows[vRow.index].component.dnp ? 'Remove DNP mark' : 'Mark as Do Not Populate'"
              @click.stop="emit('toggle:dnp', groupedRows[vRow.index].component.key)"
            >
              <span
                class="h-2.5 w-2.5 rounded-full"
                :class="groupedRows[vRow.index].component.dnp
                  ? 'bg-red-500'
                  : 'bg-transparent border border-neutral-300/70 dark:border-neutral-700/70'"
              />
            </button>

            <span class="font-medium truncate flex items-center gap-0.5" :title="groupedRows[vRow.index].component.designator" :class="{ 'line-through': groupedRows[vRow.index].component.dnp }">
              {{ groupedRows[vRow.index].component.designator }}
              <span
                v-if="showSideIndicator"
                class="text-[9px] font-normal text-neutral-400"
              >{{ groupedRows[vRow.index].component.side === 'top' ? 'T' : 'B' }}</span>
              <UIcon
                v-if="bomDesignators && bomDesignators.size > 0 && !groupedRows[vRow.index].component.dnp && !bomDesignators.has(groupedRows[vRow.index].component.designator)"
                name="i-lucide-triangle-alert"
                class="text-[10px] text-amber-500 shrink-0"
                title="Not found in BOM"
              />
            </span>
            <span v-if="showCoords" class="text-neutral-500 tabular-nums">{{ groupedRows[vRow.index].component.x.toFixed(2) }}</span>
            <span v-if="showCoords" class="text-neutral-500 tabular-nums">{{ groupedRows[vRow.index].component.y.toFixed(2) }}</span>
            <div class="flex items-center gap-0.5" @click.stop>
              <input
                type="number"
                step="0.1"
                :value="formatRotation(groupedRows[vRow.index].component.rotation)"
                class="rotation-input w-8 min-w-0 rounded px-1 py-0.5 tabular-nums outline-none border bg-transparent transition-colors"
                :class="groupedRows[vRow.index].component.rotationOverridden
                  ? 'text-amber-600 dark:text-amber-300 border-transparent focus:border-amber-300/70 dark:focus:border-amber-500/50 focus:bg-amber-50/60 dark:focus:bg-amber-500/10'
                  : 'text-neutral-500 border-transparent focus:border-neutral-300 dark:focus:border-neutral-600 focus:bg-neutral-50 dark:focus:bg-neutral-800/70'"
                :title="groupedRows[vRow.index].component.rotationOverridden
                  ? `Original: ${formatRotation(groupedRows[vRow.index].component.originalRotation)}°`
                  : 'Rotation (deg)'"
                @mousedown.stop
                @keydown.enter.prevent="commitRotation(groupedRows[vRow.index].component, $event)"
                @blur="commitRotation(groupedRows[vRow.index].component, $event)"
              />
              <button
                v-if="selectedDesignator === groupedRows[vRow.index].component.designator"
                class="shrink-0 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                title="Rotate 90° CCW"
                @mousedown.stop
                @click.stop="rotateCCW(groupedRows[vRow.index].component)"
              >
                <UIcon name="i-lucide-rotate-ccw" class="text-[10px]" />
              </button>
              <button
                v-if="groupedRows[vRow.index].component.rotationOverridden"
                class="shrink-0 text-amber-600/90 dark:text-amber-300/90 hover:text-red-500 transition-colors"
                title="Reset to original rotation"
                @mousedown.stop
                @click.stop="emit('reset:rotation', { key: groupedRows[vRow.index].component.key })"
              >
                <UIcon name="i-lucide-undo-2" class="text-[10px]" />
              </button>
            </div>
            <!-- Polarized toggle -->
            <div class="flex items-center justify-center" @click.stop>
              <USwitch
                :model-value="groupedRows[vRow.index].component.polarized"
                size="xs"
                :title="groupedRows[vRow.index].component.polarized ? 'Polarized (pin 1 marked)' : 'Not polarized (no pin 1 marker)'"
                @update:model-value="emit('update:polarized', { key: groupedRows[vRow.index].component.key, polarized: !!$event })"
              />
            </div>
            <span class="truncate text-neutral-500" :title="groupedRows[vRow.index].component.value">{{ groupedRows[vRow.index].component.value || '—' }}</span>
            <!-- CAD Package (customer footprint name) -->
            <span class="truncate text-neutral-500" :title="groupedRows[vRow.index].component.cadPackage">{{ groupedRows[vRow.index].component.cadPackage || '—' }}</span>
            <!-- Package (our matched package) -->
            <USelectMenu
              :model-value="groupedRows[vRow.index].component.matchedPackage || undefined"
              v-model:search-term="pkgSearchTerm"
              :items="packageSelectItems"
              value-key="value"
              label-key="displayLabel"
              size="xs"
              searchable
              ignore-filter
              placeholder="—"
              class="w-full min-w-0"
              :class="groupedRows[vRow.index].component.packageMapped ? 'text-blue-700 dark:text-blue-300' : ''"
              :search-input="{ placeholder: 'Search package or library...' }"
              :ui="{ content: 'min-w-[28rem] max-w-[40rem]', itemLabel: 'whitespace-normal leading-tight' }"
              @mousedown.stop
              @highlight="onPkgHighlight(groupedRows[vRow.index].component.key, $event as any)"
              @update:open="!$event && emit('preview:package', null)"
              @update:model-value="onPackageMappingSelect(groupedRows[vRow.index].component, $event)"
            >
              <template #item="{ item }">
                <div class="w-full py-0.5">
                  <div class="text-xs font-medium text-neutral-800 dark:text-neutral-100 break-all leading-tight">
                    {{ getPackageOption(item)?.label ?? getItemLabel(item) }}
                  </div>
                  <div class="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {{ getPackageOption(item)?.libraryLabel ?? 'Local' }}
                  </div>
                </div>
              </template>
            </USelectMenu>
            <!-- Note indicator / edit button -->
            <div class="flex items-center justify-center" @click.stop>
              <button
                v-if="groupedRows[vRow.index].component.note"
                class="text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
                :title="groupedRows[vRow.index].component.note"
                @click="emit('edit', groupedRows[vRow.index].component)"
              >
                <UIcon name="i-lucide-sticky-note" class="text-[11px]" />
              </button>
              <button
                v-else
                class="text-neutral-300 dark:text-neutral-700 opacity-0 group-hover/row:opacity-100 hover:!text-neutral-500 dark:hover:!text-neutral-400 transition-all"
                title="Edit component"
                @click="emit('edit', groupedRows[vRow.index].component)"
              >
                <UIcon name="i-lucide-ellipsis" class="text-[11px]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVirtualizer } from '@tanstack/vue-virtual'
import type { EditablePnPComponent, AlignMode, PnPFilterKey } from '~/composables/usePickAndPlace'
import type { PnPConvention } from '~/utils/pnp-conventions'
import { PNP_CONVENTION_LABELS } from '~/utils/pnp-conventions'

const props = defineProps<{
  allComponents: EditablePnPComponent[]
  filteredComponents: EditablePnPComponent[]
  selectedDesignator: string | null
  searchQuery: string
  activeFilters: Set<PnPFilterKey>
  alignMode: AlignMode
  hasOrigin: boolean
  originX: number | null
  originY: number | null
  showPackages: boolean
  pnpConvention: PnPConvention
  packageOptions: Array<{
    value: string
    label: string
    libraryLabel: string
    searchText: string
    previewKind: 'smd' | 'tht'
    previewPkg?: Record<string, any>
    packageType?: string
  }>
  sortState: SortState
  manualOrder: string[]
  groups: ComponentGroup[]
  groupAssignments: Record<string, string>
  /** Set of designators present in BOM data (excluding DNP lines) */
  bomDesignators?: Set<string>
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
  'toggle:filter': [key: PnPFilterKey]
  clearFilters: []
  'update:packageMapping': [payload: { cadPackage: string; packageName: string | null; componentKey?: string; isManual?: boolean }]
  'update:polarized': [payload: { key: string; polarized: boolean }]
  'update:sortState': [value: SortState]
  'update:manualOrder': [value: string[]]
  'create:group': []
  'update:groupMeta': [payload: { groupId: string; name: string; comment: string }]
  'toggle:groupHidden': [groupId: string]
  'toggle:groupCollapsed': [groupId: string]
  'delete:group': [groupId: string]
  'reorder:groups': [groupIds: string[]]
  'assign:group': [payload: { componentKey: string; groupId: string | null }]
  edit: [component: EditablePnPComponent]
  addComponent: []
  'preview:package': [payload: { componentKey: string; packageName: string } | null]
}>()

const conventionOptions = Object.entries(PNP_CONVENTION_LABELS) as [PnPConvention, string][]
const conventionSelectItems = computed(() =>
  conventionOptions.map(([value, label]) => ({ value, label })),
)
const PKG_DROPDOWN_LIMIT = 80

const allPackageSelectItems = computed(() =>
  props.packageOptions.map((opt) => ({
    ...opt,
    displayLabel: `${opt.label} · ${opt.libraryLabel}`,
  })),
)
const pkgSearchTerm = ref('')
const packageSelectItems = computed(() => {
  const q = pkgSearchTerm.value.trim().toLowerCase()
  const source = allPackageSelectItems.value
  if (!q) return source.slice(0, PKG_DROPDOWN_LIMIT)
  const out: typeof source = []
  for (const item of source) {
    if (item.searchText.toLowerCase().includes(q)) {
      out.push(item)
      if (out.length >= PKG_DROPDOWN_LIMIT) break
    }
  }
  return out
})
function onPkgHighlight(componentKey: string, payload: { value: string } | undefined) {
  emit('preview:package', payload?.value ? { componentKey, packageName: payload.value } : null)
}
const packageOptionsByValue = computed(() => {
  const map = new Map<string, (typeof props.packageOptions)[number]>()
  for (const opt of props.packageOptions) map.set(opt.value, opt)
  return map
})

function getItemValue(item: any): string | undefined {
  if (!item || typeof item !== 'object') return undefined
  if (typeof item.value === 'string') return item.value
  if (item.raw && typeof item.raw === 'object' && typeof item.raw.value === 'string') return item.raw.value
  return undefined
}

function getItemLabel(item: any): string {
  if (!item || typeof item !== 'object') return ''
  if (typeof item.label === 'string') return item.label
  if (typeof item.displayLabel === 'string') return item.displayLabel
  if (item.raw && typeof item.raw === 'object') {
    if (typeof item.raw.label === 'string') return item.raw.label
    if (typeof item.raw.displayLabel === 'string') return item.raw.displayLabel
  }
  return ''
}

function getPackageOption(item: any) {
  const value = getItemValue(item)
  if (!value) return null
  return packageOptionsByValue.value.get(value) ?? null
}

const filterOptions: { key: PnPFilterKey; label: string; title: string }[] = [
  { key: 'polarized', label: 'Polarized', title: 'Show polarized components only' },
  { key: 'dnp', label: 'DNP', title: 'Show Do Not Populate components only' },
  { key: 'edited', label: 'Edited', title: 'Show manually edited components only' },
  { key: 'unmatched', label: 'Unmatched', title: 'Show components with unmatched packages only' },
]

// DNP count
const dnpCount = computed(() => props.allComponents.filter(c => c.dnp).length)

// --- Column visibility ---
const showCoords = ref(false)

const gridCols = computed(() =>
  showCoords.value
    ? '1rem 3.6rem 3.2rem 3.2rem 4rem 2.4rem minmax(0,1fr) minmax(0,1fr) minmax(0,1.6fr) 1.6rem'
    : '1rem 3.6rem 4rem 2.4rem minmax(0,1fr) minmax(0,1fr) minmax(0,1.6fr) 1.6rem',
)

// --- Sorting ---
type SortKey = 'ref' | 'x' | 'y' | 'rot' | 'pol' | 'value' | 'cadPackage' | 'package'
type SortState = { key: SortKey | null; asc: boolean }
type ComponentGroup = {
  id: string
  name: string
  comment: string
  hidden: boolean
  collapsed: boolean
}
type DisplayRow =
  | { kind: 'ungrouped'; count: number }
  | { kind: 'group'; group: ComponentGroup; count: number }
  | { kind: 'component'; component: EditablePnPComponent }

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

const visibleSortColumns = computed(() =>
  showCoords.value
    ? sortColumns
    : sortColumns.filter(c => c.key !== 'x' && c.key !== 'y'),
)

const sortKey = computed<SortKey | null>(() => props.sortState.key)
const sortAsc = computed<boolean>(() => props.sortState.asc)

function toggleSort(key: SortKey) {
  let next: SortState
  if (sortKey.value === key) {
    if (sortAsc.value) {
      next = { key, asc: false }
    } else {
      // Third click resets to unsorted
      next = { key: null, asc: true }
    }
  } else {
    next = { key, asc: true }
  }
  emit('update:sortState', next)
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

const sortedComponents = computed<EditablePnPComponent[]>(() => {
  const list = props.filteredComponents
  const key = sortKey.value
  if (!key) {
    const orderIndex = new Map(props.manualOrder.map((k, i) => [k, i]))
    return [...list].sort((a, b) => {
      const ai = orderIndex.get(a.key)
      const bi = orderIndex.get(b.key)
      if (ai == null && bi == null) return 0
      if (ai == null) return 1
      if (bi == null) return -1
      return ai - bi
    })
  }

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

const groupedRows = computed<any[]>(() => {
  const rows: DisplayRow[] = []
  const groupMap = new Map<string, EditablePnPComponent[]>()
  const groupsById = new Set(props.groups.map(g => g.id))

  for (const group of props.groups) {
    groupMap.set(group.id, [])
  }

  const ungrouped: EditablePnPComponent[] = []
  for (const comp of sortedComponents.value) {
    const groupId = props.groupAssignments[comp.key]
    if (!groupId || !groupsById.has(groupId)) {
      ungrouped.push(comp)
      continue
    }
    groupMap.get(groupId)?.push(comp)
  }

  rows.push({ kind: 'ungrouped', count: ungrouped.length })
  for (const comp of ungrouped) rows.push({ kind: 'component', component: comp })

  for (const group of props.groups) {
    const comps = groupMap.get(group.id) ?? []
    rows.push({ kind: 'group', group, count: comps.length })
    if (group.hidden || group.collapsed) continue
    for (const comp of comps) {
      rows.push({ kind: 'component', component: comp })
    }
  }

  return rows
})

watch(
  () => props.allComponents.map(c => c.key),
  (keys) => {
    const next = [...props.manualOrder]
    const seen = new Set(next)
    for (const key of keys) {
      if (!seen.has(key)) {
        next.push(key)
        seen.add(key)
      }
    }
    if (next.length !== props.manualOrder.length || next.some((k, i) => k !== props.manualOrder[i])) {
      emit('update:manualOrder', next)
    }
  },
  { immediate: true },
)

const localSearch = ref(props.searchQuery)
let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined

watch(localSearch, (v) => {
  clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => emit('update:searchQuery', v), 150)
})
watch(() => props.searchQuery, (v) => {
  if (v !== localSearch.value) localSearch.value = v
})

onUnmounted(() => {
  clearTimeout(searchDebounceTimer)
})

const searchQuery = computed({
  get: () => localSearch.value,
  set: (v: string) => { localSearch.value = v },
})

const hasActiveFiltersOrSearch = computed(() =>
  props.activeFilters.size > 0 || localSearch.value.trim() !== '',
)

function clearAll() {
  localSearch.value = ''
  emit('clearFilters')
}

const listRef = ref<HTMLElement | null>(null)

const ROW_HEIGHT = 25

const rowVirtualizer = useVirtualizer(
  computed(() => ({
    count: groupedRows.value.length,
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
  groupedRows.value.forEach((row, i) => {
    if (row.kind === 'component') map.set(row.component.designator, i)
  })
  return map
})

function createGroup() {
  emit('create:group')
}

const dragComponentKey = ref<string | null>(null)
const dragGroupId = ref<string | null>(null)

function ensureManualSortMode() {
  if (sortKey.value !== null) {
    emit('update:sortState', { key: null, asc: true })
  }
}

function onDragStart(event: DragEvent, comp: EditablePnPComponent) {
  dragGroupId.value = null
  ensureManualSortMode()
  dragComponentKey.value = comp.key
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'copyMove'
    event.dataTransfer.setData('text/plain', comp.key)
  }
}

function onDropBeforeComponent(targetKey: string) {
  const dragged = dragComponentKey.value
  if (!dragged || dragged === targetKey) return
  const targetGroupId = props.groupAssignments[targetKey] ?? null
  emit('assign:group', { componentKey: dragged, groupId: targetGroupId })
  const next = props.manualOrder.filter(k => k !== dragged)
  const idx = next.indexOf(targetKey)
  if (idx < 0) {
    next.push(dragged)
  } else {
    next.splice(idx, 0, dragged)
  }
  emit('update:manualOrder', next)
}

function onDropToGroup(groupId: string) {
  const draggedGroupId = dragGroupId.value
  if (draggedGroupId) {
    if (draggedGroupId === groupId) return
    const nextIds = props.groups.filter(g => g.id !== draggedGroupId).map(g => g.id)
    const idx = nextIds.indexOf(groupId)
    if (idx < 0) nextIds.push(draggedGroupId)
    else nextIds.splice(idx, 0, draggedGroupId)
    emit('reorder:groups', nextIds)
    return
  }

  const dragged = dragComponentKey.value
  if (!dragged) return
  emit('assign:group', { componentKey: dragged, groupId })
  const next = props.manualOrder.filter(k => k !== dragged)
  next.push(dragged)
  emit('update:manualOrder', next)
}

function onDropToUngrouped() {
  const dragged = dragComponentKey.value
  if (!dragged) return
  emit('assign:group', { componentKey: dragged, groupId: null })
  const next = props.manualOrder.filter(k => k !== dragged)
  next.push(dragged)
  emit('update:manualOrder', next)
}

function onDragEnd() {
  dragComponentKey.value = null
}

function onGroupDragStart(event: DragEvent, groupId: string) {
  dragComponentKey.value = null
  dragGroupId.value = groupId
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', groupId)
  }
}

function onGroupDragEnd() {
  dragGroupId.value = null
}

function onComponentRowDragOver(event: DragEvent) {
  if (!event.dataTransfer) return
  // Reordering rows is always a move operation.
  event.dataTransfer.dropEffect = 'move'
}

function onGroupHeaderDragOver(event: DragEvent) {
  if (!event.dataTransfer) return
  if (dragGroupId.value) {
    // Dragging a group over a group means reordering groups.
    event.dataTransfer.dropEffect = 'move'
    return
  }
  // Dragging a component over a group means assign to that group.
  event.dataTransfer.dropEffect = 'copy'
}

function onUngroupedDragOver(event: DragEvent) {
  if (!event.dataTransfer) return
  // Moving into "No section" is still a move assignment.
  event.dataTransfer.dropEffect = 'move'
}

function canMoveGroup(groupId: string, direction: -1 | 1): boolean {
  const idx = props.groups.findIndex(g => g.id === groupId)
  if (idx < 0) return false
  const nextIdx = idx + direction
  return nextIdx >= 0 && nextIdx < props.groups.length
}

function moveGroup(groupId: string, direction: -1 | 1) {
  const idx = props.groups.findIndex(g => g.id === groupId)
  if (idx < 0) return
  const nextIdx = idx + direction
  if (nextIdx < 0 || nextIdx >= props.groups.length) return
  const nextIds = props.groups.map(g => g.id)
  const [moved] = nextIds.splice(idx, 1)
  nextIds.splice(nextIdx, 0, moved)
  emit('reorder:groups', nextIds)
}

const editingGroupId = ref<string | null>(null)
const editingGroupName = ref('')
const editingGroupComment = ref('')

function startGroupMetaEdit(group: ComponentGroup) {
  editingGroupId.value = group.id
  editingGroupName.value = group.name
  editingGroupComment.value = group.comment
}

function cancelGroupMetaEdit() {
  editingGroupId.value = null
  editingGroupName.value = ''
  editingGroupComment.value = ''
}

function saveGroupMeta(groupId: string) {
  const name = editingGroupName.value.trim()
  if (!name) return
  emit('update:groupMeta', {
    groupId,
    name,
    comment: editingGroupComment.value.trim(),
  })
  cancelGroupMetaEdit()
}

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

function onPackageMappingSelect(comp: EditablePnPComponent, value: unknown) {
  const packageName = typeof value === 'string' ? value : ''
  emit('update:packageMapping', {
    cadPackage: comp.cadPackage,
    packageName: packageName || null,
    componentKey: comp.key,
    isManual: comp.manual,
  })
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
