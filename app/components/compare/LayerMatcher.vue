<template>
  <div class="flex-1 overflow-y-auto">
    <div class="p-3">
      <h3 class="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Layer Matches</h3>
      <div v-if="!matches.length" class="text-xs text-neutral-400 py-4 text-center">
        Import Gerber files to see layers
      </div>
      <div class="space-y-1">
        <LayerRow
          v-for="(match, index) in matches"
          :key="index"
          :match="match"
          :selected="index === selectedMatch"
          :available-files="filesB"
          @click="$emit('select', index)"
          @rematch="(file) => $emit('rematch', index, file)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GerberFile, LayerMatch } from '~/utils/gerber-helpers'

defineProps<{
  filesA: GerberFile[]
  filesB: GerberFile[]
  matches: LayerMatch[]
  selectedMatch: number
}>()

defineEmits<{
  select: [index: number]
  rematch: [index: number, file: GerberFile | null]
}>()
</script>
