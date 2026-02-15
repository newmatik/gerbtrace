<template>
  <div class="flex items-center gap-2">
    <!-- Preset selector dropdown -->
    <div class="flex items-center rounded-lg p-0.5 gap-0.5 bg-neutral-100/90 border border-neutral-200 dark:bg-neutral-900/70 dark:border-neutral-700">
      <UDropdownMenu :items="presetMenuItems">
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          :class="[rcBtnBase, rcBtnIdle]"
        >
          <span
            class="inline-block w-2.5 h-2.5 rounded-full border border-neutral-300/50 dark:border-neutral-600/50"
            :style="{ backgroundColor: selectedPreset.solderMask }"
          />
          <span>{{ selectedPreset.name }}</span>
          <UIcon name="i-lucide-chevron-down" class="text-[10px] opacity-50" />
        </UButton>
      </UDropdownMenu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PCB_PRESETS, type PcbPreset } from '~/utils/pcb-presets'

const props = defineProps<{
  selectedPreset: PcbPreset
}>()

const emit = defineEmits<{
  selectPreset: [preset: PcbPreset]
}>()

const presetMenuItems = computed(() => [
  PCB_PRESETS.map(preset => ({
    label: preset.name,
    icon: preset.id === props.selectedPreset.id ? 'i-lucide-check' : undefined,
    onSelect: () => emit('selectPreset', preset),
  })),
])

// Match top-toolbar outlined button style
const rcBtnBase =
  '!rounded-md !px-2.5 !py-1 !text-xs !font-medium !border !shadow-none !transition-colors'
const rcBtnIdle =
  '!border-transparent hover:!border-neutral-300/80 hover:!bg-neutral-200/70 ' +
  'dark:!text-neutral-200 dark:hover:!bg-neutral-800/70 dark:hover:!border-neutral-600/70'
</script>
