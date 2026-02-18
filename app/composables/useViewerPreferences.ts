/**
 * Per-project viewer preferences persisted to localStorage.
 *
 * Follows the same pattern as useSidebarWidth (load on init, auto-save on change).
 */

const STORAGE_PREFIX = 'gerbtrace:viewer:'

interface TabVisibility {
  panel: boolean
  pnp: boolean
  bom: boolean
  docs: boolean
}

interface ViewerPrefs {
  viewMode: 'layers' | 'realistic'
  activeFilter: 'all' | 'top' | 'bot'
  activeMode: 'cursor' | 'measure' | 'info' | 'delete'
  cropToOutline: boolean
  mirrored: boolean
  presetId: string
  boardRotation: number
  tabVisibility: TabVisibility
}

const TAB_VIS_DEFAULTS: TabVisibility = {
  panel: false,
  pnp: false,
  bom: false,
  docs: false,
}

const DEFAULTS: ViewerPrefs = {
  viewMode: 'layers',
  activeFilter: 'all',
  activeMode: 'cursor',
  cropToOutline: false,
  mirrored: false,
  presetId: 'green-enig',
  boardRotation: 0,
  tabVisibility: { ...TAB_VIS_DEFAULTS },
}

export function useViewerPreferences(projectId: number | string) {
  const key = STORAGE_PREFIX + projectId

  function load(): { prefs: ViewerPrefs, hasStoredCropToOutline: boolean } {
    if (typeof window === 'undefined') {
      return { prefs: { ...DEFAULTS }, hasStoredCropToOutline: false }
    }
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const p = JSON.parse(raw)
        const hasStoredCropToOutline = typeof p.cropToOutline === 'boolean'
        return {
          prefs: {
          viewMode: ['layers', 'realistic'].includes(p.viewMode) ? p.viewMode : DEFAULTS.viewMode,
          activeFilter: ['all', 'top', 'bot'].includes(p.activeFilter) ? p.activeFilter : DEFAULTS.activeFilter,
          activeMode: ['cursor', 'measure', 'info', 'delete'].includes(p.activeMode) ? p.activeMode : DEFAULTS.activeMode,
          cropToOutline: typeof p.cropToOutline === 'boolean' ? p.cropToOutline : DEFAULTS.cropToOutline,
          mirrored: typeof p.mirrored === 'boolean' ? p.mirrored : DEFAULTS.mirrored,
          presetId: typeof p.presetId === 'string' ? p.presetId : DEFAULTS.presetId,
          boardRotation: typeof p.boardRotation === 'number' && isFinite(p.boardRotation) ? p.boardRotation : DEFAULTS.boardRotation,
          tabVisibility: p.tabVisibility && typeof p.tabVisibility === 'object'
            ? {
                panel: !!p.tabVisibility.panel,
                pnp: !!p.tabVisibility.pnp,
                bom: !!p.tabVisibility.bom,
                docs: !!p.tabVisibility.docs,
              }
            : { ...TAB_VIS_DEFAULTS },
          },
          hasStoredCropToOutline,
        }
      }
    } catch { /* ignore corrupt data */ }
    return { prefs: { ...DEFAULTS }, hasStoredCropToOutline: false }
  }

  function save(prefs: ViewerPrefs) {
    if (typeof window === 'undefined') return
    localStorage.setItem(key, JSON.stringify(prefs))
  }

  const stored = load()

  const viewMode = ref<ViewerPrefs['viewMode']>(stored.prefs.viewMode)
  const activeFilter = ref<ViewerPrefs['activeFilter']>(stored.prefs.activeFilter)
  const activeMode = ref<ViewerPrefs['activeMode']>(stored.prefs.activeMode)
  const cropToOutline = ref(stored.prefs.cropToOutline)
  const mirrored = ref(stored.prefs.mirrored)
  const presetId = ref(stored.prefs.presetId)
  const boardRotation = ref(stored.prefs.boardRotation)
  const tabVisibility = ref<TabVisibility>({ ...stored.prefs.tabVisibility })
  const hasStoredCropToOutline = ref(stored.hasStoredCropToOutline)

  // Auto-save whenever any preference changes
  watch(
    [viewMode, activeFilter, activeMode, cropToOutline, mirrored, presetId, boardRotation, tabVisibility],
    () => {
      save({
        viewMode: viewMode.value,
        activeFilter: activeFilter.value,
        activeMode: activeMode.value,
        cropToOutline: cropToOutline.value,
        mirrored: mirrored.value,
        presetId: presetId.value,
        boardRotation: boardRotation.value,
        tabVisibility: { ...tabVisibility.value },
      })
    },
    { deep: true },
  )

  return {
    viewMode,
    activeFilter,
    activeMode,
    cropToOutline,
    hasStoredCropToOutline,
    mirrored,
    presetId,
    boardRotation,
    tabVisibility,
  }
}
