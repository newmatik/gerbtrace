<template>
  <div
    class="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-sm text-[10px] font-mono text-white/80 select-none whitespace-nowrap cursor-pointer"
    @dblclick="$emit('open-full')"
  >
    <span :class="fpsColor">{{ fpsLabel }}</span>
    <span class="text-white/25">|</span>
    <span>{{ frameLabel }}</span>
    <template v-if="heapMb !== null">
      <span class="text-white/25">|</span>
      <span>{{ heapMb }} MB</span>
    </template>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  fps: number
  frameMs: number
  heapUsedBytes: number | null
}>()

defineEmits<{ 'open-full': [] }>()

const fpsLabel = computed(() => {
  const v = props.fps
  if (!Number.isFinite(v) || v <= 0) return '— FPS'
  return `${Math.round(v)} FPS`
})

const fpsColor = computed(() => {
  const v = props.fps
  if (!Number.isFinite(v) || v <= 0) return 'text-white/50'
  if (v >= 55) return 'text-emerald-400'
  if (v >= 30) return 'text-amber-400'
  return 'text-red-400'
})

const frameLabel = computed(() => {
  const v = props.frameMs
  if (!Number.isFinite(v) || v <= 0) return '— ms'
  return `${v.toFixed(1)} ms`
})

const heapMb = computed(() => {
  const v = props.heapUsedBytes
  if (v === null || !Number.isFinite(v) || v <= 0) return null
  return (v / (1024 * 1024)).toFixed(0)
})
</script>
