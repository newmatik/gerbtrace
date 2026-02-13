<template>
  <canvas
    ref="canvasEl"
    class="w-full h-full"
    @wheel.prevent="onWheel"
    @mousedown="interaction.handleMouseDown"
    @mousemove="interaction.handleMouseMove"
    @mouseup="interaction.handleMouseUp"
    @mouseleave="interaction.handleMouseUp"
    @contextmenu.prevent
  />
</template>

<script setup lang="ts">
import type { ImageTree } from '@lib/gerber/types'
import { renderToCanvas, computeAutoFitTransform } from '@lib/renderer/canvas-renderer'

const props = defineProps<{
  imageTree: ImageTree | null
  color?: string
  interaction: ReturnType<typeof useCanvasInteraction>
  viewBounds?: [number, number, number, number]
}>()

const canvasEl = ref<HTMLCanvasElement | null>(null)
const autoFitDone = ref(false)
const prevBoundsKey = ref('')
const { backgroundColor } = useBackgroundColor()

function onWheel(e: WheelEvent) {
  if (canvasEl.value) {
    props.interaction.handleWheel(e, canvasEl.value)
  }
}

function getCssDimensions(): { cssWidth: number; cssHeight: number } {
  const canvas = canvasEl.value
  const parent = canvas?.parentElement
  if (!parent) return { cssWidth: 800, cssHeight: 600 }
  return { cssWidth: parent.clientWidth, cssHeight: parent.clientHeight }
}

function sizeCanvas(): number {
  const canvas = canvasEl.value
  if (!canvas) return 1

  const { cssWidth, cssHeight } = getCssDimensions()
  const dpr = window.devicePixelRatio || 1

  canvas.width = cssWidth * dpr
  canvas.height = cssHeight * dpr
  canvas.style.width = cssWidth + 'px'
  canvas.style.height = cssHeight + 'px'

  return dpr
}

function draw() {
  const canvas = canvasEl.value
  if (!canvas || !props.imageTree) return

  const dpr = sizeCanvas()
  const { cssWidth, cssHeight } = getCssDimensions()

  const bounds = (props.viewBounds || props.imageTree.bounds) as [number, number, number, number]
  const boundsKey = bounds.join(',')

  // Auto-fit when bounds change or when reset is requested (scale <= 0)
  const needsAutoFit = !autoFitDone.value || boundsKey !== prevBoundsKey.value || props.interaction.transform.value.scale <= 0
  if (needsAutoFit) {
    const fit = computeAutoFitTransform(cssWidth, cssHeight, bounds)
    props.interaction.transform.value = fit
    autoFitDone.value = true
    prevBoundsKey.value = boundsKey
  }

  renderToCanvas(props.imageTree, canvas, {
    color: props.color || '#cc0000',
    transform: props.interaction.transform.value,
    dpr,
    backgroundColor: backgroundColor.value,
  })
}

watch(
  () => [props.imageTree, props.color, props.interaction.transform.value, backgroundColor.value],
  () => draw(),
  { deep: true },
)

onMounted(() => {
  draw()
  const observer = new ResizeObserver(() => {
    autoFitDone.value = false
    draw()
  })
  if (canvasEl.value?.parentElement) {
    observer.observe(canvasEl.value.parentElement)
  }
  onUnmounted(() => observer.disconnect())
})
</script>
