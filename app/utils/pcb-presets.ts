/**
 * PCB appearance presets for realistic rendering.
 *
 * Each preset defines the colors for solder mask, silkscreen,
 * surface finish (exposed pads), substrate (FR4), and copper.
 */

export interface PcbPreset {
  id: string
  name: string
  /** Solder mask color (e.g. green, black, blue) */
  solderMask: string
  /** Solder mask opacity over copper (0–1). Allows copper texture to show through. */
  solderMaskOpacity: number
  /** Silkscreen ink color */
  silkscreen: string
  /** Surface finish color for exposed pads (ENIG gold, HAL silver, OSP copper) */
  surfaceFinish: string
  /** FR4 substrate / base board color */
  substrate: string
  /** Bare copper color (visible under semi-transparent mask) */
  copper: string
}

export type SolderMaskColor = 'green' | 'black' | 'blue' | 'red' | 'white' | 'purple'

export const SOLDER_MASK_COLOR_OPTIONS: { value: SolderMaskColor; label: string }[] = [
  { value: 'green', label: 'Green' },
  { value: 'black', label: 'Black' },
  { value: 'blue', label: 'Blue' },
  { value: 'red', label: 'Red' },
  { value: 'white', label: 'White' },
  { value: 'purple', label: 'Purple' },
]

export const PCB_PRESETS: PcbPreset[] = [
  {
    id: 'green-enig',
    name: 'Green ENIG',
    solderMask: '#146b3a',
    solderMaskOpacity: 0.85,
    silkscreen: '#ffffff',
    surfaceFinish: '#c5b358',
    substrate: '#c2a366',
    copper: '#b87333',
  },
  {
    id: 'green-hasl',
    name: 'Green HASL',
    solderMask: '#146b3a',
    solderMaskOpacity: 0.85,
    silkscreen: '#ffffff',
    surfaceFinish: '#c0c0c0',
    substrate: '#c2a366',
    copper: '#b87333',
  },
  {
    id: 'black-hasl',
    name: 'Black HASL',
    solderMask: '#1a1a1a',
    solderMaskOpacity: 0.92,
    silkscreen: '#ffffff',
    surfaceFinish: '#c0c0c0',
    substrate: '#c2a366',
    copper: '#b87333',
  },
  {
    id: 'black-enig',
    name: 'Black ENIG',
    solderMask: '#1a1a1a',
    solderMaskOpacity: 0.92,
    silkscreen: '#ffffff',
    surfaceFinish: '#c5b358',
    substrate: '#c2a366',
    copper: '#b87333',
  },
  {
    id: 'blue-enig',
    name: 'Blue ENIG',
    solderMask: '#1a3a6b',
    solderMaskOpacity: 0.88,
    silkscreen: '#ffffff',
    surfaceFinish: '#c5b358',
    substrate: '#c2a366',
    copper: '#b87333',
  },
  {
    id: 'blue-hasl',
    name: 'Blue HASL',
    solderMask: '#1a3a6b',
    solderMaskOpacity: 0.88,
    silkscreen: '#ffffff',
    surfaceFinish: '#c0c0c0',
    substrate: '#c2a366',
    copper: '#b87333',
  },
  {
    id: 'red-enig',
    name: 'Red ENIG',
    solderMask: '#8b1a1a',
    solderMaskOpacity: 0.88,
    silkscreen: '#ffffff',
    surfaceFinish: '#c5b358',
    substrate: '#c2a366',
    copper: '#b87333',
  },
  {
    id: 'red-hasl',
    name: 'Red HASL',
    solderMask: '#8b1a1a',
    solderMaskOpacity: 0.88,
    silkscreen: '#ffffff',
    surfaceFinish: '#c0c0c0',
    substrate: '#c2a366',
    copper: '#b87333',
  },
  {
    id: 'white-enig',
    name: 'White ENIG',
    solderMask: '#e8e8e8',
    solderMaskOpacity: 0.90,
    silkscreen: '#1a1a1a',
    surfaceFinish: '#c5b358',
    substrate: '#c2a366',
    copper: '#b87333',
  },
  {
    id: 'white-hasl',
    name: 'White HASL',
    solderMask: '#e8e8e8',
    solderMaskOpacity: 0.90,
    silkscreen: '#1a1a1a',
    surfaceFinish: '#c0c0c0',
    substrate: '#c2a366',
    copper: '#b87333',
  },
  {
    id: 'purple-enig',
    name: 'Purple ENIG',
    solderMask: '#4a1a6b',
    solderMaskOpacity: 0.88,
    silkscreen: '#ffffff',
    surfaceFinish: '#c5b358',
    substrate: '#c2a366',
    copper: '#b87333',
  },
  {
    id: 'purple-hasl',
    name: 'Purple HASL',
    solderMask: '#4a1a6b',
    solderMaskOpacity: 0.88,
    silkscreen: '#ffffff',
    surfaceFinish: '#c0c0c0',
    substrate: '#c2a366',
    copper: '#b87333',
  },
  {
    id: 'green-osp',
    name: 'Green OSP',
    solderMask: '#146b3a',
    solderMaskOpacity: 0.85,
    silkscreen: '#ffffff',
    surfaceFinish: '#b87333',
    substrate: '#c2a366',
    copper: '#b87333',
  },
]

export const DEFAULT_PRESET_ID = 'green-enig'

export function getPresetById(id: string): PcbPreset {
  return PCB_PRESETS.find(p => p.id === id) ?? PCB_PRESETS[0]!
}

const PRESET_ID_BY_APPEARANCE: Record<string, string> = {
  'green:ENIG': 'green-enig',
  'green:HAL': 'green-hasl',
  'black:ENIG': 'black-enig',
  'black:HAL': 'black-hasl',
  'blue:ENIG': 'blue-enig',
  'blue:HAL': 'blue-hasl',
  'red:ENIG': 'red-enig',
  'red:HAL': 'red-hasl',
  'white:ENIG': 'white-enig',
  'white:HAL': 'white-hasl',
  'purple:ENIG': 'purple-enig',
  'purple:HAL': 'purple-hasl',
}

export function getPresetForAppearance(
  surfaceFinish?: 'ENIG' | 'HAL',
  solderMaskColor?: SolderMaskColor,
): PcbPreset {
  const finish = surfaceFinish === 'HAL' ? 'HAL' : 'ENIG'
  const mask = solderMaskColor ?? 'green'
  const id = PRESET_ID_BY_APPEARANCE[`${mask}:${finish}`] ?? DEFAULT_PRESET_ID
  return getPresetById(id)
}
