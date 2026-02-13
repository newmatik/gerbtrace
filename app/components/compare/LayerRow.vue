<template>
  <div
    class="flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-colors"
    :class="selected
      ? 'bg-primary/10 border border-primary/30'
      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-transparent'"
    @click="$emit('click')"
  >
    <div class="flex-1 truncate">
      <span>{{ match.fileA.fileName }}</span>
    </div>

    <UIcon name="i-lucide-arrow-right" class="text-neutral-400 shrink-0" />

    <div class="flex-1 truncate">
      <span v-if="match.fileB" :class="match.identical ? 'text-green-500' : 'text-amber-500'">
        {{ match.fileB.fileName }}
      </span>
      <span v-else class="text-neutral-400 italic">unmatched</span>
    </div>

    <UBadge v-if="match.identical" color="success" variant="subtle" size="xs">
      <UIcon name="i-lucide-check" class="mr-0.5" /> Same
    </UBadge>
    <UBadge v-else-if="match.fileB" color="warning" variant="subtle" size="xs">
      Changed
    </UBadge>
    <UBadge v-else color="error" variant="subtle" size="xs">
      Missing
    </UBadge>
  </div>
</template>

<script setup lang="ts">
import type { GerberFile, LayerMatch } from '~/utils/gerber-helpers'

defineProps<{
  match: LayerMatch
  selected: boolean
  availableFiles: GerberFile[]
}>()

defineEmits<{
  click: []
  rematch: [file: GerberFile | null]
}>()
</script>
