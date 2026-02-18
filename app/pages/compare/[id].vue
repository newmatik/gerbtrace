<template>
  <div class="h-screen flex flex-col">
    <AppHeader compact>
      <!-- Toolbar separator -->
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
          {{ project?.name || 'Compare' }}
          <UIcon name="i-lucide-pencil" class="text-[10px] opacity-0 group-hover:opacity-40 transition-opacity" />
        </button>
      </div>

      <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />

      <!-- Comparison mode toggle -->
      <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700">
        <UButton
          v-for="m in modeOptions"
          :key="m.value"
          size="xs"
          color="neutral"
          variant="ghost"
          :icon="m.icon"
          :class="[tbBtnBase, comparisonMode === m.value ? tbBtnActive : tbBtnIdle]"
          @click="comparisonMode = m.value"
        >
          <span>{{ m.label }}</span>
        </UButton>
      </div>

      <div class="w-px h-5 bg-neutral-200 dark:bg-neutral-700/80" />

      <!-- Alignment toggle -->
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-crosshair"
        :class="[tbBtnBase, alignment.isAligned.value ? tbBtnActive : tbBtnIdle]"
        @click="showAlignPanel = !showAlignPanel"
      >
        <span>Align</span>
      </UButton>
    </AppHeader>

    <div class="flex-1 flex overflow-hidden">
      <!-- Side panel -->
      <aside
        class="border-r border-neutral-200 dark:border-neutral-800 flex flex-col overflow-y-auto shrink-0"
        :style="{ width: sidebarWidth + 'px' }"
      >
        <div class="p-4 border-b border-neutral-200 dark:border-neutral-800">
          <div class="grid grid-cols-2 gap-3">
            <ImportPanel
              label="Packet 1"
              :packet="1"
              @import="(f, name) => handleImport(1, f, name)"
            />
            <ImportPanel
              label="Packet 2"
              :packet="2"
              @import="(f, name) => handleImport(2, f, name)"
            />
          </div>
        </div>

        <!-- Alignment panel -->
        <div v-if="showAlignPanel" class="p-3 border-b border-neutral-200 dark:border-neutral-800">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-semibold text-neutral-600 dark:text-neutral-300 uppercase tracking-wide">Alignment</span>
            <UButton
              v-if="alignment.isAligned.value"
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-x"
              @click="alignment.clearAlignment()"
            >
              Clear
            </UButton>
          </div>
          <div class="space-y-2">
            <!-- Packet 1 reference -->
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <span class="text-xs text-neutral-500 dark:text-neutral-400 w-9 shrink-0">Pkt 1</span>
              <template v-if="alignment.refA.value">
                <span class="text-xs font-mono text-neutral-700 dark:text-neutral-200 flex-1 truncate">
                  {{ alignment.refA.value.x.toFixed(3) }}, {{ alignment.refA.value.y.toFixed(3) }}
                </span>
                <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-crosshair" title="Re-set" @click="alignment.startPicking(1)" />
              </template>
              <template v-else>
                <UButton size="xs" variant="soft" color="neutral" icon="i-lucide-crosshair" class="flex-1" @click="alignment.startPicking(1)">
                  Set Reference
                </UButton>
              </template>
            </div>
            <!-- Packet 2 reference -->
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
              <span class="text-xs text-neutral-500 dark:text-neutral-400 w-9 shrink-0">Pkt 2</span>
              <template v-if="alignment.refB.value">
                <span class="text-xs font-mono text-neutral-700 dark:text-neutral-200 flex-1 truncate">
                  {{ alignment.refB.value.x.toFixed(3) }}, {{ alignment.refB.value.y.toFixed(3) }}
                </span>
                <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-crosshair" title="Re-set" @click="alignment.startPicking(2)" />
              </template>
              <template v-else>
                <UButton size="xs" variant="soft" color="neutral" icon="i-lucide-crosshair" class="flex-1" @click="alignment.startPicking(2)">
                  Set Reference
                </UButton>
              </template>
            </div>
          </div>
          <p class="text-[10px] text-neutral-400 dark:text-neutral-500 mt-2 leading-snug">
            Set a reference point (e.g. fiducial, pad) on each packet. Both packages will be aligned at those points.
          </p>
        </div>

        <LayerMatcher
          :files-a="filesA"
          :files-b="filesB"
          :matches="matches"
          :selected-match="selectedMatch"
          @select="selectMatch"
          @rematch="updateMatch"
        />
      </aside>

      <!-- Resize handle -->
      <div
        class="w-1 shrink-0 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors"
        :class="{ 'bg-primary/50': sidebarDragging }"
        @mousedown="onSidebarDragStart"
      />

      <!-- Comparison area -->
      <main class="flex-1 min-w-0 flex flex-col overflow-hidden" :class="{ 'select-none': sidebarDragging }">
        <div class="flex-1 relative overflow-hidden" :style="comparisonMode !== 'text' ? { backgroundColor } : undefined">
          <SideBySideView
            v-if="comparisonMode === 'side-by-side'"
            :match="selectedMatchData"
            :interaction="canvasInteraction"
            :offset-a="alignment.offsetA.value"
            :offset-b="alignment.offsetB.value"
          />
          <OverlayView
            v-else-if="comparisonMode === 'overlay'"
            :match="selectedMatchData"
            :interaction="canvasInteraction"
            :speed="overlaySpeed"
            :offset-a="alignment.offsetA.value"
            :offset-b="alignment.offsetB.value"
          />
          <DiffHighlightView
            v-else-if="comparisonMode === 'diff'"
            :match="selectedMatchData"
            :interaction="canvasInteraction"
            :offset-a="alignment.offsetA.value"
            :offset-b="alignment.offsetB.value"
          />
          <TextDiffViewer
            v-else-if="comparisonMode === 'text'"
            :match="selectedMatchData"
          />
          <div v-if="!selectedMatchData" class="absolute inset-0 flex items-center justify-center text-neutral-500">
            <p>Import files and select a layer pair to compare</p>
          </div>

          <!-- Alignment picker overlay -->
          <AlignmentPicker
            v-if="alignment.pickingPacket.value && pickerTree"
            :image-tree="pickerTree"
            :packet="alignment.pickingPacket.value"
            :interaction="canvasInteraction"
            @pick="onAlignmentPick"
            @cancel="alignment.cancelPicking()"
          />

          <!-- Floating canvas controls (hidden in text mode) -->
          <CanvasControls v-if="comparisonMode !== 'text'" :interaction="canvasInteraction" @open-settings="showSettings = true" />
        </div>
      </main>
    </div>

    <!-- Settings modal -->
    <AppSettingsModal v-model:open="showSettings" />
  </div>
</template>

<script setup lang="ts">
import type { GerberFile, LayerMatch } from '~/utils/gerber-helpers'
import type { ImageTree } from '@lib/gerber/types'

type ComparisonMode = 'side-by-side' | 'overlay' | 'diff' | 'text'

const modeOptions: { label: string; value: ComparisonMode; icon: string }[] = [
  { label: 'Side by Side', value: 'side-by-side', icon: 'i-lucide-columns-2' },
  { label: 'Overlay', value: 'overlay', icon: 'i-lucide-layers' },
  { label: 'Diff', value: 'diff', icon: 'i-lucide-diff' },
  { label: 'Text', value: 'text', icon: 'i-lucide-file-text' },
]

const route = useRoute()
const projectId = Number(route.params.id)
const { getProject, getFiles, addFiles, clearFiles, renameProject } = useProject()
const { autoMatch } = useLayerMatching()
const canvasInteraction = useCanvasInteraction()
const { backgroundColor } = useBackgroundColor()
const { sidebarWidth, dragging: sidebarDragging, onDragStart: onSidebarDragStart } = useSidebarWidth()
const alignment = useCompareAlignment()
const { parse } = useGerberRenderer()

// Toolbar button styling (outline + blue active border)
const tbBtnBase =
  '!rounded-md !px-2.5 !py-1 !text-xs !font-medium !border !shadow-none !transition-colors'
const tbBtnIdle =
  '!border-transparent hover:!border-neutral-300/80 hover:!bg-neutral-200/70 ' +
  'dark:!text-neutral-200 dark:hover:!bg-neutral-800/70 dark:hover:!border-neutral-600/70'
const tbBtnActive =
  '!border-blue-500/70 !text-blue-700 !bg-blue-50/90 ' +
  'dark:!border-blue-400/70 dark:!text-blue-200 dark:!bg-blue-500/15'

const project = ref<any>(null)
const filesA = ref<GerberFile[]>([])
const filesB = ref<GerberFile[]>([])
const matches = ref<LayerMatch[]>([])
const selectedMatch = ref<number>(0)
const comparisonMode = ref<ComparisonMode>('side-by-side')
const overlaySpeed = ref(1000)
const showSettings = ref(false)
const showAlignPanel = ref(false)

// Alignment: parse the first file from the picking packet to show in the picker
const pickerTree = computed<ImageTree | null>(() => {
  const pkt = alignment.pickingPacket.value
  if (!pkt) return null
  const files = pkt === 1 ? filesA.value : filesB.value
  // Use the first file as a representative layer for reference picking
  // Prefer a copper layer if available (most likely to have fiducials/pads)
  const copperFile = files.find(f =>
    (f.layerType || '').includes('Copper') || f.fileName.toLowerCase().match(/\.(gtl|gbl|cmp|sol)$/),
  )
  const file = copperFile || files[0]
  if (!file) return null
  try { return parse(file.content) } catch { return null }
})

function onAlignmentPick(point: { x: number; y: number }) {
  const pkt = alignment.pickingPacket.value
  if (!pkt) return
  alignment.setRef(pkt, point)
  // Auto-fit after alignment changes so the view adjusts
  if (alignment.isAligned.value) {
    canvasInteraction.resetView()
  }
}

// Editable project name
const isEditingName = ref(false)
const editableName = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
const hasBeenRenamed = ref(false)
const sourceNames = ref<string[]>([])

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

function buildCompareName() {
  const a = sourceNames.value[0]
  const b = sourceNames.value[1]
  if (a && b) return `${a} vs ${b}`
  return a || b || ''
}

const selectedMatchData = computed(() => matches.value[selectedMatch.value] || null)

onMounted(async () => {
  project.value = await getProject(projectId)
  filesA.value = await getFiles(projectId, 1)
  filesB.value = await getFiles(projectId, 2)
  matches.value = autoMatch(filesA.value, filesB.value)
})

async function handleImport(packet: number, newFiles: GerberFile[], sourceName: string) {
  // Clear alignment when files change (reference points are no longer valid)
  alignment.clearAlignment()

  // Replace the packet contents (instead of appending) to avoid stacking
  // multiple imports and breaking auto-fit/bounds.
  await clearFiles(projectId, packet)
  await addFiles(projectId, packet, newFiles)
  if (packet === 1) {
    filesA.value = [...newFiles]
  } else {
    filesB.value = [...newFiles]
  }

  // Force an auto-fit after import.
  canvasInteraction.resetView()

  // Auto-name from imported files if not manually renamed
  if (sourceName && !hasBeenRenamed.value && project.value?.name?.match(/^Compare Project /)) {
    sourceNames.value[packet - 1] = sourceName
    const autoName = buildCompareName()
    if (autoName) {
      await renameProject(projectId, autoName)
      project.value = await getProject(projectId)
    }
  }
  selectedMatch.value = 0
  matches.value = autoMatch(filesA.value, filesB.value)
}

function selectMatch(index: number) {
  selectedMatch.value = index
}

function updateMatch(index: number, fileB: GerberFile | null) {
  const match = matches.value[index]
  if (match) {
    match.fileB = fileB
    match.identical = fileB ? match.fileA.content === fileB.content : false
  }
}
</script>

<style scoped>
@reference "tailwindcss";

.tb-group {
  @apply flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100 border border-neutral-200;
}
:global(.dark) .tb-group { @apply bg-neutral-800/90 border-neutral-700; }
.tb-btn {
  @apply !rounded-md !px-2.5 !py-1 !text-xs !font-medium;
}
.tb-btn-idle {
  @apply !text-neutral-600 hover:!text-neutral-900 hover:!bg-neutral-200/80;
}
:global(.dark) .tb-btn-idle { @apply !text-neutral-300 hover:!text-white hover:!bg-neutral-700/80; }
.tb-btn-active {
  @apply !text-blue-700 !bg-blue-100/90;
}
:global(.dark) .tb-btn-active { @apply !text-blue-200 !bg-blue-500/25 !ring-1 !ring-blue-400/35; }
.tb-sep {
  @apply w-px h-5 bg-neutral-200;
}
:global(.dark) .tb-sep { @apply bg-neutral-600; }
</style>
