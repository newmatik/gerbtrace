<template>
  <div
    class="absolute bottom-4 right-4 flex gap-0.5 rounded-lg p-0.5 border backdrop-blur-sm"
    :class="isLight ? 'bg-black/12 border-black/25' : 'bg-neutral-900/85 border-neutral-700'"
  >
    <!-- Grid toggle (only in layers view) -->
    <UButton
      v-if="viewMode !== 'realistic'"
      size="xs"
      :color="settings.gridEnabled ? 'primary' : 'neutral'"
      variant="ghost"
      icon="i-lucide-grid-3x3"
      class="canvas-ctrl-btn"
      :class="[btnBase, btnTone, settings.gridEnabled ? btnActive : btnIdle]"
      :title="settings.gridEnabled ? 'Hide grid' : 'Show grid'"
      @click="settings.gridEnabled = !settings.gridEnabled"
    />
    <UButton
      size="xs"
      color="neutral"
      variant="ghost"
      :icon="isLight ? 'i-lucide-moon' : 'i-lucide-sun'"
      class="canvas-ctrl-btn"
      :class="[btnBase, btnTone, btnIdle]"
      :title="isLight ? 'Switch to dark background' : 'Switch to light background'"
      @click="toggle"
    />
    <UButton
      size="xs"
      color="neutral"
      variant="ghost"
      icon="i-lucide-plus"
      class="canvas-ctrl-btn"
      :class="[btnBase, btnTone, btnIdle]"
      title="Zoom in"
      @click="interaction.zoomIn()"
    />
    <UButton
      size="xs"
      color="neutral"
      variant="ghost"
      icon="i-lucide-minus"
      class="canvas-ctrl-btn"
      :class="[btnBase, btnTone, btnIdle]"
      title="Zoom out"
      @click="interaction.zoomOut()"
    />
    <UButton
      size="xs"
      color="neutral"
      variant="ghost"
      icon="i-lucide-maximize"
      class="canvas-ctrl-btn"
      :class="[btnBase, btnTone, btnIdle]"
      title="Fit to view"
      @click="interaction.resetView()"
    />
    <UButton
      size="xs"
      color="neutral"
      variant="ghost"
      icon="i-lucide-settings"
      class="canvas-ctrl-btn"
      :class="[btnBase, btnTone, btnIdle]"
      title="App settings"
      @click="$emit('openSettings')"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  interaction: ReturnType<typeof useCanvasInteraction>
  viewMode?: 'layers' | 'realistic'
}>()

defineEmits<{
  openSettings: []
}>()

const { isLight, toggle } = useBackgroundColor()
const { settings } = useAppSettings()

const btnBase = '!border !rounded-md !shadow-none !transition-colors'
const btnIdle = computed(() =>
  isLight.value
    ? '!border-black/20 hover:!border-black/35 hover:!bg-black/10'
    : '!border-white/15 hover:!border-white/25 hover:!bg-white/12',
)
const btnActive = computed(() =>
  isLight.value
    ? '!border-blue-600/60 !bg-blue-50/80'
    : '!border-blue-400/70 !bg-blue-500/15',
)
const btnTone = computed(() =>
  isLight.value ? '!text-black/85 hover:!text-black' : '!text-white/85 hover:!text-white',
)
</script>

<style scoped>
@reference "tailwindcss";
.canvas-ctrl-btn {
  @apply w-7 h-7;
}
</style>
