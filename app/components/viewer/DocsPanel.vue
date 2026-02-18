<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div class="flex-1 overflow-y-auto">
      <div class="p-3 space-y-0.5">
        <div
          v-for="doc in documents"
          :key="doc.id"
          class="group flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors cursor-pointer"
          :class="selectedId === doc.id
            ? 'bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-400/40'
            : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'"
          @click="emit('select', doc.id)"
        >
          <UIcon name="i-lucide-file-text" class="text-base shrink-0" :class="selectedId === doc.id ? 'text-blue-500' : 'text-neutral-400'" />
          <div class="flex-1 min-w-0">
            <p class="text-xs font-medium truncate" :class="selectedId === doc.id ? 'text-blue-700 dark:text-blue-300' : 'text-neutral-700 dark:text-neutral-300'">
              {{ doc.name }}
            </p>
            <p class="mt-0.5 text-[10px] text-neutral-400">{{ doc.type }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProjectDocument } from '~/utils/document-types'

defineProps<{
  documents: ProjectDocument[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  select: [id: string]
}>()
</script>
