<template>
  <div class="group flex items-center gap-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/40 px-3 py-2">
    <button
      class="flex-1 min-w-0 text-left"
      :title="project.name"
      @click="$emit('open', project)"
    >
      <div class="flex items-center gap-2 min-w-0">
        <h3 class="font-medium text-sm truncate text-neutral-900 dark:text-white">
          {{ project.name }}
        </h3>
        <UBadge :color="project.mode === 'viewer' ? 'info' : 'warning'" variant="subtle" size="xs" class="shrink-0">
          {{ project.mode === 'viewer' ? 'Viewer' : 'Compare' }}
        </UBadge>
      </div>
      <div class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
        Updated {{ formatDate(project.updatedAt) }}
      </div>
    </button>

    <div class="flex items-center gap-1 shrink-0">
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-arrow-right"
        title="Open"
        @click="$emit('open', project)"
      />
      <UButton
        size="xs"
        variant="ghost"
        icon="i-lucide-trash-2"
        color="error"
        title="Delete"
        @click="$emit('requestDelete', project)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  project: { id?: number; name: string; mode: string; updatedAt: Date }
}>()

defineEmits<{
  open: [project: any]
  requestDelete: [project: any]
}>()

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>
