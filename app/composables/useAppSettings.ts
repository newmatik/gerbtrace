/**
 * Global application settings with localStorage persistence.
 *
 * Settings are shared across all pages/components via a module-level
 * reactive state. Changes are automatically persisted to localStorage.
 */

export interface AppSettings {
  /** Whether the background grid is shown in layers view */
  gridEnabled: boolean
  /** Grid spacing in millimeters */
  gridSpacingMm: number
  /** DPI resolution for PNG image exports */
  exportDpi: number
}

/** Standard DPI presets for PNG export */
export const EXPORT_DPI_PRESETS = [150, 300, 600, 1200] as const

const STORAGE_KEY = 'gerbtrace-settings'

const defaults: AppSettings = {
  gridEnabled: true,
  gridSpacingMm: 10,
  exportDpi: 600,
}

function loadSettings(): AppSettings {
  if (typeof window === 'undefined') return { ...defaults }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaults }
    const parsed = JSON.parse(raw)
    return {
      gridEnabled: typeof parsed.gridEnabled === 'boolean' ? parsed.gridEnabled : defaults.gridEnabled,
      gridSpacingMm: typeof parsed.gridSpacingMm === 'number' && parsed.gridSpacingMm > 0
        ? parsed.gridSpacingMm
        : defaults.gridSpacingMm,
      exportDpi: typeof parsed.exportDpi === 'number' && parsed.exportDpi >= 72 && parsed.exportDpi <= 4800
        ? parsed.exportDpi
        : defaults.exportDpi,
    }
  } catch {
    return { ...defaults }
  }
}

function saveSettings(settings: AppSettings) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage errors (e.g. quota exceeded)
  }
}

const settings = reactive<AppSettings>(loadSettings())

// Persist whenever any setting changes
watch(
  () => ({ ...settings }),
  (newVal) => saveSettings(newVal),
  { deep: true },
)

export function useAppSettings() {
  return {
    settings,

    /** Reset all settings to defaults */
    resetDefaults() {
      Object.assign(settings, defaults)
    },
  }
}
