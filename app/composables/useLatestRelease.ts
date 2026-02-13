/**
 * Fetches the latest GitHub release and extracts platform-specific download URLs.
 * Caches the result for 10 minutes to avoid hitting API rate limits.
 */

interface ReleaseAsset {
  name: string
  browser_download_url: string
  size: number
}

interface ReleaseInfo {
  version: string
  macosUrl: string | null
  windowsExeUrl: string | null
  windowsMsiUrl: string | null
  releasePage: string
}

const REPO = 'newmatik/gerbtrace'
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

const release = ref<ReleaseInfo | null>(null)
const loading = ref(false)
const error = ref(false)
let lastFetch = 0

function detectPlatform(): 'macos' | 'windows' | 'other' {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'macos'
  if (ua.includes('win')) return 'windows'
  return 'other'
}

async function fetchLatestRelease() {
  if (Date.now() - lastFetch < CACHE_TTL && release.value) return

  loading.value = true
  error.value = false

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    const assets: ReleaseAsset[] = data.assets || []

    release.value = {
      version: data.tag_name?.replace(/^v/, '') || '',
      macosUrl: assets.find(a => a.name.endsWith('.dmg'))?.browser_download_url || null,
      windowsExeUrl: assets.find(a => a.name.endsWith('-setup.exe'))?.browser_download_url || null,
      windowsMsiUrl: assets.find(a => a.name.endsWith('.msi'))?.browser_download_url || null,
      releasePage: data.html_url || `https://github.com/${REPO}/releases/latest`,
    }
    lastFetch = Date.now()
  } catch {
    error.value = true
    release.value = null
  } finally {
    loading.value = false
  }
}

export function useLatestRelease() {
  const platform = detectPlatform()

  if (import.meta.client && !release.value && !loading.value) {
    fetchLatestRelease()
  }

  return {
    release: readonly(release),
    loading: readonly(loading),
    error: readonly(error),
    platform,
    refresh: fetchLatestRelease,
  }
}
