<template>
  <div class="h-screen flex flex-col">
    <AppHeader compact>
      <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />

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

      <!-- Board rotation -->
      <template v-if="layers.length > 0">
        <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />
        <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700">
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-rotate-ccw"
            :class="[tbBtnBase, tbBtnIdle]"
            title="Rotate 90° counter-clockwise"
            @click="rotateCCW()"
          />
          <UPopover :content="{ align: 'center', sideOffset: 8 }">
            <button
              class="text-[10px] font-mono px-1.5 py-0.5 rounded min-w-[2.5rem] text-center transition-colors cursor-pointer"
              :class="boardRotation !== 0
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-neutral-500 dark:text-neutral-400'"
              :title="'Board rotation: ' + boardRotation + '°'"
            >
              {{ boardRotation }}°
            </button>
            <template #content>
              <div class="p-3 w-48" @click.stop>
                <p class="text-[10px] font-medium text-neutral-400 uppercase tracking-wider mb-2">Board Rotation</p>
                <div class="flex items-center gap-1.5 mb-3">
                  <input
                    :value="boardRotation"
                    type="number"
                    step="1"
                    class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
                    @change="(e: Event) => setBoardRotation(Number((e.target as HTMLInputElement).value))"
                    @keydown.enter="(e: Event) => { setBoardRotation(Number((e.target as HTMLInputElement).value)); (e.target as HTMLInputElement).blur() }"
                  />
                  <span class="text-xs text-neutral-400 shrink-0">deg</span>
                </div>
                <div class="grid grid-cols-4 gap-1 mb-3">
                  <button
                    v-for="angle in [0, 90, 180, 270]"
                    :key="angle"
                    class="text-[10px] font-medium px-1.5 py-1 rounded border transition-colors text-center"
                    :class="boardRotation === angle
                      ? 'border-blue-500/70 text-blue-700 bg-blue-50/90 dark:border-blue-400/70 dark:text-blue-200 dark:bg-blue-500/15'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-800'"
                    @click="setBoardRotation(angle)"
                  >
                    {{ angle }}°
                  </button>
                </div>
                <button
                  v-if="boardRotation !== 0"
                  class="w-full text-[10px] font-medium px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-red-400 hover:text-red-600 dark:hover:border-red-500 dark:hover:text-red-400 transition-colors"
                  @click="setBoardRotation(0)"
                >
                  Reset to 0°
                </button>
              </div>
            </template>
          </UPopover>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-rotate-cw"
            :class="[tbBtnBase, tbBtnIdle]"
            title="Rotate 90° clockwise"
            @click="rotateCW()"
          />
        </div>
      </template>

      <!-- Realistic mode controls -->
      <template v-if="viewMode === 'realistic'">
        <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />
        <RealisticControls
          :selected-preset="selectedPreset"
          @select-preset="selectedPreset = $event"
        />
      </template>

      <!-- Downloads dropdown -->
      <template v-if="downloadMenuItems.length > 0">
        <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />
        <UDropdownMenu :items="[downloadMenuItems]">
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-download"
            :class="[tbBtnBase, tbBtnIdle]"
            title="Downloads"
          />
        </UDropdownMenu>
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
              @import="handleImportRequest"
            />
          </div>
          <LayerPanel
            :layers="layers"
            :edited-layers="editedLayers"
            @toggle-visibility="toggleLayerVisibility"
            @toggle-group-visibility="toggleGroupVisibility"
            @change-color="changeLayerColor"
            @change-type="changeLayerType"
            @reorder="reorderLayers"
            @reset-layer="resetLayer"
            @rename-layer="renameLayer"
            @duplicate-layer="duplicateLayer"
            @remove-layer="removeLayer"
          />
        </template>

        <!-- Components view -->
        <ComponentPanel
          v-else
          :all-components="pnp.activeComponents.value"
          :filtered-components="pnp.filteredComponents.value"
          :selected-designator="pnp.selectedDesignator.value"
          :search-query="pnp.searchQuery.value"
          :active-filters="pnp.activeFilters.value"
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
          @toggle:filter="pnp.toggleFilter($event)"
          @clear-filters="pnp.clearFilters()"
          @update:package-mapping="pnp.setCadPackageMapping($event.cadPackage, $event.packageName)"
          @update:polarized="pnp.setPolarizedOverride($event.key, $event.polarized)"
          @select="pnp.selectComponent($event)"
          @start-set-origin="startSetOrigin"
          @start-component-align="startComponentAlign"
          @reset-origin="pnp.resetOrigin()"
          @edit="openComponentEdit($event)"
          @add-component="startAddComponent"
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
        :style="{ backgroundColor: canvasAreaBg }"
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
          :active-filter="activeFilter"
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
          :board-rotation="boardRotation"
          @pnp-click="pnp.selectComponent($event)"
          @pnp-dblclick="handlePnPDblClick"
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

        <!-- Undo toast — shown briefly after a deletion -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="translate-y-2 opacity-0"
          enter-to-class="translate-y-0 opacity-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="translate-y-0 opacity-100"
          leave-to-class="translate-y-2 opacity-0"
        >
          <div
            v-if="undoToastVisible"
            class="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3.5 py-2 rounded-lg bg-neutral-800/90 dark:bg-neutral-700/95 backdrop-blur-sm shadow-lg text-white text-xs"
          >
            <UIcon name="i-lucide-trash-2" class="text-red-400 text-sm shrink-0" />
            <span>Deletion applied</span>
            <button
              class="ml-1 px-2 py-0.5 rounded font-medium bg-white/15 hover:bg-white/25 transition-colors"
              @click="handleUndo"
            >
              Undo
            </button>
            <span class="text-[10px] text-neutral-400 ml-0.5">{{ isMac ? '⌘' : 'Ctrl+' }}Z</span>
          </div>
        </Transition>

        <CanvasControls
          :interaction="canvasInteraction"
          :view-mode="viewMode"
          @open-settings="showSettings = true"
        />
        <BoardExtents :dimensions="boardSizeMm ?? null" />
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
      :board-size-mm="boardSizeMm"
      @export="handleExportImage"
    />

    <!-- Component edit modal -->
    <ComponentEditModal
      v-model:open="showComponentEdit"
      :component="editingComponent"
      :package-options="packageOptions"
      @update:rotation="pnp.setRotationOverride($event.key, $event.rotation)"
      @reset:rotation="pnp.resetRotationOverride($event.key)"
      @toggle:dnp="pnp.toggleDnp($event)"
      @update:polarized="pnp.setPolarizedOverride($event.key, $event.polarized)"
      @update:package-mapping="pnp.setCadPackageMapping($event.cadPackage, $event.packageName)"
      @update:note="pnp.setComponentNote($event.key, $event.note)"
      @update:fields="pnp.setFieldOverride($event.key, $event)"
      @update:manual-component="pnp.updateManualComponent($event.id, $event)"
      @delete:manual-component="pnp.removeManualComponent($event)"
    />

    <!-- Overwrite confirmation modal -->
    <OverwriteConfirmModal
      v-model:open="showOverwriteModal"
      :conflicts="conflictingFileNames"
      :new-files="newImportFileNames"
      :is-zip="pendingImport?.isZip ?? false"
      @confirm="handleOverwriteConfirm"
      @cancel="handleOverwriteCancel"
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
const { getProject, getFiles, addFiles, upsertFiles, clearFiles, renameFile, removeFile, getOriginalFiles, storeOriginalFiles, renameOriginalFile, removeOriginalFile, renameProject, updateFileLayerType, updateFileContent, updateProjectOrigin, updateProjectConvention, updateProjectRotationOverrides, updateProjectDnp, updateProjectCadPackageMap, updateProjectPolarizedOverrides, updateProjectComponentNotes, updateProjectFieldOverrides, updateProjectManualComponents } = useProject()

// ── Team project support ──
const teamProjectIdRef = ref(teamProjectId)
const { currentTeamRole, currentTeamId, isAdmin: isTeamAdmin } = useTeam()

/** Resolves with the team ID once it becomes available (for async write paths). */
function waitForTeamId(): Promise<string> {
  if (currentTeamId.value) return Promise.resolve(currentTeamId.value)
  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => { stop(); reject(new Error('Team context not available')) }, 15_000)
    const stop = watch(currentTeamId, (id) => {
      if (id) { clearTimeout(timeout); stop(); resolve(id) }
    })
  })
}
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
const editHistory = useEditHistory()
const isMac = computed(() => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent))
const { backgroundColor, isLight: isBgLight } = useBackgroundColor()

// Effective canvas-area background — softer tone in realistic mode
const canvasAreaBg = computed(() =>
  viewMode.value === 'realistic'
    ? (isBgLight.value ? '#e8e8ec' : '#1a1a1e')
    : backgroundColor.value,
)
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

const prefs = useViewerPreferences(isTeamProject && teamProjectId ? teamProjectId : projectId)
const viewMode = prefs.viewMode
const activeFilter = prefs.activeFilter
const cropToOutline = prefs.cropToOutline
const hasStoredCropToOutline = prefs.hasStoredCropToOutline
const mirrored = prefs.mirrored
const boardRotation = prefs.boardRotation

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
  // Don't intercept keyboard shortcuts inside editable controls (preserve native undo, etc.)
  const target = e.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return

  // Undo: Cmd+Z (macOS) / Ctrl+Z (other) — works in any mode
  if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
    if (editHistory.canUndo.value) {
      e.preventDefault()
      handleUndo()
    }
    return
  }

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

function openComponentEdit(component: import('~/composables/usePickAndPlace').EditablePnPComponent) {
  editingComponent.value = component
  showComponentEdit.value = true
}

function startAddComponent() {
  // Generate a unique ID and an auto-incremented designator
  const id = `mc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const existingDesignators = new Set(pnp.allComponents.value.map(c => c.designator))
  let idx = 1
  while (existingDesignators.has(`M${idx}`)) idx++
  const designator = `M${idx}`

  const side: 'top' | 'bottom' = pnp.activeSideFilter.value === 'bottom' ? 'bottom' : 'top'

  const mc: import('~/composables/usePickAndPlace').ManualPnPComponent = {
    id,
    designator,
    value: '',
    package: '',
    x: 0,
    y: 0,
    rotation: 0,
    side,
  }

  // Switch to cursor mode for placement
  if (activeMode.value !== 'cursor') {
    setMode('cursor')
  }
  pnp.startPlacement(mc)
}

function handlePnPDblClick(designator: string) {
  const comp = pnp.allComponents.value.find(c => c.designator === designator)
  if (comp) openComponentEdit(comp)
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
  // Track if a placement was pending before the click
  const wasPlacing = pnp.placingComponent.value
  const completed = pnp.handleAlignClick(x, y, units)
  // After a manual component placement completes, open the edit modal
  if (completed && wasPlacing) {
    nextTick(() => {
      const placed = pnp.allComponents.value.find(c => c.designator === wasPlacing.designator)
      if (placed) openComponentEdit(placed)
    })
  }
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

// ── Original content tracking (for edit detection + reset) ──
const originalContent = new Map<string, string>()

const editedLayers = computed(() => {
  const edited = new Set<string>()
  for (const layer of layers.value) {
    const orig = originalContent.get(layer.file.fileName)
    if (orig !== undefined && orig !== layer.file.content) {
      edited.add(layer.file.fileName)
    }
  }
  return edited
})

// ── Overwrite confirmation state ──
const showOverwriteModal = ref(false)
const pendingImport = ref<{ files: GerberFile[]; sourceName: string; isZip: boolean } | null>(null)
const conflictingFileNames = ref<string[]>([])
const newImportFileNames = ref<string[]>([])

const selectedPreset = computed({
  get: () => getPresetById(prefs.presetId.value),
  set: (p: PcbPreset) => { prefs.presetId.value = p.id },
})
const boardCanvasRef = ref<any>(null)
const showSettings = ref(false)
const showPnPExport = ref(false)
const showImageExport = ref(false)
const showComponentEdit = ref(false)
const editingComponent = ref<import('~/composables/usePickAndPlace').EditablePnPComponent | null>(null)

const boardSizeMm = computed<{ width: number; height: number } | undefined>(() => {
  const canvas = boardCanvasRef.value
  if (!canvas) return undefined
  return canvas.boardDimensions ?? canvas.getExportDimensionsMm() ?? undefined
})

const downloadMenuItems = computed(() => {
  const items: { label: string; icon: string; onSelect: () => void }[] = []
  if (viewMode.value === 'realistic') {
    items.push({ label: 'Export Image', icon: 'i-lucide-image', onSelect: () => { showImageExport.value = true } })
  }
  if (layers.value.length > 0) {
    items.push({ label: 'Download Gerber', icon: 'i-lucide-file-archive', onSelect: () => { handleDownloadGerber() } })
  }
  if (pnp.hasPnP.value) {
    items.push({ label: 'Export PnP', icon: 'i-lucide-table', onSelect: () => { showPnPExport.value = true } })
  }
  return items
})

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

// Persist component notes
watch(pnp.componentNotesRecord, (notes) => {
  if (isTeamProject) {
    persistToProject({ pnpComponentNotes: notes })
  } else {
    updateProjectComponentNotes(projectId, notes)
  }
}, { deep: true })

// Persist field overrides
watch(pnp.fieldOverridesRecord, (overrides) => {
  if (isTeamProject) {
    persistToProject({ pnpFieldOverrides: overrides })
  } else {
    updateProjectFieldOverrides(projectId, overrides)
  }
}, { deep: true })

// Persist manual components
watch(pnp.manualComponentsRecord, (components) => {
  if (isTeamProject) {
    persistToProject({ pnpManualComponents: components })
  } else {
    updateProjectManualComponents(projectId, components)
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
const { getProject: getTeamProject, approveProject: doApprove, revertToDraft: doRevert, updateProject: updateTeamProject, getProjectFiles: getTeamFiles, downloadFile: downloadTeamFile, uploadFile: uploadTeamFile, deleteFile: deleteTeamFile } = useTeamProjects()

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

// ── Board rotation ──

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360
}

function rotateCW(step = 90) {
  setBoardRotation(boardRotation.value + step)
}

function rotateCCW(step = 90) {
  setBoardRotation(boardRotation.value - step)
}

function setBoardRotation(deg: number) {
  if (!isFinite(deg)) return
  boardRotation.value = normalizeAngle(Math.round(deg * 100) / 100)
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
        pnpComponentNotes: tp.pnp_component_notes,
        pnpFieldOverrides: tp.pnp_field_overrides,
        pnpManualComponents: tp.pnp_manual_components,
      }
    }
  } else {
    project.value = await getProject(projectId)
  }
  let loadedFiles: GerberFile[] = []
  if (isTeamProject && teamProjectId) {
    // Try loading files from Supabase for team projects
    const teamFiles = await getTeamFiles(teamProjectId, 1)
    if (teamFiles.length > 0) {
      const downloaded = await Promise.all(
        teamFiles.map(async (tf) => {
          const content = await downloadTeamFile(tf.storage_path)
          if (content == null) return null
          return { fileName: tf.file_name, content, layerType: tf.layer_type ?? undefined } as GerberFile
        }),
      )
      loadedFiles = downloaded.filter((f): f is GerberFile => f != null)
    }
  } else {
    loadedFiles = await getFiles(projectId, 1)
  }
  layers.value = sortLayersByPcbOrder(loadedFiles.map(f => {
    const type = f.layerType || detectLayerType(f.fileName)
    return {
      file: f,
      visible: type !== 'Unmatched',
      color: getColorForType(type),
      type,
    }
  }))

  // Load persisted original content from DB (survives page reloads)
  if (!isTeamProject) {
    const storedOriginals = await getOriginalFiles(projectId, 1)
    if (storedOriginals.size > 0) {
      // Use stored originals for layers that have them
      for (const layer of layers.value) {
        const stored = storedOriginals.get(layer.file.fileName)
        originalContent.set(layer.file.fileName, stored ?? layer.file.content)
      }
      // Store originals for any new layers not yet in the originals table
      const newLayers = layers.value.filter(l => !storedOriginals.has(l.file.fileName))
      if (newLayers.length > 0) {
        await storeOriginalFiles(projectId, 1, newLayers.map(l => ({ fileName: l.file.fileName, content: l.file.content })))
      }
    } else {
      // First load: store all current content as originals
      for (const layer of layers.value) {
        originalContent.set(layer.file.fileName, layer.file.content)
      }
      await storeOriginalFiles(projectId, 1, layers.value.map(l => ({ fileName: l.file.fileName, content: l.file.content })))
    }
  } else {
    // Team projects: in-memory only (team sync handles version tracking)
    for (const layer of layers.value) {
      originalContent.set(layer.file.fileName, layer.file.content)
    }
  }

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

  // Restore persisted component notes
  pnp.setComponentNotes(project.value?.pnpComponentNotes)

  // Restore persisted field overrides
  pnp.setFieldOverrides(project.value?.pnpFieldOverrides)

  // Restore persisted manual components
  pnp.setManualComponents(project.value?.pnpManualComponents)
})

/**
 * Entry point from ImportPanel: checks for conflicts and either imports
 * directly or shows the overwrite confirmation modal.
 */
function handleImportRequest(newFiles: GerberFile[], sourceName: string, isZip: boolean) {
  const existingNames = new Set(layers.value.map(l => l.file.fileName))
  const conflicts = newFiles.filter(f => existingNames.has(f.fileName))
  const freshFiles = newFiles.filter(f => !existingNames.has(f.fileName))

  if (conflicts.length === 0) {
    doImport(newFiles, sourceName)
    return
  }

  // Store pending import and show confirmation modal
  pendingImport.value = { files: newFiles, sourceName, isZip }
  conflictingFileNames.value = conflicts.map(f => f.fileName)
  newImportFileNames.value = freshFiles.map(f => f.fileName)
  showOverwriteModal.value = true
}

async function handleOverwriteConfirm(selectedOverwrites: string[]) {
  showOverwriteModal.value = false
  if (!pendingImport.value) return

  const { files, sourceName } = pendingImport.value
  const overwriteSet = new Set(selectedOverwrites)
  const existingNames = new Set(layers.value.map(l => l.file.fileName))

  // Import: new files + user-confirmed overwrites
  const filesToImport = files.filter(
    f => !existingNames.has(f.fileName) || overwriteSet.has(f.fileName),
  )

  pendingImport.value = null
  if (filesToImport.length > 0) {
    await doImport(filesToImport, sourceName)
  }
}

function handleOverwriteCancel() {
  showOverwriteModal.value = false
  pendingImport.value = null
}

/** Performs the actual import after any overwrite confirmation. */
async function doImport(newFiles: GerberFile[], sourceName: string) {
  const canvas = boardCanvasRef.value
  const hadExistingFiles = layers.value.length > 0
  const newFileNames = new Set(newFiles.map(f => f.fileName))

  // Invalidate cache for files being overwritten or newly added
  if (canvas) {
    for (const f of newFiles) canvas.invalidateCache(f.fileName)
  }

  // Merge into the database: overwrite same-name files, keep the rest
  if (isTeamProject && teamProjectId) {
    const teamId = currentTeamId.value || await waitForTeamId()
    const uploadResults = await Promise.all(
      newFiles.map(f => uploadTeamFile(teamProjectId, teamId, 1, f.fileName, f.content, f.layerType)),
    )
    for (const result of uploadResults) {
      if (result.error) {
        console.error('[doImport] Team file upload failed:', result.error.message ?? result.error)
      }
    }
  } else {
    await upsertFiles(projectId, 1, newFiles)
  }

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

  // Update original content for imported files (overwrite = new baseline)
  for (const f of newFiles) {
    originalContent.set(f.fileName, f.content)
  }
  if (!isTeamProject) {
    await storeOriginalFiles(projectId, 1, newFiles.map(f => ({ fileName: f.fileName, content: f.content })))
  }

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

function toggleGroupVisibility(indices: number[]) {
  const groupLayers = indices.map(i => layers.value[i]).filter(Boolean)
  const anyVisible = groupLayers.some(l => l.visible)
  for (const layer of groupLayers) {
    layer.visible = !anyVisible
  }
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
  if (isTeamProject && teamProjectId) {
    const teamId = currentTeamId.value || await waitForTeamId()
    await uploadTeamFile(teamProjectId, teamId, 1, layer.file.fileName, layer.file.content, type)
  } else {
    await updateFileLayerType(projectId, 1, layer.file.fileName, type)
  }
}

function reorderLayers(fromIndex: number, toIndex: number) {
  const arr = [...layers.value]
  const [moved] = arr.splice(fromIndex, 1)
  if (!moved) return
  arr.splice(toIndex, 0, moved)
  layers.value = arr
}

// ── Reset layer to original content ──

async function resetLayer(index: number) {
  const layer = layers.value[index]
  if (!layer) return
  const orig = originalContent.get(layer.file.fileName)
  if (orig === undefined || orig === layer.file.content) return

  // Restore in-memory content
  layer.file.content = orig

  // Persist restored content
  if (isTeamProject && teamProjectId) {
    const teamId = currentTeamId.value || await waitForTeamId()
    await uploadTeamFile(teamProjectId, teamId, 1, layer.file.fileName, orig, layer.type)
  } else {
    await updateFileContent(projectId, 1, layer.file.fileName, orig)
  }

  // Invalidate cache so the restored content gets re-parsed
  const canvas = boardCanvasRef.value
  if (canvas) canvas.invalidateCache(layer.file.fileName)

  // Force re-render
  layers.value = [...layers.value]
}

// ── Rename layer ──

async function renameLayer(index: number, newName: string) {
  const layer = layers.value[index]
  if (!layer) return
  const oldName = layer.file.fileName

  // Avoid no-op or name collision
  if (oldName === newName) return
  if (layers.value.some(l => l.file.fileName === newName)) return

  // Update in-memory
  layer.file.fileName = newName

  // Migrate original content tracking (in-memory + DB)
  const orig = originalContent.get(oldName)
  if (orig !== undefined) {
    originalContent.delete(oldName)
    originalContent.set(newName, orig)
  }
  if (!isTeamProject) {
    await renameOriginalFile(projectId, 1, oldName, newName)
  }

  // Persist to DB
  if (isTeamProject && teamProjectId) {
    const teamId = currentTeamId.value || await waitForTeamId()
    // Team: upload under new name, delete old
    await uploadTeamFile(teamProjectId, teamId, 1, newName, layer.file.content, layer.file.layerType)
    const teamFiles = await getTeamFiles(teamProjectId, 1)
    const oldRecord = teamFiles.find(tf => tf.file_name === oldName)
    if (oldRecord) await deleteTeamFile(oldRecord.id, oldRecord.storage_path)
  } else {
    await renameFile(projectId, 1, oldName, newName)
  }

  // Invalidate canvas cache for old name and trigger re-render
  const canvas = boardCanvasRef.value
  if (canvas) {
    canvas.invalidateCache(oldName)
    canvas.invalidateCache(newName)
  }
  layers.value = [...layers.value]
}

// ── Duplicate layer ──

async function duplicateLayer(index: number) {
  const layer = layers.value[index]
  if (!layer) return

  // Generate a unique copy name
  const baseName = layer.file.fileName
  const dot = baseName.lastIndexOf('.')
  const stem = dot > 0 ? baseName.slice(0, dot) : baseName
  const ext = dot > 0 ? baseName.slice(dot) : ''
  let copyName = `${stem} (copy)${ext}`
  let counter = 2
  while (layers.value.some(l => l.file.fileName === copyName)) {
    copyName = `${stem} (copy ${counter})${ext}`
    counter++
  }

  const newFile: GerberFile = {
    fileName: copyName,
    content: layer.file.content,
    layerType: layer.file.layerType,
  }

  // Persist
  if (isTeamProject && teamProjectId) {
    const teamId = currentTeamId.value || await waitForTeamId()
    await uploadTeamFile(teamProjectId, teamId, 1, copyName, newFile.content, newFile.layerType)
  } else {
    await addFiles(projectId, 1, [newFile])
  }

  // Add to layers
  const newLayer: LayerInfo = {
    file: newFile,
    visible: layer.visible,
    color: layer.color,
    type: layer.type,
  }
  layers.value = sortLayersByPcbOrder([...layers.value, newLayer])
  applyFilterVisibility(activeFilter.value)

  // Track the duplicate's content as its original
  originalContent.set(copyName, newFile.content)
  if (!isTeamProject) {
    await storeOriginalFiles(projectId, 1, [{ fileName: copyName, content: newFile.content }])
  }
}

// ── Remove layer ──

async function removeLayer(index: number) {
  const layer = layers.value[index]
  if (!layer) return

  const fileName = layer.file.fileName

  // Remove from DB
  if (isTeamProject && teamProjectId) {
    const teamFiles = await getTeamFiles(teamProjectId, 1)
    const record = teamFiles.find(tf => tf.file_name === fileName)
    if (record) await deleteTeamFile(record.id, record.storage_path)
  } else {
    await removeFile(projectId, 1, fileName)
  }

  // Remove from in-memory state + originals DB
  layers.value = layers.value.filter(l => l.file.fileName !== fileName)
  originalContent.delete(fileName)
  if (!isTeamProject) {
    await removeOriginalFile(projectId, 1, fileName)
  }

  // Invalidate canvas cache
  const canvas = boardCanvasRef.value
  if (canvas) canvas.invalidateCache(fileName)
}

// ── Delete handler ──

async function handleConfirmDelete() {
  if (!deleteTool.pendingDeletion.value) return

  const canvas = boardCanvasRef.value
  if (!canvas) return

  // Snapshot affected layer contents before mutation (for undo)
  const snapshots = new Map<string, string>()
  let totalDeleted = 0

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

    // Save pre-deletion content for undo
    snapshots.set(layer.file.fileName, layer.file.content)
    totalDeleted += pendingLayer.graphicIndices.length

    // Apply the deletion to the source text
    const newContent = removeSourceRanges(layer.file.content, sourceRanges)

    // Update in-memory content
    layer.file.content = newContent

    // Persist to storage
    if (isTeamProject && teamProjectId) {
      const teamId = currentTeamId.value || await waitForTeamId()
      await uploadTeamFile(teamProjectId, teamId, 1, layer.file.fileName, newContent, layer.type)
    } else {
      await updateFileContent(projectId, 1, layer.file.fileName, newContent)
    }

    // Invalidate the parsed tree cache so it gets re-parsed
    canvas.invalidateCache(layer.file.fileName)
  }

  // Push undo entry if anything was actually deleted
  if (snapshots.size > 0) {
    const label = `Deleted ${totalDeleted} object${totalDeleted !== 1 ? 's' : ''}`
    editHistory.pushEntry(snapshots, label)
    undoToastVisible.value = true
    if (undoToastTimer) clearTimeout(undoToastTimer)
    undoToastTimer = setTimeout(() => { undoToastVisible.value = false }, 5000)
  }

  // Clear the pending deletion
  deleteTool.cancelDeletion()

  // Force re-render by triggering reactivity
  layers.value = [...layers.value]
}

// ── Undo handler ──

const undoToastVisible = ref(false)
let undoToastTimer: ReturnType<typeof setTimeout> | undefined

onUnmounted(() => {
  if (undoToastTimer) clearTimeout(undoToastTimer)
})

async function handleUndo() {
  const entry = editHistory.popEntry()
  if (!entry) return

  const canvas = boardCanvasRef.value
  if (!canvas) return

  for (const [fileName, previousContent] of entry.snapshots) {
    const layer = layers.value.find(l => l.file.fileName === fileName)
    if (!layer) continue

    // Restore in-memory content
    layer.file.content = previousContent

    // Persist restored content
    if (isTeamProject && teamProjectId) {
      const teamId = currentTeamId.value || await waitForTeamId()
      await uploadTeamFile(teamProjectId, teamId, 1, layer.file.fileName, previousContent, layer.type)
    } else {
      await updateFileContent(projectId, 1, layer.file.fileName, previousContent)
    }

    // Invalidate cache so the restored content gets re-parsed
    canvas.invalidateCache(fileName)
  }

  // Hide the undo toast
  undoToastVisible.value = false
  if (undoToastTimer) clearTimeout(undoToastTimer)

  // Force re-render
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
  const { settings: _appSettings } = useAppSettings()
  const blob = await canvas.exportPng(_appSettings.exportDpi)
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

async function handleExportImage(options: { format: 'png' | 'svg'; componentsMode: 'none' | 'with' | 'both'; sideMode: 'top' | 'bottom' | 'both'; dpi: number }) {
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
      const blob = await canvas.exportPngForSide(side, { dpi: options.dpi, includeComponents: withComponents, components: comps, includePackages: showPackages.value })
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
