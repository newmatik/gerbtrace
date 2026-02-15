<template>
  <div class="h-screen flex flex-col">
    <AppHeader>
      <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80 ml-1" />

      <!-- Project name -->
      <div class="group flex items-center shrink-0">
        <input
          v-if="isEditingName"
          ref="nameInput"
          v-model="editableName"
          class="text-xs font-medium w-36 bg-transparent border border-primary rounded px-1.5 py-0.5 outline-none"
          @blur="commitName"
          @keydown.enter="commitName"
          @keydown.escape="cancelEdit"
        />
        <button
          v-else
          class="text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors flex items-center gap-1"
          title="Click to rename"
          @click="startEditName"
        >
          {{ project?.name || 'Viewer' }}
          <UIcon name="i-lucide-pencil" class="text-[10px] opacity-0 group-hover:opacity-40 transition-opacity" />
        </button>
      </div>

      <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />

      <!-- View mode: Layers / Realistic -->
      <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700">
        <UButton
          v-for="m in viewModeOptions"
          :key="m.value"
          size="xs"
          color="neutral"
          variant="ghost"
          :class="[tbBtnBase, viewMode === m.value ? tbBtnActive : tbBtnIdle]"
          @click="setViewMode(m.value)"
        >
          {{ m.label }}
        </UButton>
      </div>

      <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />

      <!-- Layer filter: All / Top / Bot + Mirror -->
      <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700">
        <UButton
          v-for="f in activeFilterOptions"
          :key="f.value"
          size="xs"
          color="neutral"
          variant="ghost"
          :class="[tbBtnBase, activeFilter === f.value ? tbBtnActive : tbBtnIdle]"
          @click="setFilter(f.value)"
        >
          {{ f.label }}
        </UButton>
        <UButton
          v-if="activeFilter === 'bot'"
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-flip-horizontal-2"
          :class="[tbBtnBase, mirrored ? tbBtnActive : tbBtnIdle]"
          @click="mirrored = !mirrored"
        >
          <span>Mirror</span>
        </UButton>
      </div>

      <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />

      <!-- Interaction mode: Cursor / Measure / Info / Delete -->
      <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700">
        <UButton
          v-for="m in modeOptions"
          :key="m.value"
          size="xs"
          color="neutral"
          variant="ghost"
          :icon="m.icon"
          :class="[tbBtnBase, activeMode === m.value ? tbBtnActive : tbBtnIdle]"
          :title="m.title"
          @click="setMode(m.value)"
        >
          <span>{{ m.label }}</span>
        </UButton>
      </div>

      <!-- Crop toggle -->
      <template v-if="hasOutline && viewMode === 'layers'">
        <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-crop"
          :class="[tbBtnBase, cropToOutline ? tbBtnActive : tbBtnIdle]"
          @click="cropToOutline = !cropToOutline"
        >
          <span>Crop</span>
        </UButton>
      </template>

      <!-- Realistic mode controls -->
      <template v-if="viewMode === 'realistic'">
        <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />
        <RealisticControls
          :selected-preset="selectedPreset"
          @select-preset="selectedPreset = $event"
        />
      </template>

      <!-- Downloads: Image / Gerber / PnP (same muted style, no divider between) -->
      <template v-if="viewMode === 'realistic' || layers.length > 0 || pnp.hasPnP.value">
        <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />
        <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700">
          <UButton
            v-if="viewMode === 'realistic'"
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-download"
            :class="[tbBtnBase, tbBtnIdle]"
            title="Download image (PNG/SVG)"
            @click="showImageExport = true"
          >
            <span>Image</span>
          </UButton>
          <UButton
            v-if="layers.length > 0"
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-download"
            :class="[tbBtnBase, tbBtnIdle]"
            title="Download Gerber files as ZIP"
            @click="handleDownloadGerber"
          >
            <span>Gerber</span>
          </UButton>
          <UButton
            v-if="pnp.hasPnP.value"
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-download"
            :class="[tbBtnBase, tbBtnIdle]"
            title="Export Pick &amp; Place data"
            @click="showPnPExport = true"
          >
            <span>PnP</span>
          </UButton>
        </div>
      </template>

      <!-- Team project: Approval badge + Revert button -->
      <template v-if="isTeamProject">
        <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />
        <UBadge
          v-if="isApproved"
          color="success"
          size="xs"
          variant="subtle"
          class="gap-1"
        >
          <UIcon name="i-lucide-lock" class="text-xs" />
          Approved
        </UBadge>
        <UBadge
          v-else
          color="warning"
          size="xs"
          variant="subtle"
        >
          Draft
        </UBadge>
        <UButton
          v-if="isApproved && isTeamAdmin"
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-lock-open"
          title="Revert to Draft"
          @click="handleRevertToDraft"
        >
          Revert to Draft
        </UButton>
        <UButton
          v-if="!isApproved && isTeamAdmin"
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-check-circle"
          title="Approve project"
          @click="handleApproveProject"
        >
          Approve
        </UButton>
      </template>

      <!-- Team project: Presence avatars -->
      <template v-if="isTeamProject && presentUsers.length > 0">
        <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />
        <div class="flex items-center -space-x-1">
          <div
            v-for="u in presentUsers.slice(0, 5)"
            :key="u.userId"
            class="size-5 rounded-full border-2 border-white dark:border-neutral-900 flex items-center justify-center text-[8px] font-bold"
            :class="u.mode === 'editing' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-300'"
            :title="`${u.name} (${u.role}, ${u.mode})`"
          >
            {{ u.name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2) }}
          </div>
          <div
            v-if="presentUsers.length > 5"
            class="size-5 rounded-full border-2 border-white dark:border-neutral-900 bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[8px] font-medium text-neutral-500 dark:text-neutral-400"
          >
            +{{ presentUsers.length - 5 }}
          </div>
        </div>
      </template>
    </AppHeader>

    <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar -->
      <aside
        class="border-r border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden shrink-0"
        :style="{ width: sidebarWidth + 'px' }"
      >
        <!-- Sidebar tabs: Layers / Components (shown before everything) -->
        <div
          v-if="pnp.hasPnP.value"
          class="flex items-center gap-0.5 px-3 pt-3 pb-1"
        >
          <button
            class="text-[11px] font-medium px-2 py-0.5 rounded transition-colors"
            :class="sidebarTab === 'layers'
              ? 'bg-neutral-200/80 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
              : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'"
            @click="sidebarTab = 'layers'"
          >
            Layers
          </button>
          <button
            class="text-[11px] font-medium px-2 py-0.5 rounded transition-colors"
            :class="sidebarTab === 'components'
              ? 'bg-neutral-200/80 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
              : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'"
            @click="sidebarTab = 'components'"
          >
            Components
          </button>
        </div>

        <!-- Layers view -->
        <template v-if="sidebarTab === 'layers' || !pnp.hasPnP.value">
          <div class="p-4" :class="{ 'pt-2': pnp.hasPnP.value }">
            <ImportPanel
              :packet="1"
              @import="handleImport"
            />
          </div>
          <LayerPanel
            :layers="layers"
            @toggle-visibility="toggleLayerVisibility"
            @change-color="changeLayerColor"
            @change-type="changeLayerType"
            @reorder="reorderLayers"
          />
        </template>

        <!-- Components view -->
        <ComponentPanel
          v-else
          :all-components="pnp.activeComponents.value"
          :filtered-components="pnp.filteredComponents.value"
          :selected-designator="pnp.selectedDesignator.value"
          :search-query="pnp.searchQuery.value"
          :align-mode="pnp.alignMode.value"
          :has-origin="pnp.hasOrigin.value"
          :origin-x="pnp.originX.value"
          :origin-y="pnp.originY.value"
          :show-packages="showPackages"
          :pnp-convention="pnp.convention.value"
          :package-options="packageOptions"
          @update:search-query="pnp.searchQuery.value = $event"
          @update:show-packages="showPackages = $event"
          @update:pnp-convention="updateConvention"
          @update:rotation="pnp.setRotationOverride($event.key, $event.rotation)"
          @reset:rotation="pnp.resetRotationOverride($event.key)"
          @toggle:dnp="pnp.toggleDnp($event)"
          @update:package-mapping="pnp.setCadPackageMapping($event.cadPackage, $event.packageName)"
          @update:polarized="pnp.setPolarizedOverride($event.key, $event.polarized)"
          @select="pnp.selectComponent($event)"
          @start-set-origin="startSetOrigin"
          @start-component-align="startComponentAlign"
          @reset-origin="pnp.resetOrigin()"
        />
      </aside>

      <!-- Resize handle -->
      <div
        class="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
        :class="{ 'bg-primary/50': sidebarDragging }"
        @mousedown="onSidebarDragStart"
      />

      <!-- Canvas area -->
      <main
        class="flex-1 relative outline-none"
        :class="{ 'select-none': sidebarDragging }"
        :style="{ backgroundColor }"
        @keydown="handleKeyDown"
        @keyup="handleKeyUp"
        tabindex="0"
      >
        <BoardCanvas
          ref="boardCanvasRef"
          :layers="renderLayers"
          :all-layers="layers"
          :interaction="canvasInteraction"
          :mirrored="mirrored"
          :crop-to-outline="cropToOutline"
          :outline-layer="outlineLayer"
          :measure="measureTool"
          :info="infoTool"
          :delete-tool="deleteTool"
          :view-mode="viewMode"
          :preset="viewMode === 'realistic' ? selectedPreset : undefined"
          :pnp-components="pnp.visibleComponents.value"
          :selected-pnp-designator="pnp.selectedDesignator.value"
          :pnp-origin-x="pnp.originX.value"
          :pnp-origin-y="pnp.originY.value"
          :align-mode="pnp.alignMode.value"
          :align-click-a="pnp.alignClickA.value"
          :match-package="pkgLib.matchPackage"
          :package-library-version="packageLibraryVersion"
          :show-packages="showPackages"
          :pnp-convention="pnp.convention.value"
          @pnp-click="pnp.selectComponent($event)"
          @align-click="handleAlignClick"
        />
        <MeasureOverlay
          :measure="measureTool"
          :transform="canvasInteraction.transform.value"
        />
        <InfoOverlay :info="infoTool" />
        <DeleteOverlay
          :delete-tool="deleteTool"
          @confirm-delete="handleConfirmDelete"
        />
        <CanvasControls
          :interaction="canvasInteraction"
          :view-mode="viewMode"
          @open-settings="showSettings = true"
        />
      </main>
    </div>

    <!-- Settings modal -->
    <AppSettingsModal v-model:open="showSettings" />

    <!-- PnP export modal -->
    <PnPExportModal
      v-model:open="showPnPExport"
      :default-convention="pnp.convention.value"
      :components="pnp.allComponents.value"
      :project-name="project?.name || 'Untitled'"
      @export="handleExportPnP"
    />

    <!-- Image export modal -->
    <ImageExportModal
      v-model:open="showImageExport"
      :has-pn-p="pnp.hasPnP.value"
      @export="handleExportImage"
    />
  </div>
</template>

<script setup lang="ts">
import type { GerberFile, LayerInfo, LayerFilter } from '~/utils/gerber-helpers'
import type { SourceRange } from '@lib/gerber/types'
import { sortLayersByPcbOrder, isTopLayer, isBottomLayer, isSharedLayer, getColorForType, isPnPLayer } from '~/utils/gerber-helpers'
import type { ViewMode } from '~/components/viewer/BoardCanvas.vue'
import { getPresetById, type PcbPreset } from '~/utils/pcb-presets'
import type { PnPConvention } from '~/utils/pnp-conventions'
import type { PnPExportFormat, PnPExportSideMode } from '~/utils/pnp-export'
import { generatePnPExport, getPnPExportExtension, getPnPExportMimeType } from '~/utils/pnp-export'
import { exportRealisticSvg } from '../../../lib/renderer/svg-exporter'
import * as SvgExporter from '../../../lib/renderer/svg-exporter'
import { removeSourceRanges } from '@lib/gerber/editor'
import JSZip from 'jszip'

const route = useRoute()
const rawId = route.params.id as string
const isTeamProject = rawId.startsWith('team-')
const projectId = isTeamProject ? 0 : Number(rawId) // local projects use numeric IDs
const teamProjectId = isTeamProject ? rawId.replace('team-', '') : null
const { getProject, getFiles, addFiles, upsertFiles, clearFiles, renameProject, updateFileLayerType, updateFileContent, updateProjectOrigin, updateProjectConvention, updateProjectRotationOverrides, updateProjectDnp, updateProjectCadPackageMap, updateProjectPolarizedOverrides } = useProject()

// ── Team project support ──
const teamProjectIdRef = ref(teamProjectId)
const { currentTeamRole, isAdmin: isTeamAdmin } = useTeam()
const { presentUsers } = isTeamProject ? usePresence(teamProjectIdRef) : { presentUsers: ref([]) }
const projectSync = isTeamProject ? useProjectSync(teamProjectIdRef) : null

/** Whether this is an approved (frozen) team project */
const isApproved = computed(() => {
  if (!isTeamProject) return false
  return projectSync?.project.value?.status === 'approved'
})

/** Whether the current user can edit this project */
const canEdit = computed(() => {
  if (!isTeamProject) return true // local projects are always editable
  if (isApproved.value) return false // approved = frozen
  // Viewers can't edit, editors and admins can
  return currentTeamRole.value === 'editor' || currentTeamRole.value === 'admin'
})
const canvasInteraction = useCanvasInteraction()
const measureTool = useMeasureTool()
const infoTool = useInfoTool()
const deleteTool = useDeleteTool()
const { backgroundColor } = useBackgroundColor()
const { sidebarWidth, dragging: sidebarDragging, onDragStart: onSidebarDragStart } = useSidebarWidth()

// ── Sidebar tab (Layers / Components) ──
const sidebarTab = ref<'layers' | 'components'>('layers')

// Toolbar button styling (outline + blue active border)
const tbBtnBase =
  '!rounded-md !px-2.5 !py-1 !text-xs !font-medium !border !shadow-none !transition-colors'
const tbBtnIdle =
  '!border-transparent hover:!border-neutral-300/80 hover:!bg-neutral-200/70 ' +
  'dark:!text-neutral-200 dark:hover:!bg-neutral-800/70 dark:hover:!border-neutral-600/70'
const tbBtnActive =
  '!border-blue-500/70 !text-blue-700 !bg-blue-50/90 ' +
  'dark:!border-blue-400/70 dark:!text-blue-200 dark:!bg-blue-500/15'

// ── Persisted per-project preferences ──

const prefs = useViewerPreferences(projectId)
const viewMode = prefs.viewMode
const activeFilter = prefs.activeFilter
const cropToOutline = prefs.cropToOutline
const hasStoredCropToOutline = prefs.hasStoredCropToOutline
const mirrored = prefs.mirrored

// ── Interaction mode management ──

type InteractionMode = 'cursor' | 'measure' | 'info' | 'delete'

const activeMode = prefs.activeMode

const modeOptions: { label: string; value: InteractionMode; icon: string; title: string }[] = [
  { label: 'Cursor', value: 'cursor', icon: 'i-lucide-mouse-pointer', title: 'Default cursor mode' },
  { label: 'Measure', value: 'measure', icon: 'i-lucide-ruler', title: 'Measure distance between points' },
  { label: 'Info', value: 'info', icon: 'i-lucide-info', title: 'Inspect objects at click position' },
  { label: 'Delete', value: 'delete', icon: 'i-lucide-eraser', title: 'Select and delete objects from Gerber files' },
]

function setMode(mode: InteractionMode) {
  if (activeMode.value === mode) return
  // Deactivate current tool
  if (activeMode.value === 'measure') {
    measureTool.active.value = false
    measureTool.clear()
  }
  if (activeMode.value === 'info') {
    infoTool.active.value = false
    infoTool.clear()
  }
  if (activeMode.value === 'delete') {
    deleteTool.active.value = false
    deleteTool.clear()
  }
  activeMode.value = mode
  // Activate new tool
  if (mode === 'measure') measureTool.active.value = true
  if (mode === 'info') infoTool.active.value = true
  if (mode === 'delete') deleteTool.active.value = true
}

// Sync back when tools deactivate themselves (e.g. via Escape handler)
watch(() => measureTool.active.value, (isActive) => {
  if (!isActive && activeMode.value === 'measure') {
    activeMode.value = 'cursor'
  }
})
watch(() => deleteTool.active.value, (isActive) => {
  if (!isActive && activeMode.value === 'delete') {
    activeMode.value = 'cursor'
  }
})

function handleKeyDown(e: KeyboardEvent) {
  // Cancel alignment mode on Escape
  if (pnp.isAligning.value && e.key === 'Escape') {
    pnp.cancelAlign()
    return
  }
  if (activeMode.value === 'measure') {
    measureTool.handleKeyDown(e)
  } else if (activeMode.value === 'info') {
    if (e.key === 'Escape') {
      if (infoTool.hits.value.length > 0) {
        infoTool.clear()
      } else {
        setMode('cursor')
      }
    }
  } else if (activeMode.value === 'delete') {
    deleteTool.handleKeyDown(e)
  }
}

function startSetOrigin() {
  // Switch to cursor mode to allow canvas clicking
  if (activeMode.value !== 'cursor') {
    setMode('cursor')
  }
  pnp.startSettingOrigin()
}

function startComponentAlign() {
  if (!pnp.selectedComponent.value) return
  // Switch to cursor mode to allow canvas clicking
  if (activeMode.value !== 'cursor') {
    setMode('cursor')
  }
  pnp.startComponentAlign(pnp.selectedComponent.value)
}

function handleAlignClick(x: number, y: number) {
  // Detect Gerber units from the board
  const units = detectGerberUnits()
  pnp.handleAlignClick(x, y, units)
}

/** Detect the Gerber coordinate units from loaded layers */
function detectGerberUnits(): 'mm' | 'in' {
  const canvas = boardCanvasRef.value
  if (!canvas) return 'mm'
  for (const layer of layers.value) {
    const tree = canvas.getImageTree(layer)
    if (tree) return tree.units
  }
  return 'mm'
}

function handleKeyUp(e: KeyboardEvent) {
  measureTool.handleKeyUp(e)
}

const project = ref<any>(null)
const layers = ref<LayerInfo[]>([])
const selectedPreset = computed({
  get: () => getPresetById(prefs.presetId.value),
  set: (p: PcbPreset) => { prefs.presetId.value = p.id },
})
const boardCanvasRef = ref<any>(null)
const showSettings = ref(false)
const showPnPExport = ref(false)
const showImageExport = ref(false)

const outlineLayer = computed(() => layers.value.find(l => l.type === 'Outline') || undefined)
const hasOutline = computed(() => layers.value.some(l => l.type === 'Outline'))

// ── Pick & Place ──
const pnp = usePickAndPlace(layers)
const pkgLib = usePackageLibrary()
const showPackages = ref(true)
const packageLibraryVersion = computed(() => pkgLib.lookupMap.value.size)
const packageOptions = computed(() => pkgLib.allPackages.value.map(p => p.name).sort((a, b) => a.localeCompare(b)))

// Load package library on mount (non-blocking)
onMounted(() => { pkgLib.loadPackages() })

// Let the PnP composable use the package library for matching
watch(
  () => pkgLib.lookupMap.value.size,
  () => { pnp.setPackageMatcher(pkgLib.matchPackage) },
  { immediate: true },
)

// Auto-switch to Components tab when PnP layers appear for the first time
watch(pnp.hasPnP, (has) => {
  if (has && sidebarTab.value === 'layers') {
    sidebarTab.value = 'components'
  }
})

// Sync toolbar's All/Top/Bot filter with PnP side filter
watch(activeFilter, (filter) => {
  if (filter === 'top') pnp.activeSideFilter.value = 'top'
  else if (filter === 'bot') pnp.activeSideFilter.value = 'bottom'
  else pnp.activeSideFilter.value = 'all'
}, { immediate: true })

// ── Persist PnP data to local DB or Supabase ──────────────────────────

function persistToProject(updates: Record<string, any>) {
  if (isTeamProject && teamProjectId) {
    // Map camelCase keys to snake_case for Supabase
    const mapped: Record<string, any> = {}
    for (const [k, v] of Object.entries(updates)) {
      mapped[k.replace(/[A-Z]/g, m => '_' + m.toLowerCase())] = v
    }
    updateTeamProject(teamProjectId, mapped)
  }
}

// Persist PnP origin to database when it changes
watch([pnp.originX, pnp.originY], ([ox, oy]) => {
  if (isTeamProject) {
    persistToProject({ pnpOriginX: ox, pnpOriginY: oy })
  } else {
    updateProjectOrigin(projectId, ox, oy)
  }
})

// Persist per-component PnP rotation overrides to database
watch(pnp.rotationOverridesRecord, (overrides) => {
  if (isTeamProject) {
    persistToProject({ pnpRotationOverrides: overrides })
  } else {
    updateProjectRotationOverrides(projectId, overrides)
  }
}, { deep: true })

// Persist DNP component keys to database
watch(pnp.dnpRecord, (keys) => {
  if (isTeamProject) {
    persistToProject({ pnpDnpComponents: keys })
  } else {
    updateProjectDnp(projectId, keys)
  }
}, { deep: true })

// Persist CAD package -> library package mapping
watch(pnp.cadPackageMapRecord, (map) => {
  if (isTeamProject) {
    persistToProject({ pnpCadPackageMap: map })
  } else {
    updateProjectCadPackageMap(projectId, map)
  }
}, { deep: true })

// Persist polarized overrides
watch(pnp.polarizedOverridesRecord, (overrides) => {
  if (isTeamProject) {
    persistToProject({ pnpPolarizedOverrides: overrides })
  } else {
    updateProjectPolarizedOverrides(projectId, overrides)
  }
}, { deep: true })

// Update PnP convention and persist
function updateConvention(convention: PnPConvention) {
  pnp.convention.value = convention
  if (isTeamProject) {
    persistToProject({ pnpConvention: convention })
  } else {
    updateProjectConvention(projectId, convention)
  }
}

const viewModeOptions: { label: string; value: ViewMode }[] = [
  { label: 'Layers', value: 'layers' },
  { label: 'Realistic', value: 'realistic' },
]

const filterOptions: { label: string; value: LayerFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Top', value: 'top' },
  { label: 'Bot', value: 'bot' },
]

/** In realistic mode, hide "All" since we can only show one side at a time */
const activeFilterOptions = computed(() => {
  if (viewMode.value === 'realistic') {
    return filterOptions.filter(f => f.value !== 'all')
  }
  return filterOptions
})

// Editable project name
const isEditingName = ref(false)
const editableName = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
const hasBeenRenamed = ref(false)

function startEditName() {
  editableName.value = project.value?.name || ''
  isEditingName.value = true
  nextTick(() => {
    nameInput.value?.focus()
    nameInput.value?.select()
  })
}

async function commitName() {
  const trimmed = editableName.value.trim()
  if (trimmed && trimmed !== project.value?.name) {
    if (isTeamProject && teamProjectId) {
      await updateTeamProject(teamProjectId, { name: trimmed })
    } else {
      await renameProject(projectId, trimmed)
      project.value = await getProject(projectId)
    }
    if (project.value) project.value.name = trimmed
    hasBeenRenamed.value = true
  }
  isEditingName.value = false
}

function cancelEdit() {
  isEditingName.value = false
}

// ── Team project actions (approve / revert) ──
const { getProject: getTeamProject, approveProject: doApprove, revertToDraft: doRevert, updateProject: updateTeamProject } = useTeamProjects()

async function handleApproveProject() {
  if (!teamProjectId) return
  const { error } = await doApprove(teamProjectId)
  if (error) console.warn('Failed to approve project:', error)
}

async function handleRevertToDraft() {
  if (!teamProjectId) return
  const { error } = await doRevert(teamProjectId)
  if (error) console.warn('Failed to revert project:', error)
}

function setViewMode(mode: ViewMode) {
  viewMode.value = mode
  if (mode === 'realistic') {
    // Realistic mode always crops to outline
    cropToOutline.value = true
    // "All" doesn't apply to realistic — default to Top
    if (activeFilter.value === 'all') {
      setFilter('top')
    }
  }
}

/**
 * Visible layers for rendering, reversed so the first item in the
 * sidebar (top of PCB stack) renders last (on top visually).
 */
const renderLayers = computed(() => {
  return [...layers.value].filter(l => l.visible).reverse()
})

/** Apply layer visibility based on filter choice (without changing mirrored). */
function applyFilterVisibility(filter: LayerFilter) {
  for (const layer of layers.value) {
    // Unmatched layers stay hidden regardless of filter (user must assign a type first)
    if (layer.type === 'Unmatched') {
      layer.visible = false
      continue
    }
    if (filter === 'all') {
      layer.visible = true
    } else if (filter === 'top') {
      layer.visible = isTopLayer(layer.type) || isSharedLayer(layer.type)
    } else {
      layer.visible = isBottomLayer(layer.type) || isSharedLayer(layer.type)
    }
  }
}

function setFilter(filter: LayerFilter) {
  activeFilter.value = filter
  applyFilterVisibility(filter)
  mirrored.value = filter === 'bot'
}

function applyDefaultCropToOutline() {
  if (!hasStoredCropToOutline.value && hasOutline.value) {
    cropToOutline.value = true
    hasStoredCropToOutline.value = true
  }
}

onMounted(async () => {
  if (isTeamProject && teamProjectId) {
    const tp = await getTeamProject(teamProjectId)
    if (tp) {
      // Map team project shape to the local project shape used by the template
      project.value = {
        id: tp.id,
        name: tp.name,
        mode: tp.mode,
        pnpOriginX: tp.pnp_origin_x,
        pnpOriginY: tp.pnp_origin_y,
        pnpConvention: tp.pnp_convention,
        pnpRotationOverrides: tp.pnp_rotation_overrides,
        pnpDnpComponents: tp.pnp_dnp_components,
        pnpCadPackageMap: tp.pnp_cad_package_map,
        pnpPolarizedOverrides: tp.pnp_polarized_overrides,
      }
    }
  } else {
    project.value = await getProject(projectId)
  }
  const storedFiles = await getFiles(projectId, 1)
  layers.value = sortLayersByPcbOrder(storedFiles.map(f => {
    const type = f.layerType || detectLayerType(f.fileName)
    return {
      file: f,
      visible: type !== 'Unmatched',
      color: getColorForType(type),
      type,
    }
  }))

  // Restore persisted layer visibility (filter) without overriding persisted mirrored
  applyFilterVisibility(activeFilter.value)
  applyDefaultCropToOutline()

  // Restore persisted interaction mode
  if (activeMode.value === 'measure') measureTool.active.value = true
  if (activeMode.value === 'info') infoTool.active.value = true
  if (activeMode.value === 'delete') deleteTool.active.value = true

  // Restore persisted PnP origin
  if (project.value?.pnpOriginX != null && project.value?.pnpOriginY != null) {
    pnp.originX.value = project.value.pnpOriginX
    pnp.originY.value = project.value.pnpOriginY
  }

  // Restore persisted PnP convention
  if (project.value?.pnpConvention) {
    pnp.convention.value = project.value.pnpConvention
  }

  // Restore persisted per-component PnP rotation overrides
  pnp.setRotationOverrides(project.value?.pnpRotationOverrides)

  // Restore persisted DNP state
  pnp.setDnpKeys(project.value?.pnpDnpComponents)

  // Restore persisted CAD package mapping
  pnp.setCadPackageMap(project.value?.pnpCadPackageMap)

  // Restore persisted polarized overrides
  pnp.setPolarizedOverrides(project.value?.pnpPolarizedOverrides)
})

async function handleImport(newFiles: GerberFile[], sourceName: string) {
  const canvas = boardCanvasRef.value
  const hadExistingFiles = layers.value.length > 0
  const newFileNames = new Set(newFiles.map(f => f.fileName))

  // Invalidate cache for files being overwritten or newly added
  if (canvas) {
    for (const f of newFiles) canvas.invalidateCache(f.fileName)
  }

  // Merge into the database: overwrite same-name files, keep the rest
  await upsertFiles(projectId, 1, newFiles)

  // Auto-rename only on first import into a default-named project
  const isDefaultName = project.value?.name?.match(/^(View Project |New Viewer Project|New Compare Project)/)
  if (!hadExistingFiles && sourceName && !hasBeenRenamed.value && isDefaultName) {
    if (isTeamProject && teamProjectId) {
      await updateTeamProject(teamProjectId, { name: sourceName })
    } else {
      await renameProject(projectId, sourceName)
      project.value = await getProject(projectId)
    }
    if (project.value) project.value.name = sourceName
  }

  // Build layer entries for the incoming files
  const incomingLayers = newFiles.map(f => {
    const type = f.layerType || detectLayerType(f.fileName)
    return {
      file: f,
      visible: type !== 'Unmatched',
      color: getColorForType(type),
      type,
    }
  })

  // Merge: keep existing layers that aren't overwritten, then add/replace with incoming
  const keptLayers = layers.value.filter(l => !newFileNames.has(l.file.fileName))
  layers.value = sortLayersByPcbOrder([...keptLayers, ...incomingLayers])
  applyFilterVisibility(activeFilter.value)
  applyDefaultCropToOutline()

  // Only reset PnP state on first import (empty project), not on additive imports
  if (!hadExistingFiles) {
    pnp.resetOrigin()
    pnp.resetAllRotationOverrides()
    pnp.resetAllDnp()
    if (isTeamProject) {
      persistToProject({ pnpOriginX: null, pnpOriginY: null, pnpRotationOverrides: {}, pnpDnpComponents: [] })
    } else {
      await updateProjectOrigin(projectId, null, null)
      await updateProjectRotationOverrides(projectId, {})
      await updateProjectDnp(projectId, [])
    }
  }

  canvasInteraction.resetView()

  // Invalidate PnP cache so newly imported PnP files get picked up
  pnp.invalidateCache()
}

function toggleLayerVisibility(index: number) {
  const layer = layers.value[index]
  if (layer) layer.visible = !layer.visible
}

function changeLayerColor(index: number, color: string) {
  const layer = layers.value[index]
  if (layer) layer.color = color
}

async function changeLayerType(index: number, type: string) {
  const layer = layers.value[index]
  if (!layer) return
  layer.type = type
  layer.color = getColorForType(type)
  layer.file.layerType = type
  layers.value = sortLayersByPcbOrder([...layers.value])
  await updateFileLayerType(projectId, 1, layer.file.fileName, type)
}

function reorderLayers(fromIndex: number, toIndex: number) {
  const arr = [...layers.value]
  const [moved] = arr.splice(fromIndex, 1)
  if (!moved) return
  arr.splice(toIndex, 0, moved)
  layers.value = arr
}

// ── Delete handler ──

async function handleConfirmDelete() {
  if (!deleteTool.pendingDeletion.value) return

  const canvas = boardCanvasRef.value
  if (!canvas) return

  for (const pendingLayer of deleteTool.pendingDeletion.value.layers) {
    if (!pendingLayer.selected || pendingLayer.graphicIndices.length === 0) continue

    // Find the matching layer data
    const layer = layers.value.find(l => l.file.fileName === pendingLayer.layerName)
    if (!layer) continue

    // Get the ImageTree to access source ranges
    const tree = canvas.getImageTree(layer)
    if (!tree) continue

    // Collect source ranges from the selected graphics
    const sourceRanges: SourceRange[] = []
    for (const idx of pendingLayer.graphicIndices) {
      const graphic = tree.children[idx]
      if (graphic?.sourceRanges) {
        sourceRanges.push(...graphic.sourceRanges)
      }
    }

    if (sourceRanges.length === 0) continue

    // Apply the deletion to the source text
    const newContent = removeSourceRanges(layer.file.content, sourceRanges)

    // Update in-memory content
    layer.file.content = newContent

    // Persist to IndexedDB
    await updateFileContent(projectId, 1, layer.file.fileName, newContent)

    // Invalidate the parsed tree cache so it gets re-parsed
    canvas.invalidateCache(layer.file.fileName)
  }

  // Clear the pending deletion
  deleteTool.cancelDeletion()

  // Force re-render by triggering reactivity
  layers.value = [...layers.value]
}

// ── Download Gerber handler ──

async function handleDownloadGerber() {
  const zip = new JSZip()
  for (const layer of layers.value) {
    // Skip PnP layers from Gerber download
    if (isPnPLayer(layer.type)) continue
    zip.file(layer.file.fileName, layer.file.content)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, `${project.value?.name || 'gerber-files'}.zip`)
}

// ── Export handlers ──

async function handleExportPng() {
  const canvas = boardCanvasRef.value
  if (!canvas) return
  const blob = await canvas.exportPng()
  if (!blob) return
  triggerDownload(blob, `${project.value?.name || 'pcb'}-${mirrored.value ? 'bottom' : 'top'}.png`)
}

function handleExportSvg() {
  const canvas = boardCanvasRef.value
  if (!canvas) return
  const side = mirrored.value ? 'bottom' : 'top'
  const realisticLayers = canvas.getRealisticLayersForExport(side)

  const svgString = exportRealisticSvg(realisticLayers, selectedPreset.value, side)
  const blob = new Blob([svgString], { type: 'image/svg+xml' })
  triggerDownload(blob, `${project.value?.name || 'pcb'}-${side}.svg`)
}

async function handleExportImage(options: { format: 'png' | 'svg'; componentsMode: 'none' | 'with' | 'both'; sideMode: 'top' | 'bottom' | 'both' }) {
  const canvas = boardCanvasRef.value
  if (!canvas) return

  const projectName = project.value?.name || 'pcb'
  const sides: Array<'top' | 'bottom'> = options.sideMode === 'both' ? ['top', 'bottom'] : [options.sideMode]

  // If no PnP exists, treat as "none" regardless of selection
  const canRenderComponents = pnp.hasPnP.value
  const variants: boolean[] =
    (options.componentsMode === 'both' && canRenderComponents) ? [false, true]
      : (options.componentsMode === 'with' && canRenderComponents) ? [true]
        : [false]

  const fileCount = sides.length * variants.length
  const ext = options.format === 'png' ? '.png' : '.svg'

  const buildComponentsForSide = (side: 'top' | 'bottom') => {
    if (!canRenderComponents) return []
    const list = pnp.allComponents.value
      .filter(c => !c.dnp)
      .filter(c => c.side === side)
    return list
  }

  const renderOne = async (side: 'top' | 'bottom', withComponents: boolean): Promise<Blob | null> => {
    if (options.format === 'png') {
      const comps = withComponents ? buildComponentsForSide(side) : []
      const blob = await canvas.exportPngForSide(side, { includeComponents: withComponents, components: comps, includePackages: showPackages.value })
      return blob
    }

    // SVG
    const realisticLayers = canvas.getRealisticLayersForExport(side)
    if (!withComponents) {
      const svgString = exportRealisticSvg(realisticLayers, selectedPreset.value, side)
      return new Blob([svgString], { type: 'image/svg+xml' })
    }

    const comps = buildComponentsForSide(side)
    const svgString = (SvgExporter as any).exportRealisticSvgWithComponents(realisticLayers, selectedPreset.value, side, {
      components: comps,
      pnpOriginX: pnp.originX.value,
      pnpOriginY: pnp.originY.value,
      matchPackage: pkgLib.matchPackage,
      showPackages: showPackages.value,
      pnpConvention: pnp.convention.value,
    })
    return new Blob([svgString], { type: 'image/svg+xml' })
  }

  const fileNameFor = (side: 'top' | 'bottom', withComponents: boolean) => {
    const sideSuffix = `-${side}`
    const compSuffix = variants.length === 1
      ? ''
      : (withComponents ? '-with-components' : '-no-components')
    return `${projectName}${sideSuffix}${compSuffix}${ext}`
  }

  if (fileCount === 1) {
    const blob = await renderOne(sides[0]!, variants[0]!)
    if (!blob) return
    triggerDownload(blob, fileNameFor(sides[0]!, variants[0]!))
    return
  }

  const zip = new JSZip()
  for (const side of sides) {
    for (const withComponents of variants) {
      const blob = await renderOne(side, withComponents)
      if (!blob) continue
      zip.file(fileNameFor(side, withComponents), blob)
    }
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(zipBlob, `${projectName}-images.zip`)
}

async function handleExportPnP(options: { convention: PnPConvention; format: PnPExportFormat; sideMode: PnPExportSideMode; excludeDnp: boolean }) {
  const allComps = pnp.allComponents.value
  const name = project.value?.name || 'pnp'

  const buildExport = (components: typeof allComps) =>
    generatePnPExport({
      projectName: project.value?.name || 'Untitled',
      inputConvention: pnp.convention.value,
      outputConvention: options.convention,
      format: options.format,
      components,
      matchPackage: pkgLib.matchPackage,
      excludeDnp: options.excludeDnp,
    })

  const mimeType = getPnPExportMimeType(options.format)
  const ext = getPnPExportExtension(options.format)

  if (options.sideMode === 'separate') {
    // Export as ZIP with separate top and bottom files
    const topComps = allComps.filter(c => c.side === 'top')
    const botComps = allComps.filter(c => c.side === 'bottom')
    const zip = new JSZip()
    if (topComps.length > 0) zip.file(`${name}-top${ext}`, buildExport(topComps))
    if (botComps.length > 0) zip.file(`${name}-bottom${ext}`, buildExport(botComps))
    const blob = await zip.generateAsync({ type: 'blob' })
    triggerDownload(blob, `${name}-pick-and-place.zip`)
  } else {
    let components = allComps
    if (options.sideMode === 'top') components = allComps.filter(c => c.side === 'top')
    else if (options.sideMode === 'bottom') components = allComps.filter(c => c.side === 'bottom')
    const content = buildExport(components)
    const sideSuffix = options.sideMode === 'top' ? '-top' : options.sideMode === 'bottom' ? '-bottom' : ''
    const blob = new Blob([content], { type: mimeType })
    triggerDownload(blob, `${name}-pick-and-place${sideSuffix}${ext}`)
  }
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
</script>

<!-- Toolbar button styling lives in template classes. -->
