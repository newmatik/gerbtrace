<template>
  <div ref="containerRef" class="relative w-full h-full min-h-[200px]">
    <canvas
      ref="canvasRef"
      class="w-full h-full"
    />
    <div
      v-if="!pkg"
      class="absolute inset-0 flex items-center justify-center text-sm text-neutral-400 dark:text-neutral-500"
    >
      Select a package to preview
    </div>
  </div>
</template>

<script setup lang="ts">
import { useColorMode } from '#imports'
import type { PackageDefinition, FootprintShape } from '~/utils/package-types'
import { computeFootprint } from '~/utils/package-types'

const props = defineProps<{
  pkg: PackageDefinition | null
}>()

const containerRef = ref<HTMLElement>()
const canvasRef = ref<HTMLCanvasElement>()

// Colors matching BoardCanvas.vue
const BODY_FILL = 'rgba(50, 50, 50, 0.85)'
const BODY_STROKE = 'rgba(80, 80, 80, 0.9)'
const PAD_FILL = 'rgba(180, 180, 180, 0.8)'
const PIN1_FILL = 'rgba(255, 255, 255, 0.9)'
const BODY_FILL_DARK = 'rgba(60, 65, 75, 0.9)'
const BODY_STROKE_DARK = 'rgba(100, 110, 130, 0.9)'
const PAD_FILL_DARK = 'rgba(160, 175, 200, 0.85)'
const PIN1_FILL_DARK = 'rgba(255, 255, 255, 0.95)'

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')

function draw() {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return

  const dpr = window.devicePixelRatio || 1
  const rect = container.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, rect.width, rect.height)

  if (!props.pkg) return

  const shapes = computeFootprint(props.pkg)
  if (!shapes.length) return

  // Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of shapes) {
    if (s.kind === 'circle') {
      minX = Math.min(minX, s.cx - s.r)
      minY = Math.min(minY, s.cy - s.r)
      maxX = Math.max(maxX, s.cx + s.r)
      maxY = Math.max(maxY, s.cy + s.r)
    } else {
      minX = Math.min(minX, s.cx - s.w / 2)
      minY = Math.min(minY, s.cy - s.h / 2)
      maxX = Math.max(maxX, s.cx + s.w / 2)
      maxY = Math.max(maxY, s.cy + s.h / 2)
    }
  }

  const bboxW = maxX - minX
  const bboxH = maxY - minY
  if (bboxW <= 0 || bboxH <= 0) return

  const padding = 30
  const scaleX = (rect.width - padding * 2) / bboxW
  const scaleY = (rect.height - padding * 2) / bboxH
  const scale = Math.min(scaleX, scaleY)

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const originX = rect.width / 2
  const originY = rect.height / 2

  // Draw grid
  drawGrid(ctx, rect.width, rect.height, scale, originX, originY, centerX, centerY)

  // Draw shapes sorted: body first, then pads, then pin1
  const sortOrder = { body: 0, pad: 1, pin1: 2 }
  const sorted = [...shapes].sort((a, b) => sortOrder[a.role] - sortOrder[b.role])

  for (const shape of sorted) {
    drawShape(ctx, shape, scale, originX, originY, centerX, centerY)
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scale: number,
  originX: number,
  originY: number,
  centerX: number,
  centerY: number,
) {
  // Draw crosshair at component center
  const cx = originX + (0 - centerX) * scale
  const cy = originY - (0 - centerY) * scale

  ctx.strokeStyle = isDark.value ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(cx, 0)
  ctx.lineTo(cx, h)
  ctx.moveTo(0, cy)
  ctx.lineTo(w, cy)
  ctx.stroke()
  ctx.setLineDash([])
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: FootprintShape,
  scale: number,
  originX: number,
  originY: number,
  centerX: number,
  centerY: number,
) {
  // Convert mm coords to screen coords
  // +Y is up in model, but canvas Y increases downward
  const sx = originX + (shape.cx - centerX) * scale
  const sy = originY - (shape.cy - centerY) * scale

  const dark = isDark.value

  if (shape.role === 'body') {
    ctx.fillStyle = dark ? BODY_FILL_DARK : BODY_FILL
    ctx.strokeStyle = dark ? BODY_STROKE_DARK : BODY_STROKE
    ctx.lineWidth = 1.5
  } else if (shape.role === 'pin1') {
    ctx.fillStyle = dark ? PIN1_FILL_DARK : PIN1_FILL
    ctx.strokeStyle = 'transparent'
    ctx.lineWidth = 0
  } else {
    ctx.fillStyle = dark ? PAD_FILL_DARK : PAD_FILL
    ctx.strokeStyle = dark ? 'rgba(130, 145, 170, 0.6)' : 'rgba(120, 120, 120, 0.6)'
    ctx.lineWidth = 0.5
  }

  if (shape.kind === 'rect') {
    const w = shape.w * scale
    const h = shape.h * scale
    ctx.fillRect(sx - w / 2, sy - h / 2, w, h)
    if (ctx.lineWidth > 0 && ctx.strokeStyle !== 'transparent') {
      ctx.strokeRect(sx - w / 2, sy - h / 2, w, h)
    }
  } else if (shape.kind === 'circle') {
    ctx.beginPath()
    ctx.arc(sx, sy, shape.r * scale, 0, Math.PI * 2)
    ctx.fill()
    if (ctx.lineWidth > 0 && ctx.strokeStyle !== 'transparent') {
      ctx.stroke()
    }
  } else if (shape.kind === 'roundedRect') {
    const w = shape.w * scale
    const h = shape.h * scale
    const r = Math.min(shape.r * scale, w / 2, h / 2)
    ctx.beginPath()
    roundRect(ctx, sx - w / 2, sy - h / 2, w, h, r)
    ctx.fill()
    if (ctx.lineWidth > 0 && ctx.strokeStyle !== 'transparent') {
      ctx.stroke()
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Redraw on changes
watch(() => props.pkg, () => nextTick(draw), { deep: true })
watch(isDark, () => nextTick(draw))

// Resize observer for responsive canvas
let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  nextTick(draw)
  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => draw())
    resizeObserver.observe(containerRef.value)
  }
})
onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})
</script>
