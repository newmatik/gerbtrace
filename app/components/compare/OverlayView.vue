<template>
  <div class="h-full relative">
    <GerberCanvas
      v-if="currentTree"
      :image-tree="currentTree"
      :color="showingA ? '#cc0000' : '#0066cc'"
      :interaction="interaction"
      :view-bounds="sharedBounds"
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
import { mergeBounds } from '@lib/gerber/bounding-box'

const props = defineProps<{
  match: LayerMatch | null
  interaction: ReturnType<typeof useCanvasInteraction>
  speed: number
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

const sharedBounds = computed<[number, number, number, number] | undefined>(() => {
  const a = imageTreeA.value
  const b = imageTreeB.value
  if (!a && !b) return undefined
  if (a && !b) return a.bounds as [number, number, number, number]
  if (!a && b) return b.bounds as [number, number, number, number]
  const merged = mergeBounds(a!.bounds as BoundingBox, b!.bounds as BoundingBox)
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
