<template>
  <div class="h-full relative">
    <GerberCanvas
      v-if="currentTree"
      :image-tree="currentTree"
      :color="showingA ? '#cc0000' : '#0066cc'"
      :interaction="interaction"
      :view-bounds="sharedBounds"
      :gerber-offset="showingA ? offsetA : offsetB"
    />
    <div class="absolute top-3 left-3">
      <UBadge :color="showingA ? 'error' : 'info'" variant="solid" size="sm">
        {{ showingA ? 'Packet 1' : 'Packet 2' }}
      </UBadge>
    </div>
    <div class="absolute bottom-4 left-4 flex gap-2 items-center">
      <UButton size="xs" :icon="playing ? 'i-lucide-pause' : 'i-lucide-play'" @click="togglePlay">
        {{ playing ? 'Pause' : 'Play' }}
      </UButton>
      <span class="text-xs text-neutral-400">{{ speed }}ms</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LayerMatch } from '~/utils/gerber-helpers'
import type { ImageTree, BoundingBox } from '@lib/gerber/types'
import type { GerberOffset } from '~/composables/useCompareAlignment'
import { mergeBounds } from '@lib/gerber/bounding-box'

const props = defineProps<{
  match: LayerMatch | null
  interaction: ReturnType<typeof useCanvasInteraction>
  speed: number
  offsetA?: GerberOffset
  offsetB?: GerberOffset
}>()

const { parse } = useGerberRenderer()

const showingA = ref(true)
const playing = ref(false)
let intervalId: ReturnType<typeof setInterval> | null = null

const imageTreeA = computed<ImageTree | null>(() => {
  if (!props.match?.fileA) return null
  try { return parse(props.match.fileA.content) } catch { return null }
})

const imageTreeB = computed<ImageTree | null>(() => {
  if (!props.match?.fileB) return null
  try { return parse(props.match.fileB.content) } catch { return null }
})

function shiftBounds(bounds: BoundingBox, offset?: GerberOffset): BoundingBox {
  if (!offset || (offset.x === 0 && offset.y === 0)) return bounds
  return [bounds[0] + offset.x, bounds[1] + offset.y, bounds[2] + offset.x, bounds[3] + offset.y]
}

const sharedBounds = computed<[number, number, number, number] | undefined>(() => {
  const a = imageTreeA.value
  const b = imageTreeB.value
  if (!a && !b) return undefined
  const boundsA = a ? shiftBounds(a.bounds as BoundingBox, props.offsetA) : null
  const boundsB = b ? shiftBounds(b.bounds as BoundingBox, props.offsetB) : null
  if (boundsA && !boundsB) return boundsA as [number, number, number, number]
  if (!boundsA && boundsB) return boundsB as [number, number, number, number]
  const merged = mergeBounds(boundsA!, boundsB!)
  return [merged[0], merged[1], merged[2], merged[3]]
})

const currentTree = computed(() => showingA.value ? imageTreeA.value : imageTreeB.value)

function togglePlay() {
  playing.value = !playing.value
  if (playing.value) {
    intervalId = setInterval(() => {
      showingA.value = !showingA.value
    }, props.speed)
  } else if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>
