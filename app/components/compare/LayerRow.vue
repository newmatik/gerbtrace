<template>
  <div
    class="flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors"
    :class="selected
      ? 'bg-primary/10 border border-primary/30'
      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-transparent'"
    @click="$emit('click')"
  >
    <!-- Layer type label -->
    <span
      class="shrink-0 text-[10px] font-medium w-20 truncate"
      :style="{ color: layerColor }"
      :title="match.type"
    >
      {{ match.type }}
    </span>

    <div class="flex-1 truncate text-neutral-500 dark:text-neutral-400">
      <span>{{ match.fileA.fileName }}</span>
    </div>

    <template v-if="match.fileB">
      <UIcon name="i-lucide-arrow-right" class="text-neutral-400 shrink-0" />
      <div class="flex-1 truncate">
        <span :class="match.identical ? 'text-green-500' : 'text-amber-500'">
          {{ match.fileB.fileName }}
        </span>
      </div>
    </template>

    <UBadge v-if="match.identical" color="success" variant="subtle" size="xs">
      <UIcon name="i-lucide-check" class="mr-0.5" /> Same
    </UBadge>
    <UBadge v-else-if="match.fileB" color="warning" variant="subtle" size="xs">
      Changed
    </UBadge>
    <UBadge v-else-if="hasOtherPacket" color="error" variant="subtle" size="xs">
      Missing
    </UBadge>
  </div>
</template>

<script setup lang="ts">
import type { GerberFile, LayerMatch } from '~/utils/gerber-helpers'
import { getColorForType } from '~/utils/gerber-helpers'

const props = defineProps<{
  match: LayerMatch
  selected: boolean
  availableFiles: GerberFile[]
}>()

defineEmits<{
  click: []
  rematch: [file: GerberFile | null]
}>()

const layerColor = computed(() => getColorForType(props.match.type))

/** True when the other packet has files (so "Missing" badge is meaningful) */
const hasOtherPacket = computed(() => props.availableFiles.length > 0)
</script>
