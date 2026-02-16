<template>
  <UModal v-model:open="open">
    <template #content>
      <div class="p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">
            What's New in v{{ version }}
          </h3>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-x"
            @click="open = false"
          />
        </div>

        <ul v-if="items.length" class="space-y-1.5">
          <li
            v-for="(item, i) in items"
            :key="i"
            class="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300"
          >
            <span class="mt-1.5 h-1 w-1 rounded-full bg-neutral-400 dark:bg-neutral-500 shrink-0" />
            <span>{{ item }}</span>
          </li>
        </ul>
        <p v-else class="text-sm text-neutral-500 dark:text-neutral-400">
          Bug fixes and improvements.
        </p>

        <div class="flex justify-end">
          <UButton size="sm" color="primary" @click="open = false">
            Got it
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  version: string
  notes: string
}>()

const items = computed(() => {
  if (!props.notes) return []
  return props.notes
    .split('\n')
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
})
</script>
