<template>
  <svg
    v-if="measure.active.value"
    class="absolute inset-0 w-full h-full pointer-events-none z-10"
  >
    <!-- Snap indicator -->
    <template v-if="snapScreen">
      <circle
        :cx="snapScreen.sx"
        :cy="snapScreen.sy"
        r="6"
        fill="none"
        stroke="#ffcc00"
        stroke-width="2"
      />
      <circle
        :cx="snapScreen.sx"
        :cy="snapScreen.sy"
        r="2"
        fill="#ffcc00"
      />
    </template>

    <!-- Measurement line (rubber band while placing, solid when done) -->
    <template v-if="startScreen && endScreen">
      <line
        :x1="startScreen.sx"
        :y1="startScreen.sy"
        :x2="endScreen.sx"
        :y2="endScreen.sy"
        :stroke="'#ffcc00'"
        stroke-width="1.5"
        :stroke-dasharray="measure.pointB.value ? 'none' : '6 3'"
      />

      <!-- Start point marker -->
      <circle
        :cx="startScreen.sx"
        :cy="startScreen.sy"
        r="4"
        fill="#ffcc00"
        stroke="#000"
        stroke-width="1"
      />

      <!-- End point marker (only when placed) -->
      <circle
        v-if="measure.pointB.value"
        :cx="endScreen.sx"
        :cy="endScreen.sy"
        r="4"
        fill="#ffcc00"
        stroke="#000"
        stroke-width="1"
      />

      <!-- Distance label -->
      <g v-if="measure.liveDistanceMm.value != null" :transform="labelTransform">
        <rect
          :x="-labelWidth / 2 - 6"
          y="-12"
          :width="labelWidth + 30"
          :height="formattedOffset ? 38 : 20"
          rx="4"
          fill="rgba(0,0,0,0.85)"
        />
        <text
          :x="6"
          :y="formattedOffset ? -1 : 0"
          text-anchor="middle"
          dominant-baseline="central"
          fill="#ffcc00"
          font-size="12"
          font-family="ui-monospace, monospace"
          font-weight="600"
        >
          {{ formattedDistance }}
        </text>
        <!-- X/Y offset line -->
        <text
          v-if="formattedOffset"
          :x="6"
          y="15"
          text-anchor="middle"
          dominant-baseline="central"
          fill="#ffcc00"
          font-size="11"
          font-family="ui-monospace, monospace"
          font-weight="400"
          opacity="0.8"
        >
          {{ formattedOffset }}
        </text>
        <!-- Copy button -->
        <g
          :transform="`translate(${labelWidth / 2 + 14}, ${formattedOffset ? 2 : 0})`"
          style="pointer-events: auto; cursor: pointer"
          @click.stop="copyDistance"
        >
          <rect x="-8" y="-8" width="16" height="16" fill="transparent" />
          <g v-if="copied" transform="translate(-5, -5) scale(0.625)">
            <polyline
              points="4 10 8 14 16 4"
              fill="none"
              stroke="#4ade80"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </g>
          <g v-else transform="translate(-5, -5) scale(0.625)">
            <rect x="5" y="2" width="9" height="11" rx="1.5" fill="none" stroke="#ffcc00" stroke-width="1.5" />
            <rect x="2" y="5" width="9" height="11" rx="1.5" fill="rgba(0,0,0,0.85)" stroke="#ffcc00" stroke-width="1.5" />
          </g>
        </g>
      </g>
    </template>

    <!-- Crosshair cursor when no point placed yet -->
    <template v-if="!measure.pointA.value && cursorScreen">
      <line
        :x1="cursorScreen.sx - 10" :y1="cursorScreen.sy"
        :x2="cursorScreen.sx + 10" :y2="cursorScreen.sy"
        stroke="#ffcc00" stroke-width="1" opacity="0.7"
      />
      <line
        :x1="cursorScreen.sx" :y1="cursorScreen.sy - 10"
        :x2="cursorScreen.sx" :y2="cursorScreen.sy + 10"
        stroke="#ffcc00" stroke-width="1" opacity="0.7"
      />
    </template>
  </svg>
</template>

<script setup lang="ts">
import type { CanvasTransform } from '@lib/renderer/canvas-renderer'

const props = defineProps<{
  measure: ReturnType<typeof useMeasureTool>
  transform: CanvasTransform
}>()

const copied = ref(false)
let copyTimeout: ReturnType<typeof setTimeout> | null = null

function copyDistance() {
  const dist = formattedDistance.value
  if (!dist) return
  const offset = formattedOffset.value
  const text = offset ? `${dist}\n${offset}` : dist
  navigator.clipboard.writeText(text).then(() => {
    copied.value = true
    if (copyTimeout) clearTimeout(copyTimeout)
    copyTimeout = setTimeout(() => { copied.value = false }, 1500)
  })
}

function toScreen(gx: number, gy: number) {
  return props.measure.gerberToScreen(gx, gy, props.transform)
}

const startScreen = computed(() => {
  const p = props.measure.pointA.value
  return p ? toScreen(p.x, p.y) : null
})

const endScreen = computed(() => {
  const p = props.measure.liveEnd.value
  return p ? toScreen(p.x, p.y) : null
})

const snapScreen = computed(() => {
  const s = props.measure.activeSnap.value
  return s ? toScreen(s.x, s.y) : null
})

const cursorScreen = computed(() => {
  const c = props.measure.cursorGerber.value
  return toScreen(c.x, c.y)
})

function formatMm(d: number): string {
  if (d < 0.01) return `${(d * 1000).toFixed(1)} µm`
  if (d < 1) return `${(d * 1000).toFixed(0)} µm`
  return `${d.toFixed(3)} mm`
}

const formattedDistance = computed(() => {
  const d = props.measure.liveDistanceMm.value
  if (d == null) return ''
  return formatMm(d)
})

const formattedOffset = computed(() => {
  const ox = props.measure.liveOffsetXMm.value
  const oy = props.measure.liveOffsetYMm.value
  if (ox == null || oy == null) return ''
  return `x ${formatMm(ox)}  y ${formatMm(oy)}`
})

const labelWidth = computed(() => {
  const distW = formattedDistance.value.length * 7.5
  const offW = formattedOffset.value.length * 7.5
  return Math.max(distW, offW)
})

const labelTransform = computed(() => {
  if (!startScreen.value || !endScreen.value) return ''
  const mx = (startScreen.value.sx + endScreen.value.sx) / 2
  const my = (startScreen.value.sy + endScreen.value.sy) / 2
  const offsetY = formattedOffset.value ? 22 : 16
  return `translate(${mx}, ${my - offsetY})`
})
</script>
