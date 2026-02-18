<template>
  <canvas
    ref="canvasEl"
    class="w-full h-full"
  />
</template>

<script setup lang="ts">
import type { THTPackageDefinition, THTShape, THTShapeRole } from '~/utils/tht-package-types'
import { computeThtBounds } from '~/utils/tht-package-types'

const props = defineProps<{
  package: THTPackageDefinition
}>()

const canvasEl = ref<HTMLCanvasElement | null>(null)
const colorMode = useColorMode()

function draw() {
  const canvas = canvasEl.value
  if (!canvas) return

  const parent = canvas.parentElement
  if (!parent) return

  const dpr = window.devicePixelRatio || 1
  const w = parent.clientWidth
  const h = parent.clientHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`

  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  const isDark = colorMode.value === 'dark'
  ctx.fillStyle = isDark ? '#1a1a1e' : '#f5f5f5'
  ctx.fillRect(0, 0, w, h)

  if (props.package.shapes.length === 0) {
    ctx.fillStyle = isDark ? '#555' : '#aaa'
    ctx.font = '11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('No shapes', w / 2, h / 2)
    return
  }

  const bounds = computeThtBounds(props.package)
  const padMm = 1
  const bw = bounds.maxX - bounds.minX + padMm * 2
  const bh = bounds.maxY - bounds.minY + padMm * 2
  const cx = (bounds.minX + bounds.maxX) / 2
  const cy = (bounds.minY + bounds.maxY) / 2

  const zoom = Math.min(w / bw, h / bh, 100)

  function mmToCanvas(mx: number, my: number): { x: number; y: number } {
    return {
      x: w / 2 + (mx - cx) * zoom,
      y: h / 2 - (my - cy) * zoom,
    }
  }

  // Draw grid lightly
  const gridSize = 2.54
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
  ctx.lineWidth = 0.5
  const startX = Math.floor((bounds.minX - padMm) / gridSize) * gridSize
  const endX = Math.ceil((bounds.maxX + padMm) / gridSize) * gridSize
  const startY = Math.floor((bounds.minY - padMm) / gridSize) * gridSize
  const endY = Math.ceil((bounds.maxY + padMm) / gridSize) * gridSize
  for (let x = startX; x <= endX; x += gridSize) {
    const p = mmToCanvas(x, 0)
    ctx.beginPath()
    ctx.moveTo(p.x, 0)
    ctx.lineTo(p.x, h)
    ctx.stroke()
  }
  for (let y = startY; y <= endY; y += gridSize) {
    const p = mmToCanvas(0, y)
    ctx.beginPath()
    ctx.moveTo(0, p.y)
    ctx.lineTo(w, p.y)
    ctx.stroke()
  }

  // Draw shapes
  for (const s of props.package.shapes) {
    drawShape(ctx, s, zoom, mmToCanvas, isDark)
  }
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  s: THTShape,
  zoom: number,
  mmToCanvas: (mx: number, my: number) => { x: number; y: number },
  isDark: boolean,
) {
  const pkg = props.package

  switch (s.kind) {
    case 'rect': {
      const { x: cx, y: cy } = mmToCanvas(s.x, s.y)
      const w = s.width * zoom
      const h = s.height * zoom

      ctx.fillStyle = resolveColor(s.role, s.color, pkg, isDark)
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h)
      ctx.strokeStyle = resolveStroke(s.role, s.strokeColor, pkg, isDark)
      ctx.lineWidth = 1
      ctx.strokeRect(cx - w / 2, cy - h / 2, w, h)
      break
    }
    case 'circle': {
      const { x: cx, y: cy } = mmToCanvas(s.x, s.y)
      const r = s.radius * zoom

      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.fillStyle = resolveColor(s.role, s.color, pkg, isDark)
      ctx.fill()
      ctx.strokeStyle = resolveStroke(s.role, s.strokeColor, pkg, isDark)
      ctx.lineWidth = 1
      ctx.stroke()
      break
    }
    case 'roundedRect': {
      const { x: cx, y: cy } = mmToCanvas(s.x, s.y)
      const w = s.width * zoom
      const h = s.height * zoom
      const r = Math.min(s.cornerRadius * zoom, w / 2, h / 2)

      ctx.beginPath()
      roundRect(ctx, cx - w / 2, cy - h / 2, w, h, r)
      ctx.fillStyle = resolveColor(s.role, s.color, pkg, isDark)
      ctx.fill()
      ctx.strokeStyle = resolveStroke(s.role, s.strokeColor, pkg, isDark)
      ctx.lineWidth = 1
      ctx.stroke()
      break
    }
    case 'line': {
      const p1 = mmToCanvas(s.x1, s.y1)
      const p2 = mmToCanvas(s.x2, s.y2)

      ctx.beginPath()
      ctx.moveTo(p1.x, p1.y)
      ctx.lineTo(p2.x, p2.y)
      ctx.strokeStyle = s.color || (isDark ? '#ff6666' : '#cc3333')
      ctx.lineWidth = Math.max(s.strokeWidth * zoom, 1)
      ctx.stroke()
      break
    }
  }
}

function resolveColor(role: THTShapeRole, override: string | undefined, pkg: THTPackageDefinition, isDark: boolean): string {
  if (override) return override
  if (role === 'body') return pkg.bodyColor || (isDark ? 'rgba(50,50,50,0.85)' : 'rgba(60,60,60,0.85)')
  if (role === 'pin1') return isDark ? 'rgba(255,92,92,0.95)' : 'rgba(220,38,38,0.95)'
  if (role === 'pin') return pkg.pinColor || (isDark ? 'rgba(200,200,200,0.9)' : 'rgba(180,180,180,0.9)')
  if (role === 'polarity-marker') return isDark ? 'rgba(255,80,80,0.9)' : 'rgba(220,50,50,0.9)'
  return isDark ? '#666' : '#999'
}

function resolveStroke(role: THTShapeRole, override: string | undefined, pkg: THTPackageDefinition, isDark: boolean): string {
  if (override) return override
  if (role === 'body') return pkg.bodyStrokeColor || (isDark ? 'rgba(80,80,80,0.9)' : 'rgba(100,100,100,0.9)')
  if (role === 'pin1') return isDark ? 'rgba(255,140,140,1)' : 'rgba(185,28,28,1)'
  if (role === 'pin') return pkg.pinStrokeColor || (isDark ? 'rgba(150,150,150,0.8)' : 'rgba(120,120,120,0.8)')
  return isDark ? '#888' : '#aaa'
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
}

watch(() => props.package, () => nextTick(draw), { deep: true })
watch(colorMode, () => draw())

onMounted(() => {
  nextTick(draw)
  const observer = new ResizeObserver(() => draw())
  if (canvasEl.value?.parentElement) {
    observer.observe(canvasEl.value.parentElement)
  }
  onUnmounted(() => observer.disconnect())
})
</script>
