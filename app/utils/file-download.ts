let tauriRuntime: boolean | null = null

async function isTauriRuntime(): Promise<boolean> {
  if (tauriRuntime != null) return tauriRuntime
  try {
    const { isTauri } = await import('@tauri-apps/api/core')
    tauriRuntime = await isTauri()
  } catch {
    tauriRuntime = false
  }
  return tauriRuntime
}

function browserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function getFileExtension(fileName: string): string | null {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0 || dot === fileName.length - 1) return null
  return fileName.slice(dot + 1).toLowerCase()
}

function ensureExtension(path: string, extension: string | null): string {
  if (!extension) return path
  const lowerPath = path.toLowerCase()
  const expectedSuffix = `.${extension.toLowerCase()}`
  if (lowerPath.endsWith(expectedSuffix)) return path
  return `${path}${expectedSuffix}`
}

function extensionLabel(extension: string): string {
  if (extension === 'png') return 'PNG image'
  if (extension === 'svg') return 'SVG image'
  if (extension === 'zip') return 'ZIP archive'
  if (extension === 'csv') return 'CSV file'
  if (extension === 'txt') return 'Text file'
  return `${extension.toUpperCase()} file`
}

export async function saveBlobFile(blob: Blob, fileName: string): Promise<boolean> {
  if (await isTauriRuntime()) {
    const extension = getFileExtension(fileName)
    try {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const selectedPath = await save({
        defaultPath: fileName,
        title: 'Save file',
        ...(extension
          ? {
              filters: [
                { name: extensionLabel(extension), extensions: [extension] },
              ],
            }
          : {}),
      })
      if (!selectedPath) return false

      const { invoke } = await import('@tauri-apps/api/core')
      const bytes = new Uint8Array(await blob.arrayBuffer())
      await invoke('save_file_bytes', {
        path: ensureExtension(selectedPath, extension),
        bytes: Array.from(bytes),
      })
      return true
    } catch (error) {
      console.error('Failed to save file in desktop runtime', error)
      try {
        const { message } = await import('@tauri-apps/plugin-dialog')
        await message('The file could not be saved. Please check permissions and try again.', {
          title: 'Download failed',
          kind: 'error',
        })
      } catch {
        // Ignore secondary dialog failures and return the original failure.
      }
      return false
    }
  }

  browserDownload(blob, fileName)
  return true
}
