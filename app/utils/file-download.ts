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

export async function saveBlobFile(blob: Blob, fileName: string): Promise<boolean> {
  if (await isTauriRuntime()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const selectedPath = await save({
      defaultPath: fileName,
      title: 'Save file',
    })
    if (!selectedPath) return false

    const { writeFile } = await import('@tauri-apps/plugin-fs')
    const bytes = new Uint8Array(await blob.arrayBuffer())
    await writeFile(selectedPath, bytes)
    return true
  }

  browserDownload(blob, fileName)
  return true
}
