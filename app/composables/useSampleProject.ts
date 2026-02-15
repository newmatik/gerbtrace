import JSZip from 'jszip'
import type { GerberFile } from '~/utils/gerber-helpers'
import { isPnPFile, detectPnPSide, detectLayerType } from '~/utils/gerber-helpers'
import { parsePnPFile } from '~/utils/pnp-parser'

/** Files inside ZIPs that should always be skipped (system junk). */
const SKIP_FILENAMES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini'])

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

export function useSampleProject() {
  const { createNewProject, addFiles } = useProject()

  async function extractZip(url: string): Promise<GerberFile[]> {
    const response = await fetch(url)
    const blob = await response.arrayBuffer()
    const zip = await JSZip.loadAsync(blob)
    const files: GerberFile[] = []

    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue
      if (name.startsWith('__MACOSX/')) continue
      // Strip directory prefix if present
      const fileName = name.includes('/') ? name.split('/').pop()! : name
      if (SKIP_FILENAMES.has(fileName.toLowerCase()) || fileName.startsWith('._')) continue
      const content = await entry.async('text')
      if (isPnPFile(fileName)) {
        const layerType = detectPnPLayerType(fileName, content)
        files.push({ fileName, content, layerType })
      } else {
        const layerType = detectLayerType(fileName)
        files.push({ fileName, content, layerType })
      }
    }

    return files
  }

  async function loadSampleProject(mode: 'viewer' | 'compare') {
    const baseURL = useRuntimeConfig().app.baseURL || '/'

    try {
      const project = await createNewProject(mode, mode === 'viewer' ? 'Arduino UNO' : 'Arduino UNO Rev3e vs Rev3f')

      const filesA = await extractZip(`${baseURL}samples/${mode === 'viewer' ? 'arduino-uno.zip' : 'arduino-uno-rev3e.zip'}`)
      await addFiles(project.id!, 1, filesA)

      if (mode === 'compare') {
        const filesB = await extractZip(`${baseURL}samples/arduino-uno-rev3f.zip`)
        await addFiles(project.id!, 2, filesB)
      }

      return project
    } catch (e) {
      console.error('Failed to load sample project:', e)
      return null
    }
  }

  return { loadSampleProject }
}
