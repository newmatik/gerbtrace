/**
 * Tauri auto-updater composable.
 *
 * Checks for updates on app launch when running inside Tauri.
 * Listens for the native "Check for Updates…" menu event.
 * In the browser, all methods are no-ops.
 */

export interface UpdateStatus {
  checking: boolean
  available: boolean
  downloading: boolean
  version: string | null
  error: string | null
}

const status = reactive<UpdateStatus>({
  checking: false,
  available: false,
  downloading: false,
  version: null,
  error: null,
})

/** Toggled to true when the native menu triggers a check, so the UI can open the About modal. */
const menuTriggered = ref(false)

const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__

let listenerInitialised = false

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

    if (update) {
      status.available = true
      status.version = update.version
    } else {
      status.available = false
      status.version = null
    }
  } catch (err: any) {
    status.error = err?.message || 'Failed to check for updates'
    console.warn('[updater] Check failed:', err)
  } finally {
    status.checking = false
  }
}

async function downloadAndInstall() {
  if (!isTauri || !status.available) return

  status.downloading = true
  status.error = null

  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()

    if (update) {
      await update.downloadAndInstall()
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    }
  } catch (err: any) {
    status.error = err?.message || 'Failed to install update'
    console.error('[updater] Install failed:', err)
  } finally {
    status.downloading = false
  }
}

export function useUpdater() {
  // Initialise the native menu listener once
  initMenuListener()

  return {
    status: readonly(status),
    menuTriggered,
    isTauri,
    checkForUpdate,
    downloadAndInstall,
  }
}
