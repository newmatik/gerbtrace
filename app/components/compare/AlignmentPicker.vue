<template>
  <div
    class="absolute inset-0 z-50"
    :style="{ cursor: 'crosshair' }"
  >
    <!-- Gerber render -->
    <canvas
      ref="canvasEl"
      class="w-full h-full"
      @wheel.prevent="onWheel"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="interaction.handleMouseUp"
      @mouseleave="interaction.handleMouseUp"
      @contextmenu.prevent
    />

    <!-- Instruction banner -->
    <div class="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-900/90 border border-neutral-700 shadow-lg">
      <UIcon name="i-lucide-crosshair" class="text-amber-400 text-base" />
      <span class="text-sm text-neutral-200">
        Click to set reference point for <strong>{{ packetLabel }}</strong>
      </span>
      <UButton size="xs" variant="ghost" color="neutral" @click="$emit('cancel')">
        ESC
      </UButton>
    </div>

    <!-- Snap indicator (shows nearest snap point near cursor) -->
    <div
      v-if="snapIndicator"
      class="absolute pointer-events-none"
      :style="snapIndicatorStyle"
    >
      <div class="relative -translate-x-1/2 -translate-y-1/2">
        <!-- Crosshair ring -->
        <div class="w-6 h-6 rounded-full border-2 border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
        <!-- Center dot -->
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-400" />
        <!-- Coordinate label -->
        <div class="absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-mono text-amber-300 bg-neutral-900/80 px-1.5 py-0.5 rounded">
          {{ snapIndicator.x.toFixed(3) }}, {{ snapIndicator.y.toFixed(3) }}
        </div>
      </div>
    </div>

    <!-- Packet badge -->
    <div class="absolute top-3 left-3">
      <UBadge :color="packet === 1 ? 'error' : 'info'" variant="solid" size="sm">
        Packet {{ packet }}
      </UBadge>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ImageTree } from '@lib/gerber/types'
import { renderToCanvas, computeAutoFitTransform } from '@lib/renderer/canvas-renderer'
import { drawCanvasGrid } from '~/utils/canvas-grid'
import { type AlignSnapPoint, extractSnapPoints, findNearestSnap } from '~/utils/snap-points'

const props = defineProps<{
  imageTree: ImageTree
  packet: 1 | 2
  interaction: ReturnType<typeof useCanvasInteraction>
  viewBounds?: [number, number, number, number]
}>()

const emit = defineEmits<{
  pick: [point: { x: number; y: number }]
  cancel: []
}>()

const canvasEl = ref<HTMLCanvasElement | null>(null)
const autoFitDone = ref(false)
const prevBoundsKey = ref('')
const { backgroundColor, isLight } = useBackgroundColor()
const { settings: appSettings } = useAppSettings()

const mouseScreen = ref<{ x: number; y: number } | null>(null)
const snapIndicator = ref<AlignSnapPoint | null>(null)

const packetLabel = computed(() => `Packet ${props.packet}`)
const packetColor = computed(() => props.packet === 1 ? '#cc0000' : '#0066cc')

const snapPoints = computed(() => extractSnapPoints(props.imageTree))

const snapIndicatorStyle = computed(() => {
  if (!snapIndicator.value) return {}
  const t = props.interaction.transform.value
  const screenX = t.offsetX + snapIndicator.value.x * t.scale
  const screenY = t.offsetY - snapIndicator.value.y * t.scale
  return { left: `${screenX}px`, top: `${screenY}px` }
})

function onWheel(e: WheelEvent) {
  if (canvasEl.value) {
    props.interaction.handleWheel(e, canvasEl.value)
  }
}

function onMouseDown(e: MouseEvent) {
  if (e.button === 0) {
    // Left click — pick reference point
    const point = screenToGerber(e)
    if (!point) return

    // Snap to nearest point
    const snapDist = 20 / props.interaction.transform.value.scale
    const snapped = findNearestSnap(point.x, point.y, snapPoints.value, snapDist)
    emit('pick', snapped ? { x: snapped.x, y: snapped.y } : point)
  } else if (e.button === 2) {
    // Right click — pan
    props.interaction.handleMouseDown(e)
  }
}

function onMouseMove(e: MouseEvent) {
  // Pan handling
  props.interaction.handleMouseMove(e)

  // Snap preview
  const point = screenToGerber(e)
  if (!point) {
    snapIndicator.value = null
    return
  }

  mouseScreen.value = { x: e.clientX, y: e.clientY }
  const snapDist = 20 / props.interaction.transform.value.scale
  snapIndicator.value = findNearestSnap(point.x, point.y, snapPoints.value, snapDist)
}

function screenToGerber(e: MouseEvent): { x: number; y: number } | null {
  const canvas = canvasEl.value
  if (!canvas) return null

  const rect = canvas.getBoundingClientRect()
  const screenX = e.clientX - rect.left
  const screenY = e.clientY - rect.top
  const t = props.interaction.transform.value

  if (t.scale <= 0) return null

  return {
    x: (screenX - t.offsetX) / t.scale,
    y: (t.offsetY - screenY) / t.scale,
  }
}

function draw() {
  const canvas = canvasEl.value
  if (!canvas) return

  const parent = canvas.parentElement
  if (!parent) return

  const dpr = window.devicePixelRatio || 1
  const cssWidth = parent.clientWidth
  const cssHeight = parent.clientHeight

  canvas.width = cssWidth * dpr
  canvas.height = cssHeight * dpr
  canvas.style.width = cssWidth + 'px'
  canvas.style.height = cssHeight + 'px'

  const bounds = (props.viewBounds || props.imageTree.bounds) as [number, number, number, number]
  const boundsKey = bounds.join(',')

  const needsAutoFit = !autoFitDone.value || boundsKey !== prevBoundsKey.value || props.interaction.transform.value.scale <= 0
  if (needsAutoFit) {
    const fit = computeAutoFitTransform(cssWidth, cssHeight, bounds)
    props.interaction.transform.value = fit
    autoFitDone.value = true
    prevBoundsKey.value = boundsKey
  }

  const transform = props.interaction.transform.value

  renderToCanvas(props.imageTree, canvas, {
    color: packetColor.value,
    transform,
    dpr,
    backgroundColor: backgroundColor.value,
  })

  if (appSettings.gridEnabled) {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      drawCanvasGrid({
        ctx,
        cssWidth,
        cssHeight,
        dpr,
        transform,
        units: props.imageTree.units,
        gridSpacingMm: appSettings.gridSpacingMm,
        isLight: isLight.value,
      })
    }
  }
}

// Escape key handler
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('cancel')
  }
}

watch(
  () => [props.imageTree, props.interaction.transform.value, backgroundColor.value, appSettings.gridEnabled, appSettings.gridSpacingMm],
  () => draw(),
  { deep: true },
)

onMounted(() => {
  draw()
  window.addEventListener('keydown', onKeyDown)
  const observer = new ResizeObserver(() => {
    autoFitDone.value = false
    draw()
  })
  if (canvasEl.value?.parentElement) {
    observer.observe(canvasEl.value.parentElement)
  }
  onUnmounted(() => {
    observer.disconnect()
    window.removeEventListener('keydown', onKeyDown)
  })
})
</script>
