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
          @export-png="handleExportPng"
          @export-svg="handleExportSvg"
        />
      </template>

      <!-- Download Gerber -->
      <template v-if="layers.length > 0">
        <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />
        <UButton
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
          :all-components="pnp.allComponents.value"
          :filtered-components="pnp.filteredComponents.value"
          :selected-designator="pnp.selectedDesignator.value"
          :search-query="pnp.searchQuery.value"
          :align-mode="pnp.alignMode.value"
          :has-origin="pnp.hasOrigin.value"
          :origin-x="pnp.originX.value"
          :origin-y="pnp.originY.value"
          :show-packages="showPackages"
          :pnp-convention="pnp.convention.value"
          @update:search-query="pnp.searchQuery.value = $event"
          @update:show-packages="showPackages = $event"
          @update:pnp-convention="updateConvention"
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
  </div>
</template>

<script setup lang="ts">
import type { GerberFile, LayerInfo, LayerFilter } from '~/utils/gerber-helpers'
import type { SourceRange } from '@lib/gerber/types'
import { sortLayersByPcbOrder, isTopLayer, isBottomLayer, isSharedLayer, getColorForType, isPnPLayer } from '~/utils/gerber-helpers'
import type { ViewMode } from '~/components/viewer/BoardCanvas.vue'
import { getPresetById, type PcbPreset } from '~/utils/pcb-presets'
import type { PnPConvention } from '~/utils/pnp-conventions'
import { exportRealisticSvg } from '../../../lib/renderer/svg-exporter'
import { removeSourceRanges } from '@lib/gerber/editor'
import JSZip from 'jszip'

const route = useRoute()
const projectId = Number(route.params.id)
const { getProject, getFiles, addFiles, clearFiles, renameProject, updateFileLayerType, updateFileContent, updateProjectOrigin, updateProjectConvention } = useProject()
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

const outlineLayer = computed(() => layers.value.find(l => l.type === 'Outline') || undefined)
const hasOutline = computed(() => layers.value.some(l => l.type === 'Outline'))

// ── Pick & Place ──
const pnp = usePickAndPlace(layers)
const pkgLib = usePackageLibrary()
const showPackages = ref(true)
const packageLibraryVersion = computed(() => pkgLib.lookupMap.value.size)

// Load package library on mount (non-blocking)
onMounted(() => { pkgLib.loadPackages() })

// Auto-switch to Components tab when PnP layers appear for the first time
watch(pnp.hasPnP, (has) => {
  if (has && sidebarTab.value === 'layers') {
    sidebarTab.value = 'components'
  }
})

// Persist PnP origin to database when it changes
watch([pnp.originX, pnp.originY], ([ox, oy]) => {
  updateProjectOrigin(projectId, ox, oy)
})

// Update PnP convention and persist
function updateConvention(convention: PnPConvention) {
  pnp.convention.value = convention
  updateProjectConvention(projectId, convention)
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
    await renameProject(projectId, trimmed)
    project.value = await getProject(projectId)
    hasBeenRenamed.value = true
  }
  isEditingName.value = false
}

function cancelEdit() {
  isEditingName.value = false
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
  project.value = await getProject(projectId)
  const storedFiles = await getFiles(projectId, 1)
  layers.value = sortLayersByPcbOrder(storedFiles.map(f => {
    const type = f.layerType || detectLayerType(f.fileName)
    return {
      file: f,
      visible: true,
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
})

async function handleImport(newFiles: GerberFile[], sourceName: string) {
  // Clear any cached parse trees so re-importing the same filenames works correctly.
  const canvas = boardCanvasRef.value
  const prevFileNames = layers.value.map(l => l.file.fileName)
  if (canvas) {
    for (const name of prevFileNames) canvas.invalidateCache(name)
  }

  // Replace the current board import (instead of appending).
  // Appending multiple unrelated imports can create huge unified bounds and make auto-fit look broken.
  await clearFiles(projectId, 1)
  await addFiles(projectId, 1, newFiles)
  if (sourceName && !hasBeenRenamed.value && project.value?.name?.match(/^View Project /)) {
    await renameProject(projectId, sourceName)
    project.value = await getProject(projectId)
  }
  const newLayers = newFiles.map(f => {
    const type = f.layerType || detectLayerType(f.fileName)
    return {
      file: f,
      visible: true,
      color: getColorForType(type),
      type,
    }
  })
  layers.value = sortLayersByPcbOrder(newLayers)
  applyFilterVisibility(activeFilter.value)
  applyDefaultCropToOutline()

  if (canvas) {
    for (const f of newFiles) canvas.invalidateCache(f.fileName)
  }

  // Reset PnP origin (it is board-specific) and force re-fit.
  pnp.resetOrigin()
  await updateProjectOrigin(projectId, null, null)
  canvasInteraction.resetView()

  // Invalidate PnP cache for newly imported files
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
