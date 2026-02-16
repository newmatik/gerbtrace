<template>
  <div class="flex h-full">
    <div class="flex-1 relative border-r border-neutral-800">
      <GerberCanvas
        v-if="imageTreeA"
        :image-tree="imageTreeA"
        :color="'#cc0000'"
        :interaction="interaction"
        :view-bounds="sharedBounds"
        :gerber-offset="offsetA"
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
        :gerber-offset="offsetB"
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
import type { GerberOffset } from '~/composables/useCompareAlignment'
import { mergeBounds } from '@lib/gerber/bounding-box'

const props = defineProps<{
  match: LayerMatch | null
  interaction: ReturnType<typeof useCanvasInteraction>
  offsetA?: GerberOffset
  offsetB?: GerberOffset
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
</script>
