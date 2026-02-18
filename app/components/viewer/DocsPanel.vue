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
            <div class="mt-0.5">
              <USelect
                :model-value="doc.type"
                :items="documentTypeItems"
                value-key="value"
                label-key="label"
                size="xs"
                class="w-36"
                @click.stop
                @update:model-value="emit('update-type', doc.id, String($event) as DocumentType)"
              />
            </div>
          </div>
          <button
            class="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition-all p-0.5 rounded shrink-0"
            title="Remove document"
            @click.stop="emit('remove', doc.id)"
          >
            <UIcon name="i-lucide-x" class="text-sm" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DocumentType, ProjectDocument } from '~/utils/document-types'

const documentTypes: DocumentType[] = ['Schematics', 'Drawings', 'Datasheets', 'Instructions']
const documentTypeItems = documentTypes.map((t) => ({ label: t, value: t }))

defineProps<{
  documents: ProjectDocument[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  select: [id: string]
  remove: [id: string]
  'update-type': [id: string, type: DocumentType]
}>()
</script>
