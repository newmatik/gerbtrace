const WEB_DOCS_BASE_PATH = '/docs'
const TAURI_DOCS_BASE_URL = 'https://gerbtrace.com/docs'

function normalizeDocsPath(path = ''): string {
  const normalizedPath = path
    ? `/${path}`.replace(/\/+/g, '/').replace(/^\/docs/, '')
    : ''
  return normalizedPath
}

function buildWebDocsUrl(path = ''): string {
  return `${WEB_DOCS_BASE_PATH}${normalizeDocsPath(path)}`
}

function buildTauriDocsUrl(path = ''): string {
  return `${TAURI_DOCS_BASE_URL}${normalizeDocsPath(path)}`
}

function buildDocsUrl(path = ''): string {
  // Keep API stable: web callers get same-origin /docs links.
  return buildWebDocsUrl(path)
}

export function useDocsLink() {
  async function openDocs(path = '') {
    const webUrl = buildWebDocsUrl(path)
    const tauriUrl = buildTauriDocsUrl(path)

    if (!import.meta.client) return

    // Keep browser popup opening in the same click task.
    const isLikelyTauri = typeof window !== 'undefined'
      && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
    if (!isLikelyTauri) {
      window.open(webUrl, '_blank', 'noopener,noreferrer')
      return
    }

    try {
      const { isTauri } = await import('@tauri-apps/api/core')
      if (await isTauri()) {
        const { openUrl } = await import('@tauri-apps/plugin-opener')
        await openUrl(tauriUrl)
        return
      }
    } catch (error) {
      console.warn('[docs] Failed to open with Tauri opener:', error)
    }

    window.open(webUrl, '_blank', 'noopener,noreferrer')
  }

  return {
    buildDocsUrl,
    openDocs,
  }
}
