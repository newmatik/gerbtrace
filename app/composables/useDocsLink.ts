const DOCS_BASE_URL = 'https://gerbtrace.com/docs'

function buildDocsUrl(path = ''): string {
  const normalizedPath = path
    ? `/${path}`.replace(/\/+/g, '/').replace(/^\/docs/, '')
    : ''
  return `${DOCS_BASE_URL}${normalizedPath}`
}

export function useDocsLink() {
  async function openDocs(path = '') {
    const url = buildDocsUrl(path)

    if (!import.meta.client) return

    try {
      const { isTauri } = await import('@tauri-apps/api/core')
      if (await isTauri()) {
        const { openUrl } = await import('@tauri-apps/plugin-opener')
        await openUrl(url)
        return
      }
    } catch (error) {
      console.warn('[docs] Failed to open with Tauri opener:', error)
    }

    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return {
    buildDocsUrl,
    openDocs,
  }
}
