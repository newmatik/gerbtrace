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
          :disabled="sidebarTab === 'panel' && (m.value === 'info' || m.value === 'delete')"
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
            :disabled="sidebarTab === 'panel'"
            title="Rotate 90° counter-clockwise"
            @click="rotateCCW()"
          />
          <UPopover v-if="sidebarTab !== 'panel'" :content="{ align: 'center', sideOffset: 8 }">
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
          <button
            v-else
            disabled
            class="text-[10px] font-mono px-1.5 py-0.5 rounded min-w-[2.5rem] text-center transition-colors cursor-not-allowed text-neutral-400 dark:text-neutral-500 opacity-70"
            :title="'Board rotation: ' + boardRotation + '° (disabled in panel view)'"
          >
            {{ boardRotation }}°
          </button>
          <UButton
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-rotate-cw"
            :class="[tbBtnBase, tbBtnIdle]"
            :disabled="sidebarTab === 'panel'"
            title="Rotate 90° clockwise"
            @click="rotateCW()"
          />
        </div>
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
        <!-- Sidebar tabs: Files / PCB / Panel / SMD / THT / BOM / Pricing / Docs -->
        <div
          class="flex items-center gap-0.5 px-3 pt-3 pb-1 flex-wrap"
        >
          <button
            class="text-[11px] font-medium px-2 py-0.5 rounded transition-colors"
            :class="sidebarTab === 'layers'
              ? 'bg-neutral-200/80 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
              : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'"
            @click="sidebarTab = 'layers'"
          >
            Files
          </button>
          <button
            class="text-[11px] font-medium px-2 py-0.5 rounded transition-colors"
            :class="sidebarTab === 'pcb'
              ? 'bg-neutral-200/80 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
              : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'"
            @click="sidebarTab = 'pcb'"
          >
            PCB
          </button>
          <button
            v-if="isPanelizedMode"
            class="text-[11px] font-medium px-2 py-0.5 rounded transition-colors"
            :class="sidebarTab === 'panel'
              ? 'bg-neutral-200/80 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
              : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'"
            @click="sidebarTab = 'panel'"
          >
            Panel
          </button>
          <button
            v-if="pnp.hasPnP.value"
            class="text-[11px] font-medium px-2 py-0.5 rounded transition-colors"
            :class="sidebarTab === 'smd'
              ? 'bg-neutral-200/80 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
              : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'"
            @click="sidebarTab = 'smd'"
          >
            SMD
          </button>
          <button
            v-if="pnp.hasPnP.value"
            class="text-[11px] font-medium px-2 py-0.5 rounded transition-colors"
            :class="sidebarTab === 'tht'
              ? 'bg-neutral-200/80 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
              : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'"
            @click="sidebarTab = 'tht'"
          >
            THT
          </button>
          <button
            v-if="bom.hasBom.value"
            class="text-[11px] font-medium px-2 py-0.5 rounded transition-colors"
            :class="sidebarTab === 'bom'
              ? 'bg-neutral-200/80 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
              : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'"
            @click="sidebarTab = 'bom'"
          >
            BOM
          </button>
          <button
            class="text-[11px] font-medium px-2 py-0.5 rounded transition-colors"
            :class="sidebarTab === 'pricing'
              ? 'bg-neutral-200/80 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
              : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'"
            @click="sidebarTab = 'pricing'"
          >
            Pricing
          </button>
          <button
            v-if="hasDocuments"
            class="text-[11px] font-medium px-2 py-0.5 rounded transition-colors"
            :class="sidebarTab === 'docs'
              ? 'bg-neutral-200/80 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
              : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'"
            @click="sidebarTab = 'docs'"
          >
            Docs
          </button>
        </div>

        <!-- Files view (Gerber layers + Documents) -->
        <template v-if="sidebarTab === 'layers'">
          <div class="p-4 pt-2">
            <ImportPanel
              :packet="1"
              @import="handleImportRequest"
              @documents="handleDocumentsAdd"
            />
          </div>
          <LayerPanel
            :layers="layers"
            :edited-layers="editedLayers"
            :documents="documents"
            :selected-document-id="selectedDocumentId"
            @toggle-visibility="toggleLayerVisibility"
            @toggle-group-visibility="toggleGroupVisibility"
            @change-color="changeLayerColor"
            @change-type="changeLayerType"
            @reorder="reorderLayers"
            @reset-layer="resetLayer"
            @rename-layer="renameLayer"
            @duplicate-layer="duplicateLayer"
            @remove-layer="removeLayer"
            @select-document="handleDocumentSelect"
            @remove-document="handleDocumentRemove"
          />
        </template>

        <!-- SMD Components view -->
        <ComponentPanel
          v-else-if="sidebarTab === 'smd'"
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
          :package-options="packageOptions"
          :sort-state="pnpSortSmd"
          :manual-order="pnpManualOrderSmd"
          :groups="smdGroups"
          :group-assignments="pnpGroupAssignments"
          :bom-designators="bomDesignators"
          @update:search-query="pnp.searchQuery.value = $event"
          @update:show-packages="showPackages = $event"
          @update:pnp-convention="updateConvention"
          @update:rotation="pnp.setRotationOverride($event.key, $event.rotation)"
          @reset:rotation="pnp.resetRotationOverride($event.key)"
          @toggle:dnp="pnp.toggleDnp($event)"
          @toggle:filter="pnp.toggleFilter($event)"
          @clear-filters="pnp.clearFilters()"
          @update:package-mapping="handlePackageMapping($event)"
          @update:polarized="pnp.setPolarizedOverride($event.key, $event.polarized)"
          @update:sort-state="applySortState('smd', $event)"
          @update:manual-order="pnpManualOrderSmd = $event"
          @create:group="createGroup('smd')"
          @update:group-meta="updateGroupMeta($event)"
          @toggle:group-hidden="toggleGroupHidden($event)"
          @toggle:group-collapsed="toggleGroupCollapsed($event)"
          @delete:group="deleteGroup($event, 'smd')"
          @reorder:groups="reorderGroups('smd', $event)"
          @assign:group="assignComponentGroup($event, 'smd')"
          @select="pnp.selectComponent($event)"
          @start-set-origin="startSetOrigin"
          @start-component-align="startComponentAlign"
          @reset-origin="pnp.resetOrigin()"
          @edit="openComponentEdit($event)"
          @add-component="startAddComponent('smd')"
          @preview:package="previewPkgOverride = $event"
        />

        <!-- THT Components view -->
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
          :package-options="thtPackageOptions"
          :sort-state="pnpSortTht"
          :manual-order="pnpManualOrderTht"
          :groups="thtGroups"
          :group-assignments="pnpGroupAssignments"
          :bom-designators="bomDesignators"
          @update:search-query="pnp.searchQuery.value = $event"
          @update:show-packages="showPackages = $event"
          @update:pnp-convention="updateConvention"
          @update:rotation="pnp.setRotationOverride($event.key, $event.rotation)"
          @reset:rotation="pnp.resetRotationOverride($event.key)"
          @toggle:dnp="pnp.toggleDnp($event)"
          @toggle:filter="pnp.toggleFilter($event)"
          @clear-filters="pnp.clearFilters()"
          @update:package-mapping="handlePackageMapping($event)"
          @update:polarized="pnp.setPolarizedOverride($event.key, $event.polarized)"
          @update:sort-state="applySortState('tht', $event)"
          @update:manual-order="pnpManualOrderTht = $event"
          @create:group="createGroup('tht')"
          @update:group-meta="updateGroupMeta($event)"
          @toggle:group-hidden="toggleGroupHidden($event)"
          @toggle:group-collapsed="toggleGroupCollapsed($event)"
          @delete:group="deleteGroup($event, 'tht')"
          @reorder:groups="reorderGroups('tht', $event)"
          @assign:group="assignComponentGroup($event, 'tht')"
          @select="pnp.selectComponent($event)"
          @start-set-origin="startSetOrigin"
          @start-component-align="startComponentAlign"
          @reset-origin="pnp.resetOrigin()"
          @edit="openComponentEdit($event)"
          @add-component="startAddComponent('tht')"
          @preview:package="previewPkgOverride = $event"
        />

        <!-- BOM view -->
        <BomPanel
          v-else-if="sidebarTab === 'bom'"
          :bom-lines="(bom.bomLines.value as BomLine[])"
          :filtered-lines="(bom.filteredLines.value as BomLine[])"
          :search-query="bom.searchQuery.value"
          :pricing-cache="(bom.pricingCache.value as Record<string, any>)"
          :has-credentials="elexess.hasCredentials.value"
          :is-fetching-pricing="elexess.isFetching.value"
          :pricing-queue="(elexess.pricingQueue.value as PricingQueueItem[])"
          :board-quantity="bom.boardQuantity.value"
          :pnp-designators="pnpDesignators"
          @update:search-query="bom.searchQuery.value = $event"
          @update:board-quantity="bom.boardQuantity.value = $event"
          @add-line="handleBomAddLine"
          @update-line="(id, updates) => bom.updateLine(id, updates)"
          @remove-line="bom.removeLine"
          @add-manufacturer="(lineId, mfr) => bom.addManufacturer(lineId, mfr)"
          @fetch-all-pricing="handleFetchAllPricing"
          @fetch-single-pricing="handleFetchSinglePricing"
        />

        <!-- PCB parameters view -->
        <PcbPanel
          v-else-if="sidebarTab === 'pcb'"
          :pcb-data="pcbData"
          :board-size-mm="boardSizeMm"
          :detected-layer-count="detectedLayerCount"
          :layers="layers"
          :edited-layers="editedLayers"
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

        <!-- Panel view -->
        <PanelPanel
          v-else-if="sidebarTab === 'panel' && isPanelizedMode"
          :panel-data="panelData"
          :board-size-mm="boardSizeMm"
          :team-panel-limits="teamPanelLimits"
          :thickness-mm="pcbData?.thicknessMm ?? 1.6"
          :edge-constraints="panelEdgeConstraints"
          :copper-trees="copperTrees"
          :outline-origin-mm="_outlineOriginMm"
          @update:panel-data="handlePanelDataUpdate"
          @update:danger-zone="(dz) => panelDangerZone = dz"
        />

        <!-- Pricing view -->
        <PricingPanel
          v-else-if="sidebarTab === 'pricing'"
          :pcb-data="pcbData"
        />

        <!-- Docs view -->
        <DocsPanel
          v-else-if="sidebarTab === 'docs'"
          :documents="documents"
          :selected-id="selectedDocumentId"
          @select="handleDocumentSelect"
          @remove="handleDocumentRemove"
          @update-type="handleDocumentTypeUpdate"
        />
      </aside>

      <!-- Resize handle -->
      <div
        class="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
        :class="{ 'bg-primary/50': sidebarDragging }"
        @mousedown="onSidebarDragStart"
      />

      <!-- Main content area: Board canvas or Document viewer -->
      <main
        class="flex-1 min-w-0 relative outline-none"
        :class="{ 'select-none': sidebarDragging }"
        :style="{ backgroundColor: showDocumentViewer ? undefined : canvasAreaBg }"
        @keydown="handleKeyDown"
        @keyup="handleKeyUp"
        tabindex="0"
      >
        <!-- Document PDF viewer (shown when a document is selected on the documents tab) -->
        <div
          v-if="showDocumentViewer"
          class="absolute inset-0 flex flex-col bg-neutral-100 dark:bg-neutral-900"
        >
          <div class="flex items-center gap-2 px-4 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shrink-0">
            <UIcon name="i-lucide-file-text" class="text-sm text-blue-500 shrink-0" />
            <span class="text-xs font-medium text-neutral-700 dark:text-neutral-200 truncate">{{ selectedDocument?.name }}</span>
            <UBadge size="xs" variant="subtle" color="neutral" class="shrink-0">{{ selectedDocument?.type }}</UBadge>
            <div class="flex-1" />
            <button
              class="text-[11px] font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors flex items-center gap-1"
              @click="selectedDocumentId = null"
            >
              <UIcon name="i-lucide-arrow-left" class="text-xs" />
              Back to Board
            </button>
          </div>
          <iframe
            :src="selectedDocument?.blobUrl + '#toolbar=0'"
            class="flex-1 w-full border-0"
            title="Document viewer"
          />
        </div>

        <!-- Board canvas (hidden when viewing a document) -->
        <div v-show="!showDocumentViewer" class="absolute inset-0">
          <!-- Panel canvas (shown when panel tab is active) -->
          <PanelCanvas
            v-if="sidebarTab === 'panel' && isPanelizedMode"
            ref="panelCanvasRef"
            :layers="renderLayers"
            :all-layers="layers"
            :interaction="canvasInteraction"
            :mirrored="mirrored"
            :active-filter="activeFilter"
            :view-mode="viewMode"
            :preset="viewMode === 'realistic' ? selectedPreset : undefined"
            :project-name="project?.name || 'Untitled'"
            :pcb-data="pcbData"
            :panel-config="panelData"
            :board-size-mm="boardSizeMm"
            :danger-zone="panelDangerZone"
            :measure="measureTool"
            :pnp-components="panelData.showComponents ? pnpComponentsWithPreview : []"
            :match-package="pkgLib.matchPackage"
            :match-tht-package="thtPkgLib.matchThtPackage"
            :show-packages="showPackages"
            :pnp-convention="pnp.convention.value"
            @update:panel-config="handlePanelDataUpdate"
          />
          <!-- Board canvas (shown for all other tabs) -->
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
            :view-mode="viewMode"
            :preset="viewMode === 'realistic' ? selectedPreset : undefined"
            :pnp-components="sidebarTab === 'pcb' ? [] : pnpComponentsWithPreview"
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
            @pnp-click="pnp.selectComponent($event)"
            @pnp-dblclick="handlePnPDblClick"
            @align-click="handleAlignClick"
          />
          <MeasureOverlay
            :measure="measureTool"
            :transform="canvasInteraction.transform.value"
          />
          <InfoOverlay v-if="sidebarTab !== 'panel'" :info="infoTool" />
          <DeleteOverlay
            v-if="sidebarTab !== 'panel'"
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
          <BoardExtents :dimensions="sidebarTab === 'panel' ? panelDimensionsMm : (boardSizeMm ?? null)" />
        </div>
      </main>
    </div>

    <!-- Settings modal -->
    <AppSettingsModal
      v-model:open="showSettings"
      @open-performance="showPerformanceMonitor = true"
    />
    <PerformanceMonitorModal
      v-model:open="showPerformanceMonitor"
      :snapshot="performanceSnapshot"
      @refresh="refreshPerformanceSnapshot"
    />

    <!-- PnP export modal -->
    <PnPExportModal
      v-model:open="showPnPExport"
      :default-convention="pnp.convention.value"
      :components="pnp.allComponents.value"
      :project-name="project?.name || 'Untitled'"
      :has-smd="pnp.hasSmdPnP.value || pnp.smdActiveComponents.value.length > 0"
      :has-tht="pnp.hasThtPnP.value || pnp.thtActiveComponents.value.length > 0"
      @export="handleExportPnP"
    />

    <!-- Image export modal -->
    <ImageExportModal
      v-model:open="showImageExport"
      :has-pn-p="pnp.hasPnP.value"
      :board-size-mm="imageExportTarget === 'panel' ? (panelDimensionsMm ?? undefined) : boardSizeMm"
      :svg-format-note="imageExportTarget === 'panel' ? 'Panel SVG exports embed a rasterized PNG. They preserve panel size, but scaling quality is lower and files can be larger than vector SVG.' : undefined"
      @export="handleExportImage"
    />

    <!-- Component edit modal -->
    <ComponentEditModal
      v-model:open="showComponentEdit"
      :component="editingComponent"
      :package-options="editingComponent?.componentType === 'tht' ? thtPackageOptions : packageOptions"
      :groups="editingComponent?.componentType === 'tht' ? thtGroups : smdGroups"
      :current-group-id="editingComponent ? (pnpGroupAssignments[editingComponent.key] ?? null) : null"
      :bom-designators="bomDesignators"
      @update:rotation="pnp.setRotationOverride($event.key, $event.rotation)"
      @reset:rotation="pnp.resetRotationOverride($event.key)"
      @toggle:dnp="pnp.toggleDnp($event)"
      @update:polarized="pnp.setPolarizedOverride($event.key, $event.polarized)"
      @update:package-mapping="handlePackageMapping($event)"
      @update:note="pnp.setComponentNote($event.key, $event.note)"
      @update:fields="pnp.setFieldOverride($event.key, $event)"
      @update:manual-component="pnp.updateManualComponent($event.id, $event)"
      @delete:manual-component="pnp.removeManualComponent($event)"
      @delete:component="pnp.deleteComponent($event)"
      @assign:group="assignEditingComponentGroup($event)"
      @preview:package="previewPkgOverride = $event"
    />

    <!-- BOM field mapping modal -->
    <BomFieldMappingModal
      v-model:open="showBomFieldMapping"
      :headers="[...(bom.pendingParseResult.value?.headers ?? [])]"
      :rows="(bom.pendingParseResult.value?.rows ?? []).map(r => [...r])"
      @confirm="handleBomFieldMappingConfirm"
      @cancel="handleBomFieldMappingCancel"
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
import { parseGerber } from '@lib/gerber'
import { plotImageTree } from '@lib/gerber/plotter'
import { mergeBounds, emptyBounds, isEmpty } from '@lib/gerber/bounding-box'
import { sortLayersByPcbOrder, isTopLayer, isBottomLayer, isSharedLayer, getColorForType, isPnPLayer } from '~/utils/gerber-helpers'
import type { BomLine, BomColumnMapping } from '~/utils/bom-types'
import type { PricingQueueItem } from '~/composables/useElexessApi'
import type { ViewMode } from '~/components/viewer/BoardCanvas.vue'
import { getPresetForAppearance } from '~/utils/pcb-presets'
import type { SolderMaskColor } from '~/utils/pcb-presets'
import type { PcbThicknessMm } from '~/utils/pcb-pricing'
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
const { getProject, getFiles, addFiles, upsertFiles, clearFiles, renameFile, removeFile, getOriginalFiles, storeOriginalFiles, renameOriginalFile, removeOriginalFile, renameProject, updateFileLayerType, updateFileContent, updateProjectOrigin, updateProjectConvention, updateProjectRotationOverrides, updateProjectDnp, updateProjectCadPackageMap, updateProjectPolarizedOverrides, updateProjectComponentNotes, updateProjectFieldOverrides, updateProjectManualComponents, updateProjectDeletedComponents, updateProjectSortSmd, updateProjectSortTht, updateProjectManualOrderSmd, updateProjectManualOrderTht, updateProjectComponentGroups, updateProjectGroupAssignments, updateBomLines, updateBomPricingCache, updateBomBoardQuantity, updatePcbData, updatePanelData, getDocuments, addDocument, removeDocument: removeDocumentFromDb, updateDocumentType: updateDocumentTypeInDb } = useProject()

// ── Team project support ──
const teamProjectIdRef = ref(teamProjectId)
const { currentTeam, currentTeamRole, currentTeamId, isAdmin: isTeamAdmin } = useTeam()

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

// ── Sidebar tab (Files / PCB / Panel / SMD / THT / BOM / Pricing / Docs) ──
type SidebarTab = 'layers' | 'pcb' | 'panel' | 'smd' | 'tht' | 'bom' | 'pricing' | 'docs'
const VALID_TABS: SidebarTab[] = ['layers', 'pcb', 'panel', 'smd', 'tht', 'bom', 'pricing', 'docs']

const router = useRouter()
const initialTab = (route.query.tab as string) || 'layers'
const sidebarTab = ref<SidebarTab>(VALID_TABS.includes(initialTab as SidebarTab) ? initialTab as SidebarTab : 'layers')

onMounted(() => {
  const clientTab = new URLSearchParams(window.location.search).get('tab') || 'layers'
  if (VALID_TABS.includes(clientTab as SidebarTab) && clientTab !== sidebarTab.value) {
    sidebarTab.value = clientTab as SidebarTab
  }
})

// Sync sidebar tab to URL query parameter
watch(sidebarTab, (tab) => {
  const query = { ...route.query }
  if (tab === 'layers') {
    delete query.tab
  } else {
    query.tab = tab
  }
  router.replace({ query })
})

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

// Panel view does not support info/delete tools; fall back to cursor.
watch(sidebarTab, (tab) => {
  // Leaving the docs tab should always close any open document preview.
  if (tab !== 'docs' && selectedDocumentId.value) {
    selectedDocumentId.value = null
  }
  if (tab === 'panel' && (activeMode.value === 'info' || activeMode.value === 'delete')) {
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
  }
}

function handlePackageMapping(payload: { cadPackage: string; packageName: string | null; componentKey?: string; isManual?: boolean }) {
  if (payload.isManual && payload.componentKey) {
    // For manual components: update the package field directly on the ManualPnPComponent
    const manualId = payload.componentKey.replace(/^manual\|/, '')
    pnp.updateManualComponent(manualId, { package: payload.packageName ?? '' })
  }
  // Always update the cadPackageMap too — for parsed components this is the primary mechanism,
  // for manual components it's a belt-and-suspenders so the mapping is visible if cadPackage is populated.
  if (payload.cadPackage?.trim()) {
    pnp.setCadPackageMapping(payload.cadPackage, payload.packageName)
  }
}

function openComponentEdit(component: import('~/composables/usePickAndPlace').EditablePnPComponent) {
  editingComponent.value = component
  showComponentEdit.value = true
}

function startAddComponent(componentType: import('~/composables/usePickAndPlace').ComponentType = 'smd') {
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

// ── PCB parameters for pricing ──
const pcbData = ref<{
  sizeX?: number
  sizeY?: number
  layerCount?: number
  surfaceFinish?: 'ENIG' | 'HAL'
  copperWeight?: '1oz' | '2oz'
  innerCopperWeight?: '0.5oz' | '1oz' | '2oz'
  thicknessMm?: PcbThicknessMm
  solderMaskColor?: SolderMaskColor
  panelizationMode?: 'single' | 'panelized'
} | null>(null)

const teamPanelLimits = computed(() => ({
  preferredWidthMm: currentTeam.value?.preferred_panel_width_mm ?? null,
  preferredHeightMm: currentTeam.value?.preferred_panel_height_mm ?? null,
  maxWidthMm: currentTeam.value?.max_panel_width_mm ?? null,
  maxHeightMm: currentTeam.value?.max_panel_height_mm ?? null,
}))

function handlePcbDataUpdate(data: typeof pcbData.value) {
  pcbData.value = data
}

// ── Panel configuration ──
import type { PanelConfig, DangerZoneConfig } from '~/utils/panel-types'
import { DEFAULT_PANEL_CONFIG, migratePanelConfig } from '~/utils/panel-types'
import { derivePanelEdgeConstraintsFromComponents } from '~/utils/panel-component-clearance'

const panelData = ref<PanelConfig>(DEFAULT_PANEL_CONFIG())
const panelDangerZone = ref<DangerZoneConfig>({ enabled: false, insetMm: 2 })
const hasLoadedProjectData = ref(false)

function normalizePanelConfig(data: unknown): PanelConfig {
  // Strip Vue proxies/functions and keep a plain, migrated JSON shape.
  const plain = JSON.parse(JSON.stringify(data ?? {})) as Record<string, any>
  return migratePanelConfig(plain)
}

function handlePanelDataUpdate(data: PanelConfig) {
  panelData.value = normalizePanelConfig(data)
}

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

const selectedPreset = computed(() =>
  getPresetForAppearance(pcbData.value?.surfaceFinish, pcbData.value?.solderMaskColor),
)
const isPanelizedMode = computed(() => pcbData.value?.panelizationMode === 'panelized')
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
const imageExportTarget = ref<'board' | 'panel'>('board')
const showComponentEdit = ref(false)
watch(showComponentEdit, (open) => { if (!open) previewPkgOverride.value = null })
const editingComponent = ref<import('~/composables/usePickAndPlace').EditablePnPComponent | null>(null)
const performanceSnapshot = ref<{
  fpsApprox?: number
  frameMs?: number
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
const longTaskTimestamps: number[] = []
let longTaskObserver: PerformanceObserver | null = null

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

// Gerber-based fallback: compute board dimensions directly from layer data.
// Needed when BoardCanvas has never mounted (e.g. page opened on panel tab).
const _gerberImageTreeCache = new Map<string, ImageTree>()
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

const _outlineOriginMm = computed<{ x: number; y: number } | null>(() => {
  const ls = layers.value
  if (ls.length === 0) return null

  const outlineLayer = ls.find(l => l.type === 'Outline') || ls.find(l => l.type === 'Keep-Out')
  if (outlineLayer && !isPnPLayer(outlineLayer.type)) {
    const tree = _parseLayerTree(outlineLayer)
    if (tree && tree.children.length > 0 && !isEmpty(tree.bounds as BoundingBox)) {
      const b = tree.bounds as BoundingBox
      const toMm = tree.units === 'in' ? 25.4 : 1
      return { x: b[0] * toMm, y: b[1] * toMm }
    }
  }

  let bounds: BoundingBox = emptyBounds()
  let units: 'mm' | 'in' = 'mm'
  for (const layer of ls) {
    if (isPnPLayer(layer.type)) continue
    const tree = _parseLayerTree(layer)
    if (!tree || tree.children.length === 0) continue
    bounds = mergeBounds(bounds, tree.bounds as BoundingBox)
    units = tree.units
  }
  if (isEmpty(bounds)) return null
  const toMm = units === 'in' ? 25.4 : 1
  return { x: bounds[0] * toMm, y: bounds[1] * toMm }
})

function _parseLayerTree(layer: LayerInfo): ImageTree | null {
  const key = layer.file.fileName
  if (_gerberImageTreeCache.has(key)) return _gerberImageTreeCache.get(key)!
  try {
    const ast = parseGerber(layer.file.content)
    const tree = plotImageTree(ast)
    _gerberImageTreeCache.set(key, tree)
    return tree
  } catch {
    return null
  }
}

const boardSizeMm = computed<{ width: number; height: number } | undefined>(() => {
  return _liveBoardSizeMm.value ?? _cachedBoardSizeMm.value ?? _gerberBoardSizeMm.value
})

/** Count copper layers from loaded Gerber files to suggest PCB layer count */
const detectedLayerCount = computed<number | null>(() => {
  const copperTypes = new Set(['Top Copper', 'Bottom Copper', 'Inner Layer'])
  const count = layers.value.filter(l => copperTypes.has(l.type)).length
  return count > 0 ? count : null
})

const downloadMenuItems = computed(() => {
  const items: { label: string; icon: string; onSelect: () => void }[] = []
  if (viewMode.value === 'realistic') {
    items.push({
      label: 'Export Image',
      icon: 'i-lucide-image',
      onSelect: () => {
        imageExportTarget.value = 'board'
        showImageExport.value = true
      },
    })
  }
  if (isPanelizedMode.value && sidebarTab.value === 'panel' && layers.value.length > 0) {
    items.push({
      label: 'Export Panel Image',
      icon: 'i-lucide-grid-2x2',
      onSelect: () => {
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

const copperTrees = computed(() => {
  const copperTypes = new Set(['Top Copper', 'Bottom Copper'])
  const trees: import('@lib/gerber/types').ImageTree[] = []
  for (const layer of layers.value) {
    if (!copperTypes.has(layer.type)) continue
    const tree = _parseLayerTree(layer)
    if (tree) trees.push(tree)
  }
  return trees.length ? trees : null
})

// ── Pick & Place ──
const pnp = usePickAndPlace(layers)
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
  if (type === 'smd') pnpSortSmd.value = value
  else pnpSortTht.value = value
}

function createGroup(type: 'smd' | 'tht') {
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
  pnpComponentGroups.value = pnpComponentGroups.value.map(g =>
    g.id === groupId ? { ...g, hidden: !g.hidden } : g,
  )
}

function toggleGroupCollapsed(groupId: string) {
  pnpComponentGroups.value = pnpComponentGroups.value.map(g =>
    g.id === groupId ? { ...g, collapsed: !g.collapsed } : g,
  )
}

function deleteGroup(groupId: string, type: 'smd' | 'tht') {
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

// ── Documents (PDF) ──
import type { DocumentType, ProjectDocument } from '~/utils/document-types'

const documentTypes: DocumentType[] = ['Schematics', 'Drawings', 'Datasheets', 'Instructions']

const documents = ref<ProjectDocument[]>([])
const selectedDocumentId = ref<string | null>(null)
const hasDocuments = computed(() => documents.value.length > 0)
const selectedDocument = computed(() => documents.value.find(d => d.id === selectedDocumentId.value) ?? null)
const showDocumentViewer = computed(() => selectedDocument.value !== null)

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
  // Switch to Docs tab and select the first new document
  if (firstNewId) {
    selectedDocumentId.value = firstNewId
    sidebarTab.value = 'docs'
  }
}

async function handleDocumentRemove(id: string) {
  const idx = documents.value.findIndex(d => d.id === id)
  if (idx < 0) return
  const doc = documents.value[idx]
  delete documentSizeById.value[id]
  URL.revokeObjectURL(doc.blobUrl)
  documents.value.splice(idx, 1)
  if (selectedDocumentId.value === id) {
    selectedDocumentId.value = documents.value.length > 0 ? documents.value[0].id : null
  }
  // Switch away from docs tab when all documents are removed
  if (documents.value.length === 0 && sidebarTab.value === 'docs') {
    sidebarTab.value = 'layers'
  }
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

function handleDocumentTypeUpdate(id: string, type: DocumentType) {
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
  for (const doc of documents.value) URL.revokeObjectURL(doc.blobUrl)
  if (perfRefreshTimer) clearInterval(perfRefreshTimer)
  stopPerfFrameLoop()
  stopLongTaskObserver()
})

// ── BOM ──
const bom = useBom(layers)
const elexess = useElexessApi()

// ── BOM ↔ PnP cross-reference designator sets ──

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

/** Designators present in BOM (all non-DNP lines, split from comma-separated refs) */
const bomDesignators = computed(() => {
  const s = new Set<string>()
  for (const line of bom.bomLines.value) {
    if (line.dnp) continue
    const refs = (line.references || '').split(/[,;\s]+/).map(r => r.trim()).filter(Boolean)
    for (const r of refs) s.add(r)
  }
  return s
})

const showBomFieldMapping = ref(false)

// Auto-switch to SMD tab when PnP layers appear for the first time
// (skip if the URL already specified a tab)
const hadExplicitTab = !!route.query.tab

watch(pnp.hasPnP, (has) => {
  if (has && sidebarTab.value === 'layers' && !hadExplicitTab) {
    sidebarTab.value = 'smd'
  }
})

watch(isPanelizedMode, (enabled) => {
  if (!enabled && sidebarTab.value === 'panel') {
    sidebarTab.value = 'pcb'
  }
}, { immediate: true })

// Auto-switch to BOM tab when BOM data appears and no PnP
watch(bom.hasBom, (has) => {
  if (has && sidebarTab.value === 'layers' && !pnp.hasPnP.value && !hadExplicitTab) {
    sidebarTab.value = 'bom'
  }
})

// Show field mapping modal when needed
watch(bom.needsFieldMapping, (needs) => {
  if (needs) showBomFieldMapping.value = true
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

function persistToProject(updates: Record<string, any>) {
  if (isTeamProject && teamProjectId) {
    if (!hasLoadedProjectData.value) {
      pendingTeamUpdates = { ...pendingTeamUpdates, ...updates }
      return
    }
    // Serialize writes so stale async responses cannot overwrite newer edits.
    teamPersistQueue = teamPersistQueue.then(async () => {
      const mapped: Record<string, any> = {}
      for (const [k, v] of Object.entries(updates)) {
        mapped[k.replace(/[A-Z]/g, m => '_' + m.toLowerCase())] = v
      }
      const { error } = await updateTeamProject(teamProjectId, mapped)
      if (error) {
        console.warn('[viewer] Failed to persist team project updates:', error.message ?? error)
      }
    }).catch((err) => {
      console.warn('[viewer] Persist queue failed:', err)
    })
  }
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

// ── Persist BOM data ──

watch(bom.bomLinesRecord, (lines) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ bomLines: lines })
  } else {
    updateBomLines(projectId, lines)
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

watch(pcbData, (data) => {
  if (!hasLoadedProjectData.value) return
  if (isTeamProject) {
    persistToProject({ pcbData: data })
  } else {
    updatePcbData(projectId, data)
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

// BOM pricing fetch handlers
async function handleFetchAllPricing() {
  const updatedCache = await elexess.fetchAllPricing(
    bom.bomLines.value as BomLine[],
    bom.pricingCache.value as Record<string, any>,
  )
  bom.updatePricingCache(updatedCache)
}

async function handleFetchSinglePricing(partNumber: string) {
  const entry = await elexess.fetchSinglePricing(partNumber)
  if (entry) {
    bom.updateSinglePricing(partNumber, entry.data)
  }
}

function handleBomAddLine(line?: Partial<BomLine>) {
  if (line?.id) {
    bom.updateLine(line.id, line)
  } else {
    bom.addLine(line)
  }
}

function handleBomFieldMappingConfirm(mapping: BomColumnMapping) {
  bom.applyFieldMapping(mapping)
  showBomFieldMapping.value = false
}

function handleBomFieldMappingCancel() {
  bom.cancelFieldMapping()
  showBomFieldMapping.value = false
}

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
const { getProject: getTeamProject, approveProject: doApprove, revertToDraft: doRevert, updateProject: updateTeamProject, getProjectFiles: getTeamFiles, downloadFile: downloadTeamFile, uploadFile: uploadTeamFile, deleteFile: deleteTeamFile, getProjectDocuments: getTeamDocuments, uploadDocument: uploadTeamDocument, downloadDocument: downloadTeamDocument, updateDocumentType: updateTeamDocumentType, deleteDocument: deleteTeamDocument } = useTeamProjects()

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
        pnpDeletedComponents: tp.pnp_deleted_components,
        pnpSortSmd: tp.pnp_sort_smd,
        pnpSortTht: tp.pnp_sort_tht,
        pnpManualOrderSmd: tp.pnp_manual_order_smd,
        pnpManualOrderTht: tp.pnp_manual_order_tht,
        pnpComponentGroups: tp.pnp_component_groups,
        pnpGroupAssignments: tp.pnp_group_assignments,
        bomLines: tp.bom_lines,
        bomPricingCache: tp.bom_pricing_cache,
        bomBoardQuantity: tp.bom_board_quantity,
        pcbData: tp.pcb_data,
        panelData: tp.panel_data,
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
    const type = resolveLayerType(f.fileName, f.layerType)
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

  // Restore persisted deleted component keys
  pnp.setDeletedKeys(project.value?.pnpDeletedComponents)

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
  const restoredCache = project.value?.bomPricingCache
  try {
    if (restoredCache) elexess.cleanPricingCache(restoredCache)
  } catch (e) {
    console.warn('[viewer] cleanPricingCache failed, using raw cache:', e)
  }
  bom.setPricingCache(restoredCache)
  bom.setBoardQuantity(project.value?.bomBoardQuantity)

  // Restore persisted PCB data
  pcbData.value = project.value?.pcbData ?? null

  // Restore persisted panel data (with backward-compatible migration)
  if (project.value?.panelData) {
    panelData.value = normalizePanelConfig(project.value.panelData)
  }
  hasLoadedProjectData.value = true

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
  // Ensure SVG exporter uses fresh footprint shapes (not stale cached data)
  ;(SvgExporter as any).clearFootprintCaches?.()

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
      const svgString = exportRealisticSvg(realisticLayers, selectedPreset.value, side)
      return new Blob([svgString], { type: 'image/svg+xml' })
    }

    const comps = buildComponentsForSide(side)
    const svgString = (SvgExporter as any).exportRealisticSvgWithComponents(realisticLayers, selectedPreset.value, side, {
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
  triggerDownload(zipBlob, `${projectName}-panel-images.zip`)
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
    triggerDownload(blob, files[0]!.filename)
  } else {
    const zip = new JSZip()
    for (const f of files) {
      zip.file(f.filename, buildExport(f.components))
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    triggerDownload(blob, `${name}-pick-and-place.zip`)
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
