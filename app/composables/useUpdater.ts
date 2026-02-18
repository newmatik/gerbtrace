/**
 * Tauri auto-updater composable.
 *
 * Checks for updates on app launch when running inside Tauri.
 * Listens for the native "Check for Updates…" menu event.
 * In the browser, all methods are no-ops.
 */

import { isTauri as coreIsTauri } from '@tauri-apps/api/core'

export interface UpdateStatus {
  checking: boolean
  available: boolean
  downloading: boolean
  version: string | null
  notes: string | null
  error: string | null
  lastCheckedAt: number | null
  lastResult: 'update_available' | 'up_to_date' | 'error' | null
}

const status = reactive<UpdateStatus>({
  checking: false,
  available: false,
  downloading: false,
  version: null,
  notes: null,
  error: null,
  lastCheckedAt: null,
  lastResult: null,
})

/** Toggled to true when the native menu triggers a check, so the UI can open the About modal. */
const menuTriggered = ref(false)

// Prefer official Tauri API detection (works reliably across platforms/builds).
const isTauri = typeof window !== 'undefined' && coreIsTauri()

let listenerInitialised = false
let startupCheckTriggered = false
const promptDismissed = ref(false)
let pendingUpdate: import('@tauri-apps/plugin-updater').Update | null = null

interface PostUpdateInfo {
  version: string
  notes: string
}

/**
 * Persist post-update info via a Tauri command that writes a file to the
 * app-data directory.  This guarantees the data is flushed to disk before the
 * updater replaces the binary and relaunches – unlike localStorage, which may
 * not be flushed by WKWebView in time.
 */
async function savePostUpdateInfo(version: string, notes: string | null) {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const info: PostUpdateInfo = { version, notes: notes || '' }
    await invoke('save_post_update_info', { payload: JSON.stringify(info) })
  } catch { /* best-effort */ }
}

/** Read and delete the stored post-update info file (called once on startup). */
async function consumePostUpdateInfo(): Promise<PostUpdateInfo | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const raw = await invoke<string | null>('consume_post_update_info')
    if (!raw) return null
    return JSON.parse(raw) as PostUpdateInfo
  } catch {
    return null
  }
}

const postUpdateInfo = ref<PostUpdateInfo | null>(null)
const GITHUB_RELEASES_API_BASE = 'https://api.github.com/repos/newmatik/gerbtrace/releases/tags/'
const GENERIC_RELEASE_NOTES_RE = /see the assets below to download and install gerbtrace for your platform\.?/i
let pendingUpdateNotes: string | null = null

function normalizeReleaseNotes(notes: string | null | undefined): string | null {
  if (!notes) return null
  const normalized = notes.replace(/\r\n/g, '\n').trim()
  if (!normalized) return null
  if (GENERIC_RELEASE_NOTES_RE.test(normalized)) return null
  return normalized
}

async function fetchReleaseNotesFromGitHub(version: string): Promise<string | null> {
  const tag = version.startsWith('v') ? version : `v${version}`
  const url = `${GITHUB_RELEASES_API_BASE}${encodeURIComponent(tag)}`
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    })
    if (!response.ok) return null
    const payload = await response.json() as { body?: string | null }
    return normalizeReleaseNotes(payload.body ?? null)
  } catch {
    return null
  }
}

async function resolveUpdateNotes(version: string, fallbackNotes: string | null | undefined): Promise<string | null> {
  const githubNotes = await fetchReleaseNotesFromGitHub(version)
  if (githubNotes) return githubNotes
  return normalizeReleaseNotes(fallbackNotes)
}

function toUpdaterErrorMessage(err: unknown, fallback: string) {
  const message = (err as any)?.message || fallback
  if (typeof message !== 'string') return fallback
  const lowered = message.toLowerCase()
  if (lowered.includes('signature')) {
    return 'Update signature verification failed. Please reinstall from the latest release once.'
  }
  return message
}

async function initMenuListener() {
  if (!isTauri || listenerInitialised) return
  listenerInitialised = true

  try {
    const { listen } = await import('@tauri-apps/api/event')
    await listen('menu-check-for-updates', () => {
      menuTriggered.value = true
      checkForUpdate()
    })
  } catch {
    // Ignore – not running in Tauri
  }
}

async function checkForUpdate() {
  if (!isTauri) return

  status.checking = true
  status.error = null

  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()
    await pendingUpdate?.close()
    pendingUpdate = null

    if (update) {
      const resolvedNotes = await resolveUpdateNotes(update.version, update.body ?? null)
      status.available = true
      status.version = update.version
      status.notes = resolvedNotes
      pendingUpdate = update
      pendingUpdateNotes = resolvedNotes
      promptDismissed.value = false
      status.lastResult = 'update_available'
    } else {
      status.available = false
      status.version = null
      status.notes = null
      status.lastResult = 'up_to_date'
      pendingUpdateNotes = null
    }
  } catch (err: any) {
    status.error = toUpdaterErrorMessage(err, 'Failed to check for updates')
    console.warn('[updater] Check failed:', err)
    status.lastResult = 'error'
  } finally {
    status.checking = false
    status.lastCheckedAt = Date.now()
  }
}

async function downloadAndInstall() {
  if (!isTauri || !status.available) return

  status.downloading = true
  status.error = null

  try {
    if (!pendingUpdate) {
      await checkForUpdate()
    }

    if (!pendingUpdate) {
      status.error = 'Update metadata expired. Please check for updates again.'
      return
    }

    if (!pendingUpdateNotes) {
      pendingUpdateNotes = await resolveUpdateNotes(pendingUpdate.version, pendingUpdate.body ?? null)
    }

    await pendingUpdate.download()
    await savePostUpdateInfo(pendingUpdate.version, pendingUpdateNotes)
    await pendingUpdate.install()
    const { relaunch } = await import('@tauri-apps/plugin-process')
    await relaunch()
  } catch (err: any) {
    status.error = toUpdaterErrorMessage(err, 'Failed to install update')
    console.error('[updater] Install failed:', err)
  } finally {
    status.downloading = false
  }
}

function dismissUpdatePrompt() {
  promptDismissed.value = true
}

async function checkForUpdateOnStartup() {
  if (!isTauri || startupCheckTriggered) return
  startupCheckTriggered = true

  // Check if this launch follows an auto-update
  postUpdateInfo.value = await consumePostUpdateInfo()

  void checkForUpdate()
}

function dismissPostUpdate() {
  postUpdateInfo.value = null
}

export function useUpdater() {
  // Initialise the native menu listener once
  initMenuListener()

  return {
    status: readonly(status),
    menuTriggered,
    promptDismissed: readonly(promptDismissed),
    postUpdateInfo: readonly(postUpdateInfo),
    isTauri,
    checkForUpdate,
    checkForUpdateOnStartup,
    downloadAndInstall,
    dismissUpdatePrompt,
    dismissPostUpdate,
  }
}
