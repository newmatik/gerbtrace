<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="-translate-x-2 opacity-0"
    enter-to-class="translate-x-0 opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="translate-x-0 opacity-100"
    leave-to-class="-translate-x-2 opacity-0"
  >
    <div
      v-if="dimensions"
      class="absolute bottom-4 left-4 flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 border backdrop-blur-sm text-[11px] font-mono tabular-nums select-none"
      :class="isLight ? 'bg-black/12 border-black/25 text-black/80' : 'bg-neutral-900/85 border-neutral-700 text-white/80'"
    >
      <span class="flex items-center gap-1">
        <span class="opacity-50">X</span>
        <span>{{ formatMm(dimensions.width) }}</span>
      </span>
      <span class="opacity-30">×</span>
      <span class="flex items-center gap-1">
        <span class="opacity-50">Y</span>
        <span>{{ formatMm(dimensions.height) }}</span>
      </span>
      <span class="opacity-40">mm</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  dimensions: { width: number; height: number } | null
}>()

const { isLight } = useBackgroundColor()

function formatMm(val: number): string {
  return val.toFixed(2)
}
</script>
