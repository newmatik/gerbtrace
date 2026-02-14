import JSZip from 'jszip'
import type { GerberFile } from '~/utils/gerber-helpers'
import { isImportableFile, isPnPFile, detectPnPSide } from '~/utils/gerber-helpers'

export function useSampleProject() {
  const { createNewProject, addFiles } = useProject()

  async function extractZip(url: string): Promise<GerberFile[]> {
    const response = await fetch(url)
    const blob = await response.arrayBuffer()
    const zip = await JSZip.loadAsync(blob)
    const files: GerberFile[] = []

    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue
      // Strip directory prefix if present
      const fileName = name.includes('/') ? name.split('/').pop()! : name
      if (!isImportableFile(fileName)) continue
      const content = await entry.async('text')
      const layerType = isPnPFile(fileName) ? detectPnPSide(fileName) : undefined
      files.push({ fileName, content, layerType })
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
