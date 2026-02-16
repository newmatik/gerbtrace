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

const POST_UPDATE_KEY = 'gerbtrace_post_update'

interface PostUpdateInfo {
  version: string
  notes: string
}

/** Saved before relaunch so the next launch can show "What's New". */
function savePostUpdateInfo(version: string, notes: string | null) {
  try {
    const info: PostUpdateInfo = { version, notes: notes || '' }
    localStorage.setItem(POST_UPDATE_KEY, JSON.stringify(info))
  } catch { /* localStorage may be unavailable */ }
}

/** Read and clear stored post-update info (called once on startup). */
function consumePostUpdateInfo(): PostUpdateInfo | null {
  try {
    const raw = localStorage.getItem(POST_UPDATE_KEY)
    if (!raw) return null
    localStorage.removeItem(POST_UPDATE_KEY)
    return JSON.parse(raw) as PostUpdateInfo
  } catch {
    return null
  }
}

const postUpdateInfo = ref<PostUpdateInfo | null>(null)

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
      status.available = true
      status.version = update.version
      status.notes = update.body ?? null
      pendingUpdate = update
      promptDismissed.value = false
      status.lastResult = 'update_available'
    } else {
      status.available = false
      status.version = null
      status.notes = null
      status.lastResult = 'up_to_date'
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

    await pendingUpdate.download()
    savePostUpdateInfo(pendingUpdate.version, pendingUpdate.body ?? null)
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

function checkForUpdateOnStartup() {
  if (!isTauri || startupCheckTriggered) return
  startupCheckTriggered = true

  // Check if this launch follows an auto-update
  postUpdateInfo.value = consumePostUpdateInfo()

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
