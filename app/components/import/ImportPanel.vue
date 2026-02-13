<template>
  <div>
    <p v-if="label" class="text-xs font-medium text-neutral-500 mb-1">{{ label }}</p>
    <FileDropZone @files-selected="handleFiles" />
  </div>
</template>

<script setup lang="ts">
import JSZip from 'jszip'
import type { GerberFile } from '~/utils/gerber-helpers'
import { isGerberFile } from '~/utils/gerber-helpers'

const props = defineProps<{
  packet: number
  label?: string
}>()

const emit = defineEmits<{
  import: [files: GerberFile[], sourceName: string]
}>()

function deriveSourceName(file: File): string {
  // Strip extension (.zip, .gbr, etc.)
  return file.name.replace(/\.[^.]+$/, '')
}

async function handleFiles(rawFiles: File[]) {
  const gerberFiles: GerberFile[] = []
  let sourceName = ''

  for (const file of rawFiles) {
    if (file.name.toLowerCase().endsWith('.zip')) {
      if (!sourceName) sourceName = deriveSourceName(file)
      const buffer = await file.arrayBuffer()
      const zip = await JSZip.loadAsync(buffer)
      for (const [name, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue
        const fileName = name.includes('/') ? name.split('/').pop()! : name
        if (!isGerberFile(fileName)) continue
        const content = await entry.async('text')
        gerberFiles.push({ fileName, content })
      }
    } else if (isGerberFile(file.name)) {
      if (!sourceName) sourceName = deriveSourceName(file)
      const content = await file.text()
      gerberFiles.push({ fileName: file.name, content })
    }
  }

  if (gerberFiles.length) {
    emit('import', gerberFiles, sourceName)
  }
}
</script>
