<template>
  <div class="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80 px-2 py-1.5 flex items-center gap-1.5 overflow-x-auto">
    <!-- View mode: Layers / Realistic -->
    <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700 shrink-0">
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

    <!-- Layer filter: All / Top / Bot + Mirror -->
    <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700 shrink-0">
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

    <!-- Interaction mode: Cursor / Measure / Info / Delete -->
    <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700 shrink-0">
      <UButton
        v-for="m in visibleModeOptions"
        :key="m.value"
        size="xs"
        color="neutral"
        variant="ghost"
        :icon="m.icon"
        :disabled="isLocked && m.value === 'delete'"
        :class="[tbBtnBase, activeMode === m.value ? tbBtnActive : tbBtnIdle]"
        :title="m.title"
        @click="setMode(m.value)"
      >
        <span>{{ m.label }}</span>
      </UButton>

      <!-- Measure constraint modes (visible when Measure mode is active) -->
      <template v-if="activeMode === 'measure'">
        <div class="w-px h-4 bg-neutral-300 dark:bg-neutral-600 mx-0.5" />
        <UButton
          v-for="m in measureConstraintModes"
          :key="m.value"
          size="xs"
          color="neutral"
          variant="ghost"
          :class="[tbBtnBase, measureConstraintMode === m.value ? tbBtnMeasureActive : tbBtnIdle]"
          :title="m.title"
          @click="measureConstraintMode = m.value"
        >
          {{ m.label }}
        </UButton>
      </template>

      <template v-if="page === 'panel'">
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-triangle-alert"
          :class="[tbBtnBase, panelShowDangerZones ? tbBtnActive : tbBtnIdle]"
          title="Toggle danger zone overlay"
          @click="panelShowDangerZones = !panelShowDangerZones"
        >
          Show Danger
        </UButton>
        <div v-if="panelShowDangerZones" class="flex items-center gap-1 shrink-0">
          <UInput
            v-model.number="panelDangerInsetMm"
            type="number"
            size="xs"
            class="w-16"
            :min="0.5"
            :max="20"
            :step="0.5"
          />
          <span class="text-[10px] text-neutral-500 dark:text-neutral-400">mm</span>
        </div>
      </template>
    </div>

    <template v-if="page === 'panel'">
      <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700 shrink-0">
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-microchip"
          :class="[tbBtnBase, panelShowSmdComponents ? tbBtnActive : tbBtnIdle]"
          title="Toggle SMD component overlay"
          @click="panelShowSmdComponents = !panelShowSmdComponents"
        >
          SMD
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-pin"
          :class="[tbBtnBase, panelShowThtComponents ? tbBtnActive : tbBtnIdle]"
          title="Toggle THT component overlay"
          @click="panelShowThtComponents = !panelShowThtComponents"
        >
          THT
        </UButton>
      </div>
    </template>

    <!-- Panel-only: Tab Control + Added Routing -->
    <template v-if="page === 'panel'">
      <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700 shrink-0">
        <span class="text-[10px] uppercase tracking-wide font-semibold text-neutral-500 dark:text-neutral-400 px-1">
          Tabs
        </span>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          :class="[tbBtnBase, panelTabEditMode === 'move' ? tbBtnActive : tbBtnIdle]"
          :disabled="isLocked || !panelTabControlEnabled"
          @click="togglePanelTabMode('move')"
        >
          Move
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          :class="[tbBtnBase, panelTabEditMode === 'add' ? tbBtnActive : tbBtnIdle]"
          :disabled="isLocked || !panelTabControlEnabled"
          @click="togglePanelTabMode('add')"
        >
          Add
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          :class="[tbBtnBase, panelTabEditMode === 'delete' ? tbBtnActive : tbBtnIdle]"
          :disabled="isLocked || !panelTabControlEnabled"
          @click="togglePanelTabMode('delete')"
        >
          Delete
        </UButton>
      </div>

      <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700 shrink-0">
        <span class="text-[10px] uppercase tracking-wide font-semibold text-neutral-500 dark:text-neutral-400 px-1">
          Routing
        </span>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          :class="[tbBtnBase, panelAddedRoutingEditMode === 'move' ? tbBtnActive : tbBtnIdle]"
          :disabled="isLocked"
          @click="togglePanelRoutingMode('move')"
        >
          Move
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          :class="[tbBtnBase, panelAddedRoutingEditMode === 'add' ? tbBtnActive : tbBtnIdle]"
          :disabled="isLocked"
          @click="togglePanelRoutingMode('add')"
        >
          Add
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          :class="[tbBtnBase, panelAddedRoutingEditMode === 'delete' ? tbBtnActive : tbBtnIdle]"
          :disabled="isLocked"
          @click="togglePanelRoutingMode('delete')"
        >
          Delete
        </UButton>
      </div>
    </template>

    <!-- Crop toggle -->
    <template v-if="hasOutline && viewMode === 'layers'">
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

    <!-- Board rotation (not available on Panel page) -->
    <template v-if="layersCount > 0 && page !== 'panel'">
      <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700 shrink-0">
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-rotate-ccw"
          :class="[tbBtnBase, tbBtnIdle]"
          title="Rotate 90° counter-clockwise"
          :disabled="isLocked"
          @click="rotateCCW()"
        />
        <UPopover :content="{ align: 'center', sideOffset: 8 }">
          <button
            class="text-[10px] font-mono px-1.5 py-0.5 rounded min-w-[2.5rem] text-center transition-colors cursor-pointer"
            :disabled="isLocked"
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
                  :disabled="isLocked"
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
                  :disabled="isLocked"
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
                :disabled="isLocked"
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
          :disabled="isLocked"
          @click="rotateCW()"
        />
      </div>
    </template>

    <!-- PnP canvas controls (SMD/THT tabs) -->
    <template v-if="page === 'smd' || page === 'tht'">
      <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700 shrink-0">
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-microchip"
          :class="[tbBtnBase, pnpShowSmd ? tbBtnActive : tbBtnIdle]"
          title="Show SMD components on canvas"
          @click="pnpShowSmd = !pnpShowSmd"
        >
          SMD
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-pin"
          :class="[tbBtnBase, pnpShowTht ? tbBtnActive : tbBtnIdle]"
          title="Show THT components on canvas"
          @click="pnpShowTht = !pnpShowTht"
        >
          THT
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          :class="[tbBtnBase, pnpShowDnpHighlight ? tbBtnActive : tbBtnIdle]"
          title="Show DNP components highlighted in blue on canvas"
          @click="pnpShowDnpHighlight = !pnpShowDnpHighlight"
        >
          <span class="text-[14px] leading-none -mt-px" aria-hidden="true">•</span>
          DNP Blue
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-crosshair"
          :class="[tbBtnBase, pnpAutoFocusOnSelect ? tbBtnActive : tbBtnIdle]"
          title="Automatically center and zoom when selecting components"
          @click="pnpAutoFocusOnSelect = !pnpAutoFocusOnSelect"
        >
          Auto Focus
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-map"
          :class="[tbBtnBase, pnpShowMinimap ? tbBtnActive : tbBtnIdle]"
          title="Show minimap with current viewport"
          @click="pnpShowMinimap = !pnpShowMinimap"
        >
          Minimap
        </UButton>
      </div>
    </template>

    <div v-if="showLockControl" class="ml-auto shrink-0">
      <UPopover v-model:open="lockPopoverOpen" :content="{ side: 'bottom', align: 'end', sideOffset: 6 }">
        <div
          @mouseenter="lockPopoverOpen = true"
          @mouseleave="lockPopoverOpen = false"
          @focusin="lockPopoverOpen = true"
          @focusout="lockPopoverOpen = false"
        >
          <UButton
            size="xs"
            :color="isLocked ? 'warning' : 'neutral'"
            :variant="isLocked ? 'soft' : 'outline'"
            :icon="isLocked ? 'i-lucide-lock' : 'i-lucide-lock-open'"
            :disabled="!canToggleLock"
            @click="toggleLock?.()"
          >
            {{ isLocked ? 'Locked' : 'Unlocked' }}
          </UButton>
        </div>
        <template #content>
          <div class="px-2 py-1 text-[11px] text-neutral-600 dark:text-neutral-300 max-w-[20rem]">
            {{ lockTooltip }}
          </div>
        </template>
      </UPopover>
    </div>
  </div>
</template>

<script setup lang="ts">
type ViewerPage = 'files' | 'pcb' | 'panel' | 'paste' | 'smd' | 'tht' | 'bom' | 'pricing' | 'docs'
type ViewMode = 'layers' | 'realistic'
type LayerFilter = 'all' | 'top' | 'bot'
type InteractionMode = 'cursor' | 'measure' | 'info' | 'delete'
type PanelTabEditMode = 'off' | 'move' | 'add' | 'delete'
type PanelAddedRoutingEditMode = 'off' | 'add' | 'move' | 'delete'

const props = defineProps<{
  page: ViewerPage
  hasOutline: boolean
  layersCount: number
  activeFilterOptions: { label: string; value: LayerFilter }[]
  panelTabControlEnabled?: boolean
  isLocked?: boolean
  showLockControl?: boolean
  canToggleLock?: boolean
  lockTooltip?: string
  toggleLock?: () => void
  setViewMode: (m: ViewMode) => void
  setFilter: (f: LayerFilter) => void
  setMode: (m: InteractionMode) => void
  rotateCW: () => void
  rotateCCW: () => void
  setBoardRotation: (deg: number) => void
}>()

const viewMode = defineModel<ViewMode>('viewMode', { required: true })
const activeFilter = defineModel<LayerFilter>('activeFilter', { required: true })
const mirrored = defineModel<boolean>('mirrored', { required: true })
const activeMode = defineModel<InteractionMode>('activeMode', { required: true })
const cropToOutline = defineModel<boolean>('cropToOutline', { required: true })
const boardRotation = defineModel<number>('boardRotation', { required: true })

const panelTabEditMode = defineModel<PanelTabEditMode>('panelTabEditMode', { default: 'off' })
const panelAddedRoutingEditMode = defineModel<PanelAddedRoutingEditMode>('panelAddedRoutingEditMode', { default: 'off' })
const panelShowSmdComponents = defineModel<boolean>('panelShowSmdComponents', { default: true })
const panelShowThtComponents = defineModel<boolean>('panelShowThtComponents', { default: true })
const panelShowDangerZones = defineModel<boolean>('panelShowDangerZones', { default: false })
const panelDangerInsetMm = defineModel<number>('panelDangerInsetMm', { default: 2 })

const pnpShowDnpHighlight = defineModel<boolean>('pnpShowDnpHighlight', { default: true })
const pnpShowSmd = defineModel<boolean>('pnpShowSmd', { default: true })
const pnpShowTht = defineModel<boolean>('pnpShowTht', { default: false })
const pnpAutoFocusOnSelect = defineModel<boolean>('pnpAutoFocusOnSelect', { default: true })
const pnpShowMinimap = defineModel<boolean>('pnpShowMinimap', { default: false })
const measureConstraintMode = defineModel<'free' | 'horizontal' | 'vertical'>('measureConstraintMode', { default: 'free' })

const panelTabControlEnabled = computed(() => props.panelTabControlEnabled ?? true)
const isLocked = computed(() => !!props.isLocked)
const showLockControl = computed(() => !!props.showLockControl)
const canToggleLock = computed(() => props.canToggleLock ?? false)
const lockTooltip = computed(() => props.lockTooltip ?? '')
const lockPopoverOpen = ref(false)

const viewModeOptions: { label: string; value: ViewMode }[] = [
  { label: 'Layers', value: 'layers' },
  { label: 'Realistic', value: 'realistic' },
]

const modeOptions: { label: string; value: InteractionMode; icon: string; title: string }[] = [
  { label: 'Cursor', value: 'cursor', icon: 'i-lucide-mouse-pointer', title: 'Default cursor mode' },
  { label: 'Measure', value: 'measure', icon: 'i-lucide-ruler', title: 'Measure distance between points' },
  { label: 'Info', value: 'info', icon: 'i-lucide-info', title: 'Inspect objects at click position' },
  { label: 'Delete', value: 'delete', icon: 'i-lucide-eraser', title: 'Select and delete objects from Gerber files' },
]

const visibleModeOptions = computed(() => {
  if (props.page === 'panel') return modeOptions.filter(m => m.value !== 'info' && m.value !== 'delete')
  if (props.page === 'smd' || props.page === 'tht') return modeOptions.filter(m => m.value !== 'info' && m.value !== 'delete')
  return modeOptions
})

function togglePanelTabMode(mode: Exclude<PanelTabEditMode, 'off'>) {
  if (isLocked.value) return
  if (!panelTabControlEnabled.value) return
  panelTabEditMode.value = panelTabEditMode.value === mode ? 'off' : mode
  if (panelTabEditMode.value !== 'off') panelAddedRoutingEditMode.value = 'off'
}

function togglePanelRoutingMode(mode: Exclude<PanelAddedRoutingEditMode, 'off'>) {
  if (isLocked.value) return
  panelAddedRoutingEditMode.value = panelAddedRoutingEditMode.value === mode ? 'off' : mode
  if (panelAddedRoutingEditMode.value !== 'off') panelTabEditMode.value = 'off'
}

// Toolbar button styling (outline + blue active border)
const tbBtnBase =
  '!rounded-md !px-2.5 !py-1 !text-xs !font-medium !border !shadow-none !transition-colors'
const tbBtnIdle =
  '!border-transparent hover:!border-neutral-300/80 hover:!bg-neutral-200/70 ' +
  'dark:!text-neutral-200 dark:hover:!bg-neutral-800/70 dark:hover:!border-neutral-600/70'
const tbBtnActive =
  '!border-blue-500/70 !text-blue-700 !bg-blue-50/90 ' +
  'dark:!border-blue-400/70 dark:!text-blue-200 dark:!bg-blue-500/15'
const tbBtnMeasureActive =
  '!border-yellow-500/70 !text-yellow-700 !bg-yellow-50/90 ' +
  'dark:!border-yellow-400/70 dark:!text-yellow-200 dark:!bg-yellow-500/15'

const measureConstraintModes = [
  { value: 'free' as const, label: 'Free', title: 'Free measurement (hold Shift for auto axis lock)' },
  { value: 'horizontal' as const, label: 'H', title: 'Constrain to horizontal axis' },
  { value: 'vertical' as const, label: 'V', title: 'Constrain to vertical axis' },
]
</script>

