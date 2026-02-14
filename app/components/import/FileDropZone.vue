<template>
  <div
    class="border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer"
    :class="isDragOver
      ? 'border-primary bg-primary/5'
      : 'border-neutral-300 dark:border-neutral-700 hover:border-primary/50'"
    @dragover.prevent="isDragOver = true"
    @dragleave="isDragOver = false"
    @drop.prevent="handleDrop"
    @click="openFilePicker"
  >
    <UIcon name="i-lucide-upload" class="text-xl text-neutral-400 mb-1" />
    <p class="text-xs text-neutral-500">Drop ZIP, Gerber, or Pick &amp; Place files</p>
    <input
      ref="fileInput"
      type="file"
      multiple
      accept=".zip,.gtl,.gbl,.gts,.gbs,.gto,.gbo,.gtp,.gbp,.gm1,.gm2,.gm3,.gko,.gbr,.ger,.pho,.cmp,.sol,.stc,.sts,.plc,.pls,.crc,.crs,.drl,.drd,.xln,.exc,.ncd,.art,.txt,.csv,.xy,.pos"
      class="hidden"
      @change="handleInputChange"
    />
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  filesSelected: [files: File[]]
}>()

const isDragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function openFilePicker() {
  fileInput.value?.click()
}

function handleDrop(e: DragEvent) {
  isDragOver.value = false
  const files = Array.from(e.dataTransfer?.files || [])
  if (files.length) emit('filesSelected', files)
}

function handleInputChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (files.length) emit('filesSelected', files)
  input.value = ''
}
</script>
