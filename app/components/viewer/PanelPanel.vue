<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Top toolbar: compact toggles -->
    <div class="flex items-center gap-2 px-4 py-2 border-b border-neutral-200 dark:border-neutral-800">
      <button
        class="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors"
        :class="local.showComponents
          ? 'border-blue-500/70 text-blue-700 bg-blue-50/90 dark:border-blue-400/70 dark:text-blue-200 dark:bg-blue-500/15'
          : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:border-neutral-400'"
        title="Show component overlay on each PCB"
        @click="update('showComponents', !local.showComponents)"
      >
        <UIcon name="i-lucide-cpu" class="text-[11px]" />
        Components
      </button>
      <button
        class="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors"
        :class="dangerZoneLocal.enabled
          ? 'border-orange-500/70 text-orange-700 bg-orange-50/90 dark:border-orange-400/70 dark:text-orange-200 dark:bg-orange-500/15'
          : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:border-neutral-400'"
        title="Show danger zone clearance overlay"
        @click="dangerZoneLocal = { ...dangerZoneLocal, enabled: !dangerZoneLocal.enabled }"
      >
        <UIcon name="i-lucide-triangle-alert" class="text-[11px]" />
        Danger Zone
      </button>
      <input
        v-if="dangerZoneLocal.enabled"
        :value="dangerZoneLocal.insetMm"
        type="number"
        min="0.5"
        max="20"
        step="0.5"
        title="Danger zone inset width (mm)"
        class="w-12 text-[10px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-1.5 py-0.5 outline-none focus:border-primary transition-colors tabular-nums"
        @input="dangerZoneLocal = { ...dangerZoneLocal, insetMm: clampFloat(($event.target as HTMLInputElement).value, 0.5, 20) }"
      />
    </div>

    <div class="flex-1 overflow-y-auto">
      <!-- Section: Grid Layout -->
      <div class="p-4 pb-2">
        <div class="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
          Grid Layout
        </div>
        <div class="grid grid-cols-3 gap-x-2">
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Count X</label>
            <input
              :value="local.countX"
              type="number"
              min="1"
              max="50"
              step="1"
              class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:border-primary transition-colors tabular-nums"
              @input="update('countX', clampInt(($event.target as HTMLInputElement).value, 1, 50))"
            />
          </div>
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Count Y</label>
            <input
              :value="local.countY"
              type="number"
              min="1"
              max="50"
              step="1"
              class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:border-primary transition-colors tabular-nums"
              @input="update('countY', clampInt(($event.target as HTMLInputElement).value, 1, 50))"
            />
          </div>
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Rotation</label>
            <div class="flex">
              <input
                :value="local.pcbRotation + '°'"
                type="text"
                readonly
                class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-l px-2 py-1 outline-none tabular-nums text-center"
              />
              <button
                class="text-[10px] font-medium px-1.5 py-1 rounded-r border border-l-0 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors whitespace-nowrap"
                title="Rotate +90°"
                @click="update('pcbRotation', (local.pcbRotation + 90) % 360)"
              >
                +90
              </button>
            </div>
          </div>
        </div>

        <!-- Panel size info with limit warning -->
        <div
          v-if="boardSizeMm && (local.countX > 1 || local.countY > 1 || local.frame.enabled)"
          class="mt-1.5 text-[10px] tabular-nums"
          :class="panelExceedsLimits ? 'text-orange-500 dark:text-orange-400 font-semibold' : 'text-neutral-400'"
        >
          <span>Panel: {{ panelWidth.toFixed(2) }} × {{ panelHeight.toFixed(2) }} mm</span>
          <span
            v-if="panelExceedsLimits"
            class="ml-1"
            :title="`Max panel size: ${PANEL_MAX_WIDTH}mm (X) × ${PANEL_MAX_HEIGHT}mm (Y)`"
          >
            (exceeds {{ PANEL_MAX_WIDTH }}×{{ PANEL_MAX_HEIGHT }}mm limit)
          </span>
        </div>
      </div>

      <!-- Section: Separation -->
      <div class="px-4 py-2 border-t border-neutral-200 dark:border-neutral-800">
        <div class="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
          Separation
        </div>

        <div class="space-y-2">
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Type</label>
            <div class="flex items-center gap-1">
              <button
                v-for="t in separationTypes"
                :key="t.value"
                class="flex-1 text-[10px] font-medium px-2 py-1 rounded border transition-colors text-center"
                :class="local.separationType === t.value
                  ? 'border-blue-500/70 text-blue-700 bg-blue-50/90 dark:border-blue-400/70 dark:text-blue-200 dark:bg-blue-500/15'
                  : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500'"
                @click="updateSeparationType(t.value)"
              >
                {{ t.label }}
              </button>
            </div>
          </div>

          <!-- Routing tool diameter -->
          <div v-if="local.separationType !== 'scored'" class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Routing Tool (mm)</label>
            <input
              :value="local.routingToolDiameter"
              type="number"
              min="0.5"
              max="5"
              step="0.1"
              class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:border-primary transition-colors tabular-nums"
              @input="update('routingToolDiameter', clampFloat(($event.target as HTMLInputElement).value, 0.5, 5))"
            />
          </div>

          <!-- Per-edge separation (mixed mode) -->
          <template v-if="local.separationType === 'mixed'">
            <div class="text-[10px] text-neutral-400 mt-1">Edge Types</div>
            <div class="grid grid-cols-2 gap-x-3 gap-y-1">
              <div v-for="edge in edgeNames" :key="edge" class="flex items-center gap-1.5">
                <span class="text-[10px] text-neutral-500 w-10 capitalize">{{ edge }}</span>
                <select
                  :value="local.edges[edge].type"
                  class="flex-1 text-[10px] bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-1.5 py-0.5 outline-none focus:border-primary transition-colors"
                  @change="updateEdge(edge, ($event.target as HTMLSelectElement).value as 'routed' | 'scored')"
                >
                  <option value="routed">Routed</option>
                  <option value="scored">V-Cut</option>
                </select>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Section: Tabs (only for routed/mixed) -->
      <div v-if="local.separationType !== 'scored'" class="px-4 py-2 border-t border-neutral-200 dark:border-neutral-800">
        <div class="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
          Tabs
        </div>
        <div class="grid grid-cols-2 gap-x-3 gap-y-2 mb-2">
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Width (mm)</label>
            <input
              :value="local.tabs.width"
              type="number"
              min="0.5"
              max="10"
              step="0.5"
              class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:border-primary transition-colors tabular-nums"
              @input="updateTabs('width', clampFloat(($event.target as HTMLInputElement).value, 0.5, 10))"
            />
          </div>
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Perforation</label>
            <select
              :value="local.tabs.perforation"
              class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:border-primary transition-colors"
              @change="updateTabs('perforation', ($event.target as HTMLSelectElement).value as TabPerforationMode)"
            >
              <option value="none">None</option>
              <option value="pcb-side">PCB Side</option>
              <option value="both-sides">Both Sides</option>
            </select>
          </div>
        </div>
        <div class="mb-2 flex items-center justify-between">
          <label class="text-[10px] text-neutral-400">Synchronize Tab Edits</label>
          <button
            class="text-[10px] px-1.5 py-0.5 rounded border transition-colors"
            :class="local.tabs.syncAcrossPanel
              ? 'border-blue-500/70 text-blue-700 bg-blue-50/90 dark:border-blue-400/70 dark:text-blue-200 dark:bg-blue-500/15'
              : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:border-neutral-400'"
            @click="updateTabs('syncAcrossPanel', !local.tabs.syncAcrossPanel)"
          >
            {{ local.tabs.syncAcrossPanel ? 'ON' : 'OFF' }}
          </button>
        </div>
        <div class="grid grid-cols-4 gap-x-2 gap-y-1">
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Top</label>
            <input
              :value="local.tabs.defaultCountTop"
              type="number"
              min="0"
              max="10"
              step="1"
              class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:border-primary transition-colors tabular-nums"
              @input="updateTabSideCount('defaultCountTop', clampInt(($event.target as HTMLInputElement).value, 0, 10))"
            />
          </div>
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Bottom</label>
            <input
              :value="local.tabs.defaultCountBottom"
              type="number"
              min="0"
              max="10"
              step="1"
              class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:border-primary transition-colors tabular-nums"
              @input="updateTabSideCount('defaultCountBottom', clampInt(($event.target as HTMLInputElement).value, 0, 10))"
            />
          </div>
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Left</label>
            <input
              :value="local.tabs.defaultCountLeft"
              type="number"
              min="0"
              max="10"
              step="1"
              class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:border-primary transition-colors tabular-nums"
              @input="updateTabSideCount('defaultCountLeft', clampInt(($event.target as HTMLInputElement).value, 0, 10))"
            />
          </div>
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Right</label>
            <input
              :value="local.tabs.defaultCountRight"
              type="number"
              min="0"
              max="10"
              step="1"
              class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:border-primary transition-colors tabular-nums"
              @input="updateTabSideCount('defaultCountRight', clampInt(($event.target as HTMLInputElement).value, 0, 10))"
            />
          </div>
        </div>

        <!-- Perforation (Mouse Bites) -->
        <div class="mt-2 space-y-2">
          <div v-if="local.tabs.perforation !== 'none'" class="grid grid-cols-2 gap-x-3 gap-y-2">
            <div class="space-y-0.5">
              <label class="text-[10px] text-neutral-400">Hole Dia (mm)</label>
              <input
                :value="local.tabs.perforationHoleDiameter"
                type="number"
                min="0.2"
                max="2"
                step="0.1"
                class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:border-primary transition-colors tabular-nums"
                @input="updateTabs('perforationHoleDiameter', clampFloat(($event.target as HTMLInputElement).value, 0.2, 2))"
              />
            </div>
            <div class="space-y-0.5">
              <label class="text-[10px] text-neutral-400">Spacing (mm)</label>
              <input
                :value="local.tabs.perforationHoleSpacing"
                type="number"
                min="0.3"
                max="3"
                step="0.1"
                class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:border-primary transition-colors tabular-nums"
                @input="updateTabs('perforationHoleSpacing', clampFloat(($event.target as HTMLInputElement).value, 0.3, 3))"
              />
            </div>
          </div>
        </div>

        <p class="mt-2 text-[10px] text-neutral-400">
          Tab placement is edited directly on the canvas using the Move/Add/Delete controls.
        </p>
      </div>

      <!-- Section: Frame -->
      <div class="px-4 py-2 border-t border-neutral-200 dark:border-neutral-800">
        <div class="flex items-center justify-between mb-2">
          <div class="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
            Frame
          </div>
          <button
            class="text-[10px] px-1.5 py-0.5 rounded border transition-colors"
            :class="local.frame.enabled
              ? 'border-blue-500/70 text-blue-700 bg-blue-50/90 dark:border-blue-400/70 dark:text-blue-200 dark:bg-blue-500/15'
              : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:border-neutral-400'"
            @click="updateFrame('enabled', !local.frame.enabled)"
          >
            {{ local.frame.enabled ? 'ON' : 'OFF' }}
          </button>
        </div>

        <template v-if="local.frame.enabled">
          <div class="grid grid-cols-2 gap-x-3 gap-y-2">
            <div class="space-y-0.5">
              <label class="text-[10px] text-neutral-400">Width (mm)</label>
              <input
                :value="local.frame.width"
                type="number"
                min="2"
                max="30"
                step="0.5"
                class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:border-primary transition-colors tabular-nums"
                @input="updateFrame('width', clampFloat(($event.target as HTMLInputElement).value, 2, 30))"
              />
            </div>
            <div class="space-y-0.5">
              <label class="text-[10px] text-neutral-400">Corner R (mm)</label>
              <input
                :value="local.frame.cornerRadius"
                type="number"
                min="0"
                max="10"
                step="0.5"
                class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:border-primary transition-colors tabular-nums"
                @input="updateFrame('cornerRadius', clampFloat(($event.target as HTMLInputElement).value, 0, 10))"
              />
            </div>
          </div>
        </template>
      </div>

      <!-- Section: Support Bars -->
      <div v-if="local.countX > 1 || local.countY > 1" class="px-4 py-2 border-t border-neutral-200 dark:border-neutral-800">
        <div class="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
          Support Bars
        </div>

        <div class="grid grid-cols-2 gap-x-3 gap-y-2">
          <div class="space-y-0.5">
            <label class="text-[10px] text-neutral-400">Rail Width (mm)</label>
            <input
              :value="local.supports.width"
              type="number"
              min="5"
              max="30"
              step="0.5"
              class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:border-primary transition-colors tabular-nums"
              @change="updateSupports('width', clampFloat(($event.target as HTMLInputElement).value, 5, 30))"
              @blur="updateSupports('width', clampFloat(($event.target as HTMLInputElement).value, 5, 30))"
            />
          </div>

          <div />

          <!-- Column gaps -->
          <div v-if="local.countX > 1" class="space-y-1">
            <div class="text-[10px] text-neutral-400">Column Gaps</div>
            <label
              v-for="i in (local.countX - 1)"
              :key="`xgap-${i}`"
              class="flex items-center gap-1.5 text-[10px] text-neutral-500 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                :checked="local.supports.xGaps.includes(i - 1)"
                class="rounded border-neutral-300 dark:border-neutral-600 text-primary focus:ring-primary/30 w-3 h-3"
                @change="toggleSupportGap('x', i - 1)"
              />
              Col {{ i }}-{{ i + 1 }}
            </label>
          </div>

          <!-- Row gaps -->
          <div v-if="local.countY > 1" class="space-y-1">
            <div class="text-[10px] text-neutral-400">Row Gaps</div>
            <label
              v-for="i in (local.countY - 1)"
              :key="`ygap-${i}`"
              class="flex items-center gap-1.5 text-[10px] text-neutral-500 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                :checked="local.supports.yGaps.includes(i - 1)"
                class="rounded border-neutral-300 dark:border-neutral-600 text-primary focus:ring-primary/30 w-3 h-3"
                @change="toggleSupportGap('y', i - 1)"
              />
              Row {{ i }}-{{ i + 1 }}
            </label>
          </div>
        </div>
      </div>

      <!-- Section: Fiducials -->
      <div class="px-4 py-2 border-t border-neutral-200 dark:border-neutral-800">
        <div class="flex items-center justify-between mb-2">
          <div class="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
            Fiducials
          </div>
          <button
            class="text-[10px] px-1.5 py-0.5 rounded border transition-colors"
            :class="local.fiducials.enabled
              ? 'border-blue-500/70 text-blue-700 bg-blue-50/90 dark:border-blue-400/70 dark:text-blue-200 dark:bg-blue-500/15'
              : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:border-neutral-400'"
            @click="updateFiducials('enabled', !local.fiducials.enabled)"
          >
            {{ local.fiducials.enabled ? 'ON' : 'OFF' }}
          </button>
        </div>

        <template v-if="local.fiducials.enabled">
          <div class="grid grid-cols-2 gap-x-3">
            <div class="space-y-0.5">
              <label class="text-[10px] text-neutral-400">Diameter (mm)</label>
              <input
                :value="local.fiducials.diameter"
                type="number"
                min="0.5"
                max="5"
                step="0.1"
                class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:border-primary transition-colors tabular-nums"
                @input="updateFiducials('diameter', clampFloat(($event.target as HTMLInputElement).value, 0.5, 5))"
              />
            </div>
            <div class="space-y-0.5">
              <label class="text-[10px] text-neutral-400">Positions</label>
              <div class="flex flex-col gap-0.5 mt-0.5">
                <label
                  v-for="pos in fiducialPositionOptions"
                  :key="pos.value"
                  class="flex items-center gap-1 text-[10px] text-neutral-500 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    :checked="local.fiducials.positions.includes(pos.value)"
                    class="rounded border-neutral-300 dark:border-neutral-600 text-primary focus:ring-primary/30 w-3 h-3"
                    @change="toggleFiducialPosition(pos.value)"
                  />
                  {{ pos.label }}
                </label>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Section: Tooling Holes -->
      <div class="px-4 py-2 border-t border-neutral-200 dark:border-neutral-800">
        <div class="flex items-center justify-between mb-2">
          <div class="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
            Tooling Holes
          </div>
          <button
            class="text-[10px] px-1.5 py-0.5 rounded border transition-colors"
            :class="local.toolingHoles.enabled
              ? 'border-blue-500/70 text-blue-700 bg-blue-50/90 dark:border-blue-400/70 dark:text-blue-200 dark:bg-blue-500/15'
              : 'border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:border-neutral-400'"
            @click="updateToolingHoles('enabled', !local.toolingHoles.enabled)"
          >
            {{ local.toolingHoles.enabled ? 'ON' : 'OFF' }}
          </button>
        </div>

        <template v-if="local.toolingHoles.enabled">
          <div class="grid grid-cols-2 gap-x-3 gap-y-2">
            <div class="space-y-0.5">
              <label class="text-[10px] text-neutral-400">Diameter (mm)</label>
              <input
                :value="local.toolingHoles.diameter"
                type="number"
                min="1"
                max="8"
                step="0.1"
                class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:border-primary transition-colors tabular-nums"
                @input="updateToolingHoles('diameter', clampFloat(($event.target as HTMLInputElement).value, 1, 8))"
              />
            </div>
            <div class="space-y-0.5">
              <label class="text-[10px] text-neutral-400">Offset (mm)</label>
              <input
                :value="local.toolingHoles.offsetMm"
                type="number"
                min="0"
                max="30"
                step="0.5"
                class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:border-primary transition-colors tabular-nums"
                @input="updateToolingHoles('offsetMm', clampFloat(($event.target as HTMLInputElement).value, 0, 30))"
              />
            </div>
          </div>
          <div class="mt-2 space-y-0.5">
            <label class="text-[10px] text-neutral-400">Positions</label>
            <div class="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <label
                v-for="pos in toolingHolePositionOptions"
                :key="pos.value"
                class="flex items-center gap-1 text-[10px] text-neutral-500 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  :checked="local.toolingHoles.positions.includes(pos.value)"
                  class="rounded border-neutral-300 dark:border-neutral-600 text-primary focus:ring-primary/30 w-3 h-3"
                  @change="toggleToolingHolePosition(pos.value)"
                />
                {{ pos.label }}
              </label>
            </div>
          </div>
        </template>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import type { PanelConfig, FiducialPosition, DangerZoneConfig, TabPerforationMode, ToolingHolePosition } from '~/utils/panel-types'
import { DEFAULT_PANEL_CONFIG, PANEL_MAX_WIDTH, PANEL_MAX_HEIGHT } from '~/utils/panel-types'
import { computePanelLayout } from '~/utils/panel-geometry'

const props = defineProps<{
  panelData: PanelConfig
  boardSizeMm?: { width: number; height: number } | null
}>()

const emit = defineEmits<{
  'update:panelData': [data: PanelConfig]
  'update:dangerZone': [data: DangerZoneConfig]
}>()

const local = computed(() => props.panelData ?? DEFAULT_PANEL_CONFIG())

// Danger zone is local-only (not persisted)
const dangerZoneLocal = ref<DangerZoneConfig>({ enabled: false, insetMm: 2 })

watch(dangerZoneLocal, (dz) => {
  emit('update:dangerZone', dz)
}, { deep: true, immediate: true })

const separationTypes = [
  { label: 'Routed', value: 'routed' as const },
  { label: 'V-Cut', value: 'scored' as const },
  { label: 'Mixed', value: 'mixed' as const },
]

const edgeNames = ['top', 'bottom', 'left', 'right'] as const

const fiducialPositionOptions = [
  { label: 'Top-left', value: 'top-left' as FiducialPosition },
  { label: 'Bot-left', value: 'bottom-left' as FiducialPosition },
  { label: 'Bot-right', value: 'bottom-right' as FiducialPosition },
]

const toolingHolePositionOptions = [
  { label: 'Top-left', value: 'top-left' as ToolingHolePosition },
  { label: 'Top-right', value: 'top-right' as ToolingHolePosition },
  { label: 'Bot-left', value: 'bottom-left' as ToolingHolePosition },
  { label: 'Bot-right', value: 'bottom-right' as ToolingHolePosition },
]

// Panel dimensions from geometry
const panelLayout = computed(() => {
  if (!props.boardSizeMm) return null
  return computePanelLayout(local.value, props.boardSizeMm.width, props.boardSizeMm.height)
})

const panelWidth = computed(() => panelLayout.value?.totalWidth ?? 0)
const panelHeight = computed(() => panelLayout.value?.totalHeight ?? 0)

const panelExceedsLimits = computed(() => {
  const w = panelWidth.value
  const h = panelHeight.value
  if (w <= 0 || h <= 0) return false
  // Check both orientations
  const fitsNormal = w <= PANEL_MAX_WIDTH && h <= PANEL_MAX_HEIGHT
  const fitsRotated = h <= PANEL_MAX_WIDTH && w <= PANEL_MAX_HEIGHT
  return !fitsNormal && !fitsRotated
})

function update<K extends keyof PanelConfig>(field: K, value: PanelConfig[K]) {
  emit('update:panelData', { ...local.value, [field]: value })
}

function updateSeparationType(type: PanelConfig['separationType']) {
  const updated = { ...local.value, separationType: type }
  if (type === 'routed') {
    updated.edges = {
      top: { type: 'routed' },
      bottom: { type: 'routed' },
      left: { type: 'routed' },
      right: { type: 'routed' },
    }
  } else if (type === 'scored') {
    updated.edges = {
      top: { type: 'scored' },
      bottom: { type: 'scored' },
      left: { type: 'scored' },
      right: { type: 'scored' },
    }
  }
  emit('update:panelData', updated)
}

function updateEdge(edge: 'top' | 'bottom' | 'left' | 'right', type: 'routed' | 'scored') {
  const edges = { ...local.value.edges, [edge]: { type } }
  emit('update:panelData', { ...local.value, edges })
}

function updateFrame<K extends keyof PanelConfig['frame']>(field: K, value: PanelConfig['frame'][K]) {
  emit('update:panelData', { ...local.value, frame: { ...local.value.frame, [field]: value } })
}

function updateTabs<K extends keyof PanelConfig['tabs']>(field: K, value: PanelConfig['tabs'][K]) {
  emit('update:panelData', { ...local.value, tabs: { ...local.value.tabs, [field]: value } })
}

function updateTabSideCount(field: 'defaultCountTop' | 'defaultCountBottom' | 'defaultCountLeft' | 'defaultCountRight', value: number) {
  emit('update:panelData', { ...local.value, tabs: { ...local.value.tabs, [field]: value } })
}

function updateFiducials<K extends keyof PanelConfig['fiducials']>(field: K, value: PanelConfig['fiducials'][K]) {
  emit('update:panelData', { ...local.value, fiducials: { ...local.value.fiducials, [field]: value } })
}

function toggleFiducialPosition(pos: FiducialPosition) {
  const current = [...local.value.fiducials.positions]
  const idx = current.indexOf(pos)
  if (idx >= 0) current.splice(idx, 1)
  else current.push(pos)
  updateFiducials('positions', current)
}

function updateToolingHoles<K extends keyof PanelConfig['toolingHoles']>(field: K, value: PanelConfig['toolingHoles'][K]) {
  emit('update:panelData', { ...local.value, toolingHoles: { ...local.value.toolingHoles, [field]: value } })
}

function toggleToolingHolePosition(pos: ToolingHolePosition) {
  const current = [...local.value.toolingHoles.positions]
  const idx = current.indexOf(pos)
  if (idx >= 0) current.splice(idx, 1)
  else current.push(pos)
  updateToolingHoles('positions', current)
}

function updateSupports<K extends keyof PanelConfig['supports']>(field: K, value: PanelConfig['supports'][K]) {
  emit('update:panelData', { ...local.value, supports: { ...local.value.supports, [field]: value } })
}

function toggleSupportGap(axis: 'x' | 'y', gapIndex: number) {
  const key = axis === 'x' ? 'xGaps' : 'yGaps'
  const current = [...local.value.supports[key]]
  const idx = current.indexOf(gapIndex)
  if (idx >= 0) current.splice(idx, 1)
  else current.push(gapIndex)
  updateSupports(key, current.sort((a, b) => a - b))
}

// ─── Interactive tab editor ───

import { evenTabPositions } from '~/utils/panel-types'

const tabEditorSvg = ref<SVGSVGElement | null>(null)

// Editor layout constants (SVG units, proportional to actual panel)
const editorScale = computed(() => {
  if (!props.boardSizeMm) return 1
  const maxSvg = 120
  const pw = panelWidth.value || props.boardSizeMm.width
  const ph = panelHeight.value || props.boardSizeMm.height
  return Math.min(maxSvg / pw, maxSvg / ph, 1)
})

const es = computed(() => editorScale.value)
const cfg = computed(() => local.value)
const editorFrameW = computed(() => cfg.value.frame.enabled ? cfg.value.frame.width * es.value : 0)
const editorToolD = computed(() => cfg.value.separationType === 'scored' ? 0 : cfg.value.routingToolDiameter * es.value)
const editorPcbW = computed(() => (props.boardSizeMm?.width ?? 30) * es.value)
const editorPcbH = computed(() => (props.boardSizeMm?.height ?? 20) * es.value)
const editorCornerR = computed(() => (cfg.value.frame.cornerRadius ?? 3) * es.value)
const editorPad = 3

function editorColGap(i: number): number {
  const c = cfg.value
  if (c.separationType === 'scored') return 0
  if (c.supports.xGaps.includes(i)) return (c.supports.width + 2 * c.routingToolDiameter) * es.value
  return c.routingToolDiameter * es.value
}

function editorRowGap(i: number): number {
  const c = cfg.value
  if (c.separationType === 'scored') return 0
  if (c.supports.yGaps.includes(i)) return (c.supports.width + 2 * c.routingToolDiameter) * es.value
  return c.routingToolDiameter * es.value
}

const editorFrameRoutingGap = computed(() => cfg.value.separationType === 'scored' ? 0 : editorToolD.value)

const editorInnerW = computed(() => {
  let w = editorFrameRoutingGap.value * 2 + cfg.value.countX * editorPcbW.value
  for (let i = 0; i < cfg.value.countX - 1; i++) w += editorColGap(i)
  return w
})
const editorInnerH = computed(() => {
  let h = editorFrameRoutingGap.value * 2 + cfg.value.countY * editorPcbH.value
  for (let i = 0; i < cfg.value.countY - 1; i++) h += editorRowGap(i)
  return h
})
const editorTotalW = computed(() => editorInnerW.value + 2 * editorFrameW.value)
const editorTotalH = computed(() => editorInnerH.value + 2 * editorFrameW.value)

function editorColX(col: number): number {
  let x = editorFrameW.value + editorFrameRoutingGap.value
  for (let c = 0; c < col; c++) x += editorPcbW.value + editorColGap(c)
  return x
}
function editorRowY(row: number): number {
  let y = editorFrameW.value + editorFrameRoutingGap.value
  for (let r = 0; r < row; r++) y += editorPcbH.value + editorRowGap(r)
  return y
}

const editorPcbs = computed(() => {
  const result: { col: number; row: number; x: number; y: number }[] = []
  for (let col = 0; col < cfg.value.countX; col++) {
    for (let row = 0; row < cfg.value.countY; row++) {
      result.push({ col, row, x: editorColX(col), y: editorRowY(row) })
    }
  }
  return result
})

const editorSupportRails = computed(() => {
  const rails: { x: number; y: number; w: number; h: number }[] = []
  const c = cfg.value
  const railMat = Math.max(0, c.supports.width)
  for (const gi of c.supports.xGaps) {
    if (gi < 0 || gi >= c.countX - 1) continue
    const rx = editorColX(gi) + editorPcbW.value + editorToolD.value
    rails.push({ x: rx, y: 0, w: railMat * es.value, h: editorTotalH.value })
  }
  for (const gi of c.supports.yGaps) {
    if (gi < 0 || gi >= c.countY - 1) continue
    const ry = editorRowY(gi) + editorPcbH.value + editorToolD.value
    rails.push({ x: 0, y: ry, w: editorTotalW.value, h: railMat * es.value })
  }
  return rails
})

function getTabOverrideKey(col: number, row: number, edge: string, channelId: string = 'main'): string {
  if (local.value.tabs.syncAcrossPanel) return `sync-${edge}-${channelId}`
  return `${col}-${row}-${edge}-${channelId}`
}

function getTabPositions(col: number, row: number, edge: string, channelId: string = 'main'): number[] {
  const key = getTabOverrideKey(col, row, edge, channelId)
  if (key in local.value.tabs.edgeOverrides) return local.value.tabs.edgeOverrides[key]
  const legacyEdge = `${col}-${row}-${edge}`
  if (legacyEdge in local.value.tabs.edgeOverrides) return local.value.tabs.edgeOverrides[legacyEdge]
  return evenTabPositions(local.value.tabs.defaultCountPerEdge)
}

interface EditorChannel {
  key: string
  col: number
  row: number
  edge: string
  x: number
  y: number
  w: number
  h: number
  edgeLength: number
  edgeStart: number
  isVertical: boolean
}

const editorChannels = computed<EditorChannel[]>(() => {
  const channels: EditorChannel[] = []
  const c = cfg.value
  if (c.separationType === 'scored') return channels

  for (let col = 0; col < c.countX; col++) {
    for (let row = 0; row < c.countY; row++) {
      // Right channel (between columns)
      if (col < c.countX - 1) {
        const gapX = editorColX(col) + editorPcbW.value
        const gapW = editorColGap(col)
        channels.push({
          key: `${col}-${row}-right`, col, row, edge: 'right',
          x: gapX, y: editorRowY(row), w: gapW, h: editorPcbH.value,
          edgeLength: editorPcbH.value, edgeStart: editorRowY(row), isVertical: true,
        })
      }
      // Bottom channel (between rows)
      if (row < c.countY - 1) {
        const gapY = editorRowY(row) + editorPcbH.value
        const gapH = editorRowGap(row)
        channels.push({
          key: `${col}-${row}-bottom`, col, row, edge: 'bottom',
          x: editorColX(col), y: gapY, w: editorPcbW.value, h: gapH,
          edgeLength: editorPcbW.value, edgeStart: editorColX(col), isVertical: false,
        })
      }
      // Frame edges
      if (c.frame.enabled && editorFrameRoutingGap.value > 0) {
        if (col === 0) {
          channels.push({
            key: `${col}-${row}-left`, col, row, edge: 'left',
            x: editorFrameW.value, y: editorRowY(row), w: editorFrameRoutingGap.value, h: editorPcbH.value,
            edgeLength: editorPcbH.value, edgeStart: editorRowY(row), isVertical: true,
          })
        }
        if (row === 0) {
          channels.push({
            key: `${col}-${row}-top`, col, row, edge: 'top',
            x: editorColX(col), y: editorFrameW.value, w: editorPcbW.value, h: editorFrameRoutingGap.value,
            edgeLength: editorPcbW.value, edgeStart: editorColX(col), isVertical: false,
          })
        }
        if (col === c.countX - 1) {
          channels.push({
            key: `${col}-${row}-right`, col, row, edge: 'right',
            x: editorColX(col) + editorPcbW.value, y: editorRowY(row), w: editorFrameRoutingGap.value, h: editorPcbH.value,
            edgeLength: editorPcbH.value, edgeStart: editorRowY(row), isVertical: true,
          })
        }
        if (row === c.countY - 1) {
          channels.push({
            key: `${col}-${row}-bottom`, col, row, edge: 'bottom',
            x: editorColX(col), y: editorRowY(row) + editorPcbH.value, w: editorPcbW.value, h: editorFrameRoutingGap.value,
            edgeLength: editorPcbW.value, edgeStart: editorColX(col), isVertical: false,
          })
        }
      }
    }
  }
  return channels
})

interface EditorTab {
  id: string
  col: number
  row: number
  edge: string
  posIndex: number
  position: number
  x: number
  y: number
  w: number
  h: number
}

const editorTabs = computed<EditorTab[]>(() => {
  const tabs: EditorTab[] = []
  const tabWidthSvg = cfg.value.tabs.width * es.value

  for (const ch of editorChannels.value) {
    const positions = getTabPositions(ch.col, ch.row, ch.edge)
    for (let pi = 0; pi < positions.length; pi++) {
      const t = Math.max(0, Math.min(1, positions[pi]))
      const center = ch.edgeStart + t * ch.edgeLength
      const tw = Math.min(tabWidthSvg, ch.edgeLength)

      if (ch.isVertical) {
        tabs.push({
          id: `${ch.key}-${pi}`, col: ch.col, row: ch.row, edge: ch.edge, posIndex: pi, position: t,
          x: ch.x, y: center - tw / 2, w: ch.w, h: tw,
        })
      } else {
        tabs.push({
          id: `${ch.key}-${pi}`, col: ch.col, row: ch.row, edge: ch.edge, posIndex: pi, position: t,
          x: center - tw / 2, y: ch.y, w: tw, h: ch.h,
        })
      }
    }
  }
  return tabs
})

// Tab dragging
const draggingTab = ref<{ id: string; col: number; row: number; edge: string; posIndex: number } | null>(null)

function svgPoint(e: MouseEvent): { x: number; y: number } | null {
  const svg = tabEditorSvg.value
  if (!svg) return null
  const pt = svg.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const svgPt = pt.matrixTransform(ctm.inverse())
  return { x: svgPt.x, y: svgPt.y }
}

function startTabDrag(tab: EditorTab, e: MouseEvent) {
  e.preventDefault()
  draggingTab.value = { id: tab.id, col: tab.col, row: tab.row, edge: tab.edge, posIndex: tab.posIndex }
}

function onTabEditorMouseMove(e: MouseEvent) {
  if (!draggingTab.value) return
  const pt = svgPoint(e)
  if (!pt) return

  const ch = editorChannels.value.find(c => c.key === `${draggingTab.value!.col}-${draggingTab.value!.row}-${draggingTab.value!.edge}`)
  if (!ch) return

  let t: number
  if (ch.isVertical) {
    t = (pt.y - ch.edgeStart) / ch.edgeLength
  } else {
    t = (pt.x - ch.edgeStart) / ch.edgeLength
  }
  t = Math.max(0.05, Math.min(0.95, t))

  const key = `${draggingTab.value.col}-${draggingTab.value.row}-${draggingTab.value.edge}`
  const positions = [...getTabPositions(draggingTab.value.col, draggingTab.value.row, draggingTab.value.edge)]
  positions[draggingTab.value.posIndex] = Math.round(t * 100) / 100
  const overrides = { ...local.value.tabs.edgeOverrides, [key]: positions }
  emit('update:panelData', { ...local.value, tabs: { ...local.value.tabs, edgeOverrides: overrides } })
}

function onTabEditorMouseUp() {
  draggingTab.value = null
}

function addTabToEdge(col: number, row: number, edge: string, e: MouseEvent) {
  const pt = svgPoint(e)
  if (!pt) return

  const ch = editorChannels.value.find(c => c.key === `${col}-${row}-${edge}`)
  if (!ch) return

  let t: number
  if (ch.isVertical) {
    t = (pt.y - ch.edgeStart) / ch.edgeLength
  } else {
    t = (pt.x - ch.edgeStart) / ch.edgeLength
  }
  t = Math.max(0.05, Math.min(0.95, t))
  t = Math.round(t * 100) / 100

  const key = `${col}-${row}-${edge}`
  const positions = [...getTabPositions(col, row, edge), t].sort((a, b) => a - b)
  const overrides = { ...local.value.tabs.edgeOverrides, [key]: positions }
  emit('update:panelData', { ...local.value, tabs: { ...local.value.tabs, edgeOverrides: overrides } })
}

function removeTab(col: number, row: number, edge: string, posIndex: number) {
  const key = `${col}-${row}-${edge}`
  const positions = [...getTabPositions(col, row, edge)]
  positions.splice(posIndex, 1)

  const overrides = { ...local.value.tabs.edgeOverrides }
  if (positions.length === 0) {
    overrides[key] = []
  } else {
    overrides[key] = positions
  }
  emit('update:panelData', { ...local.value, tabs: { ...local.value.tabs, edgeOverrides: overrides } })
}

function clampInt(val: string, min: number, max: number): number {
  const n = parseInt(val, 10)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}

function clampFloat(val: string, min: number, max: number): number {
  const normalized = val.trim().replace(',', '.')
  const n = parseFloat(normalized)
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}
</script>
