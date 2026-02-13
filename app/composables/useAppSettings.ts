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
}

const STORAGE_KEY = 'gerbtrace-settings'

const defaults: AppSettings = {
  gridEnabled: true,
  gridSpacingMm: 10,
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
