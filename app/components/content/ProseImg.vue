<script setup lang="ts">
const props = defineProps<{
  src: string
  alt?: string
  width?: string | number
  height?: string | number
}>()

const colorMode = useColorMode()
const fallback = ref(false)
const localTheme = ref<'dark' | 'light' | null>(null)
const lightboxOpen = ref(false)

const activeTheme = computed(() => localTheme.value ?? (colorMode.value === 'light' ? 'light' : 'dark'))
const isDark = computed(() => activeTheme.value === 'dark')

function themedSrc(theme: 'dark' | 'light') {
  const s = props.src
  if (!s) return s

  const ext = s.match(/\.[^.]+$/)?.[0] ?? ''
  const base = s.slice(0, s.length - ext.length)

  if (base.endsWith('-dark')) {
    return `${base.slice(0, -5)}-${theme}${ext}`
  }
  if (base.endsWith('-light')) {
    return `${base.slice(0, -6)}-${theme}${ext}`
  }

  return `${base}-${theme}${ext}`
}

const resolvedSrc = computed(() => {
  if (fallback.value) return props.src
  return themedSrc(activeTheme.value)
})

function onError() {
  if (!fallback.value) {
    fallback.value = true
  }
}

watch(() => colorMode.value, () => {
  fallback.value = false
  localTheme.value = null
})

function toggleTheme() {
  localTheme.value = activeTheme.value === 'dark' ? 'light' : 'dark'
  fallback.value = false
}

function openLightbox() {
  lightboxOpen.value = true
}

function closeLightbox() {
  lightboxOpen.value = false
}

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) closeLightbox()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeLightbox()
}

watch(lightboxOpen, (open) => {
  if (open) {
    document.addEventListener('keydown', onKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <figure class="my-4">
    <img
      :src="resolvedSrc"
      :alt="alt"
      :width="width"
      :height="height"
      class="rounded-lg cursor-pointer hover:opacity-90 transition-opacity w-full"
      @error="onError"
      @click="openLightbox"
    >
    <figcaption class="mt-2 flex justify-center">
      <div class="inline-flex items-center gap-2 text-[11px] text-neutral-400 dark:text-neutral-500">
        <UIcon name="i-lucide-sun" class="text-xs" />
        <USwitch
          :model-value="isDark"
          size="xs"
          @update:model-value="toggleTheme"
        />
        <UIcon name="i-lucide-moon" class="text-xs" />
      </div>
    </figcaption>

    <Teleport to="body">
      <Transition name="lightbox">
        <div
          v-if="lightboxOpen"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8"
          @click="onBackdropClick"
        >
          <div class="relative max-w-[95vw] max-h-[95vh] flex flex-col items-center">
            <div class="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-3">
              <div class="inline-flex items-center gap-2 text-xs text-neutral-300">
                <UIcon name="i-lucide-sun" class="text-sm" />
                <USwitch
                  :model-value="isDark"
                  size="xs"
                  @update:model-value="toggleTheme"
                />
                <UIcon name="i-lucide-moon" class="text-sm" />
              </div>
            </div>
            <button
              class="absolute -top-9 right-0 text-neutral-300 hover:text-white transition-colors"
              @click="closeLightbox"
            >
              <UIcon name="i-lucide-x" class="text-lg" />
            </button>
            <img
              :src="resolvedSrc"
              :alt="alt"
              class="rounded-lg max-w-full max-h-[90vh] object-contain"
              @error="onError"
            >
            <span
              v-if="alt"
              class="mt-2 text-xs text-neutral-400"
            >{{ alt }}</span>
          </div>
        </div>
      </Transition>
    </Teleport>
  </figure>
</template>

<style scoped>
.lightbox-enter-active,
.lightbox-leave-active {
  transition: opacity 0.15s ease;
}
.lightbox-enter-from,
.lightbox-leave-to {
  opacity: 0;
}
</style>
