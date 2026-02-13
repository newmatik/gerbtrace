<template>
  <div class="h-full relative">
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
    <div class="absolute top-3 left-3 flex gap-2">
      <UBadge color="error" variant="solid" size="xs">Removed</UBadge>
      <UBadge color="success" variant="solid" size="xs">Added</UBadge>
      <UBadge color="neutral" variant="solid" size="xs">Identical</UBadge>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LayerMatch } from '~/utils/gerber-helpers'
import type { ImageTree, BoundingBox } from '@lib/gerber/types'
import { renderToCanvas, computeAutoFitTransform } from '@lib/renderer/canvas-renderer'
import { computePixelDiff } from '@lib/renderer/pixel-diff'
import { mergeBounds } from '@lib/gerber/bounding-box'

const props = defineProps<{
  match: LayerMatch | null
  interaction: ReturnType<typeof useCanvasInteraction>
}>()

const canvasEl = ref<HTMLCanvasElement | null>(null)
const { parse } = useGerberRenderer()
const { backgroundColor } = useBackgroundColor()
const autoFitDone = ref(false)
const prevBoundsKey = ref('')

function onWheel(e: WheelEvent) {
  if (canvasEl.value) {
    props.interaction.handleWheel(e, canvasEl.value)
  }
}

function draw() {
  const canvas = canvasEl.value
  if (!canvas || !props.match?.fileA || !props.match?.fileB) return

  const parent = canvas.parentElement
  if (!parent) return

  const dpr = window.devicePixelRatio || 1
  const cssWidth = parent.clientWidth
  const cssHeight = parent.clientHeight

  canvas.width = cssWidth * dpr
  canvas.height = cssHeight * dpr
  canvas.style.width = cssWidth + 'px'
  canvas.style.height = cssHeight + 'px'

  let treeA: ImageTree | null = null
  let treeB: ImageTree | null = null

  try { treeA = parse(props.match.fileA.content) } catch { /* skip */ }
  try { treeB = parse(props.match.fileB.content) } catch { /* skip */ }

  if (!treeA || !treeB) return

  // Compute shared bounds for consistent positioning
  const shared = mergeBounds(treeA.bounds as BoundingBox, treeB.bounds as BoundingBox)
  const viewBounds: [number, number, number, number] = [shared[0], shared[1], shared[2], shared[3]]

  const boundsKey = viewBounds.join(',')
  const needsAutoFit = !autoFitDone.value || boundsKey !== prevBoundsKey.value || props.interaction.transform.value.scale <= 0
  if (needsAutoFit) {
    const fit = computeAutoFitTransform(cssWidth, cssHeight, viewBounds)
    props.interaction.transform.value = fit
    autoFitDone.value = true
    prevBoundsKey.value = boundsKey
  }

  const transform = props.interaction.transform.value

  // Render both to offscreen canvases with shared bounds
  const offA = document.createElement('canvas')
  offA.width = canvas.width
  offA.height = canvas.height
  renderToCanvas(treeA, offA, { color: '#ffffff', transform, dpr })

  const offB = document.createElement('canvas')
  offB.width = canvas.width
  offB.height = canvas.height
  renderToCanvas(treeB, offB, { color: '#ffffff', transform, dpr })

  // Compute pixel diff
  const diffData = computePixelDiff(offA, offB)

  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Fill background
  ctx.fillStyle = backgroundColor.value
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Composite diff on top of background (putImageData replaces pixels,
  // so use a temp canvas + drawImage to preserve the background)
  const diffCanvas = document.createElement('canvas')
  diffCanvas.width = canvas.width
  diffCanvas.height = canvas.height
  diffCanvas.getContext('2d')!.putImageData(diffData, 0, 0)
  ctx.drawImage(diffCanvas, 0, 0)
}

watch(
  () => [props.match, props.interaction.transform.value, backgroundColor.value],
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
