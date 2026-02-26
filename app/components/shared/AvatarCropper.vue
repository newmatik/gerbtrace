<template>
  <div class="space-y-3">
    <div class="flex items-center gap-3">
      <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-upload" @click="fileInputRef?.click()">
        {{ pickedFile ? pickedFile.name : 'Choose image' }}
      </UButton>
      <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="onPickFile">
    </div>

    <template v-if="previewUrl">
      <div class="space-y-2">
        <div class="text-xs text-neutral-500">Zoom</div>
        <input v-model.number="zoom" type="range" min="1" max="2.5" step="0.05" class="w-full">
      </div>

      <div class="w-36 h-36 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
        <img
          :src="previewUrl"
          alt="Avatar preview"
          class="w-full h-full object-cover"
          :style="{ transform: `scale(${zoom})` }"
        >
      </div>

      <UButton size="sm" @click="emitCropped">Use cropped image</UButton>
    </template>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  cropped: [blob: Blob]
  picked: []
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const pickedFile = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const zoom = ref(1)

function cleanupPreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
}

function onPickFile(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0] ?? null
  pickedFile.value = file
  cleanupPreview()
  if (file) {
    previewUrl.value = URL.createObjectURL(file)
    emit('picked')
  }
}

async function emitCropped() {
  if (!pickedFile.value) return
  const image = await loadImage(pickedFile.value)
  const minSide = Math.min(image.width, image.height)
  const zoomFactor = Math.max(1, Math.min(2.5, zoom.value))
  const cropSize = Math.floor(minSide / zoomFactor)
  const sx = Math.floor((image.width - cropSize) / 2)
  const sy = Math.floor((image.height - cropSize) / 2)

  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.drawImage(image, sx, sy, cropSize, cropSize, 0, 0, 256, 256)

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png', 0.92))
  if (!blob) return
  emit('cropped', blob)
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Invalid image'))
      img.src = String(reader.result || '')
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

onBeforeUnmount(() => cleanupPreview())
</script>
