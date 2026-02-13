/**
 * Tauri auto-updater composable.
 *
 * Checks for updates on app launch when running inside Tauri.
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

const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__

export function useUpdater() {
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
        // Relaunch the app after install
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

  return {
    status: readonly(status),
    isTauri,
    checkForUpdate,
    downloadAndInstall,
  }
}
