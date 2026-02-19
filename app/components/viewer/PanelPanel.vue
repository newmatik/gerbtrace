<template>
  <div class="flex-1 min-h-0 flex flex-col overflow-x-hidden overflow-y-auto p-2 gap-2">
    <div
      class="pt-1 space-y-2"
      :class="{ 'pointer-events-none opacity-80': locked }"
    >
          <div v-if="boardSizeMm" class="rounded border border-neutral-200 dark:border-neutral-800 p-2 space-y-2">
            <div class="flex items-center justify-between">
              <div class="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Suggestions</div>
              <div class="flex items-center gap-1">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  :icon="showSuggestions ? 'i-lucide-chevrons-up' : 'i-lucide-chevrons-down'"
                  @click="showSuggestions = !showSuggestions"
                />
                <UButton size="xs" color="neutral" variant="outline" @click="generateSuggestions">
                  Generate
                </UButton>
                <UButton size="xs" color="primary" variant="soft" :disabled="!panelSuggestions.length" @click="autoPanelize">
                  Auto-panelize
                </UButton>
              </div>
            </div>
            <p v-if="showSuggestions" class="text-[10px] text-neutral-400">
              Deterministic suggestions based on preferred/max panel envelope and PCB thickness.
            </p>
            <div v-if="!showSuggestions" class="text-[10px] text-neutral-500">
              Suggestions dismissed to save space.
            </div>
            <div v-else-if="!panelSuggestions.length" class="text-[10px] text-neutral-500">
              Click Generate to compute panel layouts.
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="(suggestion, idx) in panelSuggestions"
                :key="suggestion.id"
                class="rounded border border-neutral-200 dark:border-neutral-700 p-2 space-y-1"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="text-[10px] text-neutral-300">{{ idx + 1 }}.</div>
                  <div class="flex-1 min-w-0">
                    <div class="text-[11px] font-medium truncate">{{ suggestion.title }}</div>
                    <div class="text-[10px] text-neutral-400 tabular-nums">
                      {{ suggestion.panelWidthMm.toFixed(2) }} x {{ suggestion.panelHeightMm.toFixed(2) }} mm
                    </div>
                  </div>
                  <UButton size="xs" color="primary" variant="outline" @click="applySuggestion(suggestion)">
                    Apply
                  </UButton>
                </div>
                <ul class="text-[10px] text-neutral-400 space-y-0.5">
                  <li v-for="reason in suggestion.reasons" :key="reason">- {{ reason }}</li>
                </ul>
                <ul v-if="suggestion.warnings.length" class="text-[10px] text-orange-500 dark:text-orange-400 space-y-0.5">
                  <li v-for="warning in suggestion.warnings" :key="warning">- {{ warning }}</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="rounded border border-neutral-200 dark:border-neutral-800 p-2 space-y-2">
            <div class="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">General</div>
            <div class="grid grid-cols-3 gap-2 text-[10px] text-neutral-400">
              <span>Count X</span>
              <span>Count Y</span>
              <span>Rotation</span>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <UInput :model-value="local.countX" type="number" size="xs" :min="1" :max="50" :step="1" @update:model-value="update('countX', clampInt(String($event), 1, 50))" />
              <UInput :model-value="local.countY" type="number" size="xs" :min="1" :max="50" :step="1" @update:model-value="update('countY', clampInt(String($event), 1, 50))" />
              <UButton size="xs" color="neutral" variant="soft" class="justify-center" @click="update('pcbRotation', (local.pcbRotation + 90) % 360)">
                {{ local.pcbRotation }}deg
              </UButton>
            </div>
          </div>

          <div class="rounded border border-neutral-200 dark:border-neutral-800 p-2 space-y-2">
            <div class="flex items-center justify-between text-[10px]">
              <span class="font-semibold uppercase tracking-wider text-neutral-400">Frame</span>
              <USwitch :model-value="local.frame.enabled" size="sm" @update:model-value="updateFrame('enabled', !!$event)" />
            </div>
            <div v-if="local.frame.enabled" class="space-y-2">
              <div class="grid grid-cols-5 gap-2">
                <div class="space-y-1">
                  <div class="text-[10px] text-neutral-400">Top (mm)</div>
                  <UInput :model-value="local.frame.widthTop" type="number" size="xs" :min="0" :max="30" :step="0.5" @update:model-value="updateFrame('widthTop', clampFloat(String($event), 0, 30))" />
                </div>
                <div class="space-y-1">
                  <div class="text-[10px] text-neutral-400">Bottom (mm)</div>
                  <UInput :model-value="local.frame.widthBottom" type="number" size="xs" :min="0" :max="30" :step="0.5" @update:model-value="updateFrame('widthBottom', clampFloat(String($event), 0, 30))" />
                </div>
                <div class="space-y-1">
                  <div class="text-[10px] text-neutral-400">Left (mm)</div>
                  <UInput :model-value="local.frame.widthLeft" type="number" size="xs" :min="0" :max="30" :step="0.5" @update:model-value="updateFrame('widthLeft', clampFloat(String($event), 0, 30))" />
                </div>
                <div class="space-y-1">
                  <div class="text-[10px] text-neutral-400">Right (mm)</div>
                  <UInput :model-value="local.frame.widthRight" type="number" size="xs" :min="0" :max="30" :step="0.5" @update:model-value="updateFrame('widthRight', clampFloat(String($event), 0, 30))" />
                </div>
                <div class="space-y-1">
                  <div class="text-[10px] text-neutral-400">Corner R (mm)</div>
                  <UInput :model-value="local.frame.cornerRadius" type="number" size="xs" :min="0" :max="10" :step="0.5" @update:model-value="updateFrame('cornerRadius', clampFloat(String($event), 0, 10))" />
                </div>
              </div>
            </div>
          </div>

          <div v-if="local.countX > 1 || local.countY > 1" class="rounded border border-neutral-200 dark:border-neutral-800 p-2 space-y-2">
            <div class="flex items-center justify-between text-[10px]">
              <span class="font-semibold uppercase tracking-wider text-neutral-500/75">Support Bars</span>
              <USwitch :model-value="local.supports.enabled" size="sm" @update:model-value="updateSupports('enabled', !!$event)" />
            </div>
            <template v-if="local.supports.enabled">
              <div class="grid grid-cols-4 gap-2 text-[10px]">
                <div class="space-y-1">
                  <div class="text-[10px] text-neutral-500/70">Column rail (mm)</div>
                  <UInput :model-value="local.supports.widthColumns" type="number" size="xs" :min="0" :max="30" :step="0.5" @update:model-value="updateSupports('widthColumns', clampFloat(String($event), 0, 30))" />
                </div>
                <div class="space-y-1">
                  <div class="text-[10px] text-neutral-500/70">Row rail (mm)</div>
                  <UInput :model-value="local.supports.widthRows" type="number" size="xs" :min="0" :max="30" :step="0.5" @update:model-value="updateSupports('widthRows', clampFloat(String($event), 0, 30))" />
                </div>
                <div class="space-y-1">
                  <div class="text-neutral-500/70">Columns</div>
                  <label v-for="i in (local.countX - 1)" :key="`xgap-${i}`" class="flex items-center gap-1 text-neutral-500/65">
                    <USwitch
                      :model-value="local.supports.xGaps.includes(i - 1)"
                      size="sm"
                      @update:model-value="toggleSupportGap('x', i - 1)"
                    />
                    Col {{ i }}-{{ i + 1 }}
                  </label>
                </div>
                <div class="space-y-1">
                  <div class="text-neutral-500/70">Rows</div>
                  <label v-for="i in (local.countY - 1)" :key="`ygap-${i}`" class="flex items-center gap-1 text-neutral-500/65">
                    <USwitch
                      :model-value="local.supports.yGaps.includes(i - 1)"
                      size="sm"
                      @update:model-value="toggleSupportGap('y', i - 1)"
                    />
                    Row {{ i }}-{{ i + 1 }}
                  </label>
                </div>
              </div>
            </template>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="rounded border border-neutral-200 dark:border-neutral-800 p-2 space-y-2">
              <div class="flex items-center justify-between text-[10px]">
                <span class="font-semibold uppercase tracking-wider text-neutral-400">Fiducials</span>
                <USwitch :model-value="local.fiducials.enabled" size="sm" @update:model-value="updateFiducials('enabled', !!$event)" />
              </div>
              <template v-if="local.fiducials.enabled">
                <div class="text-[10px] text-neutral-400">Diameter (mm)</div>
                <UInput :model-value="local.fiducials.diameter" type="number" size="xs" :min="0.5" :max="5" :step="0.1" @update:model-value="updateFiducials('diameter', clampFloat(String($event), 0.5, 5))" />
                <label v-for="pos in fiducialPositionOptions" :key="pos.value" class="flex items-center gap-1 text-[10px] text-neutral-500">
                  <USwitch
                    :model-value="local.fiducials.positions.includes(pos.value)"
                    size="sm"
                    @update:model-value="toggleFiducialPosition(pos.value)"
                  />
                  {{ pos.label }}
                </label>
              </template>
            </div>

            <div class="rounded border border-neutral-200 dark:border-neutral-800 p-2 space-y-2">
              <div class="flex items-center justify-between text-[10px]">
                <span class="font-semibold uppercase tracking-wider text-neutral-400">Tooling Holes</span>
                <USwitch :model-value="local.toolingHoles.enabled" size="sm" @update:model-value="updateToolingHoles('enabled', !!$event)" />
              </div>
              <template v-if="local.toolingHoles.enabled">
                <div class="grid grid-cols-2 gap-2">
                  <div class="space-y-1">
                    <div class="text-[10px] text-neutral-400">Dia (mm)</div>
                    <UInput :model-value="local.toolingHoles.diameter" type="number" size="xs" :min="1" :max="8" :step="0.1" @update:model-value="updateToolingHoles('diameter', clampFloat(String($event), 1, 8))" />
                  </div>
                  <div class="space-y-1">
                    <div class="text-[10px] text-neutral-400">Offset (mm)</div>
                    <UInput :model-value="local.toolingHoles.offsetMm" type="number" size="xs" :min="0" :max="30" :step="0.5" @update:model-value="updateToolingHoles('offsetMm', clampFloat(String($event), 0, 30))" />
                  </div>
                </div>
                <label v-for="pos in toolingHolePositionOptions" :key="pos.value" class="flex items-center gap-1 text-[10px] text-neutral-500">
                  <USwitch
                    :model-value="local.toolingHoles.positions.includes(pos.value)"
                    size="sm"
                    @update:model-value="toggleToolingHolePosition(pos.value)"
                  />
                  {{ pos.label }}
                </label>
              </template>
            </div>
          </div>
      <div class="rounded border border-neutral-200 dark:border-neutral-800 p-2">
        <div class="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Panel Connections</div>
      </div>
          <div class="rounded border border-neutral-200 dark:border-neutral-800 p-2 space-y-2">
            <div class="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">Separation</div>
            <div class="grid grid-cols-3 gap-1">
              <UButton
                v-for="t in separationTypes"
                :key="t.value"
                size="xs"
                :color="local.separationType === t.value ? 'primary' : 'neutral'"
                :variant="local.separationType === t.value ? 'soft' : 'outline'"
                class="justify-center"
                @click="updateSeparationType(t.value)"
              >
                {{ t.label }}
              </UButton>
            </div>

            <div v-if="hasAnyRoutedSeparation(local)" class="grid grid-cols-2 gap-2">
              <div class="space-y-1">
                <div class="text-[10px] text-neutral-400">Routing tool (mm)</div>
                <UInput
                  :model-value="local.routingToolDiameter"
                  type="number"
                  size="xs"
                  :min="0.5"
                  :max="5"
                  :step="0.1"
                  @update:model-value="update('routingToolDiameter', clampFloat(String($event), 0.5, 5))"
                />
              </div>
              <div class="text-[10px] text-neutral-500 flex items-end pb-1">Tool diameter for routed channels</div>
            </div>

            <div v-if="local.separationType === 'mixed'" class="grid grid-cols-2 gap-2">
              <div v-for="edge in edgeNames" :key="edge" class="flex items-center gap-1">
                <span class="text-[10px] text-neutral-400 w-10 capitalize">{{ edge }}</span>
                <USelect
                  :model-value="local.edges[edge].type"
                  size="xs"
                  :items="[
                    { label: 'Routed', value: 'routed' },
                    { label: isScoredDisallowed(edge) ? 'V-Cut (blocked by protruding components)' : 'V-Cut', value: 'scored', disabled: isScoredDisallowed(edge) },
                  ]"
                  class="flex-1"
                  @update:model-value="updateEdge(edge, String($event) as 'routed' | 'scored')"
                />
              </div>
            </div>

          </div>

          <div v-if="!hasAnyRoutedSeparation(local)" class="text-xs text-neutral-400">
            Tabs are disabled in V-Cut mode.
          </div>
          <template v-else>
            <div class="grid grid-cols-2 gap-2 text-[10px] text-neutral-400">
              <span>Tab width (mm)</span>
              <span>Perforation</span>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <UInput
                :model-value="local.tabs.width"
                type="number"
                size="xs"
                :min="0.5"
                :max="10"
                :step="0.5"
                @update:model-value="updateTabs('width', clampFloat(String($event), 0.5, 10))"
              />
              <USelect
                :model-value="local.tabs.perforation"
                size="xs"
                :items="[{ label: 'None', value: 'none' }, { label: 'PCB Side', value: 'pcb-side' }, { label: 'Both Sides', value: 'both-sides' }]"
                @update:model-value="updateTabs('perforation', String($event) as TabPerforationMode)"
              />
            </div>

            <div class="flex items-center justify-between text-[10px]">
              <span class="text-neutral-400">Synchronize tab edits</span>
              <USwitch :model-value="local.tabs.syncAcrossPanel" size="sm" @update:model-value="updateTabs('syncAcrossPanel', !!$event)" />
            </div>

            <template v-if="hasManualPlacement">
              <div class="rounded border border-neutral-200 dark:border-neutral-700 p-2 space-y-2">
                <p class="text-[10px] text-neutral-400">
                  Tab positions are managed in the visual editor.
                  Use the canvas tab controls to add, move or delete tabs.
                </p>
                <UButton size="xs" color="neutral" variant="outline" @click="resetTabPlacement">
                  Reset to default positions
                </UButton>
              </div>
            </template>
            <template v-else>
              <div
                class="grid gap-2 text-[10px] text-neutral-400"
                :style="{ gridTemplateColumns: `repeat(${tabEdgeControlFields.length}, minmax(0, 1fr))` }"
              >
                <span v-for="item in tabEdgeControlFields" :key="`${item.edge}-label`">{{ item.label }}</span>
              </div>
              <div
                class="grid gap-2"
                :style="{ gridTemplateColumns: `repeat(${tabEdgeControlFields.length}, minmax(0, 1fr))` }"
              >
                <UInput
                  v-for="item in tabEdgeControlFields"
                  :key="`${item.edge}-input`"
                  :model-value="getTabSideCount(item.field)"
                  type="number"
                  size="xs"
                  :min="0"
                  :max="10"
                  :step="1"
                  @update:model-value="updateTabSideCount(item.field, clampInt(String($event), 0, 10))"
                />
              </div>
            </template>

            <div v-if="local.tabs.perforation !== 'none'" class="grid grid-cols-2 gap-2 text-[10px] text-neutral-400">
              <span>Hole dia (mm)</span>
              <span>Spacing (mm)</span>
            </div>
            <div v-if="local.tabs.perforation !== 'none'" class="grid grid-cols-2 gap-2">
              <UInput
                :model-value="local.tabs.perforationHoleDiameter"
                type="number"
                size="xs"
                :min="0.2"
                :max="2"
                :step="0.1"
                @update:model-value="updateTabs('perforationHoleDiameter', clampFloat(String($event), 0.2, 2))"
              />
              <UInput
                :model-value="local.tabs.perforationHoleSpacing"
                type="number"
                size="xs"
                :min="0.3"
                :max="3"
                :step="0.1"
                @update:model-value="updateTabs('perforationHoleSpacing', clampFloat(String($event), 0.3, 3))"
              />
            </div>
            <p class="text-[10px] text-neutral-400">
              Move/Add/Delete tab placement directly on the canvas.
            </p>
          </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PanelConfig, FiducialPosition, TabPerforationMode, ToolingHolePosition } from '~/utils/panel-types'
import { DEFAULT_PANEL_CONFIG } from '~/utils/panel-types'
import { computePanelLayout } from '~/utils/panel-geometry'
import { generatePanelSuggestions, type PanelSuggestion, type PanelSuggestionLimits, type PanelSuggestionEdgeConstraints } from '~/utils/panel-suggestions'

const props = defineProps<{
  panelData: PanelConfig
  boardSizeMm?: { width: number; height: number } | null
  teamPanelLimits?: PanelSuggestionLimits | null
  thicknessMm?: number | null
  edgeConstraints?: PanelSuggestionEdgeConstraints | null
  locked?: boolean
}>()

const locked = computed(() => !!props.locked)

const emit = defineEmits<{
  'update:panelData': [data: PanelConfig]
}>()

const local = computed(() => props.panelData ?? DEFAULT_PANEL_CONFIG())

const separationTypes = [
  { label: 'Routed', value: 'routed' as const },
  { label: 'V-Cut', value: 'scored' as const },
  { label: 'Mixed', value: 'mixed' as const },
]

const edgeNames = ['top', 'bottom', 'left', 'right'] as const
type PanelEdge = typeof edgeNames[number]
type TabSideCountField = 'defaultCountTop' | 'defaultCountBottom' | 'defaultCountLeft' | 'defaultCountRight'
const tabCountFieldToEdge: Record<TabSideCountField, PanelEdge> = {
  defaultCountTop: 'top',
  defaultCountBottom: 'bottom',
  defaultCountLeft: 'left',
  defaultCountRight: 'right',
}
const tabEdgeControlFields = computed((): Array<{ edge: PanelEdge, label: string, field: TabSideCountField }> => {
  const edgeToField: Record<PanelEdge, TabSideCountField> = {
    top: 'defaultCountTop',
    bottom: 'defaultCountBottom',
    left: 'defaultCountLeft',
    right: 'defaultCountRight',
  }
  return edgeNames
    .filter(edge => isPanelEdgeRouted(local.value, edge))
    .map(edge => ({
      edge,
      label: edge.charAt(0).toUpperCase() + edge.slice(1),
      field: edgeToField[edge],
    }))
})

function hasAnyRoutedSeparation(config: PanelConfig): boolean {
  if (config.separationType === 'routed') return true
  if (config.separationType === 'scored') return false
  return config.edges.top.type === 'routed'
    || config.edges.bottom.type === 'routed'
    || config.edges.left.type === 'routed'
    || config.edges.right.type === 'routed'
}

function isPanelEdgeRouted(config: PanelConfig, edge: PanelEdge): boolean {
  if (config.separationType === 'routed') return true
  if (config.separationType === 'scored') return false
  return config.edges[edge].type === 'routed'
}

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

const panelSuggestions = ref<PanelSuggestion[]>([])
const showSuggestions = ref(true)

function generateSuggestions() {
  if (!props.boardSizeMm) {
    panelSuggestions.value = []
    return
  }
  panelSuggestions.value = generatePanelSuggestions({
    boardWidthMm: props.boardSizeMm.width,
    boardHeightMm: props.boardSizeMm.height,
    thicknessMm: props.thicknessMm ?? 1.6,
    limits: props.teamPanelLimits ?? undefined,
    edgeConstraints: props.edgeConstraints ?? undefined,
    maxSuggestions: 3,
  })
}

function applySuggestion(suggestion: PanelSuggestion) {
  const fullSnapshot = JSON.parse(JSON.stringify(suggestion.config)) as PanelConfig
  emit('update:panelData', fullSnapshot)
}

function autoPanelize() {
  if (!panelSuggestions.value.length) generateSuggestions()
  const top = panelSuggestions.value[0]
  if (!top) return
  applySuggestion(top)
}

watch(
  () => [props.boardSizeMm?.width, props.boardSizeMm?.height, props.teamPanelLimits, props.thicknessMm, props.edgeConstraints],
  () => {
    panelSuggestions.value = []
    showSuggestions.value = true
  },
  { deep: true },
)

function isScoredDisallowed(edge: PanelEdge): boolean {
  return !!props.edgeConstraints?.prohibitScoredEdges?.[edge]
}

function update<K extends keyof PanelConfig>(field: K, value: PanelConfig[K]) {
  emit('update:panelData', { ...local.value, [field]: value })
}

function updateSeparationType(type: PanelConfig['separationType']) {
  if (type === 'scored') {
    const disallowed = edgeNames.some(edge => isScoredDisallowed(edge))
    if (disallowed) type = 'mixed'
  }
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
  } else if (type === 'mixed') {
    updated.edges = {
      top: { type: isScoredDisallowed('top') ? 'routed' : 'scored' },
      bottom: { type: isScoredDisallowed('bottom') ? 'routed' : 'scored' },
      left: { type: isScoredDisallowed('left') ? 'routed' : 'scored' },
      right: { type: isScoredDisallowed('right') ? 'routed' : 'scored' },
    }
  }
  emit('update:panelData', updated)
}

function updateEdge(edge: 'top' | 'bottom' | 'left' | 'right', type: 'routed' | 'scored') {
  if (type === 'scored' && isScoredDisallowed(edge)) type = 'routed'
  const edges = { ...local.value.edges, [edge]: { type } }
  emit('update:panelData', { ...local.value, edges })
}

function updateFrame<K extends keyof PanelConfig['frame']>(field: K, value: PanelConfig['frame'][K]) {
  emit('update:panelData', { ...local.value, frame: { ...local.value.frame, [field]: value } })
}

function updateTabs<K extends keyof PanelConfig['tabs']>(field: K, value: PanelConfig['tabs'][K]) {
  emit('update:panelData', { ...local.value, tabs: { ...local.value.tabs, [field]: value } })
}

const hasManualPlacement = computed(() => !!local.value.tabs.manualPlacement)

function getTabSideCount(field: TabSideCountField): number {
  return local.value.tabs[field] ?? local.value.tabs.defaultCountPerEdge
}

function updateTabSideCount(field: TabSideCountField, value: number) {
  emit('update:panelData', { ...local.value, tabs: { ...local.value.tabs, [field]: value } })
}

function resetTabPlacement() {
  emit('update:panelData', {
    ...local.value,
    tabs: { ...local.value.tabs, manualPlacement: false, edgeOverrides: {} },
  })
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
const editorFrameTop = computed(() => cfg.value.frame.enabled ? (cfg.value.frame.widthTop ?? 0) * es.value : 0)
const editorFrameBottom = computed(() => cfg.value.frame.enabled ? (cfg.value.frame.widthBottom ?? 0) * es.value : 0)
const editorFrameLeft = computed(() => cfg.value.frame.enabled ? (cfg.value.frame.widthLeft ?? 0) * es.value : 0)
const editorFrameRight = computed(() => cfg.value.frame.enabled ? (cfg.value.frame.widthRight ?? 0) * es.value : 0)
const editorToolD = computed(() => hasAnyRoutedSeparation(cfg.value) ? cfg.value.routingToolDiameter * es.value : 0)
const editorFrameGapTop = computed(() =>
  editorFrameTop.value > 0 && isPanelEdgeRouted(cfg.value, 'top') ? editorToolD.value : 0,
)
const editorFrameGapBottom = computed(() =>
  editorFrameBottom.value > 0 && isPanelEdgeRouted(cfg.value, 'bottom') ? editorToolD.value : 0,
)
const editorFrameGapLeft = computed(() =>
  editorFrameLeft.value > 0 && isPanelEdgeRouted(cfg.value, 'left') ? editorToolD.value : 0,
)
const editorFrameGapRight = computed(() =>
  editorFrameRight.value > 0 && isPanelEdgeRouted(cfg.value, 'right') ? editorToolD.value : 0,
)
const editorPcbW = computed(() => (props.boardSizeMm?.width ?? 30) * es.value)
const editorPcbH = computed(() => (props.boardSizeMm?.height ?? 20) * es.value)
const editorCornerR = computed(() => (cfg.value.frame.cornerRadius ?? 3) * es.value)
const editorPad = 3

function editorColGap(i: number): number {
  const c = cfg.value
  if (!hasAnyRoutedSeparation(c)) return 0
  if (!(c.supports.enabled ?? true)) return c.routingToolDiameter * es.value
  if (c.supports.xGaps.includes(i)) return ((c.supports.widthColumns ?? 0) + 2 * c.routingToolDiameter) * es.value
  return c.routingToolDiameter * es.value
}

function editorRowGap(i: number): number {
  const c = cfg.value
  if (!hasAnyRoutedSeparation(c)) return 0
  if (!(c.supports.enabled ?? true)) return c.routingToolDiameter * es.value
  if (c.supports.yGaps.includes(i)) return ((c.supports.widthRows ?? 0) + 2 * c.routingToolDiameter) * es.value
  return c.routingToolDiameter * es.value
}

const editorInnerW = computed(() => {
  let w = editorFrameGapLeft.value + editorFrameGapRight.value + cfg.value.countX * editorPcbW.value
  for (let i = 0; i < cfg.value.countX - 1; i++) w += editorColGap(i)
  return w
})
const editorInnerH = computed(() => {
  let h = editorFrameGapTop.value + editorFrameGapBottom.value + cfg.value.countY * editorPcbH.value
  for (let i = 0; i < cfg.value.countY - 1; i++) h += editorRowGap(i)
  return h
})
const editorTotalW = computed(() => editorInnerW.value + editorFrameLeft.value + editorFrameRight.value)
const editorTotalH = computed(() => editorInnerH.value + editorFrameTop.value + editorFrameBottom.value)

function editorColX(col: number): number {
  let x = editorFrameLeft.value + editorFrameGapLeft.value
  for (let c = 0; c < col; c++) x += editorPcbW.value + editorColGap(c)
  return x
}
function editorRowY(row: number): number {
  let y = editorFrameTop.value + editorFrameGapTop.value
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
  if (!(c.supports.enabled ?? true)) return rails
  const colRailMat = Math.max(0, c.supports.widthColumns ?? 0)
  const rowRailMat = Math.max(0, c.supports.widthRows ?? 0)
  for (const gi of c.supports.xGaps) {
    if (gi < 0 || gi >= c.countX - 1) continue
    const rx = editorColX(gi) + editorPcbW.value + editorToolD.value
    rails.push({ x: rx, y: 0, w: colRailMat * es.value, h: editorTotalH.value })
  }
  for (const gi of c.supports.yGaps) {
    if (gi < 0 || gi >= c.countY - 1) continue
    const ry = editorRowY(gi) + editorPcbH.value + editorToolD.value
    rails.push({ x: 0, y: ry, w: editorTotalW.value, h: rowRailMat * es.value })
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
  const oppositeModeKey = local.value.tabs.syncAcrossPanel
    ? `${col}-${row}-${edge}-${channelId}`
    : `sync-${edge}-${channelId}`
  if (oppositeModeKey in local.value.tabs.edgeOverrides) return local.value.tabs.edgeOverrides[oppositeModeKey]
  const legacyEdge = `${col}-${row}-${edge}`
  if (legacyEdge in local.value.tabs.edgeOverrides) return local.value.tabs.edgeOverrides[legacyEdge]
  const perEdgeDefault = edge === 'top'
    ? local.value.tabs.defaultCountTop
    : edge === 'bottom'
      ? local.value.tabs.defaultCountBottom
      : edge === 'left'
        ? local.value.tabs.defaultCountLeft
        : local.value.tabs.defaultCountRight
  return evenTabPositions(perEdgeDefault ?? local.value.tabs.defaultCountPerEdge)
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
  if (!hasAnyRoutedSeparation(c)) return channels
  const hasVerticalRouted = isPanelEdgeRouted(c, 'left') || isPanelEdgeRouted(c, 'right')
  const hasHorizontalRouted = isPanelEdgeRouted(c, 'top') || isPanelEdgeRouted(c, 'bottom')

  for (let col = 0; col < c.countX; col++) {
    for (let row = 0; row < c.countY; row++) {
      // Right channel (between columns)
      if (col < c.countX - 1 && hasVerticalRouted) {
        const gapX = editorColX(col) + editorPcbW.value
        const gapW = editorColGap(col)
        channels.push({
          key: `${col}-${row}-right`, col, row, edge: 'right',
          x: gapX, y: editorRowY(row), w: gapW, h: editorPcbH.value,
          edgeLength: editorPcbH.value, edgeStart: editorRowY(row), isVertical: true,
        })
      }
      // Bottom channel (between rows)
      if (row < c.countY - 1 && hasHorizontalRouted) {
        const gapY = editorRowY(row) + editorPcbH.value
        const gapH = editorRowGap(row)
        channels.push({
          key: `${col}-${row}-bottom`, col, row, edge: 'bottom',
          x: editorColX(col), y: gapY, w: editorPcbW.value, h: gapH,
          edgeLength: editorPcbW.value, edgeStart: editorColX(col), isVertical: false,
        })
      }
      // Frame edges
      if (c.frame.enabled) {
        if (col === 0 && editorFrameGapLeft.value > 0 && isPanelEdgeRouted(c, 'left')) {
          channels.push({
            key: `${col}-${row}-left`, col, row, edge: 'left',
            x: editorFrameLeft.value, y: editorRowY(row), w: editorFrameGapLeft.value, h: editorPcbH.value,
            edgeLength: editorPcbH.value, edgeStart: editorRowY(row), isVertical: true,
          })
        }
        if (row === 0 && editorFrameGapTop.value > 0 && isPanelEdgeRouted(c, 'top')) {
          channels.push({
            key: `${col}-${row}-top`, col, row, edge: 'top',
            x: editorColX(col), y: editorFrameTop.value, w: editorPcbW.value, h: editorFrameGapTop.value,
            edgeLength: editorPcbW.value, edgeStart: editorColX(col), isVertical: false,
          })
        }
        if (col === c.countX - 1 && editorFrameGapRight.value > 0 && isPanelEdgeRouted(c, 'right')) {
          channels.push({
            key: `${col}-${row}-right`, col, row, edge: 'right',
            x: editorColX(col) + editorPcbW.value, y: editorRowY(row), w: editorFrameGapRight.value, h: editorPcbH.value,
            edgeLength: editorPcbH.value, edgeStart: editorRowY(row), isVertical: true,
          })
        }
        if (row === c.countY - 1 && editorFrameGapBottom.value > 0 && isPanelEdgeRouted(c, 'bottom')) {
          channels.push({
            key: `${col}-${row}-bottom`, col, row, edge: 'bottom',
            x: editorColX(col), y: editorRowY(row) + editorPcbH.value, w: editorPcbW.value, h: editorFrameGapBottom.value,
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

  const key = getTabOverrideKey(draggingTab.value.col, draggingTab.value.row, draggingTab.value.edge)
  const positions = [...getTabPositions(draggingTab.value.col, draggingTab.value.row, draggingTab.value.edge)]
  positions[draggingTab.value.posIndex] = Math.round(t * 100) / 100
  const overrides = { ...local.value.tabs.edgeOverrides, [key]: positions }
  emit('update:panelData', { ...local.value, tabs: { ...local.value.tabs, manualPlacement: true, edgeOverrides: overrides } })
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

  const key = getTabOverrideKey(col, row, edge)
  const positions = [...getTabPositions(col, row, edge), t].sort((a, b) => a - b)
  const overrides = { ...local.value.tabs.edgeOverrides, [key]: positions }
  emit('update:panelData', { ...local.value, tabs: { ...local.value.tabs, manualPlacement: true, edgeOverrides: overrides } })
}

function removeTab(col: number, row: number, edge: string, posIndex: number) {
  const key = getTabOverrideKey(col, row, edge)
  const positions = [...getTabPositions(col, row, edge)]
  positions.splice(posIndex, 1)

  const overrides = { ...local.value.tabs.edgeOverrides }
  if (positions.length === 0) {
    overrides[key] = []
  } else {
    overrides[key] = positions
  }
  emit('update:panelData', { ...local.value, tabs: { ...local.value.tabs, manualPlacement: true, edgeOverrides: overrides } })
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

<style scoped>
.viewer-tabs-scroller::-webkit-scrollbar {
  display: none;
}

.viewer-tabs-scroller {
  scrollbar-width: none;
}
</style>
