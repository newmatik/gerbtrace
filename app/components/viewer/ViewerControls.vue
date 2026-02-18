<template>
  <div
    v-if="showControls"
    class="h-10 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-1.5 px-3 bg-white dark:bg-neutral-900 shrink-0"
  >
    <!-- View mode: Layers / Realistic -->
    <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700">
      <UButton
        v-for="m in viewModeOptions"
        :key="m.value"
        size="xs"
        color="neutral"
        variant="ghost"
        :class="[tbBtnBase, viewMode === m.value ? tbBtnActive : tbBtnIdle]"
        @click="$emit('update:viewMode', m.value)"
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
        @click="$emit('update:activeFilter', f.value)"
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
        @click="$emit('update:mirrored', !mirrored)"
      >
        <span>Mirror</span>
      </UButton>
    </div>

    <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />

    <!-- Interaction mode: Cursor / Measure / (Info) / (Delete) -->
    <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700">
      <UButton
        v-for="m in filteredModeOptions"
        :key="m.value"
        size="xs"
        color="neutral"
        variant="ghost"
        :icon="m.icon"
        :class="[tbBtnBase, activeMode === m.value ? tbBtnActive : tbBtnIdle]"
        :title="m.title"
        @click="$emit('update:activeMode', m.value)"
      >
        <span>{{ m.label }}</span>
      </UButton>
    </div>

    <!-- Crop toggle (PCB only) -->
    <template v-if="showCrop">
      <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-crop"
        :class="[tbBtnBase, cropToOutline ? tbBtnActive : tbBtnIdle]"
        @click="$emit('update:cropToOutline', !cropToOutline)"
      >
        <span>Crop</span>
      </UButton>
    </template>

    <!-- Board rotation (not on Panel) -->
    <template v-if="showRotation">
      <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />
      <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700">
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-rotate-ccw"
          :class="[tbBtnBase, tbBtnIdle]"
          title="Rotate 90° counter-clockwise"
          @click="$emit('rotateCCW')"
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
                  @change="(e: Event) => $emit('update:boardRotation', Number((e.target as HTMLInputElement).value))"
                  @keydown.enter="(e: Event) => { $emit('update:boardRotation', Number((e.target as HTMLInputElement).value)); (e.target as HTMLInputElement).blur() }"
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
                  @click="$emit('update:boardRotation', angle)"
                >
                  {{ angle }}°
                </button>
              </div>
              <button
                v-if="boardRotation !== 0"
                class="w-full text-[10px] font-medium px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-red-400 hover:text-red-600 dark:hover:border-red-500 dark:hover:text-red-400 transition-colors"
                @click="$emit('update:boardRotation', 0)"
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
          @click="$emit('rotateCW')"
        />
      </div>
    </template>

    <!-- Panel-specific: Tab Control + Added Routing -->
    <template v-if="activeTab === 'panel'">
      <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />

      <span class="text-[10px] uppercase tracking-wide font-semibold text-neutral-500 dark:text-neutral-400 px-1">
        Tabs
      </span>
      <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700">
        <UButton
          v-for="m in tabControlModes"
          :key="m.value"
          size="xs"
          color="neutral"
          variant="ghost"
          :disabled="!tabControlEnabled"
          :class="[tbBtnBase, panelTabEditMode === m.value ? (m.value === 'delete' ? tbBtnDanger : tbBtnActive) : tbBtnIdle]"
          :title="m.title"
          @click="$emit('update:panelTabEditMode', panelTabEditMode === m.value ? 'off' : m.value)"
        >
          {{ m.label }}
        </UButton>
      </div>

      <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />

      <span class="text-[10px] uppercase tracking-wide font-semibold text-neutral-500 dark:text-neutral-400 px-1">
        Routing
      </span>
      <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700">
        <UButton
          v-for="m in routingControlModes"
          :key="m.value"
          size="xs"
          color="neutral"
          variant="ghost"
          :class="[tbBtnBase, panelRoutingEditMode === m.value ? (m.value === 'delete' ? tbBtnDanger : tbBtnActive) : tbBtnIdle]"
          :title="m.title"
          @click="$emit('update:panelRoutingEditMode', panelRoutingEditMode === m.value ? 'off' : m.value)"
        >
          {{ m.label }}
        </UButton>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { LayerFilter } from '~/utils/gerber-helpers'
import type { ViewMode } from '~/components/viewer/BoardCanvas.vue'

type InteractionMode = 'cursor' | 'measure' | 'info' | 'delete'
type SidebarTab = 'files' | 'pcb' | 'panel' | 'smd' | 'tht' | 'bom' | 'pricing' | 'docs'
type TabEditMode = 'off' | 'move' | 'add' | 'delete'
type RoutingEditMode = 'off' | 'add' | 'move' | 'delete'

const props = defineProps<{
  activeTab: SidebarTab
  viewMode: ViewMode
  activeFilter: LayerFilter
  mirrored: boolean
  activeMode: InteractionMode
  cropToOutline: boolean
  hasOutline: boolean
  hasLayers: boolean
  boardRotation: number
  tabControlEnabled: boolean
  panelTabEditMode: TabEditMode
  panelRoutingEditMode: RoutingEditMode
}>()

defineEmits<{
  'update:viewMode': [mode: ViewMode]
  'update:activeFilter': [filter: LayerFilter]
  'update:mirrored': [mirrored: boolean]
  'update:activeMode': [mode: InteractionMode]
  'update:cropToOutline': [crop: boolean]
  'update:boardRotation': [deg: number]
  'rotateCW': []
  'rotateCCW': []
  'update:panelTabEditMode': [mode: TabEditMode]
  'update:panelRoutingEditMode': [mode: RoutingEditMode]
}>()

const tbBtnBase =
  '!rounded-md !px-2.5 !py-1 !text-xs !font-medium !border !shadow-none !transition-colors'
const tbBtnIdle =
  '!border-transparent hover:!border-neutral-300/80 hover:!bg-neutral-200/70 ' +
  'dark:!text-neutral-200 dark:hover:!bg-neutral-800/70 dark:hover:!border-neutral-600/70'
const tbBtnActive =
  '!border-blue-500/70 !text-blue-700 !bg-blue-50/90 ' +
  'dark:!border-blue-400/70 dark:!text-blue-200 dark:!bg-blue-500/15'
const tbBtnDanger =
  '!border-red-500/70 !text-red-700 !bg-red-50/90 ' +
  'dark:!border-red-400/70 dark:!text-red-200 dark:!bg-red-500/15'

const pagesWithControls = new Set<SidebarTab>(['pcb', 'panel', 'smd', 'tht'])
const pagesWithInfoDelete = new Set<SidebarTab>(['pcb'])
const pagesWithRotation = new Set<SidebarTab>(['pcb', 'smd', 'tht'])

const showControls = computed(() => pagesWithControls.has(props.activeTab))

const showCrop = computed(() =>
  props.activeTab === 'pcb' && props.hasOutline && props.viewMode === 'layers',
)

const showRotation = computed(() =>
  pagesWithRotation.has(props.activeTab) && props.hasLayers,
)

const viewModeOptions: { label: string; value: ViewMode }[] = [
  { label: 'Layers', value: 'layers' },
  { label: 'Realistic', value: 'realistic' },
]

const filterOptions = [
  { label: 'All', value: 'all' as LayerFilter },
  { label: 'Top', value: 'top' as LayerFilter },
  { label: 'Bot', value: 'bot' as LayerFilter },
]

const activeFilterOptions = computed(() => {
  if (props.viewMode === 'realistic') {
    return filterOptions.filter(f => f.value !== 'all')
  }
  return filterOptions
})

const allModeOptions: { label: string; value: InteractionMode; icon: string; title: string }[] = [
  { label: 'Cursor', value: 'cursor', icon: 'i-lucide-mouse-pointer', title: 'Default cursor mode' },
  { label: 'Measure', value: 'measure', icon: 'i-lucide-ruler', title: 'Measure distance between points' },
  { label: 'Info', value: 'info', icon: 'i-lucide-info', title: 'Inspect objects at click position' },
  { label: 'Delete', value: 'delete', icon: 'i-lucide-eraser', title: 'Select and delete objects from Gerber files' },
]

const filteredModeOptions = computed(() => {
  if (pagesWithInfoDelete.has(props.activeTab)) return allModeOptions
  return allModeOptions.filter(m => m.value !== 'info' && m.value !== 'delete')
})

const tabControlModes = [
  { label: 'Move', value: 'move' as const, title: 'Move tabs' },
  { label: 'Add', value: 'add' as const, title: 'Add tabs' },
  { label: 'Delete', value: 'delete' as const, title: 'Delete tabs' },
]

const routingControlModes = [
  { label: 'Move', value: 'move' as const, title: 'Move milling path' },
  { label: 'Add', value: 'add' as const, title: 'Add milling path' },
  { label: 'Delete', value: 'delete' as const, title: 'Delete milling path' },
]
</script>
