<template>
  <div>
    <p v-if="label" class="text-xs font-medium text-neutral-500 mb-1">{{ label }}</p>
    <FileDropZone @files-selected="handleFiles" />
  </div>
</template>

<script setup lang="ts">
import JSZip from 'jszip'
import type { GerberFile } from '~/utils/gerber-helpers'
import { isPnPFile, detectPnPSide, isImportableFile, detectLayerType, looksLikeGerberContent } from '~/utils/gerber-helpers'
import { parsePnPFile } from '~/utils/pnp-parser'

/** Files inside ZIPs that should always be skipped (system junk). */
const SKIP_FILENAMES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini'])
/** Non-importable drill report sidecars (Altium) that look like "Drill" by name. */
const SKIP_ZIP_EXTENSIONS = new Set(['.drr', '.ldp'])

function shouldSkipZipEntry(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  if (SKIP_FILENAMES.has(lower)) return true
  // macOS resource fork files
  if (fileName.startsWith('._')) return true
  // Skip known non-layer sidecars (drill reports, layer-pairs export, etc.)
  const dot = lower.lastIndexOf('.')
  const ext = dot >= 0 ? lower.slice(dot) : ''
  if (SKIP_ZIP_EXTENSIONS.has(ext)) return true
  return false
}

/**
 * Detect the PnP layer type for a file by parsing its content to check
 * which sides are present. Returns 'PnP Top + Bot' for combined files,
 * or 'PnP Top' / 'PnP Bottom' for single-side files.
 */
function detectPnPLayerType(fileName: string, content: string): string {
  const components = parsePnPFile(content, 'top')
  const hasTop = components.some(c => c.side === 'top')
  const hasBot = components.some(c => c.side === 'bottom')

  if (hasTop && hasBot) return 'PnP Top + Bot'
  if (hasBot) return 'PnP Bottom'
  return detectPnPSide(fileName)
}

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
  const importedFiles: GerberFile[] = []
  let sourceName = ''

  for (const file of rawFiles) {
    if (file.name.toLowerCase().endsWith('.zip')) {
      if (!sourceName) sourceName = deriveSourceName(file)
      const buffer = await file.arrayBuffer()
      const zip = await JSZip.loadAsync(buffer)
      for (const [name, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue
        if (name.startsWith('__MACOSX/')) continue
        const fileName = name.includes('/') ? name.split('/').pop()! : name
        if (shouldSkipZipEntry(fileName)) continue
        if (isImportableFile(fileName)) {
          const content = await entry.async('text')
          if (isPnPFile(fileName)) {
            const layerType = detectPnPLayerType(fileName, content)
            importedFiles.push({ fileName, content, layerType })
          } else {
            const layerType = detectLayerType(fileName)
            importedFiles.push({ fileName, content, layerType })
          }
        } else {
          // Some CAM tools export extensionless Gerber files — fall back to content sniffing
          const content = await entry.async('text')
          if (looksLikeGerberContent(content)) {
            importedFiles.push({ fileName, content })
          }
        }
      }
    } else if (isImportableFile(file.name)) {
      if (!sourceName) sourceName = deriveSourceName(file)
      const content = await file.text()
      if (isPnPFile(file.name)) {
        const layerType = detectPnPLayerType(file.name, content)
        importedFiles.push({ fileName: file.name, content, layerType })
      } else {
        importedFiles.push({ fileName: file.name, content })
      }
    }
  }

  if (importedFiles.length) {
    emit('import', importedFiles, sourceName)
  }
}
</script>
