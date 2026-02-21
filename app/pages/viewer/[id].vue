<template>
  <div class="h-screen flex flex-col">
    <AppHeader
      compact
      show-performance-monitor-item
      @open-performance-monitor="showPerformanceMonitor = true"
    >
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

      <ViewerPagesTabs
        v-model="sidebarTab"
        :show-panel="effectiveShowPanel"
        :show-paste="effectiveShowPaste"
        :show-pn-p="effectiveShowPnP"
        :show-bom="effectiveShowBom"
        :show-docs="effectiveShowDocs"
        :locked-tabs="lockedTabsForNav"
      />

      <!-- Team project: Presence avatars -->
      <template v-if="isTeamProject && presentUsers.length > 0">
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

      <template #right>
        <template v-if="downloadMenuItems.length > 0">
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

        <template v-if="isTeamProject">
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
            Revert
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
      </template>
    </AppHeader>

    <ViewerControlsBar
      v-if="showControlsBar"
      v-model:view-mode="viewMode"
      v-model:active-filter="activeFilter"
      v-model:mirrored="mirrored"
      v-model:active-mode="activeMode"
      v-model:crop-to-outline="cropToOutline"
      v-model:board-rotation="boardRotation"
      v-model:panel-tab-edit-mode="panelTabEditMode"
      v-model:panel-added-routing-edit-mode="panelAddedRoutingEditMode"
      v-model:panel-show-smd-components="panelShowSmdComponents"
      v-model:panel-show-tht-components="panelShowThtComponents"
      v-model:panel-show-danger-zones="panelShowDangerZones"
      v-model:panel-danger-inset-mm="panelDangerInsetMm"
      v-model:pnp-show-dnp-highlight="pnpShowDnpHighlight"
      v-model:pnp-show-smd="pnpShowSmd"
      v-model:pnp-show-tht="pnpShowTht"
      v-model:pnp-auto-focus-on-select="pnpAutoFocusOnSelect"
      v-model:pnp-show-minimap="pnpShowMinimap"
      v-model:measure-constraint-mode="measureTool.constraintMode.value"
      :page="sidebarTab"
      :users-in-tab="isTeamProject && isCanvasPage ? presentUsersInTab(sidebarTab) : []"
      :has-outline="hasOutline"
      :layers-count="layers.length"
      :active-filter-options="activeFilterOptions"
      :panel-tab-control-enabled="panelTabControlEnabled"
      :is-locked="isCurrentTabLocked"
      :show-lock-control="isLockableTab(sidebarTab)"
      :can-toggle-lock="canToggleCurrentTabLock"
      :lock-tooltip="currentTabLockTitle"
      :toggle-lock="toggleCurrentTabLock"
      :set-view-mode="setViewMode"
      :set-filter="setFilter"
      :set-mode="setMode"
      :rotate-c-w="rotateCW"
      :rotate-c-c-w="rotateCCW"
      :set-board-rotation="setBoardRotation"
    />
    <DrawEditorBar
      v-if="activeMode === 'draw' && isCanvasPage"
      :draw="drawTool"
      :layers="layers.map(l => ({ fileName: l.file.fileName, type: l.type, color: l.color }))"
      :active-filter="activeFilter"
    />

    <div class="flex-1 flex overflow-hidden">
      <!-- Canvas pages: sidebar panels + canvas -->
      <template v-if="isCanvasPage">
        <aside
          class="border-r border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden shrink-0"
          :style="{ width: sidebarWidth + 'px' }"
        >
          <ComponentPanel
            v-if="sidebarTab === 'smd'"
            :all-components="pnp.smdActiveComponents.value"
            :filtered-components="pnp.smdFilteredComponents.value"
            :selected-designator="pnp.selectedDesignator.value"
            :search-query="pnp.searchQuery.value"
            :active-filters="pnp.activeFilters.value"
            :align-mode="pnp.alignMode.value"
            :has-origin="pnp.hasOrigin.value"
            :origin-x="pnp.originX.value"
            :origin-y="pnp.originY.value"
            :show-packages="showPackages"
            :pnp-convention="pnp.convention.value"
            :pnp-unit-override="pnp.coordUnitOverride.value"
            :package-options="packageOptions"
            :sort-state="pnpSortSmd"
            :manual-order="pnpManualOrderSmd"
            :groups="smdGroups"
            :group-assignments="pnpGroupAssignments"
            :bom-designators="bomDesignators"
            :locked="!canEditTab('smd')"
            @update:search-query="pnp.searchQuery.value = $event"
            @update:show-packages="showPackages = $event"
            @update:pnp-convention="updateConvention"
            @update:pnp-unit-override="pnp.coordUnitOverride.value = $event"
            @update:rotation="handleComponentRotationUpdate($event)"
            @reset:rotation="handleComponentResetRotation($event)"
            @toggle:dnp="handleComponentToggleDnp($event)"
            @toggle:filter="pnp.toggleFilter($event)"
            @clear-filters="pnp.clearFilters()"
            @update:package-mapping="handlePackageMapping($event)"
            @update:polarized="handleComponentPolarizedUpdate($event)"
            @update:sort-state="applySortState('smd', $event)"
            @update:manual-order="handleManualOrderUpdate('smd', $event)"
            @create:group="createGroup('smd')"
            @update:group-meta="updateGroupMeta($event)"
            @toggle:group-hidden="toggleGroupHidden($event)"
            @toggle:group-collapsed="toggleGroupCollapsed($event)"
            @delete:group="deleteGroup($event, 'smd')"
            @reorder:groups="reorderGroups('smd', $event)"
            @assign:group="assignComponentGroup($event, 'smd')"
            @select="handleComponentTableSelect($event)"
            @start-set-origin="startSetOrigin"
            @start-component-align="startComponentAlign"
            @reset-origin="handleResetOrigin"
            @edit="openComponentEdit($event)"
            @add-component="startAddComponent('smd')"
            @preview:package="previewPkgOverride = $event"
          />

          <ComponentPanel
            v-else-if="sidebarTab === 'tht'"
            :all-components="pnp.thtActiveComponents.value"
            :filtered-components="pnp.thtFilteredComponents.value"
            :selected-designator="pnp.selectedDesignator.value"
            :search-query="pnp.searchQuery.value"
            :active-filters="pnp.activeFilters.value"
            :align-mode="pnp.alignMode.value"
            :has-origin="pnp.hasOrigin.value"
            :origin-x="pnp.originX.value"
            :origin-y="pnp.originY.value"
            :show-packages="showPackages"
            :pnp-convention="pnp.convention.value"
            :pnp-unit-override="pnp.coordUnitOverride.value"
            :package-options="thtPackageOptions"
            :sort-state="pnpSortTht"
            :manual-order="pnpManualOrderTht"
            :groups="thtGroups"
            :group-assignments="pnpGroupAssignments"
            :bom-designators="bomDesignators"
            :locked="!canEditTab('tht')"
            :assembly-type-overrides="pnp.assemblyTypeOverrides.value"
            @update:search-query="pnp.searchQuery.value = $event"
            @update:show-packages="showPackages = $event"
            @update:pnp-convention="updateConvention"
            @update:pnp-unit-override="pnp.coordUnitOverride.value = $event"
            @update:rotation="handleComponentRotationUpdate($event)"
            @reset:rotation="handleComponentResetRotation($event)"
            @toggle:dnp="handleComponentToggleDnp($event)"
            @toggle:filter="pnp.toggleFilter($event)"
            @clear-filters="pnp.clearFilters()"
            @update:package-mapping="handlePackageMapping($event)"
            @update:polarized="handleComponentPolarizedUpdate($event)"
            @update:sort-state="applySortState('tht', $event)"
            @update:manual-order="handleManualOrderUpdate('tht', $event)"
            @create:group="createGroup('tht')"
            @update:group-meta="updateGroupMeta($event)"
            @toggle:group-hidden="toggleGroupHidden($event)"
            @toggle:group-collapsed="toggleGroupCollapsed($event)"
            @delete:group="deleteGroup($event, 'tht')"
            @reorder:groups="reorderGroups('tht', $event)"
            @assign:group="assignComponentGroup($event, 'tht')"
            @select="handleComponentTableSelect($event)"
            @start-set-origin="startSetOrigin"
            @start-component-align="startComponentAlign"
            @reset-origin="handleResetOrigin"
            @edit="openComponentEdit($event)"
            @add-component="startAddComponent('tht')"
            @preview:package="previewPkgOverride = $event"
            @update:assembly-type="handleAssemblyTypeUpdate($event)"
          />

          <PcbPanel
            v-else-if="sidebarTab === 'pcb'"
            :pcb-data="pcbData"
            :board-size-mm="boardSizeMm"
            :detected-layer-count="detectedLayerCount"
            :layers="layers"
            :edited-layers="editedLayers"
            :locked="!canEditTab('pcb')"
            @update:pcb-data="handlePcbDataUpdate"
            @toggle-visibility="toggleLayerVisibility"
            @toggle-group-visibility="toggleGroupVisibility"
            @change-color="changeLayerColor"
            @change-type="changeLayerType"
            @reset-layer="resetLayer"
            @rename-layer="renameLayer"
            @duplicate-layer="duplicateLayer"
            @remove-layer="removeLayer"
          />

          <PanelPanel
            v-else-if="sidebarTab === 'panel' && isPanelizedMode"
            :panel-data="panelData"
            :board-size-mm="boardSizeMm"
            :team-panel-limits="teamPanelLimits"
            :thickness-mm="pcbData?.thicknessMm ?? 1.6"
            :edge-constraints="panelEdgeConstraints"
            :locked="!canEditTab('panel')"
            @update:panel-data="handlePanelDataUpdate"
          />

          <PastePanel
            v-else-if="sidebarTab === 'paste'"
            :paste-settings="pasteSettings"
            :locked="!canEditTab('paste')"
            @update:paste-settings="pasteSettings = $event"
            @export-jpsys="showJpsysExport = true"
          />
        </aside>

        <div
          class="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
          :class="{ 'bg-primary/50': sidebarDragging }"
          @mousedown="onSidebarDragStart"
        />

        <main
          class="flex-1 min-w-0 relative outline-none"
          :class="{ 'select-none': sidebarDragging }"
          :style="{ backgroundColor: canvasAreaBg }"
          @keydown="handleKeyDown"
          @keyup="handleKeyUp"
          tabindex="0"
        >
          <div class="absolute inset-0">
            <PanelCanvas
              v-if="sidebarTab === 'panel' && isPanelizedMode"
              ref="panelCanvasRef"
              v-model:tab-edit-mode="panelTabEditMode"
              v-model:added-routing-edit-mode="panelAddedRoutingEditMode"
              :layers="renderLayers"
              :all-layers="layers"
              :interaction="canvasInteraction"
              :mirrored="mirrored"
              :active-filter="activeFilter"
              :view-mode="viewMode"
              :preset="viewMode === 'realistic' ? selectedPreset : undefined"
              :paste-settings="pasteSettings"
              :project-name="project?.name || 'Untitled'"
              :pcb-data="pcbData"
              :panel-config="panelData"
              :board-size-mm="boardSizeMm"
              :danger-zone="panelDangerZone"
              :measure="measureTool"
              :pnp-components="panelPnpComponentsForCanvas"
              :match-package="pkgLib.matchPackage"
              :match-tht-package="thtPkgLib.matchThtPackage"
              :show-packages="showPackages"
              :pnp-convention="pnp.convention.value"
              @update:panel-config="handlePanelDataUpdate"
            />
            <BoardCanvas
              v-else
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
              :draw-tool="drawTool"
              :view-mode="viewMode"
              :preset="viewMode === 'realistic' ? selectedPreset : undefined"
              :paste-settings="pasteSettings"
              :pnp-components="sidebarTab === 'pcb' || sidebarTab === 'paste' ? [] : pnpComponentsForCanvas"
              :show-dnp-highlight="pnpShowDnpHighlight"
              :selected-pnp-designator="pnp.selectedDesignator.value"
              :pnp-origin-x="pnp.originX.value"
              :pnp-origin-y="pnp.originY.value"
              :align-mode="pnp.alignMode.value"
              :align-click-a="pnp.alignClickA.value"
              :match-package="pkgLib.matchPackage"
              :match-tht-package="thtPkgLib.matchThtPackage"
              :package-library-version="packageLibraryVersion"
              :show-packages="showPackages"
              :pnp-convention="pnp.convention.value"
              :board-rotation="boardRotation"
              @pnp-click="handleCanvasComponentClick($event)"
              @pnp-dblclick="handlePnPDblClick"
              @align-click="handleAlignClick"
              @draw-commit="handleDrawCommit"
            />
            <MeasureOverlay :measure="measureTool" :transform="canvasInteraction.transform.value" />
            <DrawPreviewOverlay :draw="drawTool" :transform="canvasInteraction.transform.value" />
            <InfoOverlay v-if="sidebarTab !== 'panel'" :info="infoTool" />
            <DeleteOverlay v-if="sidebarTab !== 'panel'" :delete-tool="deleteTool" @confirm-delete="handleConfirmDelete" />

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
                <UIcon
                  :name="editHistory.lastDescription.value.startsWith('Deleted') ? 'i-lucide-trash-2' : 'i-lucide-pen-tool'"
                  :class="editHistory.lastDescription.value.startsWith('Deleted') ? 'text-red-400' : 'text-emerald-400'"
                  class="text-sm shrink-0"
                />
                <span>{{ editHistory.lastDescription.value }}</span>
                <button class="ml-1 px-2 py-0.5 rounded font-medium bg-white/15 hover:bg-white/25 transition-colors" @click="handleUndo">
                  Undo
                </button>
                <span class="text-[10px] text-neutral-400 ml-0.5">{{ isMac ? '⌘' : 'Ctrl+' }}Z</span>
              </div>
            </Transition>

            <Transition
              enter-active-class="transition-opacity duration-100 ease-out"
              enter-from-class="opacity-0"
              enter-to-class="opacity-100"
              leave-active-class="transition-opacity duration-120 ease-in"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
            >
              <div
                v-if="pnpMinimapVisible"
                class="absolute bottom-14 right-4 z-20 w-44 h-28 rounded-md border border-neutral-300/60 dark:border-neutral-700/70 bg-white/60 dark:bg-neutral-900/60 backdrop-blur-sm shadow-md overflow-hidden"
              >
                <svg
                  class="w-full h-full"
                  viewBox="0 0 176 112"
                  aria-label="PCB minimap"
                >
                  <rect x="0" y="0" width="176" height="112" fill="transparent" />
                  <g v-if="pnpMinimapOutlinePaths.length > 0" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="1.4">
                    <path
                      v-for="(d, idx) in pnpMinimapOutlinePaths"
                      :key="`mini-outline-${idx}`"
                      :d="d"
                    />
                  </g>
                  <rect
                    v-else-if="pnpMinimapModel"
                    :x="pnpMinimapModel.boardRect.x"
                    :y="pnpMinimapModel.boardRect.y"
                    :width="pnpMinimapModel.boardRect.w"
                    :height="pnpMinimapModel.boardRect.h"
                    rx="2"
                    fill="none"
                    stroke="rgba(255,255,255,0.9)"
                    stroke-width="1.4"
                  />
                  <rect
                    v-if="pnpMinimapModel"
                    :x="pnpMinimapModel.viewportRect.x"
                    :y="pnpMinimapModel.viewportRect.y"
                    :width="pnpMinimapModel.viewportRect.w"
                    :height="pnpMinimapModel.viewportRect.h"
                    fill="none"
                    stroke="#EF4444"
                    stroke-width="1.8"
                  />
                </svg>
              </div>
            </Transition>

            <CanvasControls :interaction="canvasInteraction" :view-mode="viewMode" @open-settings="showSettings = true" />
            <BoardExtents :dimensions="sidebarTab === 'panel' ? panelDimensionsMm : (boardSizeMm ?? null)" />

          </div>
        </main>
      </template>

      <!-- Files: full width, list + preview (no canvas) -->
      <template v-else-if="sidebarTab === 'files'">
        <aside
          class="shrink-0 border-r border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden"
          :style="{ width: sidebarFiles.sidebarWidth.value + 'px' }"
        >
          <div class="p-4 pb-2 border-b border-neutral-200 dark:border-neutral-800">
            <ImportPanel
              v-if="canEditTab('files')"
              :packet="1"
              @import="handleImportRequest"
              @documents="handleDocumentsAdd"
            />
            <div v-else class="text-[11px] text-neutral-400">
              Files are locked. Import is disabled.
            </div>
            <div
              v-if="importLayerWarnings.length > 0"
              class="mt-2 rounded-md border border-amber-300/70 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-500/10 p-2"
            >
              <div class="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Import checks
              </div>
              <ul class="mt-1 space-y-0.5 text-[11px] text-amber-800 dark:text-amber-200">
                <li v-for="warning in importLayerWarnings" :key="warning">
                  - {{ warning }}
                </li>
              </ul>
            </div>
          </div>
          <FilesPanel
            v-model:selected-layer-file-name="filesSelectedLayerFileName"
            v-model:selected-layer-index="filesSelectedLayerIndex"
            v-model:selected-doc-id="filesSelectedDocId"
            :layers="layers"
            :documents="documents"
            :edited-layers="editedLayers"
            :locked="!canEditTab('files')"
            @select-layer="handleFilesLayerSelect"
            @select-doc="handleFilesDocSelect"
            @change-layer-type="changeLayerType"
            @remove-layer="removeLayer"
            @rename-layer="renameLayer"
            @duplicate-layer="duplicateLayer"
            @reorder="reorderLayers"
            @download-layer="downloadLayer"
            @update-document-type="handleDocumentTypeUpdate"
            @remove-document="handleDocumentRemove"
            @download-document="downloadDocument"
          />
        </aside>

        <div
          class="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
          :class="{ 'bg-primary/50': sidebarFiles.dragging.value }"
          @mousedown="sidebarFiles.onDragStart($event)"
        />

        <main
          class="flex-1 min-w-0 overflow-hidden bg-neutral-50 dark:bg-neutral-950"
          :class="{ 'select-none': sidebarFiles.dragging.value }"
        >
          <div class="h-full flex flex-col">
            <div class="px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center gap-2">
              <template v-if="filesSelectedLayer">
                <UIcon name="i-lucide-file" class="text-sm text-blue-500 shrink-0" />
                <span class="text-xs font-medium text-neutral-700 dark:text-neutral-200 truncate">{{ filesSelectedLayer.file.fileName }}</span>
                <UBadge size="xs" variant="subtle" color="neutral" class="shrink-0">{{ filesSelectedLayer.type }}</UBadge>
                <UBadge
                  v-if="editedLayers.has(filesSelectedLayer.file.fileName)"
                  size="xs"
                  variant="subtle"
                  color="warning"
                  class="shrink-0"
                >
                  Edited
                </UBadge>
                <template v-if="isSelectedLayerImportConfigurable">
                  <div class="flex items-center gap-1.5 ml-1">
                    <span v-if="isSelectedLayerPnp" class="text-[11px] text-neutral-500 dark:text-neutral-400">Unit</span>
                    <USelect
                      v-if="isSelectedLayerPnp"
                      :model-value="selectedLayerPnpUnit"
                      :items="pnpUnitItems"
                      value-key="value"
                      label-key="label"
                      size="xs"
                      class="w-24"
                      @update:model-value="updateSelectedLayerPnpUnit($event)"
                    />
                  </div>
                </template>
                <div v-if="filesSelectedLayer" class="flex items-center gap-1 ml-1">
                  <UButton
                    v-if="canSelectedLayerUseTablePreview"
                    size="xs"
                    color="neutral"
                    :variant="filesPreviewMode === 'table' ? 'soft' : 'ghost'"
                    @click="filesPreviewMode = 'table'"
                  >
                    Table
                  </UButton>
                  <UButton
                    size="xs"
                    color="neutral"
                    :variant="filesPreviewMode === 'text' ? 'soft' : 'ghost'"
                    @click="filesPreviewMode = 'text'"
                  >
                    Text
                  </UButton>
                  <UButton
                    size="xs"
                    :color="filesPreviewMode !== 'diff' && editedLayers.has(filesSelectedLayer.file.fileName) ? 'warning' : 'neutral'"
                    :variant="filesPreviewMode === 'diff' ? 'soft' : (editedLayers.has(filesSelectedLayer.file.fileName) ? 'soft' : 'ghost')"
                    @click="filesPreviewMode = 'diff'"
                  >
                    Diff
                  </UButton>
                </div>
                <div class="flex-1" />
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-download" @click="downloadSelectedLayer">
                  Download
                </UButton>
              </template>
              <template v-else-if="filesSelectedDoc">
                <UIcon name="i-lucide-file-text" class="text-sm text-blue-500 shrink-0" />
                <span class="text-xs font-medium text-neutral-700 dark:text-neutral-200 truncate">{{ filesSelectedDoc.name }}</span>
                <UBadge size="xs" variant="subtle" color="neutral" class="shrink-0">{{ filesSelectedDoc.type }}</UBadge>
                <div class="flex-1" />
                <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-download" @click="downloadDocument(filesSelectedDoc.id)">
                  Download
                </UButton>
              </template>
              <template v-else>
                <span class="text-xs text-neutral-400">Select a file to preview</span>
              </template>
              <div class="flex-1" />
              <UPopover
                v-if="isLockableTab(sidebarTab)"
                v-model:open="filesLockPopoverOpen"
                :content="{ side: 'bottom', align: 'end', sideOffset: 6 }"
              >
                <div
                  @mouseenter="filesLockPopoverOpen = true"
                  @mouseleave="filesLockPopoverOpen = false"
                  @focusin="filesLockPopoverOpen = true"
                  @focusout="filesLockPopoverOpen = false"
                >
                  <UButton
                    size="xs"
                    :color="isCurrentTabLocked ? 'warning' : 'neutral'"
                    :variant="isCurrentTabLocked ? 'soft' : 'outline'"
                    :icon="isCurrentTabLocked ? 'i-lucide-lock' : 'i-lucide-lock-open'"
                    :disabled="!canToggleCurrentTabLock"
                    @click="toggleCurrentTabLock"
                  >
                    {{ isCurrentTabLocked ? 'Locked' : 'Unlocked' }}
                  </UButton>
                </div>
                <template #content>
                  <div class="px-2 py-1 text-[11px] text-neutral-600 dark:text-neutral-300 max-w-[20rem]">
                    {{ currentTabLockTitle }}
                  </div>
                </template>
              </UPopover>
            </div>

            <div class="flex-1 min-h-0 overflow-hidden">
              <div v-if="filesSelectedLayer" class="h-full">
                <FileTablePreview
                  v-if="canSelectedLayerUseTablePreview && filesPreviewMode === 'table'"
                  :key="`layer-${filesPreviewSelectionNonce}-${filesSelectedLayerIndex ?? 'na'}-${filesSelectedLayer.file.fileName}`"
                  :file-name="filesSelectedLayer.file.fileName"
                  :text-content="filesSelectedLayer.file.content"
                  :skip-rows="selectedLayerSkipRows"
                  :skip-bottom-rows="selectedLayerSkipBottomRows"
                  :mapping="selectedLayerMappingByField"
                  :mapping-fields="selectedLayerMappingFields"
                  :fixed-columns="selectedLayerFixedColumns"
                  :delimiter="selectedLayerDelimiter"
                  :decimal="selectedLayerDecimal"
                  :extra-columns="selectedLayerExtraColumns"
                  @update:skip-rows="updateSelectedLayerSkipRows"
                  @update:skip-bottom-rows="updateSelectedLayerSkipBottomRows"
                  @update:mapping="updateSelectedLayerMappingByField"
                  @update:fixed-columns="updateSelectedLayerFixedColumns"
                  @update:delimiter="updateSelectedLayerDelimiter"
                  @update:decimal="updateSelectedLayerDecimal"
                  @update:extra-columns="updateSelectedLayerExtraColumns"
                />
                <FileTextEditorPreview
                  v-else
                  :key="`layer-text-${filesPreviewSelectionNonce}-${filesSelectedLayer.file.fileName}`"
                  :model-value="filesSelectedLayer.file.content"
                  :original-text="selectedLayerOriginalText"
                  :editable="canEditTab('files')"
                  :mode="filesPreviewMode === 'diff' ? 'diff' : 'text'"
                  @update:model-value="updateSelectedLayerText"
                />
              </div>
              <div v-else-if="filesSelectedDoc" class="h-full">
                <FileTablePreview
                  v-if="isTabularPreviewFileName(filesSelectedDoc.name)"
                  :key="`doc-${filesSelectedDoc.id}`"
                  :file-name="filesSelectedDoc.name"
                  :blob-url="filesSelectedDoc.blobUrl"
                />
                <iframe
                  v-else
                  :src="filesSelectedDoc.blobUrl + '#toolbar=0'"
                  class="w-full h-full border-0"
                  title="Document preview"
                />
              </div>
              <div v-else class="h-full flex items-center justify-center text-sm text-neutral-400">
                No preview
              </div>
            </div>
          </div>
        </main>
      </template>

      <!-- BOM: 50/50 split (table + details), resizable -->
      <template v-else-if="sidebarTab === 'bom'">
        <div class="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div class="px-3 py-1.5 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center gap-3">
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-neutral-400">Pricing qty</span>
              <USelect
                :model-value="bom.boardQuantity.value"
                size="xs"
                class="w-28"
                :items="pricingQtySelectItems"
                value-key="value"
                label-key="label"
                :disabled="!canEditTab('bom')"
                @update:model-value="handleBomBoardQuantityUpdate(($event as number))"
              />
            </div>
            <div class="min-w-[320px] max-w-[520px] flex-1">
              <PricingQuantityTags
                :model-value="pricingQuantities"
                :locked="!canEditTab('bom')"
                @update:model-value="handlePricingQuantitiesFromBom($event)"
              />
            </div>
            <div class="flex-1" />
            <UButton
              v-if="spark.isAiEnabled.value"
              size="xs"
              color="secondary"
              :variant="spark.isEnriching.value ? 'solid' : spark.pendingSuggestionCount.value > 0 ? 'soft' : 'outline'"
              icon="i-lucide-sparkles"
              :loading="spark.isEnriching.value"
              :disabled="(bom.bomLines.value as BomLine[]).length === 0 || spark.isEnriching.value || spark.pendingSuggestionCount.value > 0 || !canEditTab('bom')"
              :title="spark.pendingSuggestionCount.value > 0 ? `Review ${spark.pendingSuggestionCount.value} pending suggestion${spark.pendingSuggestionCount.value === 1 ? '' : 's'} before running Spark again` : 'Enrich BOM with AI suggestions'"
              @click="handleSparkEnrich"
            >
              <template v-if="spark.isEnriching.value">Analyzing {{ (bom.bomLines.value as BomLine[]).filter(l => !l.dnp).length }} lines...</template>
              <template v-else>
                Spark
                <UBadge v-if="spark.pendingSuggestionCount.value > 0" size="xs" color="secondary" variant="solid" class="ml-1">{{ spark.pendingSuggestionCount.value }}</UBadge>
              </template>
            </UButton>
            <div v-if="spark.pendingSuggestionCount.value > 0" class="flex items-center gap-0.5">
              <span class="text-[10px] text-secondary-600 dark:text-secondary-400 tabular-nums px-1">{{ sparkReviewPosition }} / {{ spark.pendingSuggestionCount.value }}</span>
              <UButton
                size="xs"
                color="secondary"
                variant="ghost"
                icon="i-lucide-chevron-up"
                :disabled="spark.pendingSuggestionCount.value === 0"
                title="Previous suggestion"
                class="!p-0.5"
                @click="sparkReviewNav(-1)"
              />
              <UButton
                size="xs"
                color="secondary"
                variant="ghost"
                icon="i-lucide-chevron-down"
                :disabled="spark.pendingSuggestionCount.value === 0"
                title="Next suggestion"
                class="!p-0.5"
                @click="sparkReviewNav(1)"
              />
            </div>
            <UButton
              v-if="bomCpLines.length > 0"
              size="xs"
              :color="bomCpCopied ? 'success' : 'neutral'"
              :variant="bomCpCopied ? 'soft' : 'outline'"
              :icon="bomCpCopied ? 'i-lucide-check' : 'i-lucide-clipboard-copy'"
              :title="`Copy ${bomCpLines.length} customer-provided items to clipboard`"
              @click="copyBomCpItems"
            >
              {{ bomCpCopied ? 'Copied' : 'Copy CP List' }}
            </UButton>
            <template v-if="isTeamProject && presentUsersInTab('bom').length > 0">
              <div class="flex items-center -space-x-1" :title="presentUsersInTab('bom').map(u => u.name).join(', ')">
                <div
                  v-for="u in presentUsersInTab('bom').slice(0, 4)"
                  :key="u.userId"
                  class="size-5 rounded-full border-2 border-white dark:border-neutral-900 flex items-center justify-center text-[8px] font-bold bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"
                >
                  {{ u.name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2) }}
                </div>
                <div
                  v-if="presentUsersInTab('bom').length > 4"
                  class="size-5 rounded-full border-2 border-white dark:border-neutral-900 bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[8px] font-medium text-neutral-500 dark:text-neutral-400"
                >
                  +{{ presentUsersInTab('bom').length - 4 }}
                </div>
              </div>
            </template>
            <UPopover
              v-model:open="bomLockPopoverOpen"
              :content="{ side: 'bottom', align: 'end', sideOffset: 6 }"
            >
              <div
                @mouseenter="bomLockPopoverOpen = true"
                @mouseleave="bomLockPopoverOpen = false"
                @focusin="bomLockPopoverOpen = true"
                @focusout="bomLockPopoverOpen = false"
              >
                <UButton
                  size="xs"
                  :color="isCurrentTabLocked ? 'warning' : 'neutral'"
                  :variant="isCurrentTabLocked ? 'soft' : 'outline'"
                  :icon="isCurrentTabLocked ? 'i-lucide-lock' : 'i-lucide-lock-open'"
                  :disabled="!canToggleCurrentTabLock"
                  @click="toggleCurrentTabLock"
                >
                  {{ isCurrentTabLocked ? 'Locked' : 'Unlocked' }}
                </UButton>
              </div>
              <template #content>
                <div class="px-2 py-1 text-[11px] text-neutral-600 dark:text-neutral-300 max-w-[20rem]">
                  {{ currentTabLockTitle }}
                </div>
              </template>
            </UPopover>
          </div>
          <div ref="bomSplitEl" class="flex-1 min-h-0 min-w-0 flex overflow-hidden" :class="{ 'select-none': bomDragging }">
          <section class="shrink-0 min-h-0 min-w-[360px] overflow-hidden" :style="{ width: `${bomLeftPct}%` }">
            <BomTable
              :bom-lines="(bom.bomLines.value as BomLine[])"
              :customer-bom-lines="(bom.customerBomLines.value as BomLine[])"
              :filtered-lines="(bom.filteredLines.value as BomLine[])"
              :search-query="bom.searchQuery.value"
              :pricing-cache="(bom.pricingCache.value as any)"
              :has-credentials="elexess.hasCredentials.value"
              :is-fetching-pricing="elexess.isFetching.value"
              :pricing-queue="(elexess.pricingQueue.value as PricingQueueItem[])"
              :board-quantity="bom.boardQuantity.value"
              :team-currency="stableTeamCurrency"
              :exchange-rate="elexess.exchangeRate.value"
              :pnp-designators="pnpDesignators"
              :selected-line-id="selectedBomLineId"
              :locked="!canEditTab('bom')"
              :ai-suggestions="(spark.aiSuggestions.value as BomAiSuggestions)"
              :groups="(bom.bomGroups.value as BomGroup[])"
              @select-line="selectedBomLineId = $event"
              @update:search-query="bom.searchQuery.value = $event"
              @add-line="handleBomAddLine"
              @update-line="handleBomUpdateLine"
              @remove-line="handleBomRemoveLine"
              @add-manufacturer="handleBomAddManufacturer"
              @fetch-all-pricing="handleFetchAllPricing"
              @fetch-single-pricing="handleFetchSinglePricing"
              @add-group="handleBomAddGroup"
              @remove-group="handleBomRemoveGroup"
              @update-group="handleBomUpdateGroup"
              @assign-group="handleBomAssignGroup"
              @move-line-before="handleBomMoveLineBefore"
              @move-line-to-end="handleBomMoveLineToEnd"
            />
          </section>

          <div
            class="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
            :class="{ 'bg-primary/50': bomDragging }"
            @mousedown="onBomDragStart"
          />

          <section class="flex-1 min-h-0 min-w-0 overflow-hidden">
            <BomDetails
              :line="selectedBomLine"
              :customer-bom-lines="(bom.customerBomLines.value as BomLine[])"
              :pricing-cache="(bom.pricingCache.value as any)"
              :has-credentials="elexess.hasCredentials.value"
              :is-fetching-pricing="elexess.isFetching.value"
              :pricing-queue="(elexess.pricingQueue.value as PricingQueueItem[])"
              :board-quantity="bom.boardQuantity.value"
              :team-currency="stableTeamCurrency"
              :exchange-rate="elexess.exchangeRate.value"
              :pnp-designators="pnpDesignators"
              :locked="!canEditTab('bom')"
              :ai-suggestion="selectedBomLine ? spark.getSuggestion(selectedBomLine.id) : null"
              :groups="(bom.bomGroups.value as BomGroup[])"
              @update-line="handleBomUpdateLine"
              @remove-line="handleBomRemoveLine"
              @remove-manufacturer="handleBomRemoveManufacturer"
              @add-manufacturer="handleBomAddManufacturer"
              @fetch-all-pricing="handleFetchAllPricing"
              @fetch-single-pricing="handleFetchSinglePricing"
              @accept-ai-suggestion="handleAcceptAiSuggestion"
              @dismiss-ai-suggestion="handleDismissAiSuggestion"
              @accept-all-ai="handleAcceptAllAi"
              @dismiss-all-ai="handleDismissAllAi"
              @accept-ai-manufacturer="handleAcceptAiManufacturer"
              @dismiss-ai-manufacturer="handleDismissAiManufacturer"
              @accept-ai-group="handleAcceptAiGroup"
              @dismiss-ai-group="handleDismissAiGroup"
              @assign-group="handleBomAssignGroup"
            />
          </section>
          </div>
        </div>
      </template>

      <!-- Summary: full width (no canvas) -->
      <template v-else-if="sidebarTab === 'summary'">
        <main class="flex-1 min-w-0 overflow-hidden bg-neutral-50 dark:bg-neutral-950">
          <LazySummaryPanel
            :pcb-data="pcbData"
            :smd-components="(pnp.smdActiveComponents.value as any[])"
            :tht-components="(pnp.thtActiveComponents.value as any[])"
            :bom-lines="(bom.bomLines.value as any[])"
            :match-package="pkgLib.matchPackage"
            :match-tht-package="thtPkgLib.matchThtPackage"
            :project-name="project?.name || 'Untitled'"
            :assembly-type-overrides="pnp.assemblyTypeOverrides.value"
          />
        </main>
      </template>

      <!-- Pricing: full width (no canvas) -->
      <template v-else-if="sidebarTab === 'pricing'">
        <div class="flex-1 min-w-0 flex flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-950">
          <div class="px-3 py-1.5 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center gap-3">
            <div class="min-w-[320px] max-w-[520px] flex-1">
              <PricingQuantityTags
                :model-value="pricingQuantities"
                :locked="!canEditTab('bom')"
                @update:model-value="handlePricingQuantitiesFromPricing($event)"
              />
            </div>
            <div class="flex-1" />
            <template v-if="isTeamProject && presentUsersInTab('pricing').length > 0">
              <div class="flex items-center -space-x-1" :title="presentUsersInTab('pricing').map(u => u.name).join(', ')">
                <div
                  v-for="u in presentUsersInTab('pricing').slice(0, 4)"
                  :key="u.userId"
                  class="size-5 rounded-full border-2 border-white dark:border-neutral-900 flex items-center justify-center text-[8px] font-bold bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"
                >
                  {{ u.name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2) }}
                </div>
                <div
                  v-if="presentUsersInTab('pricing').length > 4"
                  class="size-5 rounded-full border-2 border-white dark:border-neutral-900 bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[8px] font-medium text-neutral-500 dark:text-neutral-400"
                >
                  +{{ presentUsersInTab('pricing').length - 4 }}
                </div>
              </div>
            </template>
            <UPopover
              v-model:open="bomLockPopoverOpen"
              :content="{ side: 'bottom', align: 'end', sideOffset: 6 }"
            >
              <div
                @mouseenter="bomLockPopoverOpen = true"
                @mouseleave="bomLockPopoverOpen = false"
                @focusin="bomLockPopoverOpen = true"
                @focusout="bomLockPopoverOpen = false"
              >
                <UButton
                  size="xs"
                  :color="isCurrentTabLocked ? 'warning' : 'neutral'"
                  :variant="isCurrentTabLocked ? 'soft' : 'outline'"
                  :icon="isCurrentTabLocked ? 'i-lucide-lock' : 'i-lucide-lock-open'"
                  :disabled="!canToggleCurrentTabLock"
                  @click="toggleCurrentTabLock"
                >
                  {{ isCurrentTabLocked ? 'Locked' : 'Unlocked' }}
                </UButton>
              </div>
              <template #content>
                <div class="px-2 py-1 text-[11px] text-neutral-600 dark:text-neutral-300 max-w-[20rem]">
                  {{ currentTabLockTitle }}
                </div>
              </template>
            </UPopover>
          </div>
          <main class="flex-1 min-w-0 overflow-hidden">
            <LazyPricingPanel
              :pcb-data="pcbData"
              :bom-lines="(bom.bomLines.value as BomLine[])"
              :pricing-cache="(bom.pricingCache.value as any)"
              :exchange-rate="elexess.exchangeRate.value"
              :pricing-quantities="pricingQuantities"
              :selected-quantity="pcbData?.selectedPricingQuantity ?? null"
              @update:selected-quantity="handlePricingSelectedQuantityUpdate"
            />
          </main>
        </div>
      </template>

      <!-- Docs: full width list + preview (no canvas) -->
      <template v-else-if="sidebarTab === 'docs'">
        <aside
          class="shrink-0 border-r border-neutral-200 dark:border-neutral-800 overflow-hidden"
          :style="{ width: sidebarDocs.sidebarWidth.value + 'px' }"
        >
          <DocsPanel
            :documents="documents"
            :selected-id="selectedDocumentId"
            @select="handleDocumentSelect"
          />
        </aside>

        <div
          class="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
          :class="{ 'bg-primary/50': sidebarDocs.dragging.value }"
          @mousedown="sidebarDocs.onDragStart($event)"
        />

        <main
          class="flex-1 min-w-0 overflow-hidden bg-neutral-50 dark:bg-neutral-950"
          :class="{ 'select-none': sidebarDocs.dragging.value }"
        >
          <div v-if="selectedDocument" class="h-full">
            <iframe
              :src="selectedDocument.blobUrl + '#toolbar=0'"
              class="w-full h-full border-0"
              title="Document viewer"
            />
          </div>
          <div v-else class="h-full flex items-center justify-center text-sm text-neutral-400">
            Select a document to preview
          </div>
        </main>
      </template>
    </div>

    <!-- Settings modal -->
    <AppSettingsModal v-model:open="showSettings" />
    <PerformanceMonitorModal
      v-model:open="showPerformanceMonitor"
      :snapshot="performanceSnapshot"
      @refresh="refreshPerformanceSnapshot"
    />

    <!-- PnP export modal -->
    <LazyPnPExportModal
      v-model:open="showPnPExport"
      :default-convention="pnp.convention.value"
      :components="pnp.allComponents.value"
      :project-name="project?.name || 'Untitled'"
      :has-smd="pnp.hasSmdPnP.value || pnp.smdActiveComponents.value.length > 0"
      :has-tht="pnp.hasThtPnP.value || pnp.thtActiveComponents.value.length > 0"
      @export="handleExportPnP"
    />

    <!-- JPSys export modal -->
    <LazyJetprintExportModal
      v-model:open="showJpsysExport"
      :paste-tree="activePasteTree ?? null"
      :board-width-mm="boardSizeMm?.width ?? 100"
      :board-height-mm="boardSizeMm?.height ?? 100"
      :board-rotation="boardRotation"
      :project-name="project?.name"
    />

    <!-- Image export modal -->
    <LazyImageExportModal
      v-model:open="showImageExport"
      :has-pn-p="pnp.hasPnP.value"
      :board-size-mm="imageExportTarget === 'panel' ? (panelDimensionsMm ?? undefined) : boardSizeMm"
      :svg-format-note="imageExportTarget === 'panel' ? 'Panel SVG exports embed a rasterized PNG. They preserve panel size, but scaling quality is lower and files can be larger than vector SVG.' : undefined"
      @export="handleExportImage"
    />

    <!-- Component edit modal -->
    <LazyComponentEditModal
      v-model:open="showComponentEdit"
      :component="editingComponent"
      :package-options="editingComponent?.componentType === 'tht' ? thtPackageOptions : packageOptions"
      :groups="editingComponent?.componentType === 'tht' ? thtGroups : smdGroups"
      :current-group-id="editingComponent ? (pnpGroupAssignments[editingComponent.key] ?? null) : null"
      :bom-designators="bomDesignators"
      :locked="!isTabEditAllowed"
      @update:rotation="handleComponentRotationUpdate($event)"
      @reset:rotation="handleComponentResetRotation($event)"
      @toggle:dnp="handleComponentToggleDnp($event)"
      @update:polarized="handleComponentPolarizedUpdate($event)"
      @update:package-mapping="handlePackageMapping($event)"
      @update:note="handleComponentNoteUpdate($event)"
      @update:fields="handleComponentFieldsUpdate($event)"
      @update:manual-component="handleManualComponentUpdate($event)"
      @delete:manual-component="handleDeleteManualComponent($event)"
      @delete:component="handleDeleteComponent($event)"
      @assign:group="assignEditingComponentGroup($event)"
      @preview:package="previewPkgOverride = $event"
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

    <PnPGroupModal
      v-model:open="showCreateGroupModal"
      :default-name="createGroupDefaultName"
      @create="handleCreateGroup"
    />
  </div>
</template>

<script setup lang="ts">
import type { GerberFile, LayerInfo, LayerFilter } from '~/utils/gerber-helpers'
import type { SourceRange, ImageTree, BoundingBox } from '@lib/gerber/types'
import { mergeBounds, emptyBounds, isEmpty } from '@lib/gerber/bounding-box'
import { sortLayersByPcbOrder, isTopLayer, isBottomLayer, isSharedLayer, getColorForType, isPnPLayer } from '~/utils/gerber-helpers'
import type { BomLine, BomColumnMapping, BomAiSuggestions, AiSuggestion, BomGroup } from '~/utils/bom-types'
import type { PricingQueueItem } from '~/composables/useElexessApi'
import type { ViewMode } from '~/components/viewer/BoardCanvas.vue'
import { getPresetForAppearance } from '~/utils/pcb-presets'
import type { SolderMaskColor } from '~/utils/pcb-presets'
import type { PcbThicknessMm } from '~/utils/pcb-pricing'
import type { PnPConvention } from '~/utils/pnp-conventions'
import type { PnPExportFormat, PnPExportSideMode } from '~/utils/pnp-export'
import { generatePnPExport, getPnPExportExtension, getPnPExportMimeType } from '~/utils/pnp-export'
import { removeSourceRanges } from '@lib/gerber/editor'
import {
  parseFormatFromSource,
  formatCoordinate,
  findNextApertureCode,
  generateRect,
  generateText,
  injectGerberCommands,
  mmToFileUnits,
} from '@lib/gerber/generator'
import { parseBomFile } from '~/utils/bom-parser'
import { parsePnPPreview, type PnPColumnMapping, type PnPCoordUnit } from '~/utils/pnp-parser'
import { saveBlobFile } from '~/utils/file-download'

const route = useRoute()
const rawId = route.params.id as string
const isTeamProject = rawId.startsWith('team-')
const projectId = isTeamProject ? 0 : Number(rawId) // local projects use numeric IDs
const teamProjectId = isTeamProject ? rawId.replace('team-', '') : null
const { getProject, getFiles, addFiles, upsertFiles, clearFiles, renameFile, removeFile, getOriginalFiles, storeOriginalFiles, renameOriginalFile, removeOriginalFile, renameProject, updateFileLayerType, updateFileContent, updateProjectOrigin, updateProjectConvention, updateProjectRotationOverrides, updateProjectDnp, updateProjectCadPackageMap, updateProjectPolarizedOverrides, updateProjectComponentNotes, updateProjectFieldOverrides, updateProjectManualComponents, updateProjectDeletedComponents, updateProjectSortSmd, updateProjectSortTht, updateProjectManualOrderSmd, updateProjectManualOrderTht, updateProjectComponentGroups, updateProjectGroupAssignments, updatePnpAssemblyTypes, updateBomLines, updateBomGroups, updateBomPricingCache, updateBomBoardQuantity, updatePcbData, updatePanelData, updatePasteSettings: updateLocalPasteSettings, updateLayerOrder: updateLocalLayerOrder, updateDocumentOrder: updateLocalDocumentOrder, updateBomFileImportOptions: updateLocalBomFileImportOptions, updatePnpFileImportOptions: updateLocalPnpFileImportOptions, updateProjectPreview, getDocuments, addDocument, removeDocument: removeDocumentFromDb, updateDocumentType: updateDocumentTypeInDb } = useProject()

// ── Team project support ──
const teamProjectIdRef = ref(teamProjectId)
const { currentTeam, currentTeamRole, currentTeamId, isAdmin: isTeamAdmin } = useTeam()
const stableTeamCurrency = ref<'USD' | 'EUR'>('EUR')
watch(() => currentTeam.value?.default_currency, (currency) => {
  if (currency === 'USD' || currency === 'EUR') {
    stableTeamCurrency.value = currency
  }
}, { immediate: true })

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
const presence = isTeamProject ? usePresence(teamProjectIdRef) : { presentUsers: ref([]), presentUsersInTab: () => [], updatePresence: async () => {}, updateMode: async () => {} }
const { presentUsers, presentUsersInTab, updatePresence } = presence
const projectSync = isTeamProject ? useProjectSync(teamProjectIdRef) : null
const { user } = useAuth()
const { profile } = useCurrentUser()

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

type LockableTab = 'files' | 'pcb' | 'panel' | 'paste' | 'smd' | 'tht' | 'bom'
type PageLockState = {
  locked: boolean
  locked_at: string | null
  locked_by: string | null
  locked_by_name: string | null
}
type PageLocksRecord = Partial<Record<LockableTab, PageLockState>>

const LOCKABLE_TABS: LockableTab[] = ['files', 'pcb', 'panel', 'paste', 'smd', 'tht', 'bom']

function toPageLocksSnapshot(value: PageLocksRecord | null | undefined): PageLocksRecord {
  const snapshot: PageLocksRecord = {}
  if (!value || typeof value !== 'object') return snapshot
  for (const tab of LOCKABLE_TABS) {
    const entry = value[tab]
    if (!entry || typeof entry !== 'object') continue
    snapshot[tab] = {
      locked: !!entry.locked,
      locked_at: entry.locked_at ?? null,
      locked_by: entry.locked_by ?? null,
      locked_by_name: entry.locked_by_name ?? null,
    }
  }
  return snapshot
}

function arePageLocksEqual(a: PageLocksRecord, b: PageLocksRecord): boolean {
  for (const tab of LOCKABLE_TABS) {
    const left = a[tab]
    const right = b[tab]
    if (!left && !right) continue
    if (!left || !right) return false
    if (
      left.locked !== right.locked
      || (left.locked_at ?? null) !== (right.locked_at ?? null)
      || (left.locked_by ?? null) !== (right.locked_by ?? null)
      || (left.locked_by_name ?? null) !== (right.locked_by_name ?? null)
    ) {
      return false
    }
  }
  return true
}
const pageLocksOverride = ref<PageLocksRecord | null>(null)

function isLockableTab(tab: string): tab is LockableTab {
  return LOCKABLE_TABS.includes(tab as LockableTab)
}
const canvasInteraction = useCanvasInteraction()
const measureTool = useMeasureTool()
const infoTool = useInfoTool()
const deleteTool = useDeleteTool()
const drawTool = useDrawTool()
const editHistory = useEditHistory()
const isMac = computed(() => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent))
const { backgroundColor, isLight: isBgLight } = useBackgroundColor()

// Effective canvas-area background — softer tone in realistic mode
const canvasAreaBg = computed(() =>
  viewMode.value === 'realistic'
    ? (isBgLight.value ? '#e8e8ec' : '#1a1a1e')
    : backgroundColor.value,
)
// Per-page-type sidebar widths (each persisted independently)
const sidebarFiles = useSidebarWidth('files')
const sidebarPcb = useSidebarWidth('pcb')
const sidebarPanel = useSidebarWidth('panel')
const sidebarPaste = useSidebarWidth('paste')
const sidebarSmd = useSidebarWidth('smd')
const sidebarTht = useSidebarWidth('tht')
const sidebarDocs = useSidebarWidth('docs')
const bomSplit = useBomSplitWidth()

const sidebarMap: Record<string, ReturnType<typeof useSidebarWidth>> = {
  files: sidebarFiles,
  pcb: sidebarPcb,
  panel: sidebarPanel,
  paste: sidebarPaste,
  smd: sidebarSmd,
  tht: sidebarTht,
  docs: sidebarDocs,
}
const activeSidebar = computed(() => sidebarMap[sidebarTab.value] ?? sidebarPcb)
const sidebarWidth = computed(() => activeSidebar.value.sidebarWidth.value)
const sidebarDragging = computed(() => activeSidebar.value.dragging.value)
function onSidebarDragStart(e: MouseEvent) {
  activeSidebar.value.onDragStart(e)
}

// ── Sidebar tab (Files / PCB / Panel / SMD / THT / BOM / Pricing / Docs) ──
type SidebarTab = 'files' | 'pcb' | 'panel' | 'paste' | 'smd' | 'tht' | 'bom' | 'pricing' | 'docs' | 'summary'
const VALID_TABS: SidebarTab[] = ['files', 'pcb', 'panel', 'paste', 'smd', 'tht', 'bom', 'docs', 'summary', 'pricing']

const router = useRouter()
const initialTabRaw = (route.query.tab as string) || 'files'
// Back-compat: old URLs used `tab=layers` for the Files tab.
const initialTab = initialTabRaw === 'layers' ? 'files' : initialTabRaw
const sidebarTab = ref<SidebarTab>(VALID_TABS.includes(initialTab as SidebarTab) ? initialTab as SidebarTab : 'files')
const project = ref<any>(null)

const projectPageLocks = computed<PageLocksRecord>(() => {
  const optimistic = pageLocksOverride.value
  if (optimistic && typeof optimistic === 'object') return optimistic
  const live = projectSync?.project.value?.page_locks as PageLocksRecord | null | undefined
  if (live && typeof live === 'object') return live
  const cached = (project.value?.pageLocks ?? null) as PageLocksRecord | null
  return cached && typeof cached === 'object' ? cached : {}
})

const currentTabLock = computed<PageLockState | null>(() => {
  if (!isLockableTab(sidebarTab.value)) return null
  const entry = projectPageLocks.value[sidebarTab.value]
  return entry && typeof entry === 'object' ? entry : null
})

const isCurrentTabLocked = computed(() =>
  !!(isLockableTab(sidebarTab.value) && currentTabLock.value?.locked),
)

const canToggleCurrentTabLock = computed(() =>
  isTeamProject && isLockableTab(sidebarTab.value) && canEdit.value,
)

const isTabEditAllowed = computed(() =>
  canEdit.value && !isCurrentTabLocked.value,
)

function isTabLocked(tab: LockableTab): boolean {
  return !!projectPageLocks.value[tab]?.locked
}

function canEditTab(tab: LockableTab): boolean {
  return canEdit.value && !isTabLocked(tab)
}

function ensureTabEditable(tab: LockableTab): boolean {
  if (canEditTab(tab)) return true
  return false
}

function formatLockTitle(lock: PageLockState | null): string {
  if (!lock?.locked) return 'Unlocked'
  const who = lock.locked_by_name || 'Unknown user'
  const when = lock.locked_at
    ? new Date(lock.locked_at).toLocaleString()
    : 'unknown time'
  return `Locked by ${who} at ${when}`
}

const currentTabLockTitle = computed(() => formatLockTitle(currentTabLock.value))
const lockedTabsForNav = computed(() =>
  LOCKABLE_TABS.filter(tab => isTabLocked(tab)),
)

watch(() => projectSync?.project.value?.page_locks, (next) => {
  if (!next || typeof next !== 'object') return
  const remoteSnapshot = toPageLocksSnapshot(next as PageLocksRecord)
  if (pendingLocalPageLocks && !arePageLocksEqual(remoteSnapshot, pendingLocalPageLocks)) {
    // Ignore stale realtime rows while a local lock write is still in flight.
    return
  }
  if (pendingLocalPageLocks && arePageLocksEqual(remoteSnapshot, pendingLocalPageLocks)) {
    pendingLocalPageLocks = null
  }
  if (arePageLocksEqual(remoteSnapshot, toPageLocksSnapshot(projectPageLocks.value))) return
  pageLocksOverride.value = null
  if (project.value) project.value.pageLocks = remoteSnapshot
}, { deep: true })

watch(() => projectSync?.project.value?.paste_settings, (next) => {
  if (!next || typeof next !== 'object') return
  const mergedRemote = { ...pasteSettings.value, ...next }
  const remoteSnapshot = toPasteSettingsSnapshot(mergedRemote)
  if (pendingLocalPasteSettings && !arePasteSettingsEqual(remoteSnapshot, pendingLocalPasteSettings)) {
    // Ignore stale realtime rows while a local paste-settings write is still in flight.
    return
  }
  if (pendingLocalPasteSettings && arePasteSettingsEqual(remoteSnapshot, pendingLocalPasteSettings)) {
    pendingLocalPasteSettings = null
  }
  if (arePasteSettingsEqual(remoteSnapshot, toPasteSettingsSnapshot(pasteSettings.value))) return
  pasteSettings.value = mergedRemote
}, { deep: true })

watch(() => projectSync?.project.value?.layer_order, (next) => {
  if (!isStringArray(next)) return
  layerOrder.value = [...next]
  layers.value = applyLayerOrder(layers.value)
  syncLayerOrderFromLayers()
}, { deep: true })

watch(() => projectSync?.project.value?.document_order, (next) => {
  if (!isStringArray(next)) return
  documentOrder.value = [...next]
  documents.value = applyDocumentOrder(documents.value)
  syncDocumentOrderFromDocuments()
}, { deep: true })

watch(() => projectSync?.project.value?.pnp_file_import_options, (next) => {
  const remoteSnapshot = toPnpImportOptionsSnapshot(next)
  if (hasImportOptions(remoteSnapshot)) saveTeamImportOptionsBackup('pnp', remoteSnapshot)
  if (pendingLocalPnpFileImportOptions && !arePnpImportOptionsEqual(remoteSnapshot, pendingLocalPnpFileImportOptions)) {
    // Ignore stale realtime rows while a local write is still in flight.
    return
  }
  if (pendingLocalPnpFileImportOptions && arePnpImportOptionsEqual(remoteSnapshot, pendingLocalPnpFileImportOptions)) {
    pendingLocalPnpFileImportOptions = null
  }
  if (!hasImportOptions(remoteSnapshot) && hasImportOptions(toPnpImportOptionsSnapshot(pnp.fileImportOptions.value))) {
    // Defensive guard: never wipe in-memory mappings from an empty realtime payload.
    return
  }
  if (arePnpImportOptionsEqual(remoteSnapshot, toPnpImportOptionsSnapshot(pnp.fileImportOptions.value))) return
  pnp.setFileImportOptionsMap(remoteSnapshot)
}, { deep: true })

watch(() => projectSync?.project.value?.bom_file_import_options, (next) => {
  const remoteSnapshot = toBomImportOptionsSnapshot(next)
  if (hasImportOptions(remoteSnapshot)) saveTeamImportOptionsBackup('bom', remoteSnapshot)
  if (pendingLocalBomFileImportOptions && !areBomImportOptionsEqual(remoteSnapshot, pendingLocalBomFileImportOptions)) {
    // Ignore stale realtime rows while a local write is still in flight.
    return
  }
  if (pendingLocalBomFileImportOptions && areBomImportOptionsEqual(remoteSnapshot, pendingLocalBomFileImportOptions)) {
    pendingLocalBomFileImportOptions = null
  }
  if (!hasImportOptions(remoteSnapshot) && hasImportOptions(toBomImportOptionsSnapshot(bom.fileImportOptions.value))) {
    // Defensive guard: never wipe in-memory mappings from an empty realtime payload.
    return
  }
  if (areBomImportOptionsEqual(remoteSnapshot, toBomImportOptionsSnapshot(bom.fileImportOptions.value))) return
  bom.setFileImportOptionsMap(remoteSnapshot)
}, { deep: true })

watch(() => projectSync?.project.value?.pcb_data, (next) => {
  const remoteSnapshot = toPcbDataSnapshot(next)
  if (pendingLocalPcbData && !arePcbDataEqual(remoteSnapshot, pendingLocalPcbData)) {
    // Ignore stale realtime rows while a local write is still in flight.
    return
  }
  if (pendingLocalPcbData && arePcbDataEqual(remoteSnapshot, pendingLocalPcbData)) {
    pendingLocalPcbData = null
  }
  if (arePcbDataEqual(remoteSnapshot, toPcbDataSnapshot(pcbData.value))) return
  pcbData.value = remoteSnapshot
}, { deep: true })

onMounted(() => {
  const raw = new URLSearchParams(window.location.search).get('tab') || 'files'
  const clientTab = raw === 'layers' ? 'files' : raw
  if (VALID_TABS.includes(clientTab as SidebarTab) && clientTab !== sidebarTab.value) {
    sidebarTab.value = clientTab as SidebarTab
  }
})

// Sync sidebar tab and selected file to URL query parameters
watch(sidebarTab, (tab) => {
  const query = { ...route.query }
  // Keep URLs clean for first-load defaults, but persist an explicit "layers" tab
  // once the user is already using the `tab` query param (so reload preserves Files).
  if (tab === 'files') {
    if (route.query.tab) query.tab = 'files'
    else delete query.tab
    if (filesSelectedLayerFileName.value) query.file = filesSelectedLayerFileName.value
    else delete query.file
  } else {
    query.tab = tab
    delete query.file
  }
  router.replace({ query })
})

// Presence: update viewing vs editing mode and current tab when switching
watch(sidebarTab, (tab) => {
  const editableTabs = ['bom', 'smd', 'tht', 'paste', 'panel']
  updatePresence(editableTabs.includes(tab) ? 'editing' : 'viewing', tab)
}, { immediate: true })

const isCanvasPage = computed(() => {
  return sidebarTab.value === 'pcb' || sidebarTab.value === 'panel' || sidebarTab.value === 'paste' || sidebarTab.value === 'smd' || sidebarTab.value === 'tht'
})

const showControlsBar = isCanvasPage

// ── Panel-only edit modes (moved into Controls bar) ──
type PanelTabEditMode = 'off' | 'move' | 'add' | 'delete'
type PanelAddedRoutingEditMode = 'off' | 'add' | 'move' | 'delete'

const panelTabEditMode = ref<PanelTabEditMode>('off')
const panelAddedRoutingEditMode = ref<PanelAddedRoutingEditMode>('off')

function panelHasAnyRoutedSeparation(cfg: PanelConfig): boolean {
  if (cfg.separationType === 'routed') return true
  if (cfg.separationType === 'scored') return false
  return cfg.edges.top.type === 'routed'
    || cfg.edges.bottom.type === 'routed'
    || cfg.edges.left.type === 'routed'
    || cfg.edges.right.type === 'routed'
}

const panelTabControlEnabled = computed(() => {
  return panelHasAnyRoutedSeparation(panelData.value)
})

watch(sidebarTab, (tab) => {
  if (tab !== 'panel') {
    panelTabEditMode.value = 'off'
    panelAddedRoutingEditMode.value = 'off'
  }
  if (tab === 'smd') {
    pnpShowSmd.value = true
    pnpShowTht.value = false
  } else if (tab === 'tht') {
    pnpShowSmd.value = false
    pnpShowTht.value = true
  }
})

watch(isCurrentTabLocked, (locked) => {
  if (!locked) return
  panelTabEditMode.value = 'off'
  panelAddedRoutingEditMode.value = 'off'
  if (activeMode.value === 'delete') setMode('cursor')
})

// Toolbar button styling (outline + blue active border)
const tbBtnBase =
  '!rounded-md !px-2.5 !py-1 !text-xs !font-medium !border !shadow-none !transition-colors'
const tbBtnIdle =
  '!border-transparent hover:!border-neutral-300/80 hover:!bg-neutral-200/70 ' +
  'dark:!text-neutral-200 dark:hover:!bg-neutral-800/70 dark:hover:!border-neutral-600/70'
// ── Persisted per-project preferences ──

const prefs = useViewerPreferences(isTeamProject && teamProjectId ? teamProjectId : projectId)
const viewMode = prefs.viewMode
const activeFilter = prefs.activeFilter
const cropToOutline = prefs.cropToOutline
const hasStoredCropToOutline = prefs.hasStoredCropToOutline
const mirrored = prefs.mirrored
const boardRotation = prefs.boardRotation
const pasteSettings = prefs.pasteSettings
const pnpUnitOverride = prefs.pnpUnitOverride
const cachedTabVisibility = prefs.tabVisibility

function toPasteSettingsSnapshot(settings: typeof pasteSettings.value) {
  return {
    mode: settings.mode,
    dotDiameter: settings.dotDiameter,
    dotSpacing: settings.dotSpacing,
    pattern: settings.pattern,
    dynamicDots: settings.dynamicDots,
    highlightDots: settings.highlightDots,
    showJetPath: settings.showJetPath,
  }
}

function arePasteSettingsEqual(
  a: ReturnType<typeof toPasteSettingsSnapshot>,
  b: ReturnType<typeof toPasteSettingsSnapshot>,
): boolean {
  return (
    a.mode === b.mode
    && a.dotDiameter === b.dotDiameter
    && a.dotSpacing === b.dotSpacing
    && a.pattern === b.pattern
    && a.dynamicDots === b.dynamicDots
    && a.highlightDots === b.highlightDots
  )
}

type PcbDataSnapshot = {
  sizeX?: number
  sizeY?: number
  layerCount?: number
  material?: 'FR4' | 'IMS-AL' | 'Flex' | 'Rigid-Flex'
  surfaceFinish?: 'ENIG' | 'HAL' | 'OSP'
  copperWeight?: '1oz' | '2oz'
  innerCopperWeight?: '0.5oz' | '1oz' | '2oz'
  thicknessMm?: PcbThicknessMm
  solderMaskColor?: SolderMaskColor
  panelizationMode?: 'single' | 'panelized'
  pricingQuantities?: number[]
  selectedPricingQuantity?: number
}

function toPcbDataSnapshot(data: unknown): PcbDataSnapshot | null {
  if (!data || typeof data !== 'object') return null
  const raw = toRaw(data) as Record<string, unknown>
  const numberOrUndefined = (value: unknown) => {
    if (value == null) return undefined
    if (typeof value === 'string' && value.trim() === '') return undefined
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }
  const out: PcbDataSnapshot = {
    sizeX: numberOrUndefined(raw.sizeX),
    sizeY: numberOrUndefined(raw.sizeY),
    layerCount: numberOrUndefined(raw.layerCount),
    material: raw.material === 'FR4' || raw.material === 'IMS-AL' || raw.material === 'Flex' || raw.material === 'Rigid-Flex'
      ? raw.material
      : undefined,
    surfaceFinish: raw.surfaceFinish === 'ENIG' || raw.surfaceFinish === 'HAL' || raw.surfaceFinish === 'OSP'
      ? raw.surfaceFinish
      : undefined,
    copperWeight: raw.copperWeight === '1oz' || raw.copperWeight === '2oz'
      ? raw.copperWeight
      : undefined,
    innerCopperWeight: raw.innerCopperWeight === '0.5oz' || raw.innerCopperWeight === '1oz' || raw.innerCopperWeight === '2oz'
      ? raw.innerCopperWeight
      : undefined,
    thicknessMm: raw.thicknessMm === 0.6
      || raw.thicknessMm === 0.8
      || raw.thicknessMm === 1.0
      || raw.thicknessMm === 1.2
      || raw.thicknessMm === 1.6
      || raw.thicknessMm === 2.0
      ? raw.thicknessMm
      : undefined,
    solderMaskColor: raw.solderMaskColor === 'green'
      || raw.solderMaskColor === 'black'
      || raw.solderMaskColor === 'blue'
      || raw.solderMaskColor === 'red'
      || raw.solderMaskColor === 'white'
      || raw.solderMaskColor === 'purple'
      || raw.solderMaskColor === 'brown'
      ? raw.solderMaskColor
      : undefined,
    panelizationMode: raw.panelizationMode === 'panelized' ? 'panelized' : (raw.panelizationMode === 'single' ? 'single' : undefined),
    pricingQuantities: Array.isArray(raw.pricingQuantities)
      ? raw.pricingQuantities
        .map(v => Number(v))
        .filter(v => Number.isFinite(v))
      : undefined,
    selectedPricingQuantity: numberOrUndefined(raw.selectedPricingQuantity),
  }
  return out
}

function arePcbDataEqual(a: PcbDataSnapshot | null, b: PcbDataSnapshot | null): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

type BomImportOptionEntry = {
  skipRows?: number
  skipBottomRows?: number
  mapping?: BomColumnMapping
  fixedColumns?: number[]
  delimiter?: ',' | ';' | '\t' | 'fixed'
  decimal?: '.' | ','
  extraColumns?: string[]
}
type PnpImportOptionEntry = {
  skipRows?: number
  skipBottomRows?: number
  mapping?: PnPColumnMapping
  unitOverride?: 'auto' | PnPCoordUnit
  fixedColumns?: number[]
  delimiter?: ',' | ';' | '\t' | 'fixed'
  decimal?: '.' | ','
}
type BomImportOptionsSnapshot = Record<string, BomImportOptionEntry>
type PnpImportOptionsSnapshot = Record<string, PnpImportOptionEntry>

function hasImportOptions(snapshot: Record<string, unknown>): boolean {
  return Object.keys(snapshot).length > 0
}

function teamImportOptionsBackupKey(kind: 'bom' | 'pnp'): string | null {
  if (!import.meta.client || !isTeamProject || !teamProjectId) return null
  return `viewer:${teamProjectId}:import-options:${kind}`
}

function loadTeamImportOptionsBackup(kind: 'bom' | 'pnp'): unknown {
  const key = teamImportOptionsBackupKey(kind)
  if (!key) return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveTeamImportOptionsBackup(kind: 'bom' | 'pnp', snapshot: Record<string, unknown>) {
  const key = teamImportOptionsBackupKey(kind)
  if (!key || !hasImportOptions(snapshot)) return
  try {
    localStorage.setItem(key, JSON.stringify(snapshot))
  } catch {
    // Ignore quota/serialization failures; remote DB is still the source of truth.
  }
}

function sanitizeFixedColumns(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined
  const next = [...new Set(value
    .map(v => Number(v))
    .filter(v => Number.isFinite(v))
    .map(v => Math.max(1, Math.floor(v))))]
    .sort((a, b) => a - b)
  return next.length ? next : undefined
}

function sanitizeDelimiter(value: unknown): ',' | ';' | '\t' | 'fixed' | undefined {
  if (value === ',' || value === ';' || value === '\t' || value === 'fixed') return value
  return undefined
}

function sanitizeDecimal(value: unknown): '.' | ',' | undefined {
  if (value === '.' || value === ',') return value
  return undefined
}

function sanitizeExtraColumns(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  return out.length > 0 ? out : undefined
}

function normalizeImportKey(name: string): string {
  return name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/g, '')
}

function hasEquivalentImportKey(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase() || normalizeImportKey(a) === normalizeImportKey(b)
}

function buildCanonicalImportOptionMap<T>(
  currentMap: Record<string, T>,
  activeFileName: string,
  nextOptions: T,
): Record<string, T> {
  const nextMap: Record<string, T> = {
    ...currentMap,
    [activeFileName]: nextOptions,
  }
  for (const key of Object.keys(nextMap)) {
    if (key === activeFileName) continue
    if (hasEquivalentImportKey(key, activeFileName)) delete nextMap[key]
  }
  return nextMap
}

function toBomImportOptionsSnapshot(input: unknown): BomImportOptionsSnapshot {
  if (!input || typeof input !== 'object') return {}
  const out: BomImportOptionsSnapshot = {}
  for (const [fileName, opts] of Object.entries(toRaw(input) as Record<string, unknown>)) {
    if (!opts || typeof opts !== 'object') continue
    const rawOpts = toRaw(opts) as Record<string, unknown>
    const skipRows = Number(rawOpts.skipRows)
    const skipBottomRows = Number(rawOpts.skipBottomRows)
    const mappingRaw = rawOpts.mapping
    let mapping: BomColumnMapping | undefined
    if (mappingRaw && typeof mappingRaw === 'object') {
      const mapOut: Record<string, number> = {}
      for (const [k, v] of Object.entries(toRaw(mappingRaw) as Record<string, unknown>)) {
        const n = Number(v)
        if (Number.isFinite(n)) mapOut[k] = n
      }
      mapping = mapOut as BomColumnMapping
    }
    out[fileName] = {
      skipRows: Number.isFinite(skipRows) ? Math.max(0, Math.floor(skipRows)) : undefined,
      skipBottomRows: Number.isFinite(skipBottomRows) ? Math.max(0, Math.floor(skipBottomRows)) : undefined,
      mapping,
      fixedColumns: sanitizeFixedColumns(rawOpts.fixedColumns),
      delimiter: sanitizeDelimiter(rawOpts.delimiter),
      decimal: sanitizeDecimal(rawOpts.decimal),
      extraColumns: sanitizeExtraColumns(rawOpts.extraColumns),
    }
  }
  return out
}

function toPnpImportOptionsSnapshot(input: unknown): PnpImportOptionsSnapshot {
  if (!input || typeof input !== 'object') return {}
  const out: PnpImportOptionsSnapshot = {}
  for (const [fileName, opts] of Object.entries(toRaw(input) as Record<string, unknown>)) {
    if (!opts || typeof opts !== 'object') continue
    const rawOpts = toRaw(opts) as Record<string, unknown>
    const skipRows = Number(rawOpts.skipRows)
    const skipBottomRows = Number(rawOpts.skipBottomRows)
    const mappingRaw = rawOpts.mapping
    let mapping: PnPColumnMapping | undefined
    if (mappingRaw && typeof mappingRaw === 'object') {
      const mapOut: Record<string, number> = {}
      for (const [k, v] of Object.entries(toRaw(mappingRaw) as Record<string, unknown>)) {
        const n = Number(v)
        if (Number.isFinite(n)) mapOut[k] = n
      }
      mapping = mapOut as PnPColumnMapping
    }
    const unitOverride = rawOpts.unitOverride === 'auto' || rawOpts.unitOverride === 'mm' || rawOpts.unitOverride === 'mils' || rawOpts.unitOverride === 'inches'
      ? rawOpts.unitOverride
      : undefined
    out[fileName] = {
      skipRows: Number.isFinite(skipRows) ? Math.max(0, Math.floor(skipRows)) : undefined,
      skipBottomRows: Number.isFinite(skipBottomRows) ? Math.max(0, Math.floor(skipBottomRows)) : undefined,
      mapping,
      unitOverride,
      fixedColumns: sanitizeFixedColumns(rawOpts.fixedColumns),
      delimiter: sanitizeDelimiter(rawOpts.delimiter),
      decimal: sanitizeDecimal(rawOpts.decimal),
    }
  }
  return out
}

function areBomImportOptionsEqual(a: BomImportOptionsSnapshot, b: BomImportOptionsSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function arePnpImportOptionsEqual(a: PnpImportOptionsSnapshot, b: PnpImportOptionsSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// ── Interaction mode management ──

type InteractionMode = 'cursor' | 'measure' | 'info' | 'delete' | 'draw'

const activeMode = prefs.activeMode

const modeOptions: { label: string; value: InteractionMode; icon: string; title: string }[] = [
  { label: 'Cursor', value: 'cursor', icon: 'i-lucide-mouse-pointer', title: 'Default cursor mode' },
  { label: 'Measure', value: 'measure', icon: 'i-lucide-ruler', title: 'Measure distance between points' },
  { label: 'Info', value: 'info', icon: 'i-lucide-info', title: 'Inspect objects at click position' },
  { label: 'Delete', value: 'delete', icon: 'i-lucide-eraser', title: 'Select and delete objects from Gerber files' },
  { label: 'Draw', value: 'draw', icon: 'i-lucide-pen-tool', title: 'Draw shapes on a Gerber layer' },
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
  if (activeMode.value === 'draw') {
    drawTool.active.value = false
    drawTool.clear()
  }
  activeMode.value = mode
  // Activate new tool
  if (mode === 'measure') measureTool.active.value = true
  if (mode === 'info') infoTool.active.value = true
  if (mode === 'delete') deleteTool.active.value = true
  if (mode === 'draw') drawTool.active.value = true
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
watch(() => drawTool.active.value, (isActive) => {
  if (!isActive && activeMode.value === 'draw') {
    activeMode.value = 'cursor'
  }
})
watch(activeFilter, (filter) => {
  if (filter === 'all') drawTool.cancelQuickPlacement()
})

// Panel view does not support info/delete tools; fall back to cursor.
watch(sidebarTab, (tab) => {
  if (tab !== 'docs' && selectedDocumentId.value) {
    selectedDocumentId.value = null
  }
  if (tab === 'docs' && !selectedDocumentId.value && documents.value.length) {
    selectedDocumentId.value = documents.value[0].id
  }
  if (tab === 'panel' && (activeMode.value === 'info' || activeMode.value === 'delete' || activeMode.value === 'draw')) {
    setMode('cursor')
  }
  if (tab === 'paste' && activeMode.value === 'draw') {
    setMode('cursor')
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
  } else if (activeMode.value === 'draw') {
    drawTool.handleKeyDown(e)
  }
}

function handlePackageMapping(payload: { cadPackage: string; packageName: string | null; componentKey?: string; isManual?: boolean }) {
  if (isCurrentTabLocked.value) return
  if (payload.isManual && payload.componentKey) {
    const manualId = payload.componentKey.replace(/^manual\|/, '')
    pnp.updateManualComponent(manualId, { package: payload.packageName ?? '' })
  }
  if (payload.cadPackage?.trim()) {
    pnp.setCadPackageMapping(payload.cadPackage, payload.packageName)
  }
}

function openComponentEdit(component: import('~/composables/usePickAndPlace').EditablePnPComponent) {
  editingComponent.value = component
  showComponentEdit.value = true
}

function startAddComponent(componentType: import('~/composables/usePickAndPlace').ComponentType = 'smd') {
  if (!ensureTabEditable(componentType)) return
  // Generate a unique ID and an auto-incremented designator
  const id = `mc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const existingDesignators = new Set(pnp.allComponents.value.map(c => c.designator))
  const prefix = componentType === 'tht' ? 'T' : 'M'
  let idx = 1
  while (existingDesignators.has(`${prefix}${idx}`)) idx++
  const designator = `${prefix}${idx}`

  const side: 'top' | 'bottom' = pnp.activeSideFilter.value === 'bottom' ? 'bottom' : 'top'

  const mc: import('~/composables/usePickAndPlace').ManualPnPComponent = {
    id,
    designator,
    value: '',
    description: '',
    package: '',
    x: 0,
    y: 0,
    rotation: 0,
    side,
    componentType,
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

function handleComponentTableSelect(designator: string | null) {
  pnpSelectionSource.value = 'table'
  pnp.selectComponent(designator)
}

function handleCanvasComponentClick(designator: string | null) {
  pnpSelectionSource.value = 'canvas'
  pnp.selectComponent(designator)
}

function startSetOrigin() {
  if (!ensureTabEditable(sidebarTab.value === 'tht' ? 'tht' : 'smd')) return
  // Switch to cursor mode to allow canvas clicking
  if (activeMode.value !== 'cursor') {
    setMode('cursor')
  }
  pnp.startSettingOrigin()
}

function startComponentAlign() {
  if (!ensureTabEditable(sidebarTab.value === 'tht' ? 'tht' : 'smd')) return
  if (!pnp.selectedComponent.value) return
  // Switch to cursor mode to allow canvas clicking
  if (activeMode.value !== 'cursor') {
    setMode('cursor')
  }
  pnp.startComponentAlign(pnp.selectedComponent.value)
}

function handleComponentRotationUpdate(payload: { key: string; rotation: number }) {
  if (!ensureTabEditable(sidebarTab.value === 'tht' ? 'tht' : 'smd')) return
  pnp.setRotationOverride(payload.key, payload.rotation)
}

function handleComponentResetRotation(payload: { key: string } | string) {
  if (!ensureTabEditable(sidebarTab.value === 'tht' ? 'tht' : 'smd')) return
  const key = typeof payload === 'string' ? payload : payload.key
  pnp.resetRotationOverride(key)
}

function handleComponentToggleDnp(key: string) {
  if (!ensureTabEditable(sidebarTab.value === 'tht' ? 'tht' : 'smd')) return
  pnp.toggleDnp(key)
}

function handleResetOrigin() {
  if (!ensureTabEditable(sidebarTab.value === 'tht' ? 'tht' : 'smd')) return
  pnp.resetOrigin()
}

function handleComponentPolarizedUpdate(payload: { key: string; polarized: boolean }) {
  if (!ensureTabEditable(sidebarTab.value === 'tht' ? 'tht' : 'smd')) return
  pnp.setPolarizedOverride(payload.key, payload.polarized)
}

function handleComponentNoteUpdate(payload: { key: string; note: string }) {
  if (!ensureTabEditable(sidebarTab.value === 'tht' ? 'tht' : 'smd')) return
  pnp.setComponentNote(payload.key, payload.note)
}

function handleAssemblyTypeUpdate(payload: { key: string; type: string | undefined }) {
  if (!ensureTabEditable('tht')) return
  pnp.setAssemblyType(payload.key, payload.type as any)
}

function handleComponentFieldsUpdate(payload: { key: string; designator?: string; value?: string; description?: string; x?: number; y?: number }) {
  if (!ensureTabEditable(sidebarTab.value === 'tht' ? 'tht' : 'smd')) return
  pnp.setFieldOverride(payload.key, payload)
}

function handleManualComponentUpdate(payload: { id: string; [key: string]: any }) {
  if (!ensureTabEditable(sidebarTab.value === 'tht' ? 'tht' : 'smd')) return
  pnp.updateManualComponent(payload.id, payload)
}

function handleDeleteManualComponent(id: string) {
  if (!ensureTabEditable(sidebarTab.value === 'tht' ? 'tht' : 'smd')) return
  pnp.removeManualComponent(id)
}

function handleDeleteComponent(key: string) {
  if (!ensureTabEditable(sidebarTab.value === 'tht' ? 'tht' : 'smd')) return
  pnp.deleteComponent(key)
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

interface MinimapBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function hasValidBounds(b: number[] | undefined): b is [number, number, number, number] {
  if (!b || b.length < 4) return false
  const [minX, minY, maxX, maxY] = b
  return Number.isFinite(minX) && Number.isFinite(minY) && Number.isFinite(maxX) && Number.isFinite(maxY)
    && maxX > minX && maxY > minY
}

const pnpMinimapBounds = computed<MinimapBounds | null>(() => {
  const canvas = boardCanvasRef.value
  if (!canvas || layers.value.length === 0) return null

  const outlineLayer = layers.value.find(l => l.type === 'Outline')
    ?? layers.value.find(l => l.type === 'Keep-Out')
  if (outlineLayer) {
    const outlineTree = canvas.getImageTree(outlineLayer)
    const ob = outlineTree?.bounds as number[] | undefined
    if (outlineTree && outlineTree.children.length > 0 && hasValidBounds(ob)) {
      return { minX: ob[0], minY: ob[1], maxX: ob[2], maxY: ob[3] }
    }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const layer of layers.value) {
    const tree = canvas.getImageTree(layer)
    const b = tree?.bounds as number[] | undefined
    if (!tree || tree.children.length === 0 || !hasValidBounds(b)) continue
    minX = Math.min(minX, b[0])
    minY = Math.min(minY, b[1])
    maxX = Math.max(maxX, b[2])
    maxY = Math.max(maxY, b[3])
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null
  return { minX, minY, maxX, maxY }
})

const pnpMinimapOutlineTree = computed<ImageTree | null>(() => {
  const canvas = boardCanvasRef.value
  if (!canvas) return null
  const outlineSrc = layers.value.find(l => l.type === 'Outline')
    ?? layers.value.find(l => l.type === 'Keep-Out')
  if (!outlineSrc) return null
  const tree = canvas.getImageTree(outlineSrc) as ImageTree | null
  if (!tree || tree.children.length === 0) return null
  const b = tree.bounds as number[] | undefined
  if (!hasValidBounds(b)) return null
  return tree
})

const pnpMinimapModel = computed<{
  mapW: number
  mapH: number
  fit: number
  minX: number
  maxY: number
  drawX: number
  drawY: number
  boardRect: { x: number; y: number; w: number; h: number }
  viewportRect: { x: number; y: number; w: number; h: number }
} | null>(() => {
  const bounds = pnpMinimapBounds.value
  if (!bounds) return null

  const canvasEl = boardCanvasRef.value?.getCanvas?.() as HTMLCanvasElement | null | undefined
  if (!canvasEl) return null

  const vw = canvasEl.clientWidth || canvasEl.width
  const vh = canvasEl.clientHeight || canvasEl.height
  if (!vw || !vh) return null

  const scale = canvasInteraction.transform.value.scale
  if (!Number.isFinite(scale) || scale <= 0) return null
  const offX = canvasInteraction.transform.value.offsetX
  const offY = canvasInteraction.transform.value.offsetY

  const viewLeft = (0 - offX) / scale
  const viewRight = (vw - offX) / scale
  const viewTop = offY / scale
  const viewBottom = (offY - vh) / scale

  const mapW = 176
  const mapH = 112
  const pad = 8
  const availableW = mapW - pad * 2
  const availableH = mapH - pad * 2
  const boardW = Math.max(1e-9, bounds.maxX - bounds.minX)
  const boardH = Math.max(1e-9, bounds.maxY - bounds.minY)
  const fit = Math.min(availableW / boardW, availableH / boardH)
  const drawW = boardW * fit
  const drawH = boardH * fit
  const drawX = (mapW - drawW) / 2
  const drawY = (mapH - drawH) / 2

  const nx = (x: number) => drawX + (x - bounds.minX) * fit
  const ny = (y: number) => drawY + (bounds.maxY - y) * fit
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

  const vx0 = clamp(nx(Math.min(viewLeft, viewRight)), drawX, drawX + drawW)
  const vx1 = clamp(nx(Math.max(viewLeft, viewRight)), drawX, drawX + drawW)
  const vy0 = clamp(ny(Math.max(viewTop, viewBottom)), drawY, drawY + drawH)
  const vy1 = clamp(ny(Math.min(viewTop, viewBottom)), drawY, drawY + drawH)

  return {
    mapW,
    mapH,
    fit,
    minX: bounds.minX,
    maxY: bounds.maxY,
    drawX,
    drawY,
    boardRect: { x: drawX, y: drawY, w: drawW, h: drawH },
    viewportRect: {
      x: vx0,
      y: vy0,
      w: Math.max(2, vx1 - vx0),
      h: Math.max(2, vy1 - vy0),
    },
  }
})

const pnpMinimapVisible = computed(() => {
  if (sidebarTab.value !== 'smd' && sidebarTab.value !== 'tht') return false
  if (!pnpShowMinimap.value || !pnpMinimapModel.value) return false
  const board = pnpMinimapModel.value.boardRect
  const viewport = pnpMinimapModel.value.viewportRect
  const boardArea = Math.max(1, board.w * board.h)
  const viewportArea = Math.max(0, viewport.w * viewport.h)
  const coverage = viewportArea / boardArea
  // Hide minimap when nearly fully zoomed out (whole PCB in view).
  return coverage < 0.88
})

function sampleArcPoints(
  start: [number, number],
  end: [number, number],
  center: [number, number],
  radius: number,
  startAngle: number,
  endAngle: number,
  counterclockwise: boolean,
): Array<[number, number]> {
  let delta = endAngle - startAngle
  if (counterclockwise) {
    while (delta < 0) delta += Math.PI * 2
  } else {
    while (delta > 0) delta -= Math.PI * 2
  }
  const steps = Math.max(8, Math.ceil(Math.abs(delta) / (Math.PI / 18)))
  const pts: Array<[number, number]> = [start]
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    const a = startAngle + delta * t
    pts.push([center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius])
  }
  pts.push(end)
  return pts
}

const pnpMinimapOutlinePaths = computed<string[]>(() => {
  const tree = pnpMinimapOutlineTree.value
  const model = pnpMinimapModel.value
  if (!tree || !model) return []

  const nx = (x: number) => model.drawX + (x - model.minX) * model.fit
  const ny = (y: number) => model.drawY + (model.maxY - y) * model.fit

  const pathFromSegments = (segments: any[], closePath = false): string => {
    if (!Array.isArray(segments) || segments.length === 0) return ''
    let d = ''
    let started = false
    for (const seg of segments) {
      if (seg?.type === 'line' && Array.isArray(seg.start) && Array.isArray(seg.end)) {
        const sx = nx(seg.start[0]); const sy = ny(seg.start[1])
        const ex = nx(seg.end[0]); const ey = ny(seg.end[1])
        if (!started) { d += `M ${sx} ${sy} `; started = true }
        d += `L ${ex} ${ey} `
      } else if (
        seg?.type === 'arc'
        && Array.isArray(seg.start) && Array.isArray(seg.end) && Array.isArray(seg.center)
        && Number.isFinite(seg.radius) && Number.isFinite(seg.startAngle) && Number.isFinite(seg.endAngle)
      ) {
        const sampled = sampleArcPoints(
          seg.start, seg.end, seg.center, seg.radius, seg.startAngle, seg.endAngle, !!seg.counterclockwise,
        )
        if (!started) {
          const [sx, sy] = sampled[0]!
          d += `M ${nx(sx)} ${ny(sy)} `
          started = true
        }
        for (let i = 1; i < sampled.length; i++) {
          const [px, py] = sampled[i]!
          d += `L ${nx(px)} ${ny(py)} `
        }
      }
    }
    if (closePath && d) d += 'Z'
    return d.trim()
  }

  const out: string[] = []
  for (const g of tree.children as any[]) {
    if (g?.type === 'path') {
      const d = pathFromSegments(g.segments, false)
      if (d) out.push(d)
    } else if (g?.type === 'region') {
      const d = pathFromSegments(g.segments, true)
      if (d) out.push(d)
    } else if (g?.type === 'shape') {
      const s = g.shape
      if (!s) continue
      if (s.type === 'outline' && Array.isArray(s.segments)) {
        const d = pathFromSegments(s.segments, true)
        if (d) out.push(d)
      } else if (s.type === 'polygon' && Array.isArray(s.points) && s.points.length > 1) {
        const first = s.points[0]!
        let d = `M ${nx(first[0])} ${ny(first[1])} `
        for (let i = 1; i < s.points.length; i++) {
          const p = s.points[i]!
          d += `L ${nx(p[0])} ${ny(p[1])} `
        }
        out.push((d + 'Z').trim())
      } else if (s.type === 'rect') {
        const x0 = nx(s.x)
        const y0 = ny(s.y + s.h)
        const x1 = nx(s.x + s.w)
        const y1 = ny(s.y)
        out.push(`M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${y1} L ${x0} ${y1} Z`)
      }
    }
  }
  return out
})

function focusComponentOnCanvas(comp: { x: number; y: number }) {
  const canvasEl = boardCanvasRef.value?.getCanvas?.() as HTMLCanvasElement | null | undefined
  if (!canvasEl) return

  const rect = canvasEl.getBoundingClientRect()
  const cssWidth = rect.width || canvasEl.clientWidth || canvasEl.width
  const cssHeight = rect.height || canvasEl.clientHeight || canvasEl.height
  if (!cssWidth || !cssHeight) return

  const units = detectGerberUnits()
  const xInGerber = units === 'in' ? comp.x / 25.4 : comp.x
  const yInGerber = units === 'in' ? comp.y / 25.4 : comp.y
  const ox = pnp.originX.value ?? 0
  const oy = pnp.originY.value ?? 0
  const gx = ox + xInGerber
  const gy = oy + yInGerber

  // Use a fixed focus scale so selection zoom feels consistent.
  // Relative scaling (based on current zoom) makes jumps unpredictable.
  const targetScale = 18

  canvasInteraction.transform.value = {
    scale: targetScale,
    offsetX: cssWidth / 2 - gx * targetScale,
    offsetY: cssHeight / 2 + gy * targetScale,
  }
}

function handleKeyUp(e: KeyboardEvent) {
  measureTool.handleKeyUp(e)
}

const layers = ref<LayerInfo[]>([])
const layerOrder = ref<string[]>([])
const documentOrder = ref<string[]>([])

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string' && v.trim().length > 0)
}

function sortBySavedOrder<T>(items: T[], getKey: (item: T) => string, savedOrder: string[], fallbackSort: (items: T[]) => T[]): T[] {
  const rank = new Map<string, number>()
  for (let i = 0; i < savedOrder.length; i++) {
    const key = savedOrder[i]
    if (!rank.has(key)) rank.set(key, i)
  }

  const inOrder: Array<{ item: T; rank: number; index: number }> = []
  const remaining: T[] = []

  items.forEach((item, index) => {
    const itemRank = rank.get(getKey(item))
    if (itemRank == null) {
      remaining.push(item)
      return
    }
    inOrder.push({ item, rank: itemRank, index })
  })

  inOrder.sort((a, b) => a.rank - b.rank || a.index - b.index)
  if (remaining.length === 0) return inOrder.map(entry => entry.item)
  return [...inOrder.map(entry => entry.item), ...fallbackSort(remaining)]
}

function applyLayerOrder(nextLayers: LayerInfo[]): LayerInfo[] {
  const normalizedOrder = isStringArray(layerOrder.value) ? layerOrder.value : []
  if (normalizedOrder.length === 0) return sortLayersByPcbOrder(nextLayers)
  return sortBySavedOrder(
    nextLayers,
    layer => layer.file.fileName,
    normalizedOrder,
    sortLayersByPcbOrder,
  )
}

function applyDocumentOrder(nextDocuments: ProjectDocument[]): ProjectDocument[] {
  const normalizedOrder = isStringArray(documentOrder.value) ? documentOrder.value : []
  if (normalizedOrder.length === 0) return [...nextDocuments]
  return sortBySavedOrder(
    nextDocuments,
    doc => doc.name,
    normalizedOrder,
    (docs) => [...docs],
  )
}

function syncLayerOrderFromLayers() {
  const next = layers.value.map(layer => layer.file.fileName)
  if (next.length === layerOrder.value.length && next.every((name, idx) => name === layerOrder.value[idx])) return
  layerOrder.value = next
}

function syncDocumentOrderFromDocuments() {
  const next = documents.value.map(doc => doc.name)
  if (next.length === documentOrder.value.length && next.every((name, idx) => name === documentOrder.value[idx])) return
  documentOrder.value = next
}

// ── PCB parameters for pricing ──
const pcbData = ref<{
  sizeX?: number
  sizeY?: number
  layerCount?: number
  material?: 'FR4' | 'IMS-AL' | 'Flex' | 'Rigid-Flex'
  surfaceFinish?: 'ENIG' | 'HAL' | 'OSP'
  copperWeight?: '1oz' | '2oz'
  innerCopperWeight?: '0.5oz' | '1oz' | '2oz'
  thicknessMm?: PcbThicknessMm
  solderMaskColor?: SolderMaskColor
  panelizationMode?: 'single' | 'panelized'
  pricingQuantities?: number[]
  selectedPricingQuantity?: number
} | null>(null)

const DEFAULT_PRICING_QUANTITIES = [10, 50, 100, 500, 1000]

function sanitizePricingQuantities(values: number[] | null | undefined): number[] {
  const source = Array.isArray(values) && values.length > 0 ? values : DEFAULT_PRICING_QUANTITIES
  return Array.from(
    new Set(
      source
        .map(v => Number(v))
        .filter(v => Number.isFinite(v) && v >= 1)
        .map(v => Math.round(v)),
    ),
  ).sort((a, b) => a - b)
}

const pricingQuantities = computed(() => sanitizePricingQuantities(pcbData.value?.pricingQuantities))
const pricingQtySelectItems = computed(() =>
  pricingQuantities.value.map(v => ({ label: `${v.toLocaleString('en-US')} pcs`, value: v })),
)

const teamPanelLimits = computed(() => ({
  preferredWidthMm: currentTeam.value?.preferred_panel_width_mm ?? null,
  preferredHeightMm: currentTeam.value?.preferred_panel_height_mm ?? null,
  maxWidthMm: currentTeam.value?.max_panel_width_mm ?? null,
  maxHeightMm: currentTeam.value?.max_panel_height_mm ?? null,
}))

function handlePcbDataUpdate(data: typeof pcbData.value) {
  if (!ensureTabEditable('pcb')) return
  pcbData.value = data
}

function handlePricingQuantitiesUpdate(next: number[]) {
  const quantities = sanitizePricingQuantities(next)
  pcbData.value = {
    ...(pcbData.value ?? {}),
    pricingQuantities: quantities,
  }
  if (!quantities.includes(bom.boardQuantity.value)) {
    bom.boardQuantity.value = quantities[0]
  }
}

function handlePricingSelectedQuantityUpdate(next: number) {
  const qty = Number(next)
  if (!Number.isFinite(qty) || qty < 1) return
  pcbData.value = {
    ...(pcbData.value ?? {}),
    selectedPricingQuantity: Math.round(qty),
  }
}

// ── Panel configuration ──
import type { PanelConfig, DangerZoneConfig } from '~/utils/panel-types'
import { DEFAULT_PANEL_CONFIG, migratePanelConfig } from '~/utils/panel-types'
import { derivePanelEdgeConstraintsFromComponents } from '~/utils/panel-component-clearance'

const panelData = ref<PanelConfig>(DEFAULT_PANEL_CONFIG())
const panelDangerZone = ref<DangerZoneConfig>({ enabled: false, insetMm: 2 })
const hasLoadedProjectData = ref(false)

const panelShowSmdComponents = computed<boolean>({
  get: () => panelData.value.showSmdComponents !== false,
  set: (v) => {
    // Viewing overlay toggle should remain usable even when Panel is locked.
    const nextShowSmd = !!v
    const nextShowTht = panelData.value.showThtComponents !== false
    panelData.value = normalizePanelConfig({
      ...(panelData.value as any),
      showSmdComponents: nextShowSmd,
      showComponents: nextShowSmd || nextShowTht,
    } as PanelConfig)
  },
})

const panelShowThtComponents = computed<boolean>({
  get: () => panelData.value.showThtComponents !== false,
  set: (v) => {
    // Viewing overlay toggle should remain usable even when Panel is locked.
    const nextShowTht = !!v
    const nextShowSmd = panelData.value.showSmdComponents !== false
    panelData.value = normalizePanelConfig({
      ...(panelData.value as any),
      showThtComponents: nextShowTht,
      showComponents: nextShowSmd || nextShowTht,
    } as PanelConfig)
  },
})

const panelShowDangerZones = computed<boolean>({
  get: () => panelDangerZone.value.enabled,
  set: (v) => {
    panelDangerZone.value = { ...panelDangerZone.value, enabled: v }
  },
})

const panelDangerInsetMm = computed<number>({
  get: () => panelDangerZone.value.insetMm,
  set: (v) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return
    const clamped = Math.max(0.5, Math.min(20, Math.round(n * 10) / 10))
    panelDangerZone.value = { ...panelDangerZone.value, insetMm: clamped }
  },
})

function normalizePanelConfig(data: unknown): PanelConfig {
  // Strip Vue proxies/functions and keep a plain, migrated JSON shape.
  const plain = JSON.parse(JSON.stringify(data ?? {})) as Record<string, any>
  return migratePanelConfig(plain)
}

function handlePanelDataUpdate(data: PanelConfig) {
  if (!ensureTabEditable('panel')) return
  panelData.value = normalizePanelConfig(data)
}

// ── Original content tracking (for edit detection + reset) ──
const originalContent = reactive(new Map<string, string>())
const TEAM_ORIGINALS_STORAGE_PREFIX = 'gerbtrace:team:file-originals:'

function teamOriginalsStorageKey(): string | null {
  if (!import.meta.client || !isTeamProject || !teamProjectId) return null
  return `${TEAM_ORIGINALS_STORAGE_PREFIX}${teamProjectId}:1`
}

function loadTeamOriginalsFromStorage(): Map<string, string> {
  const key = teamOriginalsStorageKey()
  if (!key) return new Map<string, string>()
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return new Map<string, string>()
    const parsed = JSON.parse(raw) as Record<string, string>
    return new Map<string, string>(Object.entries(parsed))
  } catch {
    return new Map<string, string>()
  }
}

function saveTeamOriginalsToStorage() {
  const key = teamOriginalsStorageKey()
  if (!key) return
  const payload: Record<string, string> = {}
  for (const [fileName, content] of originalContent.entries()) payload[fileName] = content
  localStorage.setItem(key, JSON.stringify(payload))
}

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

const selectedPreset = computed(() =>
  getPresetForAppearance(pcbData.value?.surfaceFinish, pcbData.value?.solderMaskColor),
)
const isPanelizedMode = computed(() => pcbData.value?.panelizationMode !== 'single')
const hasPasteLayers = computed(() =>
  layers.value.some(l => l.type === 'Top Paste' || l.type === 'Bottom Paste'),
)
const activePasteTree = computed(() => {
  const canvas = boardCanvasRef.value
  if (!canvas) return null
  const pasteLayer = layers.value.find(l => l.type === 'Top Paste' || l.type === 'Bottom Paste')
  if (!pasteLayer) return null
  return canvas.getImageTree(pasteLayer) as import('@lib/gerber/types').ImageTree | null
})
const boardCanvasRef = ref<any>(null)
const panelCanvasRef = ref<any>(null)

const panelDimensionsMm = computed<{ width: number; height: number } | null>(() => {
  const canvas = panelCanvasRef.value
  if (!canvas) return null
  const dims = canvas.panelDimensions
  if (!dims) return null
  if (typeof dims === 'object' && dims !== null && 'value' in dims) {
    return (dims as { value: { width: number; height: number } | null }).value ?? null
  }
  return dims as { width: number; height: number } | null
})

const showSettings = ref(false)
const showPerformanceMonitor = ref(false)
const showPnPExport = ref(false)
const showImageExport = ref(false)
const showJpsysExport = ref(false)
const imageExportTarget = ref<'board' | 'panel'>('board')
const filesLockPopoverOpen = ref(false)
const bomLockPopoverOpen = ref(false)
const showComponentEdit = ref(false)
watch(showComponentEdit, (open) => { if (!open) previewPkgOverride.value = null })
watch(isCurrentTabLocked, (locked) => {
  if (locked) showComponentEdit.value = false
})
const editingComponent = ref<import('~/composables/usePickAndPlace').EditablePnPComponent | null>(null)
const performanceSnapshot = ref<{
  fpsApprox?: number
  frameMs?: number
  importToVisibleMs?: number
  longTaskCount30s?: number
  memorySupported?: boolean
  heapUsedBytes?: number
  heapTotalBytes?: number
  heapLimitBytes?: number
  storageUsageBytes?: number
  storageQuotaBytes?: number
  projectEstimateBytes?: number
  logicalCores?: number
  deviceMemoryGb?: number | null
  gpuRenderer?: string | null
  board?: { sceneCacheBytes?: number, canvasPoolSize?: number, draws?: number }
  panel?: { tileBytesTotal?: number, canvasPoolSize?: number, draws?: number }
} | null>(null)

const documentSizeById = ref<Record<string, number>>({})
let perfFrameReq = 0
let perfRefreshTimer: ReturnType<typeof setInterval> | null = null
let perfLastRafTs = 0
let perfFrameMs = 0
const importPerfStartMs = ref<number | null>(null)
const importToVisibleMs = ref(0)
const longTaskTimestamps: number[] = []
let longTaskObserver: PerformanceObserver | null = null

function markImportVisible() {
  if (importPerfStartMs.value == null) return
  importToVisibleMs.value = performance.now() - importPerfStartMs.value
  importPerfStartMs.value = null
}

watch(
  () => layers.value.map(layer => `${layer.file.fileName}:${layer.file.content.length}:${layer.type}`).join('|'),
  () => {
    importPerfStartMs.value = performance.now()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        markImportVisible()
      })
    })
  },
)

function estimateProjectBytes(): number {
  const encoder = new TextEncoder()
  const layerBytes = layers.value.reduce((sum, layer) => sum + encoder.encode(layer.file.content).length, 0)
  const docsBytes = Object.values(documentSizeById.value).reduce((sum, size) => sum + size, 0)
  const pnpBytes = encoder.encode(JSON.stringify({
    all: pnp.allComponents.value,
    manual: pnp.manualComponentsRecord.value,
    mapping: pnp.cadPackageMapRecord.value,
  })).length
  const bomBytes = encoder.encode(JSON.stringify({
    lines: bom.bomLines.value,
    pricing: bom.pricingCache.value,
  })).length
  const panelBytes = encoder.encode(JSON.stringify(panelData.value)).length
  const pcbBytes = encoder.encode(JSON.stringify(pcbData.value ?? {})).length
  return layerBytes + docsBytes + pnpBytes + bomBytes + panelBytes + pcbBytes
}

function getGpuRenderer(): string | null {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!gl) return null
    const ext = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info') as any
    if (!ext) return null
    return (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL) as string
  } catch {
    return null
  }
}

function startPerfFrameLoop() {
  const tick = (ts: number) => {
    if (perfLastRafTs > 0) perfFrameMs = ts - perfLastRafTs
    perfLastRafTs = ts
    perfFrameReq = requestAnimationFrame(tick)
  }
  if (!perfFrameReq) perfFrameReq = requestAnimationFrame(tick)
}

function stopPerfFrameLoop() {
  if (perfFrameReq) {
    cancelAnimationFrame(perfFrameReq)
    perfFrameReq = 0
  }
  perfLastRafTs = 0
}

function startLongTaskObserver() {
  if (longTaskObserver || typeof PerformanceObserver === 'undefined') return
  try {
    longTaskObserver = new PerformanceObserver((list) => {
      const now = performance.now()
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'longtask') longTaskTimestamps.push(now)
      }
      while (longTaskTimestamps.length && now - longTaskTimestamps[0]! > 30000) {
        longTaskTimestamps.shift()
      }
    })
    longTaskObserver.observe({ entryTypes: ['longtask'] })
  } catch {
    longTaskObserver = null
  }
}

function stopLongTaskObserver() {
  if (longTaskObserver) {
    longTaskObserver.disconnect()
    longTaskObserver = null
  }
}

async function refreshPerformanceSnapshot() {
  const mem = ((performance as any).memory ?? null) as { usedJSHeapSize: number, totalJSHeapSize: number, jsHeapSizeLimit: number } | null
  const storageEstimate = typeof navigator.storage?.estimate === 'function'
    ? await navigator.storage.estimate().catch(() => null)
    : null
  const boardStats = boardCanvasRef.value?.getPerformanceStats?.()
  const panelStats = panelCanvasRef.value?.getPerformanceStats?.()

  performanceSnapshot.value = {
    fpsApprox: perfFrameMs > 0 ? 1000 / perfFrameMs : 0,
    frameMs: perfFrameMs,
    importToVisibleMs: importToVisibleMs.value,
    longTaskCount30s: longTaskTimestamps.length,
    memorySupported: !!mem,
    heapUsedBytes: mem?.usedJSHeapSize ?? 0,
    heapTotalBytes: mem?.totalJSHeapSize ?? 0,
    heapLimitBytes: mem?.jsHeapSizeLimit ?? 0,
    storageUsageBytes: storageEstimate?.usage ?? 0,
    storageQuotaBytes: storageEstimate?.quota ?? 0,
    projectEstimateBytes: estimateProjectBytes(),
    logicalCores: navigator.hardwareConcurrency ?? 0,
    deviceMemoryGb: (navigator as any).deviceMemory ?? null,
    gpuRenderer: getGpuRenderer(),
    board: {
      sceneCacheBytes: boardStats?.sceneCache?.estimatedBytes ?? 0,
      canvasPoolSize: boardStats?.canvasPoolSize ?? 0,
      draws: boardStats?.draws ?? 0,
    },
    panel: {
      tileBytesTotal: (panelStats?.pcbTile?.estimatedBytes ?? 0)
        + (panelStats?.componentTile?.estimatedBytes ?? 0)
        + (panelStats?.dangerTile?.estimatedBytes ?? 0),
      canvasPoolSize: panelStats?.canvasPoolSize ?? 0,
      draws: panelStats?.draws ?? 0,
    },
  }
}

watch(showPerformanceMonitor, (open) => {
  if (!open) {
    if (perfRefreshTimer) {
      clearInterval(perfRefreshTimer)
      perfRefreshTimer = null
    }
    stopPerfFrameLoop()
    stopLongTaskObserver()
    return
  }
  startPerfFrameLoop()
  startLongTaskObserver()
  refreshPerformanceSnapshot()
  perfRefreshTimer = setInterval(() => {
    refreshPerformanceSnapshot()
  }, 1000)
})

// Board dimensions — cached so the value survives when BoardCanvas is unmounted (e.g. panel tab)
const _cachedBoardSizeMm = ref<{ width: number; height: number } | undefined>(undefined)

const _liveBoardSizeMm = computed<{ width: number; height: number } | undefined>(() => {
  const canvas = boardCanvasRef.value
  if (!canvas) return undefined
  return canvas.boardDimensions ?? canvas.getExportDimensionsMm() ?? undefined
})

// Keep the cache updated whenever the live value changes
watch(_liveBoardSizeMm, (dims) => {
  if (dims) _cachedBoardSizeMm.value = dims
}, { immediate: true })

// ── Preview thumbnail capture ──
let _previewTimer: ReturnType<typeof setTimeout> | null = null
function schedulePreviewCapture() {
  if (_previewTimer) clearTimeout(_previewTimer)
  _previewTimer = setTimeout(async () => {
    const canvas = boardCanvasRef.value
    if (!canvas?.exportPng || !_liveBoardSizeMm.value) return
    try {
      const blob = await canvas.exportPng(72)
      if (!blob) return
      if (isTeamProject && teamProjectId) {
        const teamId = currentTeamId.value || await waitForTeamId()
        uploadPreviewImage(teamProjectId, teamId, blob)
      } else if (projectId) {
        updateProjectPreview(projectId, blob)
      }
    } catch (e) {
      console.warn('[viewer] Preview capture failed:', e)
    }
  }, 1500)
}

watch(_liveBoardSizeMm, (dims) => {
  if (dims) schedulePreviewCapture()
})

watch([selectedPreset, viewMode], () => {
  if (_liveBoardSizeMm.value) schedulePreviewCapture()
})

// Gerber-based fallback: compute board dimensions directly from layer data.
// Needed when BoardCanvas has never mounted (e.g. page opened on panel tab).
const gerberTreeCache = useGerberImageTreeCache()
const _gerberBoardSizeMm = computed<{ width: number; height: number } | undefined>(() => {
  const ls = layers.value
  if (ls.length === 0) return undefined

  // Prefer outline bounds for accurate physical dimensions
  const outlineLayer = ls.find(l => l.type === 'Outline') || ls.find(l => l.type === 'Keep-Out')
  if (outlineLayer && !isPnPLayer(outlineLayer.type)) {
    const tree = _parseLayerTree(outlineLayer)
    if (tree && tree.children.length > 0 && !isEmpty(tree.bounds as BoundingBox)) {
      const b = tree.bounds as BoundingBox
      const bw = b[2] - b[0]
      const bh = b[3] - b[1]
      if (bw > 0 && bh > 0) {
        const toMm = tree.units === 'in' ? 25.4 : 1
        return { width: bw * toMm, height: bh * toMm }
      }
    }
  }

  // Fallback: union of all Gerber layer bounds
  let bounds: BoundingBox = emptyBounds()
  let units: 'mm' | 'in' = 'mm'
  for (const layer of ls) {
    if (isPnPLayer(layer.type)) continue
    const tree = _parseLayerTree(layer)
    if (!tree || tree.children.length === 0) continue
    bounds = mergeBounds(bounds, tree.bounds as BoundingBox)
    units = tree.units
  }
  if (isEmpty(bounds)) return undefined
  const bw = bounds[2] - bounds[0]
  const bh = bounds[3] - bounds[1]
  if (bw <= 0 || bh <= 0) return undefined
  const toMm = units === 'in' ? 25.4 : 1
  return { width: bw * toMm, height: bh * toMm }
})


function _parseLayerTree(layer: LayerInfo): ImageTree | null {
  return gerberTreeCache.getOrParseSync(layer)
}

const boardSizeMm = computed<{ width: number; height: number } | undefined>(() => {
  return _liveBoardSizeMm.value ?? _cachedBoardSizeMm.value ?? _gerberBoardSizeMm.value
})

let gerberPrewarmTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => layers.value
    .filter(layer => !isPnPLayer(layer.type))
    .map((layer) => {
      const content = layer.file.content
      return `${layer.file.fileName}:${content.length}:${content.slice(0, 32)}:${content.slice(-32)}`
    })
    .join('|'),
  () => {
    if (gerberPrewarmTimer) clearTimeout(gerberPrewarmTimer)
    gerberPrewarmTimer = setTimeout(() => {
      const targetLayers = layers.value.filter(layer => !isPnPLayer(layer.type))
      gerberTreeCache.prewarmLayers(targetLayers).catch(() => {})
    }, 40)
  },
  { immediate: true },
)

function roundBoardMm(value: number): number {
  return Math.round(value * 100) / 100
}

watch(boardSizeMm, (dims) => {
  if (!dims || !hasLoadedProjectData.value) return
  const current = pcbData.value ?? {}
  const nextSizeX = current.sizeX ?? roundBoardMm(dims.width)
  const nextSizeY = current.sizeY ?? roundBoardMm(dims.height)
  if (current.sizeX === nextSizeX && current.sizeY === nextSizeY) return
  pcbData.value = {
    ...current,
    sizeX: nextSizeX,
    sizeY: nextSizeY,
  }
}, { immediate: true })

/** Count copper layers from loaded Gerber files to suggest PCB layer count */
const detectedLayerCount = computed<number | null>(() => {
  const copperTypes = new Set(['Top Copper', 'Bottom Copper', 'Inner Layer'])
  const count = layers.value.filter(l => copperTypes.has(l.type)).length
  return count > 0 ? count : null
})

const downloadMenuItems = computed(() => {
  const items: { label: string; icon: string; onSelect: () => void }[] = []
  if (layers.value.length > 0) {
    items.push({
      label: 'Export Image',
      icon: 'i-lucide-image',
      onSelect: () => {
        // Ensure the board canvas is mounted for export flows.
        if (!isCanvasPage.value) sidebarTab.value = 'pcb'
        imageExportTarget.value = 'board'
        showImageExport.value = true
      },
    })
  }
  if (isPanelizedMode.value && layers.value.length > 0) {
    items.push({
      label: 'Export Panel Image',
      icon: 'i-lucide-grid-2x2',
      onSelect: () => {
        // Panel export requires the panel canvas, even if user is on a non-canvas page.
        sidebarTab.value = 'panel'
        imageExportTarget.value = 'panel'
        showImageExport.value = true
      },
    })
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
const importLayerWarnings = computed<string[]>(() => {
  if (layers.value.length === 0) return []

  const types = layers.value.map(l => l.type)
  const hasTopCopper = types.includes('Top Copper')
  const hasBottomCopper = types.includes('Bottom Copper')
  const innerLayerCount = types.filter(t => t === 'Inner Layer').length
  const hasAnyCopper = hasTopCopper || hasBottomCopper || innerLayerCount > 0
  const hasDrill = types.includes('Drill')
  const hasOutlineLike = types.includes('Outline') || types.includes('Keep-Out')
  const configuredLayerCount = Number(pcbData.value?.layerCount ?? 0)

  const warnings: string[] = []
  if (!hasAnyCopper) {
    warnings.push('No copper layers detected. Check file types for Top/Bottom/Inner copper.')
  }
  if (!hasDrill) {
    warnings.push('No drill layer detected. Through-hole and via data may be incomplete.')
  }
  if (!hasOutlineLike) {
    warnings.push('No outline layer detected. Board dimensions/cropping may be inaccurate.')
  }
  if (hasTopCopper !== hasBottomCopper) {
    warnings.push('Only one outer copper side is detected (Top or Bottom).')
  }
  if (configuredLayerCount > 2 && innerLayerCount === 0) {
    warnings.push(`Layer count is set to ${configuredLayerCount} but no inner copper layers were detected.`)
  }
  return warnings
})

// ── Pick & Place ──
const pnp = usePickAndPlace(layers)
watch(pnpUnitOverride, (next) => {
  pnp.coordUnitOverride.value = next
}, { immediate: true })
watch(() => pnp.coordUnitOverride.value, (next) => {
  pnpUnitOverride.value = next
})
watch(
  () => pnp.selectedComponent.value?.key ?? null,
  async () => {
    if (sidebarTab.value !== 'smd' && sidebarTab.value !== 'tht') return
    if (!pnpAutoFocusOnSelect.value) return
    if (pnpSelectionSource.value !== 'table') return
    const selected = pnp.selectedComponent.value
    if (!selected) return
    await nextTick()
    focusComponentOnCanvas(selected)
    pnpSelectionSource.value = 'other'
  },
)
const pkgLib = usePackageLibrary()
const thtPkgLib = useThtPackageLibrary()
const panelEdgeConstraints = computed(() => {
  return derivePanelEdgeConstraintsFromComponents({
    boardSizeMm: boardSizeMm.value ?? null,
    components: pnp.allComponents.value,
    matchPackage: pkgLib.matchPackage,
    matchThtPackage: thtPkgLib.matchThtPackage,
    tabClearanceMm: 20,
  })
})
const showPackages = ref(true)
const pnpShowDnpHighlight = ref(true)
const pnpShowSmd = ref(true)
const pnpShowTht = ref(false)
const pnpAutoFocusOnSelect = ref(true)
const pnpShowMinimap = ref(false)
const pnpSelectionSource = ref<'table' | 'canvas' | 'other'>('other')

watch(pnpAutoFocusOnSelect, (enabled) => {
  if (enabled) pnpShowMinimap.value = true
}, { immediate: true })

const previewPkgOverride = ref<{ componentKey: string; packageName: string } | null>(null)
const pnpComponentsWithPreview = computed(() => {
  const comps = pnp.visibleComponents.value
  const override = previewPkgOverride.value
  if (!override) return comps
  return comps.map(c =>
    c.key === override.componentKey
      ? { ...c, matchedPackage: override.packageName }
      : c,
  )
})

const pnpComponentsForCanvas = computed(() => {
  const showSmd = pnpShowSmd.value
  const showTht = pnpShowTht.value
  const showDnp = pnpShowDnpHighlight.value
  return pnpComponentsWithPreview.value.filter((c) => {
    if (c.dnp && !showDnp) return false
    if (c.componentType === 'smd') return showSmd
    if (c.componentType === 'tht') return showTht
    return true
  })
})

const panelPnpComponentsForCanvas = computed(() => {
  const showSmd = panelData.value.showSmdComponents !== false
  const showTht = panelData.value.showThtComponents !== false
  return pnpComponentsWithPreview.value.filter((c) => {
    if (c.componentType === 'smd') return showSmd
    if (c.componentType === 'tht') return showTht
    return true
  })
})

// Monotonic version counter — bumped whenever any package source changes.
const _pkgLibVersion = ref(0)
const packageLibraryVersion = computed(() => _pkgLibVersion.value)

type PackageSelectOption = {
  value: string
  label: string
  libraryLabel: string
  searchText: string
  previewKind: 'smd' | 'tht'
  previewPkg?: Record<string, any>
  packageType?: string
}

function buildPackageOptions<T extends { name: string, type?: string, libraryName?: string, sourceType?: string, owner?: string }>(
  packages: T[],
  previewKind: 'smd' | 'tht',
): PackageSelectOption[] {
  const seen = new Set<string>()
  const out: PackageSelectOption[] = []
  for (const pkg of packages) {
    const name = (pkg.name || '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const sourceParts: string[] = []
    if (pkg.sourceType) sourceParts.push(pkg.sourceType)
    if (pkg.owner) sourceParts.push(pkg.owner)
    const sourceLabel = sourceParts.join(' / ')
    const libraryLabel = pkg.libraryName || sourceLabel || 'Local'
    out.push({
      value: name,
      label: name,
      libraryLabel,
      searchText: `${name} ${libraryLabel} ${sourceLabel}`.trim(),
      previewKind,
      previewPkg: pkg as Record<string, any>,
      packageType: pkg.type,
    })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label))
}

const packageOptions = computed(() => buildPackageOptions(
  pkgLib.allPackages.value as Array<{ name: string, type?: string, libraryName?: string, sourceType?: string, owner?: string }>,
  'smd',
))
const thtPackageOptions = computed(() => buildPackageOptions(
  thtPkgLib.allThtPackages.value as Array<{ name: string, type?: string, libraryName?: string, sourceType?: string, owner?: string }>,
  'tht',
))

type PnPSortKey = 'ref' | 'x' | 'y' | 'rot' | 'pol' | 'value' | 'cadPackage' | 'package'
type PnPSortState = { key: PnPSortKey | null; asc: boolean }
type PnPComponentGroup = {
  id: string
  componentType: 'smd' | 'tht'
  name: string
  comment: string
  hidden: boolean
  collapsed: boolean
}

const pnpSortSmd = ref<PnPSortState>({ key: null, asc: true })
const pnpSortTht = ref<PnPSortState>({ key: null, asc: true })
const pnpManualOrderSmd = ref<string[]>([])
const pnpManualOrderTht = ref<string[]>([])
const pnpComponentGroups = ref<PnPComponentGroup[]>([])
const pnpGroupAssignments = ref<Record<string, string>>({})
const showCreateGroupModal = ref(false)
const pendingGroupType = ref<'smd' | 'tht'>('smd')
const createGroupDefaultName = ref('Group 1')

const smdGroups = computed(() => pnpComponentGroups.value.filter(g => g.componentType === 'smd'))
const thtGroups = computed(() => pnpComponentGroups.value.filter(g => g.componentType === 'tht'))

function isValidSortState(value: unknown): value is PnPSortState {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  const validKeys = new Set<PnPSortKey | null>(['ref', 'x', 'y', 'rot', 'pol', 'value', 'cadPackage', 'package', null])
  return validKeys.has((v.key as PnPSortKey | null) ?? null) && typeof v.asc === 'boolean'
}

function applySortState(type: 'smd' | 'tht', value: PnPSortState) {
  if (!ensureTabEditable(type)) return
  if (type === 'smd') pnpSortSmd.value = value
  else pnpSortTht.value = value
}

function createGroup(type: 'smd' | 'tht') {
  if (!ensureTabEditable(type)) return
  pendingGroupType.value = type
  const baseName = type === 'smd' ? 'SMD Group' : 'THT Group'
  const existing = pnpComponentGroups.value
    .filter(g => g.componentType === type)
    .map(g => g.name.trim().toLowerCase())
  let idx = 1
  while (existing.includes(`${baseName.toLowerCase()} ${idx}`)) idx++
  createGroupDefaultName.value = `${baseName} ${idx}`
  showCreateGroupModal.value = true
}

function handleCreateGroup(payload: { name: string; comment: string }) {
  if (!ensureTabEditable(pendingGroupType.value)) return
  const id = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  pnpComponentGroups.value = [...pnpComponentGroups.value, {
    id,
    componentType: pendingGroupType.value,
    name: payload.name,
    comment: payload.comment,
    hidden: false,
    collapsed: false,
  }]
}

function toggleGroupHidden(groupId: string) {
  const target = pnpComponentGroups.value.find(g => g.id === groupId)
  if (target && !ensureTabEditable(target.componentType)) return
  pnpComponentGroups.value = pnpComponentGroups.value.map(g =>
    g.id === groupId ? { ...g, hidden: !g.hidden } : g,
  )
}

function toggleGroupCollapsed(groupId: string) {
  const target = pnpComponentGroups.value.find(g => g.id === groupId)
  if (target && !ensureTabEditable(target.componentType)) return
  pnpComponentGroups.value = pnpComponentGroups.value.map(g =>
    g.id === groupId ? { ...g, collapsed: !g.collapsed } : g,
  )
}

function deleteGroup(groupId: string, type: 'smd' | 'tht') {
  if (!ensureTabEditable(type)) return
  const target = pnpComponentGroups.value.find(g => g.id === groupId)
  if (!target || target.componentType !== type) return

  // Move components in this group back to "No section" by clearing assignment.
  const nextAssignments = { ...pnpGroupAssignments.value }
  for (const [componentKey, assignedGroupId] of Object.entries(nextAssignments)) {
    if (assignedGroupId === groupId) {
      delete nextAssignments[componentKey]
    }
  }
  pnpGroupAssignments.value = nextAssignments

  pnpComponentGroups.value = pnpComponentGroups.value.filter(g => g.id !== groupId)
}

function reorderGroups(type: 'smd' | 'tht', orderedIds: string[]) {
  if (!ensureTabEditable(type)) return
  const typeGroups = pnpComponentGroups.value.filter(g => g.componentType === type)
  if (typeGroups.length <= 1) return

  const expectedIds = new Set(typeGroups.map(g => g.id))
  if (orderedIds.length !== typeGroups.length) return
  if (orderedIds.some(id => !expectedIds.has(id))) return

  const reorderedById = new Map(typeGroups.map(g => [g.id, g] as const))
  const reordered = orderedIds.map(id => reorderedById.get(id)).filter(Boolean) as PnPComponentGroup[]
  let idx = 0
  pnpComponentGroups.value = pnpComponentGroups.value.map((group) => {
    if (group.componentType !== type) return group
    const next = reordered[idx]
    idx++
    return next ?? group
  })
}

function assignComponentGroup(payload: { componentKey: string; groupId: string | null }, type: 'smd' | 'tht') {
  if (!ensureTabEditable(type)) return
  const next = { ...pnpGroupAssignments.value }
  if (!payload.groupId) {
    delete next[payload.componentKey]
    pnpGroupAssignments.value = next
    return
  }
  const target = pnpComponentGroups.value.find(g => g.id === payload.groupId)
  if (!target || target.componentType !== type) return
  next[payload.componentKey] = payload.groupId
  pnpGroupAssignments.value = next
}

function updateGroupMeta(payload: { groupId: string; name: string; comment: string }) {
  const target = pnpComponentGroups.value.find(g => g.id === payload.groupId)
  if (target && !ensureTabEditable(target.componentType)) return
  pnpComponentGroups.value = pnpComponentGroups.value.map(g =>
    g.id === payload.groupId
      ? { ...g, name: payload.name.trim(), comment: payload.comment.trim() }
      : g,
  )
}

function assignEditingComponentGroup(payload: { key: string; groupId: string | null }) {
  const comp = pnp.allComponents.value.find(c => c.key === payload.key)
  if (!comp) return
  assignComponentGroup(
    { componentKey: payload.key, groupId: payload.groupId },
    comp.componentType,
  )
}

// Load package libraries on mount (non-blocking)
onMounted(() => {
  pkgLib.loadPackages()
  thtPkgLib.loadPackages()
})

// Merge local custom packages (IndexedDB) into the package libraries
const { customDefinitions: localCustomPkgs } = useCustomPackages()
const { customThtDefinitions: localCustomThtPkgs } = useCustomThtPackages()
watch(localCustomPkgs, (pkgs) => { pkgLib.setCustomPackages(pkgs); _pkgLibVersion.value++ }, { immediate: true })
watch(localCustomThtPkgs, (pkgs) => { thtPkgLib.setCustomPackages(pkgs); _pkgLibVersion.value++ }, { immediate: true })

// Merge team packages (Supabase) into the package libraries
const { teamPackageDefinitions: teamPkgDefs } = useTeamPackages()
const { teamThtPackageDefinitions: teamThtPkgDefs } = useTeamThtPackages()
watch(teamPkgDefs, (pkgs) => { pkgLib.setTeamPackages(pkgs); _pkgLibVersion.value++ }, { immediate: true, deep: true })
watch(teamThtPkgDefs, (pkgs) => { thtPkgLib.setTeamPackages(pkgs); _pkgLibVersion.value++ }, { immediate: true, deep: true })

// Let the PnP composable use the package libraries for matching
watch(
  () => pkgLib.lookupMap.value.size,
  () => { pnp.setPackageMatcher(pkgLib.matchPackage) },
  { immediate: true },
)
watch(
  () => thtPkgLib.lookupMap.value.size,
  () => { pnp.setThtPackageMatcher(thtPkgLib.matchThtPackage) },
  { immediate: true },
)

// Prefetch full package geometry for packages actually referenced in PnP data
watch(
  () => ({
    smd: pnp.smdActiveComponents.value.map(c => c.matchedPackage),
    tht: pnp.thtActiveComponents.value.map(c => c.matchedPackage),
    smdReady: pkgLib.loaded.value,
    thtReady: thtPkgLib.loaded.value,
  }),
  async ({ smd, tht, smdReady, thtReady }) => {
    const smdNames = [...new Set(smd.filter(Boolean))]
    const thtNames = [...new Set(tht.filter(Boolean))]
    if (smdReady && smdNames.length) {
      await pkgLib.prefetchPackagesForBoard(smdNames)
      _pkgLibVersion.value++
    }
    if (thtReady && thtNames.length) {
      await thtPkgLib.prefetchPackagesForBoard(thtNames)
      _pkgLibVersion.value++
    }
  },
  { immediate: true },
)

// ── Documents (PDF) ──
import type { DocumentType, ProjectDocument } from '~/utils/document-types'

const documentTypes: DocumentType[] = ['Schematics', 'Drawings', 'Datasheets', 'Instructions']

const documents = ref<ProjectDocument[]>([])
const selectedDocumentId = ref<string | null>(null)
const hasDocuments = computed(() => documents.value.length > 0)
const selectedDocument = computed(() => documents.value.find(d => d.id === selectedDocumentId.value) ?? null)

// Files page selection (raw file/doc preview)
const initialFileQuery = (route.query.file as string) || null
const filesSelectedLayerFileName = ref<string | null>(null)
const filesSelectedLayerIndex = ref<number | null>(null)
const filesSelectedDocId = ref<string | null>(null)
const filesPreviewSelectionNonce = ref(0)
const filesPreviewMode = ref<'table' | 'text' | 'diff'>('text')
const filesSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()
const filesSelectedLayer = computed(() => {
  const selectedIndex = filesSelectedLayerIndex.value
  if (typeof selectedIndex === 'number' && selectedIndex >= 0 && selectedIndex < layers.value.length) {
    const byIndex = layers.value[selectedIndex] ?? null
    if (!filesSelectedLayerFileName.value || byIndex?.file.fileName === filesSelectedLayerFileName.value) {
      return byIndex
    }
  }
  return layers.value.find(l => l.file.fileName === filesSelectedLayerFileName.value) ?? null
})
const filesSelectedDoc = computed(() => documents.value.find(d => d.id === filesSelectedDocId.value) ?? null)
const selectedLayerOriginalText = computed(() => {
  const layer = filesSelectedLayer.value
  if (!layer) return ''
  return originalContent.get(layer.file.fileName) ?? layer.file.content
})
const canSelectedLayerUseTablePreview = computed(() => {
  const layer = filesSelectedLayer.value
  if (!layer) return false
  if (layer.type === 'Drill') return false
  return isTabularPreviewFileName(layer.file.fileName)
})
const isSelectedLayerBom = computed(() => !!filesSelectedLayer.value && filesSelectedLayer.value.type === 'BOM')
const isSelectedLayerPnp = computed(() => !!filesSelectedLayer.value && isPnPLayer(filesSelectedLayer.value.type))
const isSelectedLayerImportConfigurable = computed(() => isSelectedLayerBom.value || isSelectedLayerPnp.value)
const bomMappingFields: { key: keyof BomColumnMapping; label: string }[] = [
  { key: 'references', label: 'References' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'description', label: 'Description' },
  { key: 'type', label: 'Type' },
  { key: 'customerProvided', label: 'Customer Provided' },
  { key: 'customerItemNo', label: 'Customer Item No' },
  { key: 'package', label: 'Package' },
  { key: 'comment', label: 'Comment' },
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'manufacturerPart', label: 'Manufacturer Part' },
]
const pnpMappingFields: { key: keyof PnPColumnMapping; label: string }[] = [
  { key: 'designator', label: 'Designator' },
  { key: 'x', label: 'X' },
  { key: 'y', label: 'Y' },
  { key: 'rotation', label: 'Rotation' },
  { key: 'value', label: 'Value' },
  { key: 'package', label: 'Package' },
  { key: 'side', label: 'Side' },
  { key: 'description', label: 'Description' },
]
const pnpUnitItems = [
  { label: 'Auto', value: 'auto' as const },
  { label: 'mm', value: 'mm' as const },
  { label: 'mils', value: 'mils' as const },
  { label: 'inches', value: 'inches' as const },
]
const selectedLayerSkipRows = computed(() => {
  const layer = filesSelectedLayer.value
  if (!layer) return 0
  if (isSelectedLayerBom.value) return bom.resolveFileImportOptions(layer.file.fileName)?.skipRows ?? 0
  if (isSelectedLayerPnp.value) return pnp.resolveFileImportOptions(layer.file.fileName)?.skipRows ?? 0
  return 0
})
const selectedLayerSkipBottomRows = computed(() => {
  const layer = filesSelectedLayer.value
  if (!layer) return 0
  if (isSelectedLayerBom.value) return bom.resolveFileImportOptions(layer.file.fileName)?.skipBottomRows ?? 0
  if (isSelectedLayerPnp.value) return pnp.resolveFileImportOptions(layer.file.fileName)?.skipBottomRows ?? 0
  return 0
})
const selectedLayerFixedColumns = computed<readonly number[] | undefined>(() => {
  const layer = filesSelectedLayer.value
  if (!layer) return undefined
  if (isSelectedLayerBom.value) return bom.resolveFileImportOptions(layer.file.fileName)?.fixedColumns
  if (isSelectedLayerPnp.value) return pnp.resolveFileImportOptions(layer.file.fileName)?.fixedColumns
  return undefined
})
const selectedLayerDelimiter = computed<',' | ';' | '\t' | 'fixed' | undefined>(() => {
  const layer = filesSelectedLayer.value
  if (!layer) return undefined
  if (isSelectedLayerBom.value) return bom.resolveFileImportOptions(layer.file.fileName)?.delimiter
  if (isSelectedLayerPnp.value) return pnp.resolveFileImportOptions(layer.file.fileName)?.delimiter
  return undefined
})
const selectedLayerDecimal = computed<'.' | ',' | undefined>(() => {
  const layer = filesSelectedLayer.value
  if (!layer) return undefined
  if (isSelectedLayerBom.value) return bom.resolveFileImportOptions(layer.file.fileName)?.decimal
  if (isSelectedLayerPnp.value) return pnp.resolveFileImportOptions(layer.file.fileName)?.decimal
  return undefined
})
const selectedLayerExtraColumns = computed(() => {
  const layer = filesSelectedLayer.value
  if (!layer || !isSelectedLayerBom.value) return undefined
  const cols = bom.resolveFileImportOptions(layer.file.fileName)?.extraColumns
  return cols ? [...cols] : undefined
})
const selectedLayerPnpUnit = computed<'auto' | PnPCoordUnit>(() => {
  const layer = filesSelectedLayer.value
  if (!layer || !isSelectedLayerPnp.value) return 'auto'
  return pnp.resolveFileImportOptions(layer.file.fileName)?.unitOverride ?? 'auto'
})
const selectedLayerBomMapping = computed<BomColumnMapping>(() => {
  const layer = filesSelectedLayer.value
  if (!layer || !isSelectedLayerBom.value) return {}
  const fileName = layer.file.fileName
  const opts = bom.resolveFileImportOptions(fileName)
  if (opts?.mapping) return opts.mapping
  const auto = parseBomFile(fileName, layer.file.content, {
    skipRows: opts?.skipRows,
    skipBottomRows: opts?.skipBottomRows,
    fixedColumns: opts?.fixedColumns,
  }).mapping
  return auto ?? {}
})
const selectedLayerPnpMapping = computed<PnPColumnMapping>(() => {
  const layer = filesSelectedLayer.value
  if (!layer || !isSelectedLayerPnp.value) return {}
  const fileName = layer.file.fileName
  const opts = pnp.resolveFileImportOptions(fileName)
  if (opts?.mapping) return opts.mapping
  const auto = parsePnPPreview(layer.file.content, {
    skipRows: opts?.skipRows,
    skipBottomRows: opts?.skipBottomRows,
    unitOverride: resolveSelectedPnpUnitOverride(fileName),
    fixedColumns: opts?.fixedColumns,
  }, fileName).mapping
  return auto ?? {}
})
const selectedLayerMappingFields = computed<Array<{ key: string; label: string }>>(() => {
  if (isSelectedLayerBom.value) return bomMappingFields.map(f => ({ key: f.key, label: f.label }))
  if (isSelectedLayerPnp.value) return pnpMappingFields.map(f => ({ key: f.key, label: f.label }))
  return []
})
const selectedLayerMappingByField = computed<Record<string, number | undefined>>(() => {
  if (isSelectedLayerBom.value) return { ...selectedLayerBomMapping.value }
  if (isSelectedLayerPnp.value) return { ...selectedLayerPnpMapping.value }
  return {}
})

function handleFilesLayerSelect(payload: { index: number; fileName: string }) {
  filesSelectedLayerIndex.value = payload.index
  filesSelectedLayerFileName.value = payload.fileName
  filesSelectedDocId.value = null
  filesPreviewSelectionNonce.value++
}

function handleFilesDocSelect(id: string) {
  filesSelectedDocId.value = id
  filesSelectedLayerFileName.value = null
  filesSelectedLayerIndex.value = null
}

function isTabularPreviewFileName(fileName: string): boolean {
  return /\.(csv|tsv|txt|xlsx|xls)$/i.test(fileName)
}

async function persistLayerTextContent(fileName: string) {
  const layer = layers.value.find(l => l.file.fileName === fileName)
  if (!layer) return
  const nextContent = layer.file.content
  try {
    if (isTeamProject && teamProjectId) {
      const teamId = currentTeamId.value || await waitForTeamId()
      const { error } = await uploadTeamFile(teamProjectId, teamId, 1, layer.file.fileName, nextContent, layer.type)
      if (error) throw error
    } else {
      await updateFileContent(projectId, 1, layer.file.fileName, nextContent)
    }
    const canvas = boardCanvasRef.value
    if (canvas) canvas.invalidateCache(layer.file.fileName)
  } catch (err) {
    console.warn('[files] failed to persist edited layer content', err)
    toast.add({
      title: 'Save failed',
      description: `Could not save ${layer.file.fileName}.`,
      color: 'error',
    })
  }
}

function queueLayerTextPersist(fileName: string) {
  const existing = filesSaveTimers.get(fileName)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    filesSaveTimers.delete(fileName)
    void persistLayerTextContent(fileName)
  }, 350)
  filesSaveTimers.set(fileName, timer)
}

function updateSelectedLayerText(nextContent: string) {
  if (!ensureTabEditable('files')) return
  const layer = filesSelectedLayer.value
  if (!layer || layer.file.content === nextContent) return
  layer.file.content = nextContent
  // PnP parser caches by file name/options; invalidate so edits are reflected.
  pnp.invalidateCache(layer.file.fileName)
  queueLayerTextPersist(layer.file.fileName)
}

function mutateSelectedBomImportOptions(
  fileName: string,
  mutator: (prev: BomImportOptionEntry) => BomImportOptionEntry,
) {
  const currentMap = { ...bom.fileImportOptions.value } as BomImportOptionsSnapshot
  const previous = { ...(bom.resolveFileImportOptions(fileName) ?? currentMap[fileName] ?? {}) }
  const nextOptions = mutator(previous)
  const nextMap = buildCanonicalImportOptionMap(currentMap, fileName, nextOptions)
  if (areBomImportOptionsEqual(toBomImportOptionsSnapshot(currentMap), toBomImportOptionsSnapshot(nextMap))) return
  bom.setFileImportOptionsMap(nextMap)
}

function mutateSelectedPnpImportOptions(
  fileName: string,
  mutator: (prev: PnpImportOptionEntry) => PnpImportOptionEntry,
) {
  const currentMap = { ...pnp.fileImportOptions.value } as PnpImportOptionsSnapshot
  const previous = { ...(pnp.resolveFileImportOptions(fileName) ?? currentMap[fileName] ?? {}) }
  const nextOptions = mutator(previous)
  const nextMap = buildCanonicalImportOptionMap(currentMap, fileName, nextOptions)
  if (arePnpImportOptionsEqual(toPnpImportOptionsSnapshot(currentMap), toPnpImportOptionsSnapshot(nextMap))) return
  pnp.setFileImportOptionsMap(nextMap)
}

function updateSelectedLayerPnpUnit(value: unknown) {
  const layer = filesSelectedLayer.value
  if (!layer || !isSelectedLayerPnp.value) return
  const raw = String(value ?? 'auto')
  const unitOverride: 'auto' | PnPCoordUnit =
    raw === 'mm' || raw === 'mils' || raw === 'inches' ? raw : 'auto'
  mutateSelectedPnpImportOptions(layer.file.fileName, prev => ({ ...prev, unitOverride }))
}

function updateSelectedLayerSkipRows(value: number) {
  const layer = filesSelectedLayer.value
  if (!layer) return
  const skipRows = Math.max(0, Number(value) || 0)
  if (isSelectedLayerBom.value) {
    mutateSelectedBomImportOptions(layer.file.fileName, prev => ({ ...prev, skipRows }))
    return
  }
  if (isSelectedLayerPnp.value) {
    mutateSelectedPnpImportOptions(layer.file.fileName, prev => ({ ...prev, skipRows }))
  }
}

function updateSelectedLayerSkipBottomRows(value: number) {
  const layer = filesSelectedLayer.value
  if (!layer) return
  const skipBottomRows = Math.max(0, Number(value) || 0)
  if (isSelectedLayerBom.value) {
    mutateSelectedBomImportOptions(layer.file.fileName, prev => ({ ...prev, skipBottomRows }))
    return
  }
  if (isSelectedLayerPnp.value) {
    mutateSelectedPnpImportOptions(layer.file.fileName, prev => ({ ...prev, skipBottomRows }))
  }
}

function updateSelectedLayerMappingByField(next: Record<string, number | undefined>) {
  const layer = filesSelectedLayer.value
  if (!layer) return
  if (isSelectedLayerBom.value) {
    mutateSelectedBomImportOptions(layer.file.fileName, prev => ({ ...prev, mapping: next as BomColumnMapping }))
    return
  }
  if (isSelectedLayerPnp.value) {
    mutateSelectedPnpImportOptions(layer.file.fileName, prev => ({ ...prev, mapping: next as PnPColumnMapping }))
  }
}

function updateSelectedLayerFixedColumns(next: number[]) {
  const layer = filesSelectedLayer.value
  if (!layer) return
  const fixedColumns = sanitizeFixedColumns(next)

  const arraysEqual = (a?: readonly number[], b?: readonly number[]) => {
    const aa = a ?? []
    const bb = b ?? []
    if (aa.length !== bb.length) return false
    for (let i = 0; i < aa.length; i++) {
      if (aa[i] !== bb[i]) return false
    }
    return true
  }

  if (isSelectedLayerBom.value) {
    const prev = bom.resolveFileImportOptions(layer.file.fileName)
    if (arraysEqual(prev?.fixedColumns, fixedColumns)) return
    mutateSelectedBomImportOptions(layer.file.fileName, opts => ({ ...opts, fixedColumns }))
    return
  }
  if (isSelectedLayerPnp.value) {
    const prev = pnp.resolveFileImportOptions(layer.file.fileName)
    if (arraysEqual(prev?.fixedColumns, fixedColumns)) return
    mutateSelectedPnpImportOptions(layer.file.fileName, opts => ({ ...opts, fixedColumns }))
  }
}

function updateSelectedLayerDelimiter(next: ',' | ';' | '\t' | 'fixed') {
  const layer = filesSelectedLayer.value
  if (!layer) return
  if (isSelectedLayerBom.value) {
    const prev = bom.resolveFileImportOptions(layer.file.fileName)
    if (prev?.delimiter === next) return
    mutateSelectedBomImportOptions(layer.file.fileName, opts => ({ ...opts, delimiter: next }))
    return
  }
  if (isSelectedLayerPnp.value) {
    const prev = pnp.resolveFileImportOptions(layer.file.fileName)
    if (prev?.delimiter === next) return
    mutateSelectedPnpImportOptions(layer.file.fileName, opts => ({ ...opts, delimiter: next }))
  }
}

function updateSelectedLayerDecimal(next: '.' | ',') {
  const layer = filesSelectedLayer.value
  if (!layer) return
  if (isSelectedLayerBom.value) {
    const prev = bom.resolveFileImportOptions(layer.file.fileName)
    if (prev?.decimal === next) return
    mutateSelectedBomImportOptions(layer.file.fileName, opts => ({ ...opts, decimal: next }))
    return
  }
  if (isSelectedLayerPnp.value) {
    const prev = pnp.resolveFileImportOptions(layer.file.fileName)
    if (prev?.decimal === next) return
    mutateSelectedPnpImportOptions(layer.file.fileName, opts => ({ ...opts, decimal: next }))
  }
}

function updateSelectedLayerExtraColumns(next: string[]) {
  const layer = filesSelectedLayer.value
  if (!layer || !isSelectedLayerBom.value) return
  mutateSelectedBomImportOptions(layer.file.fileName, prev => ({
    ...prev,
    extraColumns: next.length > 0 ? next : undefined,
  }))
}

function resolveSelectedPnpUnitOverride(layerFileName: string): PnPCoordUnit | undefined {
  const fileOverride = pnp.resolveFileImportOptions(layerFileName)?.unitOverride
  if (fileOverride && fileOverride !== 'auto') return fileOverride
  return pnp.coordUnitOverride.value === 'auto' ? undefined : pnp.coordUnitOverride.value
}

watch([sidebarTab, () => layers.value.length], ([tab]) => {
  if (tab !== 'files') return
  if (filesSelectedLayerFileName.value || filesSelectedDocId.value) return
  if (layers.value.length > 0) {
    filesSelectedLayerIndex.value = 0
    filesSelectedLayerFileName.value = layers.value[0].file.fileName
    filesSelectedDocId.value = null
  } else if (documents.value.length > 0) {
    filesSelectedDocId.value = documents.value[0].id
    filesSelectedLayerIndex.value = null
    filesSelectedLayerFileName.value = null
  }
}, { immediate: true })

// Restore file selection from URL query param — uses a one-time watcher that
// waits until the requested file appears in the layers array (files load
// incrementally, so BOM/PnP layers may arrive after gerber layers).
if (initialFileQuery) {
  const stopInitialFileWatch = watch(
    () => layers.value.map(l => l.file.fileName),
    (fileNames) => {
      const idx = fileNames.indexOf(initialFileQuery!)
      if (idx < 0) return
      filesSelectedLayerIndex.value = idx
      filesSelectedLayerFileName.value = initialFileQuery!
      filesSelectedDocId.value = null
      filesPreviewSelectionNonce.value++
      stopInitialFileWatch()
    },
    { immediate: true },
  )
}

watch(
  () => filesSelectedLayer.value?.file.fileName,
  () => {
    filesPreviewMode.value = canSelectedLayerUseTablePreview.value ? 'table' : 'text'
  },
  { immediate: true },
)

// Sync selected file name to URL so reload/share restores the same file
watch(filesSelectedLayerFileName, (fileName) => {
  if (sidebarTab.value !== 'files') return
  const query = { ...route.query }
  if (fileName) query.file = fileName
  else delete query.file
  router.replace({ query })
})

/** Try to guess document type from filename. */
function guessDocumentType(fileName: string): DocumentType {
  const lower = fileName.toLowerCase()
  if (/schematic/i.test(lower)) return 'Schematics'
  if (/drawing|drw|assy|assembly/i.test(lower)) return 'Drawings'
  if (/datasheet|ds\b/i.test(lower)) return 'Datasheets'
  if (/instruction|manual|guide/i.test(lower)) return 'Instructions'
  return 'Drawings'
}

async function handleDocumentsAdd(files: File[]) {
  if (!ensureTabEditable('files')) return
  let firstNewId: string | null = null
  for (const file of files) {
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const docType = guessDocumentType(file.name)
    const blobUrl = URL.createObjectURL(file)
    const entry: ProjectDocument = { id, name: file.name, type: docType, blobUrl }
    documentSizeById.value[id] = file.size
    // Persist
    if (isTeamProject && teamProjectId) {
      const teamId = currentTeamId.value || await waitForTeamId()
      const { doc } = await uploadTeamDocument(teamProjectId, teamId, file.name, file, docType)
      if (doc) {
        entry.dbId = doc.id
        entry.storagePath = doc.storage_path
      }
    } else {
      await addDocument(projectId, file.name, docType, file)
    }
    documents.value.push(entry)
    if (!firstNewId) firstNewId = id
  }
  documents.value = applyDocumentOrder(documents.value)
  syncDocumentOrderFromDocuments()
  // Switch to Files and preview the first new document
  if (firstNewId) {
    selectedDocumentId.value = firstNewId
    filesSelectedDocId.value = firstNewId
    filesSelectedLayerIndex.value = null
    filesSelectedLayerFileName.value = null
    sidebarTab.value = 'files'
  }
}

async function handleDocumentRemove(id: string) {
  if (!ensureTabEditable('files')) return
  const idx = documents.value.findIndex(d => d.id === id)
  if (idx < 0) return
  const doc = documents.value[idx]
  delete documentSizeById.value[id]
  URL.revokeObjectURL(doc.blobUrl)
  documents.value.splice(idx, 1)
  if (selectedDocumentId.value === id) {
    selectedDocumentId.value = documents.value.length > 0 ? documents.value[0].id : null
  }
  if (filesSelectedDocId.value === id) {
    filesSelectedDocId.value = documents.value.length > 0 ? documents.value[0].id : null
    filesSelectedLayerIndex.value = null
  }
  // Switch away from docs tab when all documents are removed
  if (documents.value.length === 0 && sidebarTab.value === 'docs') {
    sidebarTab.value = 'files'
  }
  syncDocumentOrderFromDocuments()
  // Remove from storage
  if (isTeamProject && doc.dbId && doc.storagePath) {
    await deleteTeamDocument(doc.dbId, doc.storagePath)
  } else if (!isTeamProject) {
    await removeDocumentFromDb(projectId, doc.name)
  }
}

function handleDocumentSelect(id: string) {
  selectedDocumentId.value = id
}

function moveDocument(fromIndex: number, toIndex: number) {
  const arr = [...documents.value]
  const [moved] = arr.splice(fromIndex, 1)
  if (!moved) return
  arr.splice(toIndex, 0, moved)
  documents.value = arr
  syncDocumentOrderFromDocuments()
}

async function downloadDocument(id: string) {
  const doc = documents.value.find(d => d.id === id)
  if (!doc) return
  const blob = await fetch(doc.blobUrl).then(r => r.blob())
  await saveBlobFile(blob, doc.name)
}

async function downloadLayer(index: number) {
  const layer = layers.value[index]
  if (!layer) return
  const lowerName = layer.file.fileName.toLowerCase()
  let blob: Blob

  if ((lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) && /^data:.*;base64,/i.test(layer.file.content)) {
    const match = layer.file.content.match(/^data:(.*);base64,(.+)$/i)
    if (match?.[2]) {
      const binary = atob(match[2])
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      blob = new Blob([bytes], { type: match[1] || 'application/octet-stream' })
    } else {
      blob = new Blob([layer.file.content], { type: 'text/plain;charset=utf-8' })
    }
  } else {
    blob = new Blob([layer.file.content], { type: 'text/plain;charset=utf-8' })
  }

  await saveBlobFile(blob, layer.file.fileName)
}

async function downloadSelectedLayer() {
  if (!filesSelectedLayer.value) return
  const idx = layers.value.findIndex(l => l.file.fileName === filesSelectedLayer.value!.file.fileName)
  if (idx >= 0) await downloadLayer(idx)
}

function handleDocumentTypeUpdate(id: string, type: DocumentType) {
  if (!ensureTabEditable('files')) return
  const doc = documents.value.find(d => d.id === id)
  if (!doc) return
  doc.type = type
  if (isTeamProject && doc.dbId) {
    updateTeamDocumentType(doc.dbId, type)
  } else if (!isTeamProject) {
    updateDocumentTypeInDb(projectId, doc.name, type)
  }
}

// Clean up all blob URLs on unmount
onUnmounted(() => {
  for (const timer of filesSaveTimers.values()) clearTimeout(timer)
  filesSaveTimers.clear()
  for (const doc of documents.value) URL.revokeObjectURL(doc.blobUrl)
  if (perfRefreshTimer) clearInterval(perfRefreshTimer)
  if (gerberPrewarmTimer) clearTimeout(gerberPrewarmTimer)
  stopPerfFrameLoop()
  stopLongTaskObserver()
  gerberTreeCache.clearAll()
})

// ── BOM ──
const bom = useBom(layers)
const elexess = useElexessApi()
const spark = useAiEnrichment()
const toast = useToast()

watch(pricingQuantities, (list) => {
  if (!list.includes(bom.boardQuantity.value)) {
    bom.boardQuantity.value = list[0]
  }
}, { immediate: true })

const bomSplitEl = ref<HTMLElement | null>(null)
const bomLeftPct = bomSplit.pct
const bomDragging = bomSplit.dragging

const bomCpLines = computed(() => (bom.bomLines.value as BomLine[]).filter(l => l.customerProvided && !l.dnp))
const bomCpCopied = ref(false)
let bomCpCopyTimeout: ReturnType<typeof setTimeout> | undefined

function copyBomCpItems() {
  if (bomCpLines.value.length === 0) return
  const text = bomCpLines.value.map((line) => {
    const refs = line.references || '—'
    const parts = [line.description, line.package, line.type].filter(Boolean).join('/')
    return `${refs} = ${parts}`
  }).join('\n')
  navigator.clipboard.writeText(text).then(() => {
    bomCpCopied.value = true
    if (bomCpCopyTimeout) clearTimeout(bomCpCopyTimeout)
    bomCpCopyTimeout = setTimeout(() => { bomCpCopied.value = false }, 1500)
  })
}

const selectedBomLineId = ref<string | null>(null)
const selectedBomLine = computed(() => {
  const id = selectedBomLineId.value
  if (!id) return null
  return (bom.bomLines.value as BomLine[]).find(l => l.id === id) ?? null
})

watch([sidebarTab, () => (bom.filteredLines.value as BomLine[])], ([tab, filtered]) => {
  if (tab !== 'bom') return
  if (filtered.length === 0) {
    selectedBomLineId.value = null
    return
  }
  if (!selectedBomLineId.value || !filtered.some(l => l.id === selectedBomLineId.value)) {
    selectedBomLineId.value = filtered[0].id
  }
}, { immediate: true })

function onBomDragStart(e: MouseEvent) {
  if (!bomSplitEl.value) return
  bomSplit.onDragStart(e, bomSplitEl.value)
}

// ── BOM ↔ PnP cross-reference designator sets ──

function normalizeDesignator(value: string): string {
  return String(value ?? '').trim().toUpperCase()
}

function parseBomRefs(refs: string): string[] {
  if (!refs) return []
  return refs
    .split(/[,;\s]+/)
    .map(normalizeDesignator)
    .filter(Boolean)
}

/** Designators present in SMD PnP, excluding DNP components */
const pnpSmdDesignators = computed(() => {
  const s = new Set<string>()
  for (const c of pnp.smdActiveComponents.value) {
    if (!c.dnp) s.add(normalizeDesignator(c.designator))
  }
  return s
})

/** Designators present in THT PnP, excluding DNP components */
const pnpThtDesignators = computed(() => {
  const s = new Set<string>()
  for (const c of pnp.thtActiveComponents.value) {
    if (!c.dnp) s.add(normalizeDesignator(c.designator))
  }
  return s
})

/** Designators present in PnP (SMD + THT), excluding DNP components */
const pnpDesignators = computed(() => {
  const s = new Set<string>()
  for (const c of pnp.smdActiveComponents.value) {
    if (!c.dnp) s.add(c.designator)
  }
  for (const c of pnp.thtActiveComponents.value) {
    if (!c.dnp) s.add(c.designator)
  }
  return s
})

function inferBomLineTypeFromReferences(references: string): BomLine['type'] | null {
  const refs = parseBomRefs(references)
  if (refs.length === 0) return null
  const hasSmd = refs.some(ref => pnpSmdDesignators.value.has(ref))
  const hasTht = refs.some(ref => pnpThtDesignators.value.has(ref))
  if (hasSmd && !hasTht) return 'SMD'
  if (hasTht && !hasSmd) return 'THT'
  return null
}

/** Designators present in BOM (all non-DNP lines, split from comma-separated refs) */
const bomDesignators = computed(() => {
  const s = new Set<string>()
  for (const line of bom.bomLines.value) {
    if (line.dnp) continue
    const refs = parseBomRefs(line.references || '')
    for (const r of refs) s.add(r)
  }
  return s
})

watch([() => bom.bomLines.value, pnpSmdDesignators, pnpThtDesignators], () => {
  for (const line of bom.bomLines.value) {
    const inferred = inferBomLineTypeFromReferences(line.references)
    if (!inferred || inferred === line.type) continue
    bom.updateLine(line.id, { type: inferred })
  }
}, { deep: false })


// Auto-switch to SMD tab when PnP layers appear for the first time
// (skip if the URL already specified a tab)
const hadExplicitTab = !!route.query.tab

watch(pnp.hasPnP, (has) => {
  if (has && sidebarTab.value === 'files' && !hadExplicitTab) {
    sidebarTab.value = 'smd'
  }
})

watch(isPanelizedMode, (enabled) => {
  if (!enabled && sidebarTab.value === 'panel') {
    sidebarTab.value = 'pcb'
  }
}, { immediate: true })

watch(hasPasteLayers, (has) => {
  if (!has && sidebarTab.value === 'paste') {
    sidebarTab.value = 'pcb'
  }
}, { immediate: true })

// Auto-switch to BOM tab when BOM data appears and no PnP
watch(bom.hasBom, (has) => {
  if (has && sidebarTab.value === 'files' && !pnp.hasPnP.value && !hadExplicitTab) {
    sidebarTab.value = 'bom'
  }
})

// Tab visibility: use cached values until data loads, then switch to live values.
// This prevents tabs from "popping in" on every page load.
const effectiveShowPanel = computed(() =>
  hasLoadedProjectData.value ? isPanelizedMode.value : (cachedTabVisibility.value.panel || isPanelizedMode.value),
)
const effectiveShowPaste = computed(() => hasPasteLayers.value)
const effectiveShowPnP = computed(() =>
  hasLoadedProjectData.value ? pnp.hasPnP.value : (cachedTabVisibility.value.pnp || pnp.hasPnP.value),
)
const effectiveShowBom = computed(() =>
  hasLoadedProjectData.value ? bom.hasBom.value : (cachedTabVisibility.value.bom || bom.hasBom.value),
)
const effectiveShowDocs = computed(() =>
  hasLoadedProjectData.value ? hasDocuments.value : (cachedTabVisibility.value.docs || hasDocuments.value),
)

watch(
  [isPanelizedMode, () => pnp.hasPnP.value, () => bom.hasBom.value, hasDocuments],
  ([panel, pnpVal, bomVal, docs]) => {
    if (!hasLoadedProjectData.value) return
    cachedTabVisibility.value = { panel, pnp: pnpVal, bom: bomVal, docs }
  },
  { immediate: true },
)

// Show field mapping modal when needed
watch(bom.needsFieldMapping, (needs) => {
  // Mapping is now adjusted inline in the Files tab table mapping popover.
  // Keep this watcher to acknowledge unresolved mappings without forcing a modal.
  void needs
})

// Keep group assignments clean when components/groups change.
watch([() => pnp.allComponents.value.map(c => c.key), pnpComponentGroups], ([keys, groups]) => {
  if (!hasLoadedProjectData.value) return
  if (keys.length === 0) return
  const validKeys = new Set(keys)
  const validGroups = new Set(groups.map(g => g.id))
  let changed = false
  const next: Record<string, string> = {}
  for (const [componentKey, groupId] of Object.entries(pnpGroupAssignments.value)) {
    if (!validKeys.has(componentKey) || !validGroups.has(groupId)) {
      changed = true
      continue
    }
    next[componentKey] = groupId
  }
  if (changed) pnpGroupAssignments.value = next
}, { deep: true })

watch(() => pnp.allComponents.value, (all) => {
  if (!hasLoadedProjectData.value) return
  if (all.length === 0) return
  const smdKeys = new Set(all.filter(c => c.componentType === 'smd').map(c => c.key))
  const thtKeys = new Set(all.filter(c => c.componentType === 'tht').map(c => c.key))

  const nextSmd = pnpManualOrderSmd.value.filter(k => smdKeys.has(k))
  for (const key of smdKeys) {
    if (!nextSmd.includes(key)) nextSmd.push(key)
  }
  if (nextSmd.length !== pnpManualOrderSmd.value.length || nextSmd.some((k, i) => k !== pnpManualOrderSmd.value[i])) {
    pnpManualOrderSmd.value = nextSmd
  }

  const nextTht = pnpManualOrderTht.value.filter(k => thtKeys.has(k))
  for (const key of thtKeys) {
    if (!nextTht.includes(key)) nextTht.push(key)
  }
  if (nextTht.length !== pnpManualOrderTht.value.length || nextTht.some((k, i) => k !== pnpManualOrderTht.value[i])) {
    pnpManualOrderTht.value = nextTht
  }
}, { deep: false })

// Sync toolbar's All/Top/Bot filter with PnP side filter
watch(activeFilter, (filter) => {
  if (filter === 'top') pnp.activeSideFilter.value = 'top'
  else if (filter === 'bot') pnp.activeSideFilter.value = 'bottom'
  else pnp.activeSideFilter.value = 'all'
}, { immediate: true })

// ── Persist PnP data to local DB or Supabase ──────────────────────────

let teamPersistQueue: Promise<void> = Promise.resolve()
let pendingTeamUpdates: Record<string, any> = {}
let pendingLocalPageLocks: PageLocksRecord | null = null
let pendingLocalPasteSettings: ReturnType<typeof toPasteSettingsSnapshot> | null = null
let pendingLocalPcbData: PcbDataSnapshot | null = null
let pendingLocalBomFileImportOptions: BomImportOptionsSnapshot | null = null
let pendingLocalPnpFileImportOptions: PnpImportOptionsSnapshot | null = null

function persistToProject(updates: Record<string, any>): Promise<void> {
  if (!isTeamProject || !teamProjectId) return Promise.resolve()
  if (!hasLoadedProjectData.value) {
    pendingTeamUpdates = { ...pendingTeamUpdates, ...updates }
    return Promise.resolve()
  }
  // Serialize writes so stale async responses cannot overwrite newer edits.
  teamPersistQueue = teamPersistQueue.then(async () => {
    const mapped: Record<string, any> = {}
    for (const [k, v] of Object.entries(updates)) {
      // Strip Vue reactivity to ensure clean JSON serialization for Supabase
      const rawValue = (v != null && typeof v === 'object') ? toRaw(v) : v
      const raw = (rawValue != null && typeof rawValue === 'object')
        ? JSON.parse(JSON.stringify(rawValue))
        : rawValue
      mapped[k.replace(/[A-Z]/g, m => '_' + m.toLowerCase())] = raw
    }
    if (Object.keys(mapped).length === 0) return
    if (import.meta.dev && 'pcb_data' in mapped) {
      console.debug('[viewer] Persist pcb_data payload', mapped.pcb_data)
    }
    const { data, error } = await updateTeamProject(teamProjectId, mapped)
    if (error) {
      const message = String(error.message ?? '')
      const missingColumn = message.includes('Could not find the')
        && message.includes('column')
      if (missingColumn) {
        const missingColumnName = message.match(/Could not find the '([^']+)' column/i)?.[1]
        if (missingColumnName && missingColumnName in mapped) {
          // Retry without only the missing field so unrelated updates still persist.
          const retryPayload: Record<string, any> = { ...mapped }
          delete retryPayload[missingColumnName]
          if (Object.keys(retryPayload).length > 0) {
            const retry = await updateTeamProject(teamProjectId, retryPayload)
            if (retry.error) {
              console.warn('[viewer] Failed retry after dropping missing column:', retry.error.message ?? retry.error)
            }
          }
          return
        }
        // Skip persists for columns that don't exist in the schema yet
        console.warn('[viewer] Skipping persist for missing column:', message)
        return
      }
      console.warn('[viewer] Failed to persist team project updates:', error.message ?? error)
      if (import.meta.dev && 'pcb_data' in mapped) {
        console.debug('[viewer] pcb_data persist error payload', mapped.pcb_data)
      }
    } else if (!data) {
      console.warn('[viewer] Persist returned no data (possible RLS issue):', Object.keys(mapped))
      if (import.meta.dev && 'pcb_data' in mapped) {
        console.debug('[viewer] pcb_data persist returned no data', mapped.pcb_data)
      }
    } else if (import.meta.dev && 'pcb_data' in mapped) {
      console.debug('[viewer] pcb_data persist success')
    }
  }).catch((err) => {
    console.warn('[viewer] Persist queue failed:', err)
  })
  return teamPersistQueue
}

watch(hasLoadedProjectData, (loaded) => {
  if (!loaded || !isTeamProject || !teamProjectId) return
  if (Object.keys(pendingTeamUpdates).length === 0) return
  const buffered = { ...pendingTeamUpdates }
  pendingTeamUpdates = {}
  persistToProject(buffered)
})

// Persist PnP origin to database when it changes
watch([pnp.originX, pnp.originY], ([ox, oy]) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ pnpOriginX: ox, pnpOriginY: oy })
  } else {
    updateProjectOrigin(projectId, ox, oy)
  }
})

// Persist per-component PnP rotation overrides to database
watch(pnp.rotationOverridesRecord, (overrides) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ pnpRotationOverrides: overrides })
  } else {
    updateProjectRotationOverrides(projectId, overrides)
  }
}, { deep: true })

// Persist DNP component keys to database
watch(pnp.dnpRecord, (keys) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ pnpDnpComponents: keys })
  } else {
    updateProjectDnp(projectId, keys)
  }
}, { deep: true })

// Persist CAD package -> library package mapping
watch(pnp.cadPackageMapRecord, (map) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ pnpCadPackageMap: map })
  } else {
    updateProjectCadPackageMap(projectId, map)
  }
}, { deep: true })

// Persist polarized overrides
watch(pnp.polarizedOverridesRecord, (overrides) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ pnpPolarizedOverrides: overrides })
  } else {
    updateProjectPolarizedOverrides(projectId, overrides)
  }
}, { deep: true })

// Persist component notes
watch(pnp.componentNotesRecord, (notes) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ pnpComponentNotes: notes })
  } else {
    updateProjectComponentNotes(projectId, notes)
  }
}, { deep: true })

// Persist field overrides
watch(pnp.fieldOverridesRecord, (overrides) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ pnpFieldOverrides: overrides })
  } else {
    updateProjectFieldOverrides(projectId, overrides)
  }
}, { deep: true })

// Persist manual components
watch(pnp.manualComponentsRecord, (components) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ pnpManualComponents: components })
  } else {
    updateProjectManualComponents(projectId, components)
  }
}, { deep: true })

// Persist deleted component keys to database
watch(pnp.deletedKeysRecord, (keys) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ pnpDeletedComponents: keys })
  } else {
    updateProjectDeletedComponents(projectId, keys)
  }
}, { deep: true })

// Persist per-tab sort state
watch(pnpSortSmd, (state) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ pnpSortSmd: state })
  } else {
    updateProjectSortSmd(projectId, state)
  }
}, { deep: true })

watch(pnpSortTht, (state) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ pnpSortTht: state })
  } else {
    updateProjectSortTht(projectId, state)
  }
}, { deep: true })

watch(pnpManualOrderSmd, (keys) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ pnpManualOrderSmd: keys })
  } else {
    updateProjectManualOrderSmd(projectId, keys)
  }
}, { deep: true })

watch(pnpManualOrderTht, (keys) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ pnpManualOrderTht: keys })
  } else {
    updateProjectManualOrderTht(projectId, keys)
  }
}, { deep: true })

// Persist PnP grouping (group definitions + assignments)
watch(pnpComponentGroups, (groups) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ pnpComponentGroups: groups })
  } else {
    updateProjectComponentGroups(projectId, groups)
  }
}, { deep: true })

watch(pnpGroupAssignments, (assignments) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ pnpGroupAssignments: assignments })
  } else {
    updateProjectGroupAssignments(projectId, assignments)
  }
}, { deep: true })

watch(() => pnp.assemblyTypeOverridesRecord.value, (types) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ pnpAssemblyTypes: types })
  } else {
    updatePnpAssemblyTypes(projectId, types)
  }
}, { deep: true })

// ── Persist BOM data ──

watch(bom.bomLinesRecord, (lines) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ bomLines: lines })
  } else {
    updateBomLines(projectId, lines)
  }
}, { deep: true })

watch(bom.bomGroupsRecord, (groups) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ bomGroups: groups })
  } else {
    updateBomGroups(projectId, groups)
  }
}, { deep: true })

watch(bom.pricingCacheRecord, (cache) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ bomPricingCache: cache })
  } else {
    updateBomPricingCache(projectId, cache)
  }
}, { deep: true })

watch(() => bom.boardQuantity.value, (qty) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ bomBoardQuantity: qty })
  } else {
    updateBomBoardQuantity(projectId, qty)
  }
})

watch(() => spark.aiSuggestions.value, (suggestions) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ bomAiSuggestions: suggestions })
  }
}, { deep: true })

watch(bom.fileImportOptionsRecord, (options) => {
  if (!hasLoadedProjectData.value) return
  const snapshot = toBomImportOptionsSnapshot(options)
  if (hasImportOptions(snapshot)) saveTeamImportOptionsBackup('bom', snapshot)
  if (isTeamProject) {
    pendingLocalBomFileImportOptions = snapshot
    void persistToProject({ bomFileImportOptions: snapshot }).finally(() => {
      if (pendingLocalBomFileImportOptions && areBomImportOptionsEqual(pendingLocalBomFileImportOptions, snapshot)) {
        pendingLocalBomFileImportOptions = null
      }
    })
  } else {
    updateLocalBomFileImportOptions(projectId, snapshot)
  }
}, { deep: true })

watch(pnp.fileImportOptionsRecord, (options) => {
  if (!hasLoadedProjectData.value) return
  const snapshot = toPnpImportOptionsSnapshot(options)
  if (hasImportOptions(snapshot)) saveTeamImportOptionsBackup('pnp', snapshot)
  if (isTeamProject) {
    pendingLocalPnpFileImportOptions = snapshot
    void persistToProject({ pnpFileImportOptions: snapshot }).finally(() => {
      if (pendingLocalPnpFileImportOptions && arePnpImportOptionsEqual(pendingLocalPnpFileImportOptions, snapshot)) {
        pendingLocalPnpFileImportOptions = null
      }
    })
  } else {
    updateLocalPnpFileImportOptions(projectId, snapshot)
  }
}, { deep: true })

watch(pcbData, (data) => {
  if (!hasLoadedProjectData.value) return
  const snapshot = toPcbDataSnapshot(data)
  if (isTeamProject) {
    pendingLocalPcbData = snapshot
    if (import.meta.dev) {
      console.debug('[viewer] queue pcbData persist', snapshot)
    }
    void persistToProject({ pcbData: snapshot }).finally(() => {
      if (pendingLocalPcbData && arePcbDataEqual(pendingLocalPcbData, snapshot)) {
        pendingLocalPcbData = null
      }
    })
  } else {
    updatePcbData(projectId, snapshot)
  }
}, { deep: true })

watch(panelData, (data) => {
  if (!hasLoadedProjectData.value) return
  const snapshot = normalizePanelConfig(data)
  if (isTeamProject) {
    persistToProject({ panelData: snapshot })
  } else {
    updatePanelData(projectId, snapshot)
  }
}, { deep: true })

watch(pasteSettings, (settings) => {
  if (!hasLoadedProjectData.value) return
  const snapshot = toPasteSettingsSnapshot(settings)
  if (isTeamProject) {
    pendingLocalPasteSettings = snapshot
    void persistToProject({ pasteSettings: { ...snapshot } }).finally(() => {
      if (pendingLocalPasteSettings && arePasteSettingsEqual(pendingLocalPasteSettings, snapshot)) {
        pendingLocalPasteSettings = null
      }
    })
  } else {
    updateLocalPasteSettings(projectId, { ...snapshot })
  }
}, { deep: true })

watch(layerOrder, (order) => {
  if (!hasLoadedProjectData.value) return
  const snapshot = [...order]
  if (isTeamProject) {
    persistToProject({ layerOrder: snapshot })
  } else {
    updateLocalLayerOrder(projectId, snapshot)
  }
}, { deep: true })

watch(documentOrder, (order) => {
  if (!hasLoadedProjectData.value) return
  const snapshot = [...order]
  if (isTeamProject) {
    persistToProject({ documentOrder: snapshot })
  } else {
    updateLocalDocumentOrder(projectId, snapshot)
  }
}, { deep: true })

// BOM pricing fetch handlers
async function handleFetchAllPricing() {
  if (!ensureTabEditable('bom')) return
  const updatedCache = await elexess.fetchAllPricing(
    bom.bomLines.value as BomLine[],
    bom.pricingCache.value as Record<string, any>,
  )
  bom.updatePricingCache(updatedCache)
  if (isTeamProject) {
    await persistToProject({ bomPricingCache: updatedCache })
  }
}

async function handleFetchSinglePricing(partNumber: string) {
  if (!ensureTabEditable('bom')) return
  const entry = await elexess.fetchSinglePricing(partNumber)
  if (entry) {
    bom.updateSinglePricing(partNumber, entry.data)
    if (isTeamProject) {
      await persistToProject({ bomPricingCache: bom.pricingCache.value as Record<string, any> })
    }
  }
}

function handleBomAddLine(line?: Partial<BomLine>) {
  if (!ensureTabEditable('bom')) return
  const baseLine: Partial<BomLine> = line ?? {}
  const inferredType = inferBomLineTypeFromReferences(String(baseLine.references ?? ''))
  const nextLine: Partial<BomLine> = inferredType ? { ...baseLine, type: inferredType } : baseLine
  if (line?.id) {
    bom.updateLine(line.id, nextLine)
  } else {
    bom.addLine(Object.keys(nextLine).length > 0 ? nextLine : undefined)
  }
}

function handleBomUpdateLine(id: string, updates: Partial<BomLine>) {
  if (!ensureTabEditable('bom')) return
  const current = bom.bomLines.value.find(l => l.id === id)
  const nextRefs = updates.references ?? current?.references ?? ''
  const inferredType = inferBomLineTypeFromReferences(String(nextRefs))
  const nextUpdates = inferredType ? { ...updates, type: inferredType } : updates
  bom.updateLine(id, nextUpdates)
}

function handleBomRemoveLine(id: string) {
  if (!ensureTabEditable('bom')) return
  bom.removeLine(id)
}

function handleBomAddManufacturer(lineId: string, mfr: { manufacturer: string; manufacturerPart: string }) {
  if (!ensureTabEditable('bom')) return
  bom.addManufacturer(lineId, mfr)
}

function handleBomRemoveManufacturer(lineId: string, idx: number) {
  if (!ensureTabEditable('bom')) return
  bom.removeManufacturer(lineId, idx)
}

function handleBomAddGroup(name: string) {
  if (!ensureTabEditable('bom')) return
  bom.addGroup(name)
}

function handleBomRemoveGroup(groupId: string) {
  if (!ensureTabEditable('bom')) return
  bom.removeGroup(groupId)
}

function handleBomUpdateGroup(groupId: string, updates: Partial<Omit<BomGroup, 'id'>>) {
  if (!ensureTabEditable('bom')) return
  bom.updateGroup(groupId, updates)
}

function handleBomAssignGroup(lineId: string, groupId: string | null) {
  if (!ensureTabEditable('bom')) return
  bom.assignGroup(lineId, groupId)
}

function handleBomMoveLineBefore(draggedId: string, targetId: string) {
  if (!ensureTabEditable('bom')) return
  bom.moveLineBefore(draggedId, targetId)
}

function handleBomMoveLineToEnd(draggedId: string) {
  if (!ensureTabEditable('bom')) return
  bom.moveLineToEnd(draggedId)
}

function handleBomBoardQuantityUpdate(qty: number) {
  if (!ensureTabEditable('bom')) return
  bom.boardQuantity.value = qty
}

function handlePricingQuantitiesFromBom(next: number[]) {
  if (!ensureTabEditable('bom')) return
  handlePricingQuantitiesUpdate(next)
}

function handlePricingQuantitiesFromPricing(next: number[]) {
  handlePricingQuantitiesUpdate(next)
}

// ── Spark AI handlers ──

async function handleSparkEnrich() {
  if (!canEditTab('bom')) return
  try {
    const result = await spark.enrichBom(
      bom.bomLines.value as BomLine[],
      pnp.smdActiveComponents.value,
      pnp.thtActiveComponents.value,
      (bom.bomGroups.value as BomGroup[]).map(g => ({ id: g.id, name: g.name })),
    )
    const count = Object.keys(result).length
    toast.add({
      title: count > 0 ? `Spark returned suggestions for ${count} BOM line${count === 1 ? '' : 's'}` : 'Spark found no suggestions to make',
      color: count > 0 ? 'success' : 'neutral',
    })
  } catch (err: any) {
    console.error('[Spark] Enrichment failed:', err)
    toast.add({
      title: 'Spark enrichment failed',
      description: spark.enrichError.value ?? undefined,
      color: 'error',
    })
  }
}

function handleAcceptAiSuggestion(lineId: string, field: string) {
  if (!ensureTabEditable('bom')) return
  spark.acceptSuggestion(lineId, field as keyof AiSuggestion, (id, updates) => {
    handleBomUpdateLine(id, updates)
  })
}

function handleDismissAiSuggestion(lineId: string, field: string) {
  spark.dismissSuggestion(lineId, field as keyof AiSuggestion)
}

function handleAcceptAiGroup(lineId: string, groupName: string) {
  if (!ensureTabEditable('bom')) return
  const group = bom.addGroup(groupName)
  bom.assignGroup(lineId, group.id)
  spark.dismissSuggestion(lineId, 'group')
}

function handleDismissAiGroup(lineId: string) {
  spark.dismissSuggestion(lineId, 'group')
}

function handleAcceptAllAi(lineId: string) {
  if (!ensureTabEditable('bom')) return
  spark.acceptAll(lineId, (id, updates) => {
    handleBomUpdateLine(id, updates)
  }, (id, mfr) => {
    handleBomAddManufacturer(id, mfr)
  }, (id, groupName) => {
    const group = bom.addGroup(groupName)
    bom.assignGroup(id, group.id)
  })
  sparkAdvanceAfterReview(lineId)
}

function handleDismissAllAi(lineId: string) {
  spark.dismissAll(lineId)
  sparkAdvanceAfterReview(lineId)
}

function handleAcceptAiManufacturer(lineId: string, mfr: { manufacturer: string; manufacturerPart: string }) {
  if (!ensureTabEditable('bom')) return
  handleBomAddManufacturer(lineId, mfr)
  spark.removeSuggestedManufacturer(lineId, mfr)
}

function handleDismissAiManufacturer(lineId: string, mfr: { manufacturer: string; manufacturerPart: string }) {
  spark.removeSuggestedManufacturer(lineId, mfr)
}

// ── Spark review navigation ──

const sparkReviewLineIds = computed(() => {
  const pending = spark.pendingLineIds.value
  if (pending.length === 0) return []
  const bomOrder = (bom.bomLines.value as BomLine[]).map(l => l.id)
  const pendingSet = new Set(pending)
  return bomOrder.filter(id => pendingSet.has(id))
})

const sparkReviewPosition = computed(() => {
  const ids = sparkReviewLineIds.value
  if (ids.length === 0) return 0
  const idx = ids.indexOf(selectedBomLineId.value ?? '')
  return idx >= 0 ? idx + 1 : 0
})

function sparkReviewNav(direction: 1 | -1) {
  const ids = sparkReviewLineIds.value
  if (ids.length === 0) return
  const currentIdx = ids.indexOf(selectedBomLineId.value ?? '')
  let nextIdx: number
  if (currentIdx < 0) {
    nextIdx = direction === 1 ? 0 : ids.length - 1
  } else {
    nextIdx = currentIdx + direction
    if (nextIdx < 0) nextIdx = ids.length - 1
    else if (nextIdx >= ids.length) nextIdx = 0
  }
  selectedBomLineId.value = ids[nextIdx]!
}

function sparkAdvanceAfterReview(reviewedLineId: string) {
  nextTick(() => {
    const ids = sparkReviewLineIds.value
    if (ids.length === 0) return
    if (ids.includes(reviewedLineId)) return
    const bomOrder = (bom.bomLines.value as BomLine[]).map(l => l.id)
    const reviewedBomIdx = bomOrder.indexOf(reviewedLineId)
    let best: string | null = null
    let bestDist = Infinity
    for (const id of ids) {
      const dist = bomOrder.indexOf(id) - reviewedBomIdx
      if (dist > 0 && dist < bestDist) { best = id; bestDist = dist }
    }
    selectedBomLineId.value = best ?? ids[0]!
  })
}

function handleManualOrderUpdate(type: 'smd' | 'tht', value: string[]) {
  if (!ensureTabEditable(type)) return
  if (type === 'smd') pnpManualOrderSmd.value = value
  else pnpManualOrderTht.value = value
}

// Update PnP convention and persist
function updateConvention(convention: PnPConvention) {
  if (!ensureTabEditable(sidebarTab.value === 'tht' ? 'tht' : 'smd')) return
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

const activeFilterOptions = computed(() => {
  if (viewMode.value === 'realistic') {
    return filterOptions.filter(option => option.value !== 'all')
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
const { getProject: getTeamProject, approveProject: doApprove, revertToDraft: doRevert, updateProject: updateTeamProject, getProjectFiles: getTeamFiles, downloadFile: downloadTeamFile, uploadFile: uploadTeamFile, deleteFile: deleteTeamFile, getProjectDocuments: getTeamDocuments, uploadDocument: uploadTeamDocument, downloadDocument: downloadTeamDocument, updateDocumentType: updateTeamDocumentType, deleteDocument: deleteTeamDocument, uploadPreviewImage } = useTeamProjects()

async function toggleCurrentTabLock() {
  if (!teamProjectId || !isLockableTab(sidebarTab.value) || !canToggleCurrentTabLock.value) return

  const tab = sidebarTab.value
  const before = toPageLocksSnapshot(projectPageLocks.value)
  const current = projectPageLocks.value[tab]
  const nextLocked = !current?.locked
  const next: PageLocksRecord = { ...projectPageLocks.value }
  const who = profile.value?.name?.trim()
    || profile.value?.email?.trim()
    || user.value?.email
    || 'Unknown user'

  next[tab] = {
    locked: nextLocked,
    locked_at: nextLocked ? new Date().toISOString() : null,
    locked_by: nextLocked ? (user.value?.id ?? null) : null,
    locked_by_name: nextLocked ? who : null,
  }

  // Optimistic local update so lock state changes immediately.
  pendingLocalPageLocks = toPageLocksSnapshot(next)
  pageLocksOverride.value = next
  if (project.value) project.value.pageLocks = next

  const { error } = await updateTeamProject(teamProjectId, { page_locks: next })
  if (error) {
    console.warn('Failed to update page lock:', error)
    pendingLocalPageLocks = null
    pageLocksOverride.value = before
    if (project.value) project.value.pageLocks = before
    return
  }
  // Ensure same-session state refreshes even without realtime delivery.
  await projectSync?.fetchProject()
}

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
  if (viewMode.value === 'realistic' && filter === 'all') {
    filter = 'top'
  }
  activeFilter.value = filter
  applyFilterVisibility(filter)
  mirrored.value = filter === 'bot'
}

watch(viewMode, (mode) => {
  if (mode === 'realistic' && activeFilter.value === 'all') {
    setFilter('top')
  }
}, { immediate: true })

// ── Board rotation ──

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360
}

function rotateCW(step = 90) {
  if (isCurrentTabLocked.value) return
  setBoardRotation(boardRotation.value + step)
}

function rotateCCW(step = 90) {
  if (isCurrentTabLocked.value) return
  setBoardRotation(boardRotation.value - step)
}

function setBoardRotation(deg: number) {
  if (isCurrentTabLocked.value) return
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
    // Always refresh from DB to avoid stale in-memory cache after collaborative writes.
    const tp = await getTeamProject(teamProjectId, { force: true })
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
        pnpDeletedComponents: tp.pnp_deleted_components,
        pnpSortSmd: tp.pnp_sort_smd,
        pnpSortTht: tp.pnp_sort_tht,
        pnpManualOrderSmd: tp.pnp_manual_order_smd,
        pnpManualOrderTht: tp.pnp_manual_order_tht,
        pnpComponentGroups: tp.pnp_component_groups,
        pnpGroupAssignments: tp.pnp_group_assignments,
        bomLines: tp.bom_lines,
        bomGroups: tp.bom_groups,
        bomPricingCache: tp.bom_pricing_cache,
        bomBoardQuantity: tp.bom_board_quantity,
        bomAiSuggestions: tp.bom_ai_suggestions,
        pcbData: tp.pcb_data,
        panelData: tp.panel_data,
        pageLocks: tp.page_locks,
        pasteSettings: tp.paste_settings,
        layerOrder: tp.layer_order,
        documentOrder: tp.document_order,
        bomFileImportOptions: tp.bom_file_import_options,
        pnpFileImportOptions: tp.pnp_file_import_options,
      }
    }
  } else {
    project.value = await getProject(projectId)
  }
  layerOrder.value = isStringArray(project.value?.layerOrder) ? [...project.value.layerOrder] : []
  documentOrder.value = isStringArray(project.value?.documentOrder) ? [...project.value.documentOrder] : []
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
  layers.value = applyLayerOrder(loadedFiles.map(f => {
    const type = resolveLayerType(f.fileName, f.layerType)
    return {
      file: f,
      visible: type !== 'Unmatched',
      color: getColorForType(type),
      type,
    }
  }))

  originalContent.clear()

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
    // Team projects: persist "original baseline" in browser storage so
    // edit markers + diff survive route reloads.
    const storedOriginals = loadTeamOriginalsFromStorage()
    let updatedStorage = false
    for (const layer of layers.value) {
      const stored = storedOriginals.get(layer.file.fileName)
      if (stored !== undefined) {
        originalContent.set(layer.file.fileName, stored)
      } else {
        originalContent.set(layer.file.fileName, layer.file.content)
        updatedStorage = true
      }
    }
    if (updatedStorage || storedOriginals.size === 0) saveTeamOriginalsToStorage()
  }

  // Restore persisted layer visibility (filter) without overriding persisted mirrored
  applyFilterVisibility(activeFilter.value)
  applyDefaultCropToOutline()

  // Restore persisted interaction mode
  if (activeMode.value === 'measure') measureTool.active.value = true
  if (activeMode.value === 'info') infoTool.active.value = true
  if (activeMode.value === 'delete') deleteTool.active.value = true
  if (activeMode.value === 'draw') drawTool.active.value = true

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

  // Restore persisted deleted component keys
  pnp.setDeletedKeys(project.value?.pnpDeletedComponents)

  // Restore persisted THT assembly type overrides
  pnp.setAssemblyTypeOverrides(project.value?.pnpAssemblyTypes)

  // Restore persisted component table sort state
  if (isValidSortState(project.value?.pnpSortSmd)) {
    pnpSortSmd.value = project.value.pnpSortSmd
  }
  if (isValidSortState(project.value?.pnpSortTht)) {
    pnpSortTht.value = project.value.pnpSortTht
  }
  pnpManualOrderSmd.value = Array.isArray(project.value?.pnpManualOrderSmd)
    ? project.value.pnpManualOrderSmd.filter((k: unknown) => typeof k === 'string')
    : []
  pnpManualOrderTht.value = Array.isArray(project.value?.pnpManualOrderTht)
    ? project.value.pnpManualOrderTht.filter((k: unknown) => typeof k === 'string')
    : []

  // Restore persisted component groups
  const restoredGroups = Array.isArray(project.value?.pnpComponentGroups) ? project.value.pnpComponentGroups : []
  pnpComponentGroups.value = restoredGroups
    .map((g: any) => ({
      id: String(g?.id ?? ''),
      componentType: (g?.componentType === 'tht' || g?.component_type === 'tht') ? 'tht' : 'smd',
      name: String(g?.name ?? '').trim(),
      comment: String(g?.comment ?? '').trim(),
      hidden: !!g?.hidden,
      collapsed: !!g?.collapsed,
    }))
    .filter((g: PnPComponentGroup) => g.id && g.name)

  const restoredAssignments = project.value?.pnpGroupAssignments
  pnpGroupAssignments.value = restoredAssignments && typeof restoredAssignments === 'object'
    ? Object.fromEntries(
        Object.entries(restoredAssignments as Record<string, unknown>)
          .filter(([key, groupId]) => key && typeof groupId === 'string' && groupId),
      ) as Record<string, string>
    : {}

  // Restore persisted BOM data
  bom.setBomLines(project.value?.bomLines)
  bom.setBomGroups(project.value?.bomGroups as any)
  const restoredCache = project.value?.bomPricingCache
  try {
    if (restoredCache) elexess.cleanPricingCache(restoredCache)
  } catch (e) {
    console.warn('[viewer] cleanPricingCache failed, using raw cache:', e)
  }
  bom.setPricingCache(restoredCache)
  bom.setBoardQuantity(project.value?.bomBoardQuantity)
  const restoredAiSuggestions = project.value?.bomAiSuggestions
  if (restoredAiSuggestions && typeof restoredAiSuggestions === 'object') {
    spark.setSuggestions(restoredAiSuggestions as Record<string, any>)
  }
  const restoredBomImportOptions = toBomImportOptionsSnapshot(project.value?.bomFileImportOptions)
  const restoredPnpImportOptions = toPnpImportOptionsSnapshot(project.value?.pnpFileImportOptions)
  const backupBomImportOptions = toBomImportOptionsSnapshot(loadTeamImportOptionsBackup('bom'))
  const backupPnpImportOptions = toPnpImportOptionsSnapshot(loadTeamImportOptionsBackup('pnp'))
  const effectiveBomImportOptions = hasImportOptions(restoredBomImportOptions)
    ? restoredBomImportOptions
    : backupBomImportOptions
  const effectivePnpImportOptions = hasImportOptions(restoredPnpImportOptions)
    ? restoredPnpImportOptions
    : backupPnpImportOptions
  bom.setFileImportOptionsMap(effectiveBomImportOptions)
  pnp.setFileImportOptionsMap(effectivePnpImportOptions)
  if (isTeamProject && teamProjectId) {
    if (!hasImportOptions(restoredBomImportOptions) && hasImportOptions(effectiveBomImportOptions)) {
      persistToProject({ bomFileImportOptions: effectiveBomImportOptions })
    }
    if (!hasImportOptions(restoredPnpImportOptions) && hasImportOptions(effectivePnpImportOptions)) {
      persistToProject({ pnpFileImportOptions: effectivePnpImportOptions })
    }
  }

  // Restore persisted PCB data
  pcbData.value = project.value?.pcbData ?? null

  // Restore persisted panel data (with backward-compatible migration)
  if (project.value?.panelData) {
    panelData.value = normalizePanelConfig(project.value.panelData)
  }

  // Restore persisted paste settings (merge with defaults for forward-compat)
  if (project.value?.pasteSettings) {
    pasteSettings.value = { ...pasteSettings.value, ...project.value.pasteSettings }
  }

  hasLoadedProjectData.value = true

  // Auto-fill board dimensions from rendered Gerber data if not yet set.
  // The boardSizeMm watcher is guarded by hasLoadedProjectData, so we handle
  // the initial detection here to avoid a race where it fires before DB data loads.
  if (boardSizeMm.value) {
    const current = pcbData.value ?? {} as NonNullable<typeof pcbData.value>
    const nextSizeX = current.sizeX ?? roundBoardMm(boardSizeMm.value.width)
    const nextSizeY = current.sizeY ?? roundBoardMm(boardSizeMm.value.height)
    if (current.sizeX !== nextSizeX || current.sizeY !== nextSizeY) {
      pcbData.value = { ...current, sizeX: nextSizeX, sizeY: nextSizeY }
    }
  }

  // Hydrate PCB display defaults into the data model so that values shown in the
  // UI (via ?? fallbacks in PcbPanel) are always backed by persisted data.
  // Only runs once per project — subsequent opens already have the fields.
  if (pcbData.value && typeof pcbData.value === 'object') {
    const PCB_DEFAULTS: Record<string, string | number> = {
      material: 'FR4',
      thicknessMm: 1.6,
      solderMaskColor: 'green',
      panelizationMode: 'single',
    }
    let needsHydration = false
    const raw = pcbData.value as Record<string, unknown>
    for (const key of Object.keys(PCB_DEFAULTS)) {
      if (raw[key] === undefined) {
        needsHydration = true
        break
      }
    }
    if (needsHydration) {
      pcbData.value = { ...PCB_DEFAULTS, ...pcbData.value }
    }
  }

  // Restore persisted documents (PDFs)
  if (isTeamProject && teamProjectId) {
    const teamDocs = await getTeamDocuments(teamProjectId)
    for (const td of teamDocs) {
      const blob = await downloadTeamDocument(td.storage_path)
      if (!blob) continue
      const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const blobUrl = URL.createObjectURL(blob)
      documentSizeById.value[id] = blob.size
      documents.value.push({ id, name: td.file_name, type: td.doc_type as DocumentType, blobUrl, dbId: td.id, storagePath: td.storage_path })
    }
  } else if (!isTeamProject) {
    const storedDocs = await getDocuments(projectId)
    for (const doc of storedDocs) {
      const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const blobUrl = URL.createObjectURL(doc.data)
      documentSizeById.value[id] = doc.data.size
      documents.value.push({ id, name: doc.fileName, type: doc.docType, blobUrl })
    }
  }

  documents.value = applyDocumentOrder(documents.value)
  syncLayerOrderFromLayers()
  syncDocumentOrderFromDocuments()

})

/**
 * Entry point from ImportPanel: checks for conflicts and either imports
 * directly or shows the overwrite confirmation modal.
 */
function handleImportRequest(newFiles: GerberFile[], sourceName: string, isZip: boolean) {
  if (!ensureTabEditable('files')) return
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
  if (!ensureTabEditable('files')) return
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
    const type = resolveLayerType(f.fileName, f.layerType)
    return {
      file: f,
      visible: type !== 'Unmatched',
      color: getColorForType(type),
      type,
    }
  })

  // Merge: keep existing layers that aren't overwritten, then add/replace with incoming
  const keptLayers = layers.value.filter(l => !newFileNames.has(l.file.fileName))
  layers.value = applyLayerOrder([...keptLayers, ...incomingLayers])
  syncLayerOrderFromLayers()
  applyFilterVisibility(activeFilter.value)
  applyDefaultCropToOutline()

  // Update original content for imported files (overwrite = new baseline)
  for (const f of newFiles) {
    originalContent.set(f.fileName, f.content)
  }
  saveTeamOriginalsToStorage()
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
  if (sidebarTab.value === 'files' && !ensureTabEditable('files')) return
  if (sidebarTab.value === 'pcb' && !ensureTabEditable('pcb')) return
  const layer = layers.value[index]
  if (!layer) return
  layer.type = type
  layer.color = getColorForType(type)
  layer.file.layerType = type
  layers.value = applyLayerOrder([...layers.value])
  syncLayerOrderFromLayers()
  if (isTeamProject && teamProjectId) {
    const teamId = currentTeamId.value || await waitForTeamId()
    await uploadTeamFile(teamProjectId, teamId, 1, layer.file.fileName, layer.file.content, type)
  } else {
    await updateFileLayerType(projectId, 1, layer.file.fileName, type)
  }
}

function reorderLayers(fromIndex: number, toIndex: number) {
  if (!ensureTabEditable('files')) return
  const arr = [...layers.value]
  const [moved] = arr.splice(fromIndex, 1)
  if (!moved) return
  arr.splice(toIndex, 0, moved)
  layers.value = arr
  syncLayerOrderFromLayers()
}

// ── Reset layer to original content ──

async function resetLayer(index: number) {
  if (sidebarTab.value === 'files' && !ensureTabEditable('files')) return
  if (sidebarTab.value === 'pcb' && !ensureTabEditable('pcb')) return
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
  syncLayerOrderFromLayers()
}

// ── Rename layer ──

async function renameLayer(index: number, newName: string) {
  if (sidebarTab.value === 'files' && !ensureTabEditable('files')) return
  if (sidebarTab.value === 'pcb' && !ensureTabEditable('pcb')) return
  const layer = layers.value[index]
  if (!layer) return
  const oldName = layer.file.fileName

  // Avoid no-op or name collision
  if (oldName === newName) return
  if (layers.value.some(l => l.file.fileName === newName)) return

  // Migrate per-file import options so mapping/markers survive renames.
  const bomOptions = { ...bom.fileImportOptions.value }
  if (bomOptions[oldName] && !bomOptions[newName]) {
    bomOptions[newName] = bomOptions[oldName]
    delete bomOptions[oldName]
    bom.setFileImportOptionsMap(bomOptions)
  }
  const pnpOptions = { ...pnp.fileImportOptions.value }
  if (pnpOptions[oldName] && !pnpOptions[newName]) {
    pnpOptions[newName] = pnpOptions[oldName]
    delete pnpOptions[oldName]
    pnp.setFileImportOptionsMap(pnpOptions)
  }

  // Update in-memory
  layer.file.fileName = newName

  // Migrate original content tracking (in-memory + DB)
  const orig = originalContent.get(oldName)
  if (orig !== undefined) {
    originalContent.delete(oldName)
    originalContent.set(newName, orig)
    saveTeamOriginalsToStorage()
  }
  if (!isTeamProject) {
    await renameOriginalFile(projectId, 1, oldName, newName)
  }

  // Persist to DB
  if (isTeamProject && teamProjectId) {
    const teamId = currentTeamId.value || await waitForTeamId()
    // Team: upload under new name, delete old only if upload succeeded
    const { error: uploadErr } = await uploadTeamFile(teamProjectId, teamId, 1, newName, layer.file.content, layer.file.layerType)
    if (!uploadErr) {
      const teamFiles = await getTeamFiles(teamProjectId, 1)
      const oldRecord = teamFiles.find(tf => tf.file_name === oldName)
      if (oldRecord) await deleteTeamFile(oldRecord.id, oldRecord.storage_path)
    }
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
  syncLayerOrderFromLayers()
}

// ── Duplicate layer ──

async function duplicateLayer(index: number) {
  if (sidebarTab.value === 'files' && !ensureTabEditable('files')) return
  if (sidebarTab.value === 'pcb' && !ensureTabEditable('pcb')) return
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
  layers.value = applyLayerOrder([...layers.value, newLayer])
  syncLayerOrderFromLayers()
  applyFilterVisibility(activeFilter.value)

  // Track the duplicate's content as its original
  originalContent.set(copyName, newFile.content)
  saveTeamOriginalsToStorage()
  if (!isTeamProject) {
    await storeOriginalFiles(projectId, 1, [{ fileName: copyName, content: newFile.content }])
  }
}

// ── Remove layer ──

async function removeLayer(index: number) {
  if (sidebarTab.value === 'files' && !ensureTabEditable('files')) return
  if (sidebarTab.value === 'pcb' && !ensureTabEditable('pcb')) return
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
  syncLayerOrderFromLayers()
  originalContent.delete(fileName)
  saveTeamOriginalsToStorage()
  if (!isTeamProject) {
    await removeOriginalFile(projectId, 1, fileName)
  }

  // Invalidate canvas cache
  const canvas = boardCanvasRef.value
  if (canvas) canvas.invalidateCache(fileName)
}

// ── Delete handler ──

async function handleConfirmDelete() {
  if (isCurrentTabLocked.value) return
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

// ── Draw handler ──

type QuickSide = 'top' | 'bot'

function getLayerByType(type: string): LayerInfo | null {
  return layers.value.find(l => l.type === type) ?? null
}

async function persistLayerContentOrThrow(layer: LayerInfo, content: string) {
  if (isTeamProject && teamProjectId) {
    const teamId = currentTeamId.value || await waitForTeamId()
    const { error } = await uploadTeamFile(teamProjectId, teamId, 1, layer.file.fileName, content, layer.type)
    if (error) throw error
  } else {
    await updateFileContent(projectId, 1, layer.file.fileName, content)
  }
}

function injectFilledCircleByMm(source: string, cx: number, cy: number, diameterMm: number): string {
  const spec = parseFormatFromSource(source)
  const d = mmToFileUnits(diameterMm, spec.units)
  const nextCode = findNextApertureCode(source)
  const fmtX = (v: number) => formatCoordinate(v, spec.format, spec.zeroSuppression)
  const fmtY = (v: number) => formatCoordinate(v, spec.format, spec.zeroSuppression)
  const apertureDef = `%ADD${nextCode}C,${d.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}*%`
  const commands = [
    `D${nextCode}*`,
    `X${fmtX(cx)}Y${fmtY(cy)}D03*`,
  ].join('\n')
  return injectGerberCommands(source, apertureDef, commands)
}

function injectClearCircleByMm(source: string, cx: number, cy: number, diameterMm: number): string {
  const spec = parseFormatFromSource(source)
  const d = mmToFileUnits(diameterMm, spec.units)
  const nextCode = findNextApertureCode(source)
  const fmtX = (v: number) => formatCoordinate(v, spec.format, spec.zeroSuppression)
  const fmtY = (v: number) => formatCoordinate(v, spec.format, spec.zeroSuppression)
  const apertureDef = `%ADD${nextCode}C,${d.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}*%`
  // Use clear-polarity flash for robust "copper cutout" behavior over existing copper.
  const wrapped = [
    `%LPC*%`,
    `D${nextCode}*`,
    `X${fmtX(cx)}Y${fmtY(cy)}D03*`,
    `%LPD*%`,
  ].join('\n')
  return injectGerberCommands(source, apertureDef, wrapped)
}

function injectBcByMm(source: string, cx: number, cy: number, widthMm: number, heightMm: number): string {
  const spec = parseFormatFromSource(source)
  const w = mmToFileUnits(widthMm, spec.units)
  const h = mmToFileUnits(heightMm, spec.units)
  const strokeW = mmToFileUnits(0.1, spec.units)

  const rectRes = generateRect({
    x: cx - w / 2,
    y: cy - h / 2,
    w,
    h,
    filled: false,
    strokeWidth: strokeW,
  }, spec, findNextApertureCode(source))
  let out = injectGerberCommands(source, rectRes.apertureDef, rectRes.commands)

  const textH = Math.max(mmToFileUnits(1.0, spec.units), h * 0.35)
  const approxTextW = textH * 1.45
  const textRes = generateText({
    text: 'BC',
    x: cx - approxTextW / 2,
    y: cy - textH / 2,
    height: textH,
    strokeWidth: strokeW,
  }, spec, findNextApertureCode(out))
  out = injectGerberCommands(out, textRes.apertureDef, textRes.commands)
  return out
}

async function applyMultiLayerEdits(
  edits: { layer: LayerInfo; newContent: string }[],
  undoLabel: string,
) {
  if (edits.length === 0) return
  const canvas = boardCanvasRef.value
  if (!canvas) return

  const snapshots = new Map<string, string>()
  for (const { layer } of edits) snapshots.set(layer.file.fileName, layer.file.content)

  try {
    for (const { layer, newContent } of edits) {
      layer.file.content = newContent
      await persistLayerContentOrThrow(layer, newContent)
      canvas.invalidateCache(layer.file.fileName)
    }
  } catch (err) {
    // Best-effort rollback in memory + persistence
    for (const [fileName, previousContent] of snapshots) {
      const layer = layers.value.find(l => l.file.fileName === fileName)
      if (!layer) continue
      layer.file.content = previousContent
      try {
        await persistLayerContentOrThrow(layer, previousContent)
      } catch {}
      canvas.invalidateCache(fileName)
    }
    layers.value = [...layers.value]
    toast.add({
      title: 'Save failed',
      description: 'Quick element could not be saved.',
      color: 'error',
    })
    console.warn('[draw] failed to persist quick element', err)
    return
  }

  editHistory.pushEntry(snapshots, undoLabel)
  undoToastVisible.value = true
  if (undoToastTimer) clearTimeout(undoToastTimer)
  undoToastTimer = setTimeout(() => { undoToastVisible.value = false }, 5000)
  layers.value = [...layers.value]
}

function resolveQuickSide(): QuickSide | null {
  if (activeFilter.value === 'top') return 'top'
  if (activeFilter.value === 'bot') return 'bot'
  return null
}

async function placeQuickFiducial(payload: { side: QuickSide; x: number; y: number }) {
  if (isCurrentTabLocked.value) return
  if (activeMode.value !== 'draw') return

  const copperType = payload.side === 'top' ? 'Top Copper' : 'Bottom Copper'
  const maskType = payload.side === 'top' ? 'Top Solder Mask' : 'Bottom Solder Mask'
  const copper = getLayerByType(copperType)
  if (!copper) {
    toast.add({ title: 'Layer missing', description: `${copperType} layer not found.`, color: 'warning' })
    return
  }

  // Copper: clear 3.0mm around + 1.0mm filled fiducial at center
  let copperContent = copper.file.content
  copperContent = injectClearCircleByMm(copperContent, payload.x, payload.y, 3.0)
  copperContent = injectFilledCircleByMm(copperContent, payload.x, payload.y, 1.0)

  const edits: { layer: LayerInfo; newContent: string }[] = [{ layer: copper, newContent: copperContent }]

  // Mask: open 2.0mm around fiducial
  const mask = getLayerByType(maskType)
  if (mask) {
    const maskContent = injectFilledCircleByMm(mask.file.content, payload.x, payload.y, 2.0)
    edits.push({ layer: mask, newContent: maskContent })
  } else {
    toast.add({ title: 'Mask layer missing', description: `${maskType} not found. Added copper fiducial only.`, color: 'warning' })
  }

  await applyMultiLayerEdits(edits, `Added fiducial (${payload.side.toUpperCase()})`)
}

async function placeQuickBc(payload: { side: QuickSide; widthMm: number; heightMm: number; x: number; y: number }) {
  if (isCurrentTabLocked.value) return
  if (activeMode.value !== 'draw') return

  const silkType = payload.side === 'top' ? 'Top Silkscreen' : 'Bottom Silkscreen'
  const silk = getLayerByType(silkType)
  if (!silk) {
    toast.add({ title: 'Layer missing', description: `${silkType} layer not found.`, color: 'warning' })
    return
  }

  const silkContent = injectBcByMm(silk.file.content, payload.x, payload.y, payload.widthMm, payload.heightMm)
  await applyMultiLayerEdits(
    [{ layer: silk, newContent: silkContent }],
    `Added BC ${payload.widthMm}x${payload.heightMm} (${payload.side.toUpperCase()})`,
  )
}

async function handleDrawCommit(request: import('~/composables/useDrawTool').DrawCommitRequest) {
  if (isCurrentTabLocked.value) return

  if (request.kind === 'quick') {
    const side = resolveQuickSide()
    if (!side) {
      toast.add({
        title: 'Select side first',
        description: 'Quick elements can only be placed in Top or Bot view.',
        color: 'warning',
      })
      return
    }
    if (request.quick.kind === 'fiducial') {
      await placeQuickFiducial({ side, x: request.quick.x, y: request.quick.y })
      return
    }
    if (request.quick.kind === 'bc') {
      await placeQuickBc({
        side,
        widthMm: request.quick.bcWidthMm ?? 7,
        heightMm: request.quick.bcHeightMm ?? 7,
        x: request.quick.x,
        y: request.quick.y,
      })
      return
    }
  }

  const canvas = boardCanvasRef.value
  if (!canvas) return

  if (request.kind !== 'shape') return

  const layerName = request.targetLayerName
  const layer = layers.value.find(l => l.file.fileName === layerName)
  if (!layer) return

  const previousContent = layer.file.content
  const newContent = drawTool.generateAndInject(request.shape, previousContent)
  if (!newContent) return

  // Update in-memory content
  layer.file.content = newContent

  try {
    // Persist to storage
    if (isTeamProject && teamProjectId) {
      const teamId = currentTeamId.value || await waitForTeamId()
      const { error } = await uploadTeamFile(teamProjectId, teamId, 1, layer.file.fileName, newContent, layer.type)
      if (error) throw error
    } else {
      await updateFileContent(projectId, 1, layer.file.fileName, newContent)
    }
  } catch (err) {
    // Revert in-memory state when persistence fails.
    layer.file.content = previousContent
    layers.value = [...layers.value]
    toast.add({
      title: 'Save failed',
      description: `Could not save ${layer.file.fileName}.`,
      color: 'error',
    })
    console.warn('[draw] failed to persist edit', err)
    return
  }

  // Invalidate the parsed tree cache so it gets re-parsed
  canvas.invalidateCache(layer.file.fileName)

  // Push undo entry
  const snapshots = new Map<string, string>()
  snapshots.set(layer.file.fileName, previousContent)
  const toolLabel = request.shape.tool === 'drill' ? 'drill hit' : request.shape.tool
  editHistory.pushEntry(snapshots, `Added ${toolLabel} to ${layer.type}`)
  undoToastVisible.value = true
  if (undoToastTimer) clearTimeout(undoToastTimer)
  undoToastTimer = setTimeout(() => { undoToastVisible.value = false }, 5000)

  // Force re-render
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

let jsZipCtorPromise: Promise<any> | null = null
function loadJsZipCtor(): Promise<any> {
  if (!jsZipCtorPromise) {
    jsZipCtorPromise = import('jszip').then(mod => (mod as any).default ?? mod)
  }
  return jsZipCtorPromise
}

type SvgExporterModule = typeof import('../../../lib/renderer/svg-exporter')
let svgExporterPromise: Promise<SvgExporterModule> | null = null
function loadSvgExporter(): Promise<SvgExporterModule> {
  if (!svgExporterPromise) {
    svgExporterPromise = import('../../../lib/renderer/svg-exporter')
  }
  return svgExporterPromise
}

async function handleDownloadGerber() {
  const JSZipCtor = await loadJsZipCtor()
  const zip = new JSZipCtor()
  for (const layer of layers.value) {
    // Skip PnP layers from Gerber download
    if (isPnPLayer(layer.type)) continue
    zip.file(layer.file.fileName, layer.file.content)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  await triggerDownload(blob, `${project.value?.name || 'gerber-files'}.zip`)
}

// ── Export handlers ──

async function handleExportPng() {
  const canvas = boardCanvasRef.value
  if (!canvas) return
  const { settings: _appSettings } = useAppSettings()
  const blob = await canvas.exportPng(_appSettings.exportDpi)
  if (!blob) return
  await triggerDownload(blob, `${project.value?.name || 'pcb'}-${mirrored.value ? 'bottom' : 'top'}.png`)
}

async function handleExportSvg() {
  const canvas = boardCanvasRef.value
  if (!canvas) return
  const side = mirrored.value ? 'bottom' : 'top'
  const realisticLayers = canvas.getRealisticLayersForExport(side)
  const svgExporter = await loadSvgExporter()
  const svgString = svgExporter.exportRealisticSvg(realisticLayers, selectedPreset.value, side)
  const blob = new Blob([svgString], { type: 'image/svg+xml' })
  await triggerDownload(blob, `${project.value?.name || 'pcb'}-${side}.svg`)
}

async function handleExportImage(options: { format: 'png' | 'svg'; componentsMode: 'none' | 'smd' | 'tht' | 'all' | 'both'; sideMode: 'top' | 'bottom' | 'both'; dpi: number }) {
  if (imageExportTarget.value === 'panel') {
    await handleExportPanelImage(options)
    return
  }
  await handleExportBoardImage(options)
}

async function handleExportBoardImage(options: { format: 'png' | 'svg'; componentsMode: 'none' | 'smd' | 'tht' | 'all' | 'both'; sideMode: 'top' | 'bottom' | 'both'; dpi: number }) {
  const canvas = boardCanvasRef.value
  if (!canvas) return
  const svgExporter = await loadSvgExporter()
  // Ensure SVG exporter uses fresh footprint shapes (not stale cached data)
  ;(svgExporter as any).clearFootprintCaches?.()

  const projectName = project.value?.name || 'pcb'
  const sides: Array<'top' | 'bottom'> = options.sideMode === 'both' ? ['top', 'bottom'] : [options.sideMode]

  // If no PnP exists, treat as "none" regardless of selection
  const canRenderComponents = pnp.hasPnP.value
  const variants: boolean[] =
    (options.componentsMode === 'both' && canRenderComponents) ? [false, true]
      : (options.componentsMode !== 'none' && canRenderComponents) ? [true]
        : [false]

  const fileCount = sides.length * variants.length
  const ext = options.format === 'png' ? '.png' : '.svg'

  const buildComponentsForSide = (side: 'top' | 'bottom') => {
    if (!canRenderComponents) return []
    let list = pnp.allComponents.value
      .filter(c => !c.dnp)
      .filter(c => c.side === side)
    // Filter by component type based on export mode
    if (options.componentsMode === 'smd') {
      list = list.filter(c => c.componentType === 'smd')
    } else if (options.componentsMode === 'tht') {
      list = list.filter(c => c.componentType === 'tht')
    }
    // 'all' and 'both' include all component types
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
      const svgString = svgExporter.exportRealisticSvg(realisticLayers, selectedPreset.value, side)
      return new Blob([svgString], { type: 'image/svg+xml' })
    }

    const comps = buildComponentsForSide(side)
    const svgString = (svgExporter as any).exportRealisticSvgWithComponents(realisticLayers, selectedPreset.value, side, {
      components: comps,
      pnpOriginX: pnp.originX.value,
      pnpOriginY: pnp.originY.value,
      matchPackage: pkgLib.matchPackage,
      matchThtPackage: thtPkgLib.matchThtPackage,
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
    await triggerDownload(blob, fileNameFor(sides[0]!, variants[0]!))
    return
  }

  const JSZipCtor = await loadJsZipCtor()
  const zip = new JSZipCtor()
  for (const side of sides) {
    for (const withComponents of variants) {
      const blob = await renderOne(side, withComponents)
      if (!blob) continue
      zip.file(fileNameFor(side, withComponents), blob)
    }
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  await triggerDownload(zipBlob, `${projectName}-images.zip`)
}

function panelPngBlobToSvgBlob(pngBlob: Blob, panelSizeMm?: { width: number; height: number } | null): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onerror = () => reject(new Error('Failed to read PNG export'))
    fr.onload = () => {
      const dataUrl = String(fr.result || '')
      // Panel SVG export is a PNG embedded in an SVG wrapper for physical dimensions.
      // It preserves measured size but does not scale as cleanly as vector board SVG output.
      const dims = panelSizeMm && panelSizeMm.width > 0 && panelSizeMm.height > 0
      const widthMm = dims ? panelSizeMm.width : 100
      const heightMm = dims ? panelSizeMm.height : 100
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm} ${heightMm}">
  <image href="${dataUrl}" x="0" y="0" width="${widthMm}" height="${heightMm}" preserveAspectRatio="none"/>
</svg>`
      resolve(new Blob([svg], { type: 'image/svg+xml' }))
    }
    fr.readAsDataURL(pngBlob)
  })
}

async function handleExportPanelImage(options: { format: 'png' | 'svg'; componentsMode: 'none' | 'smd' | 'tht' | 'all' | 'both'; sideMode: 'top' | 'bottom' | 'both'; dpi: number }) {
  const canvas = panelCanvasRef.value
  if (!canvas) return

  const projectName = project.value?.name || 'panel'
  const sides: Array<'top' | 'bottom'> = options.sideMode === 'both' ? ['top', 'bottom'] : [options.sideMode]
  const canRenderComponents = pnp.hasPnP.value
  const variants: boolean[] =
    (options.componentsMode === 'both' && canRenderComponents) ? [false, true]
      : (options.componentsMode !== 'none' && canRenderComponents) ? [true]
        : [false]

  const buildComponentsForSide = (side: 'top' | 'bottom') => {
    if (!canRenderComponents) return []
    let list = pnp.allComponents.value
      .filter(c => !c.dnp)
      .filter(c => c.side === side)
    if (options.componentsMode === 'smd') {
      list = list.filter(c => c.componentType === 'smd')
    } else if (options.componentsMode === 'tht') {
      list = list.filter(c => c.componentType === 'tht')
    }
    return list
  }

  const ext = options.format === 'png' ? '.png' : '.svg'
  const fileNameFor = (side: 'top' | 'bottom', withComponents: boolean) => {
    const sideSuffix = `-panel-${side}`
    const compSuffix = variants.length === 1
      ? ''
      : (withComponents ? '-with-components' : '-no-components')
    return `${projectName}${sideSuffix}${compSuffix}${ext}`
  }

  const renderOne = async (side: 'top' | 'bottom', withComponents: boolean): Promise<Blob | null> => {
    const comps = withComponents ? buildComponentsForSide(side) : []
    const pngBlob = await canvas.exportPngForSide(side, {
      dpi: options.dpi,
      includeComponents: withComponents,
      components: comps,
      includePackages: showPackages.value,
    })
    if (!pngBlob) return null
    if (options.format === 'png') return pngBlob
    return await panelPngBlobToSvgBlob(pngBlob, panelDimensionsMm.value)
  }

  const fileCount = sides.length * variants.length
  if (fileCount === 1) {
    const blob = await renderOne(sides[0]!, variants[0]!)
    if (!blob) return
    await triggerDownload(blob, fileNameFor(sides[0]!, variants[0]!))
    return
  }

  const JSZipCtor = await loadJsZipCtor()
  const zip = new JSZipCtor()
  for (const side of sides) {
    for (const withComponents of variants) {
      const blob = await renderOne(side, withComponents)
      if (!blob) continue
      zip.file(fileNameFor(side, withComponents), blob)
    }
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  await triggerDownload(zipBlob, `${projectName}-panel-images.zip`)
}

async function handleExportPnP(options: { convention: PnPConvention; format: PnPExportFormat; sideMode: PnPExportSideMode; componentMode: string; excludeDnp: boolean }) {
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

  // Filter by component type
  const filterByType = (comps: typeof allComps, type?: 'smd' | 'tht') => {
    if (!type) return comps
    return comps.filter(c => c.componentType === type)
  }

  // Build the list of file entries: { filename, components }
  type FileEntry = { filename: string; components: typeof allComps }
  const files: FileEntry[] = []

  const componentTypes: Array<{ type?: 'smd' | 'tht'; suffix: string }> =
    options.componentMode === 'separate'
      ? [{ type: 'smd', suffix: '-smd' }, { type: 'tht', suffix: '-tht' }]
      : options.componentMode === 'smd'
        ? [{ type: 'smd', suffix: '' }]
        : options.componentMode === 'tht'
          ? [{ type: 'tht', suffix: '' }]
          : [{ suffix: '' }] // 'all'

  const sides: Array<{ side?: 'top' | 'bottom'; suffix: string }> =
    options.sideMode === 'separate'
      ? [{ side: 'top', suffix: '-top' }, { side: 'bottom', suffix: '-bottom' }]
      : options.sideMode === 'top'
        ? [{ side: 'top', suffix: '-top' }]
        : options.sideMode === 'bottom'
          ? [{ side: 'bottom', suffix: '-bottom' }]
          : [{ suffix: '' }] // 'combined'

  for (const ct of componentTypes) {
    for (const sd of sides) {
      let comps = filterByType(allComps, ct.type)
      if (sd.side) comps = comps.filter(c => c.side === sd.side)
      if (comps.length === 0) continue
      files.push({
        filename: `${name}-pick-and-place${ct.suffix}${sd.suffix}${ext}`,
        components: comps,
      })
    }
  }

  if (files.length === 0) return

  if (files.length === 1) {
    const content = buildExport(files[0]!.components)
    const blob = new Blob([content], { type: mimeType })
    await triggerDownload(blob, files[0]!.filename)
  } else {
    const JSZipCtor = await loadJsZipCtor()
    const zip = new JSZipCtor()
    for (const f of files) {
      zip.file(f.filename, buildExport(f.components))
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    await triggerDownload(blob, `${name}-pick-and-place.zip`)
  }
}

async function triggerDownload(blob: Blob, fileName: string) {
  await saveBlobFile(blob, fileName)
}
</script>

<!-- Toolbar button styling lives in template classes. -->
