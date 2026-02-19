<script setup lang="ts">
const props = defineProps<{
  dark: string
  light: string
  alt?: string
}>()

const container = ref<HTMLElement>()
const position = ref(50)
const dragging = ref(false)

function updatePosition(clientX: number) {
  if (!container.value) return
  const rect = container.value.getBoundingClientRect()
  const x = clientX - rect.left
  position.value = Math.max(0, Math.min(100, (x / rect.width) * 100))
}

function onPointerDown(e: PointerEvent) {
  dragging.value = true
  updatePosition(e.clientX)
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  updatePosition(e.clientX)
}

function onPointerUp() {
  dragging.value = false
}
</script>

<template>
  <figure class="my-4">
    <div
      ref="container"
      class="relative overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700 select-none touch-none cursor-col-resize"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <img
        :src="light"
        :alt="alt ? `${alt} (light)` : 'Light mode'"
        class="block w-full"
        draggable="false"
      >

      <div
        class="absolute inset-0 overflow-hidden"
        :style="{ width: `${position}%` }"
      >
        <img
          :src="dark"
          :alt="alt ? `${alt} (dark)` : 'Dark mode'"
          class="block w-full"
          :style="{ minWidth: container ? `${container.clientWidth}px` : '100%' }"
          draggable="false"
        >
      </div>

      <div
        class="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_rgba(0,0,0,0.4)]"
        :style="{ left: `${position}%` }"
      >
        <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center">
          <UIcon name="i-lucide-grip-vertical" class="text-neutral-500 text-sm" />
        </div>
      </div>

      <div class="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-900/70 text-white pointer-events-none">
        Dark
      </div>
      <div class="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/80 text-neutral-800 pointer-events-none">
        Light
      </div>
    </div>
    <figcaption v-if="alt" class="mt-1.5 text-[11px] text-neutral-400 dark:text-neutral-500">
      {{ alt }}
    </figcaption>
  </figure>
</template>
