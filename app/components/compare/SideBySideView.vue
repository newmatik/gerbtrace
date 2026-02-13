<template>
  <div class="flex h-full">
    <div class="flex-1 relative border-r border-neutral-800">
      <GerberCanvas
        v-if="imageTreeA"
        :image-tree="imageTreeA"
        :color="'#cc0000'"
        :interaction="interaction"
        :view-bounds="sharedBounds"
      />
      <div v-else class="absolute inset-0 flex items-center justify-center text-neutral-600 text-sm">
        Packet 1
      </div>
    </div>
    <div class="flex-1 relative">
      <GerberCanvas
        v-if="imageTreeB"
        :image-tree="imageTreeB"
        :color="'#0066cc'"
        :interaction="interaction"
        :view-bounds="sharedBounds"
      />
      <div v-else class="absolute inset-0 flex items-center justify-center text-neutral-600 text-sm">
        Packet 2
      </div>
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
}>()

const { parse } = useGerberRenderer()

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
</script>
