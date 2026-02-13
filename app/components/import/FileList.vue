<template>
  <div v-if="files.length" class="space-y-1">
    <div
      v-for="file in files"
      :key="file.fileName"
      class="flex items-center gap-2 text-xs px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800"
    >
      <UIcon name="i-lucide-file" class="text-neutral-400 shrink-0" />
      <span class="truncate flex-1">{{ file.fileName }}</span>
      <span class="text-neutral-400 shrink-0">{{ formatSize(file.content.length) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GerberFile } from '~/utils/gerber-helpers'

defineProps<{
  files: GerberFile[]
}>()

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>
