<template>
  <div v-if="draw.active.value" class="absolute inset-0 z-10 pointer-events-none">
    <svg class="absolute inset-0 w-full h-full pointer-events-none">
      <!-- Snap indicator -->
      <template v-if="snapScreen">
        <circle
          :cx="snapScreen.sx"
          :cy="snapScreen.sy"
          r="7"
          fill="none"
          :stroke="snapColor"
          stroke-width="2"
        />
        <circle
          :cx="snapScreen.sx"
          :cy="snapScreen.sy"
          r="2.5"
          :fill="snapColor"
        />
        <text
          v-if="snapLabel"
          :x="snapScreen.sx + 10"
          :y="snapScreen.sy - 10"
          fill="#fff"
          font-size="9"
          font-family="ui-monospace, monospace"
          paint-order="stroke"
          stroke="rgba(0,0,0,0.7)"
          stroke-width="3"
        >
          {{ snapLabel }}
        </text>
      </template>

      <!-- Crosshair cursor when not drawing (non-drill tools) -->
      <template v-if="!draw.isDrawing.value && draw.activeTool.value !== 'drill' && cursorScreen">
        <line
          :x1="cursorScreen.sx - 12" :y1="cursorScreen.sy"
          :x2="cursorScreen.sx + 12" :y2="cursorScreen.sy"
          stroke="#60a5fa" stroke-width="1" opacity="0.7"
        />
        <line
          :x1="cursorScreen.sx" :y1="cursorScreen.sy - 12"
          :x2="cursorScreen.sx" :y2="cursorScreen.sy + 12"
          stroke="#60a5fa" stroke-width="1" opacity="0.7"
        />
      </template>

      <!-- Shape preview -->
      <template v-if="draw.previewShape.value">
        <!-- Rectangle preview -->
        <template v-if="draw.previewShape.value.tool === 'rect'">
          <rect
            :x="rectScreen.x"
            :y="rectScreen.y"
            :width="rectScreen.w"
            :height="rectScreen.h"
            :fill="draw.previewShape.value.filled ? 'rgba(96, 165, 250, 0.25)' : 'none'"
            stroke="#60a5fa"
            stroke-width="1.5"
            stroke-dasharray="4 3"
          />
          <!-- Dimension labels on rect -->
          <text
            :x="rectScreen.x + rectScreen.w / 2"
            :y="rectScreen.y - 6"
            text-anchor="middle"
            fill="#60a5fa"
            font-size="11"
            font-family="ui-monospace, monospace"
            font-weight="600"
            paint-order="stroke"
            stroke="rgba(0,0,0,0.75)"
            stroke-width="3"
          >
            {{ formatDim(dimW) }}
          </text>
          <text
            :x="rectScreen.x + rectScreen.w + 6"
            :y="rectScreen.y + rectScreen.h / 2"
            dominant-baseline="central"
            fill="#60a5fa"
            font-size="11"
            font-family="ui-monospace, monospace"
            font-weight="600"
            paint-order="stroke"
            stroke="rgba(0,0,0,0.75)"
            stroke-width="3"
          >
            {{ formatDim(dimH) }}
          </text>
        </template>

        <!-- Circle preview -->
        <template v-if="draw.previewShape.value.tool === 'circle'">
          <circle
            :cx="circleScreen.cx"
            :cy="circleScreen.cy"
            :r="circleScreen.r"
            :fill="draw.previewShape.value.filled ? 'rgba(96, 165, 250, 0.25)' : 'none'"
            stroke="#60a5fa"
            stroke-width="1.5"
            stroke-dasharray="4 3"
          />
          <!-- Radius line -->
          <line
            :x1="circleScreen.cx" :y1="circleScreen.cy"
            :x2="circleScreen.cx + circleScreen.r" :y2="circleScreen.cy"
            stroke="#60a5fa" stroke-width="1" opacity="0.6"
          />
          <!-- Radius label -->
          <text
            :x="circleScreen.cx + circleScreen.r / 2"
            :y="circleScreen.cy - 6"
            text-anchor="middle"
            fill="#60a5fa"
            font-size="11"
            font-family="ui-monospace, monospace"
            font-weight="600"
            paint-order="stroke"
            stroke="rgba(0,0,0,0.75)"
            stroke-width="3"
          >
            r={{ formatDim(dimR) }}
          </text>
        </template>

        <!-- Line preview -->
        <template v-if="draw.previewShape.value.tool === 'line'">
          <line
            :x1="lineScreen.x1" :y1="lineScreen.y1"
            :x2="lineScreen.x2" :y2="lineScreen.y2"
            stroke="#60a5fa"
            :stroke-width="Math.max(1.5, lineScreenWidth)"
            stroke-dasharray="4 3"
            stroke-linecap="round"
          />
          <circle :cx="lineScreen.x1" :cy="lineScreen.y1" r="3" fill="#60a5fa" />
          <circle :cx="lineScreen.x2" :cy="lineScreen.y2" r="3" fill="#60a5fa" />
          <!-- Length label -->
          <text
            :x="(lineScreen.x1 + lineScreen.x2) / 2"
            :y="Math.min(lineScreen.y1, lineScreen.y2) - 8"
            text-anchor="middle"
            fill="#60a5fa"
            font-size="11"
            font-family="ui-monospace, monospace"
            font-weight="600"
            paint-order="stroke"
            stroke="rgba(0,0,0,0.75)"
            stroke-width="3"
          >
            {{ formatDim(dimLen) }}
          </text>
        </template>

        <!-- Text preview -->
        <template v-if="draw.previewShape.value.tool === 'text'">
          <text
            :x="textScreen.x"
            :y="textScreen.y"
            fill="#60a5fa"
            :font-size="textScreen.fontSize"
            font-family="ui-monospace, monospace"
            font-weight="600"
            opacity="0.7"
          >
            {{ draw.previewShape.value.text || draw.preciseText.value }}
          </text>
        </template>
      </template>

      <!-- Drill ghost preview at cursor -->
      <template v-if="draw.activeTool.value === 'drill' && !draw.isDrawing.value && cursorScreen">
        <circle
          :cx="cursorScreen.sx"
          :cy="cursorScreen.sy"
          :r="drillScreenRadius"
          fill="rgba(96, 165, 250, 0.2)"
          stroke="#60a5fa"
          stroke-width="1.5"
        />
        <line
          :x1="cursorScreen.sx - drillScreenRadius - 4" :y1="cursorScreen.sy"
          :x2="cursorScreen.sx + drillScreenRadius + 4" :y2="cursorScreen.sy"
          stroke="#60a5fa" stroke-width="0.5" opacity="0.5"
        />
        <line
          :x1="cursorScreen.sx" :y1="cursorScreen.sy - drillScreenRadius - 4"
          :x2="cursorScreen.sx" :y2="cursorScreen.sy + drillScreenRadius + 4"
          stroke="#60a5fa" stroke-width="0.5" opacity="0.5"
        />
        <text
          :x="cursorScreen.sx + drillScreenRadius + 6"
          :y="cursorScreen.sy - 4"
          fill="#60a5fa"
          font-size="10"
          font-family="ui-monospace, monospace"
          font-weight="600"
          paint-order="stroke"
          stroke="rgba(0,0,0,0.75)"
          stroke-width="3"
        >
          ⌀{{ formatDim(draw.drillDiameterMm.value) }}
        </text>
      </template>

      <!-- Quick Fiducial preview -->
      <template v-if="draw.quickPlacement.value?.kind === 'fiducial' && cursorScreen">
        <circle
          :cx="cursorScreen.sx"
          :cy="cursorScreen.sy"
          :r="quickFiducialScreen.rCopperClear"
          fill="none"
          stroke="#60a5fa"
          stroke-width="1"
          stroke-dasharray="3 2"
          opacity="0.8"
        />
        <circle
          :cx="cursorScreen.sx"
          :cy="cursorScreen.sy"
          :r="quickFiducialScreen.rMaskOpen"
          fill="none"
          stroke="#34d399"
          stroke-width="1"
          stroke-dasharray="3 2"
          opacity="0.9"
        />
        <circle
          :cx="cursorScreen.sx"
          :cy="cursorScreen.sy"
          :r="quickFiducialScreen.rCopperDot"
          fill="rgba(245, 208, 90, 0.35)"
          stroke="#f5d05a"
          stroke-width="1"
          stroke-dasharray="2 2"
        />
      </template>

      <!-- Quick BC preview -->
      <template v-if="draw.quickPlacement.value?.kind === 'bc' && cursorScreen">
        <rect
          :x="cursorScreen.sx - quickBcScreen.hw"
          :y="cursorScreen.sy - quickBcScreen.hh"
          :width="quickBcScreen.hw * 2"
          :height="quickBcScreen.hh * 2"
          fill="none"
          stroke="#60a5fa"
          stroke-width="1"
          stroke-dasharray="3 2"
          opacity="0.9"
        />
        <text
          :x="cursorScreen.sx"
          :y="cursorScreen.sy + quickBcScreen.fontSize * 0.35"
          text-anchor="middle"
          fill="#60a5fa"
          :font-size="quickBcScreen.fontSize"
          font-family="ui-monospace, monospace"
          font-weight="600"
          opacity="0.75"
        >
          BC
        </text>
      </template>

      <!-- Precise mode placement crosshair (larger) -->
      <template v-if="draw.preciseMode.value && draw.activeTool.value !== 'drill' && !draw.isDrawing.value && cursorScreen">
        <!-- Ghost preview of precise shape at cursor -->
        <template v-if="draw.activeTool.value === 'rect'">
          <rect
            :x="cursorScreen.sx - preciseRectScreen.hw"
            :y="cursorScreen.sy - preciseRectScreen.hh"
            :width="preciseRectScreen.hw * 2"
            :height="preciseRectScreen.hh * 2"
            fill="none"
            stroke="#60a5fa"
            stroke-width="1"
            stroke-dasharray="3 2"
            opacity="0.5"
          />
        </template>
        <template v-if="draw.activeTool.value === 'circle'">
          <circle
            :cx="cursorScreen.sx"
            :cy="cursorScreen.sy"
            :r="preciseCircleScreenR"
            fill="none"
            stroke="#60a5fa"
            stroke-width="1"
            stroke-dasharray="3 2"
            opacity="0.5"
          />
        </template>
      </template>
    </svg>
  </div>
</template>

<script setup lang="ts">
import type { CanvasTransform } from '@lib/renderer/canvas-renderer'
import type { useDrawTool } from '~/composables/useDrawTool'
import { fileUnitsToMm, mmToFileUnits } from '@lib/gerber/generator'

const props = defineProps<{
  draw: ReturnType<typeof useDrawTool>
  transform: CanvasTransform
}>()

function toScreen(gx: number, gy: number) {
  return props.draw.gerberToScreen(gx, gy, props.transform)
}

const cursorScreen = computed(() => {
  const c = props.draw.cursorGerber.value
  return toScreen(c.x, c.y)
})

const snapScreen = computed(() => {
  const s = props.draw.activeSnap.value
  return s ? toScreen(s.x, s.y) : null
})

const snapColor = computed(() => {
  const s = props.draw.activeSnap.value
  if (!s) return '#60a5fa'
  return s.kind === 'grid' ? '#4ade80' : '#ffcc00'
})

const snapLabel = computed(() => {
  const s = props.draw.activeSnap.value
  if (!s) return ''
  switch (s.kind) {
    case 'pad': return 'pad'
    case 'endpoint': return 'endpoint'
    case 'center': return 'center'
    case 'grid': return 'grid'
    default: return ''
  }
})

const toMm = (v: number) => fileUnitsToMm(v, props.draw.fileUnits.value)

// Rect screen coords
const rectScreen = computed(() => {
  const shape = props.draw.previewShape.value
  if (!shape || shape.tool !== 'rect') return { x: 0, y: 0, w: 0, h: 0 }
  const tl = toScreen(shape.startX, shape.endY)
  const br = toScreen(shape.endX, shape.startY)
  return {
    x: Math.min(tl.sx, br.sx),
    y: Math.min(tl.sy, br.sy),
    w: Math.abs(br.sx - tl.sx),
    h: Math.abs(br.sy - tl.sy),
  }
})

const dimW = computed(() => {
  const shape = props.draw.previewShape.value
  if (!shape) return 0
  return toMm(Math.abs(shape.endX - shape.startX))
})

const dimH = computed(() => {
  const shape = props.draw.previewShape.value
  if (!shape) return 0
  return toMm(Math.abs(shape.endY - shape.startY))
})

// Circle screen coords
const circleScreen = computed(() => {
  const shape = props.draw.previewShape.value
  if (!shape || shape.tool !== 'circle') return { cx: 0, cy: 0, r: 0 }
  const center = toScreen(shape.startX, shape.startY)
  const rGerber = shape.radius ?? 0
  return {
    cx: center.sx,
    cy: center.sy,
    r: rGerber * props.transform.scale,
  }
})

const dimR = computed(() => {
  const shape = props.draw.previewShape.value
  if (!shape) return 0
  return toMm(shape.radius ?? 0)
})

// Line screen coords
const lineScreen = computed(() => {
  const shape = props.draw.previewShape.value
  if (!shape || shape.tool !== 'line') return { x1: 0, y1: 0, x2: 0, y2: 0 }
  const s = toScreen(shape.startX, shape.startY)
  const e = toScreen(shape.endX, shape.endY)
  return { x1: s.sx, y1: s.sy, x2: e.sx, y2: e.sy }
})

const lineScreenWidth = computed(() => {
  const shape = props.draw.previewShape.value
  if (!shape || shape.tool !== 'line') return 1.5
  return shape.strokeWidth * props.transform.scale
})

const dimLen = computed(() => {
  const shape = props.draw.previewShape.value
  if (!shape) return 0
  const dx = shape.endX - shape.startX
  const dy = shape.endY - shape.startY
  return toMm(Math.sqrt(dx * dx + dy * dy))
})

// Text screen coords
const textScreen = computed(() => {
  const shape = props.draw.previewShape.value
  if (!shape || shape.tool !== 'text') {
    const c = cursorScreen.value
    const h = mmToFileUnits(props.draw.preciseTextHeightMm.value, props.draw.fileUnits.value) * props.transform.scale
    return { x: c.sx, y: c.sy, fontSize: Math.max(8, h) }
  }
  const s = toScreen(shape.startX, shape.startY)
  const h = (shape.textHeight ?? 1) * props.transform.scale
  return { x: s.sx, y: s.sy - h, fontSize: Math.max(8, h) }
})

// Precise mode ghost previews
const preciseRectScreen = computed(() => {
  const units = props.draw.fileUnits.value
  const hw = mmToFileUnits(props.draw.preciseWidthMm.value / 2, units) * props.transform.scale
  const hh = mmToFileUnits(props.draw.preciseHeightMm.value / 2, units) * props.transform.scale
  return { hw, hh }
})

const preciseCircleScreenR = computed(() => {
  const units = props.draw.fileUnits.value
  return mmToFileUnits(props.draw.preciseRadiusMm.value, units) * props.transform.scale
})

const drillScreenRadius = computed(() => {
  const units = props.draw.fileUnits.value
  return mmToFileUnits(props.draw.drillDiameterMm.value / 2, units) * props.transform.scale
})

const quickFiducialScreen = computed(() => {
  const units = props.draw.fileUnits.value
  return {
    rCopperDot: mmToFileUnits(1.0 / 2, units) * props.transform.scale,
    rMaskOpen: mmToFileUnits(2.0 / 2, units) * props.transform.scale,
    rCopperClear: mmToFileUnits(3.0 / 2, units) * props.transform.scale,
  }
})

const quickBcScreen = computed(() => {
  const units = props.draw.fileUnits.value
  const qp = props.draw.quickPlacement.value
  const w = mmToFileUnits(qp?.bcWidthMm ?? 7, units) * props.transform.scale
  const h = mmToFileUnits(qp?.bcHeightMm ?? 7, units) * props.transform.scale
  return {
    hw: w / 2,
    hh: h / 2,
    fontSize: Math.max(8, Math.min(w, h) * 0.35),
  }
})

function formatDim(v: number): string {
  if (v < 0.01) return `${(v * 1000).toFixed(1)} µm`
  if (v < 1) return `${(v * 1000).toFixed(0)} µm`
  return `${v.toFixed(3)} mm`
}
</script>
