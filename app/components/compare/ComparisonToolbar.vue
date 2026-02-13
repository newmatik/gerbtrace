<template>
  <div class="h-11 border-b border-neutral-200 dark:border-neutral-800 flex items-center px-3 gap-2 shrink-0">
    <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700">
      <UButton
        v-for="m in modes"
        :key="m.value"
        size="xs"
        color="neutral"
        variant="ghost"
        :icon="m.icon"
        :class="[tbBtnBase, mode === m.value ? tbBtnActive : tbBtnIdle]"
        @click="$emit('update:mode', m.value)"
      >
        <span>{{ m.label }}</span>
      </UButton>
    </div>

    <div class="flex-1" />

    <CanvasControls v-if="mode !== 'text'" :interaction="interaction" />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  mode: string
  overlaySpeed: number
  interaction: ReturnType<typeof useCanvasInteraction>
}>()

defineEmits<{
  'update:mode': [value: string]
  'update:overlaySpeed': [value: number]
}>()

const modes = [
  { label: 'Side by Side', value: 'side-by-side', icon: 'i-lucide-columns-2' },
  { label: 'Overlay', value: 'overlay', icon: 'i-lucide-layers' },
  { label: 'Diff', value: 'diff', icon: 'i-lucide-diff' },
  { label: 'Text', value: 'text', icon: 'i-lucide-file-text' },
]

const tbBtnBase =
  '!rounded-md !px-2.5 !py-1 !text-xs !font-medium !border !shadow-none !transition-colors'
const tbBtnIdle =
  '!border-transparent hover:!border-neutral-300/80 hover:!bg-neutral-200/70 ' +
  'dark:!text-neutral-200 dark:hover:!bg-neutral-800/70 dark:hover:!border-neutral-600/70'
const tbBtnActive =
  '!border-blue-500/70 !text-blue-700 !bg-blue-50/90 ' +
  'dark:!border-blue-400/70 dark:!text-blue-200 dark:!bg-blue-500/15'
</script>
