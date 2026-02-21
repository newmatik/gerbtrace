/**
 * Per-project viewer preferences persisted to localStorage.
 *
 * Follows the same pattern as useSidebarWidth (load on init, auto-save on change).
 */

import type { PasteSettings, PasteMode, DotPattern } from './usePasteSettings'
import { PASTE_DEFAULTS } from './usePasteSettings'

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
  activeMode: 'cursor' | 'measure' | 'info' | 'delete' | 'draw'
  cropToOutline: boolean
  mirrored: boolean
  presetId: string
  boardRotation: number
  tabVisibility: TabVisibility
  pasteSettings: PasteSettings
  pnpUnitOverride: 'auto' | 'mm' | 'mils' | 'inches'
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
  pasteSettings: { ...PASTE_DEFAULTS },
  pnpUnitOverride: 'auto',
}

const VALID_PASTE_MODES: PasteMode[] = ['stencil', 'jetprint']
const VALID_DOT_PATTERNS: DotPattern[] = ['grid', 'hex']

function loadPasteSettings(raw: unknown): PasteSettings {
  if (!raw || typeof raw !== 'object') return { ...PASTE_DEFAULTS }
  const p = raw as Record<string, unknown>
  return {
    mode: VALID_PASTE_MODES.includes(p.mode as PasteMode) ? p.mode as PasteMode : PASTE_DEFAULTS.mode,
    dotDiameter: typeof p.dotDiameter === 'number' && isFinite(p.dotDiameter) ? p.dotDiameter : PASTE_DEFAULTS.dotDiameter,
    dotSpacing: typeof p.dotSpacing === 'number' && isFinite(p.dotSpacing) ? p.dotSpacing : PASTE_DEFAULTS.dotSpacing,
    pattern: VALID_DOT_PATTERNS.includes(p.pattern as DotPattern) ? p.pattern as DotPattern : PASTE_DEFAULTS.pattern,
    highlightDots: typeof p.highlightDots === 'boolean' ? p.highlightDots : PASTE_DEFAULTS.highlightDots,
    dynamicDots: typeof p.dynamicDots === 'boolean' ? p.dynamicDots : PASTE_DEFAULTS.dynamicDots,
    showJetPath: typeof p.showJetPath === 'boolean' ? p.showJetPath : PASTE_DEFAULTS.showJetPath,
  }
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
          activeMode: ['cursor', 'measure', 'info', 'delete', 'draw'].includes(p.activeMode) ? p.activeMode : DEFAULTS.activeMode,
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
          pasteSettings: loadPasteSettings(p.pasteSettings),
          pnpUnitOverride: ['auto', 'mm', 'mils', 'inches'].includes(p.pnpUnitOverride)
            ? p.pnpUnitOverride
            : DEFAULTS.pnpUnitOverride,
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
  const pasteSettings = ref<PasteSettings>({ ...stored.prefs.pasteSettings })
  const pnpUnitOverride = ref<ViewerPrefs['pnpUnitOverride']>(stored.prefs.pnpUnitOverride)

  // Auto-save whenever any preference changes
  watch(
    [viewMode, activeFilter, activeMode, cropToOutline, mirrored, presetId, boardRotation, tabVisibility, pasteSettings, pnpUnitOverride],
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
        pasteSettings: { ...pasteSettings.value },
        pnpUnitOverride: pnpUnitOverride.value,
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
    pasteSettings,
    pnpUnitOverride,
  }
}
