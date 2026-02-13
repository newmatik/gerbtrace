export interface GerberFile {
  fileName: string
  content: string
  /** User-overridden layer type, persisted to DB. If absent, auto-detect. */
  layerType?: string
}

export interface LayerInfo {
  file: GerberFile
  visible: boolean
  color: string
  type: string
}

export interface LayerMatch {
  fileA: GerberFile
  fileB: GerberFile | null
  identical: boolean
  type: string
}

const LAYER_TYPE_MAP: Record<string, string> = {
  // KiCad / modern naming
  '.gtl': 'Top Copper',
  '.gbl': 'Bottom Copper',
  '.gts': 'Top Solder Mask',
  '.gbs': 'Bottom Solder Mask',
  '.gto': 'Top Silkscreen',
  '.gbo': 'Bottom Silkscreen',
  '.gtp': 'Top Paste',
  '.gbp': 'Bottom Paste',
  '.gm1': 'Outline',
  '.gm2': 'Outline',
  '.gm3': 'Outline',
  '.gko': 'Keep-Out',
  // Protel / Altium / Eagle naming
  '.cmp': 'Top Copper',
  '.sol': 'Bottom Copper',
  '.stc': 'Top Solder Mask',
  '.sts': 'Bottom Solder Mask',
  '.plc': 'Top Silkscreen',
  '.pls': 'Bottom Silkscreen',
  '.crc': 'Top Paste',
  '.crs': 'Bottom Paste',
  // Drill files
  '.drl': 'Drill',
  '.drd': 'Drill',
  '.xln': 'Drill',
  '.exc': 'Drill',
  '.ncd': 'Drill',
  // Generic Gerber
  '.gbr': 'Unknown',
  '.ger': 'Unknown',
  '.pho': 'Unknown',
  '.art': 'Unknown',
}

const LAYER_COLOR_MAP: Record<string, string> = {
  'Top Copper': '#FF4444',
  'Bottom Copper': '#448AFF',
  'Top Solder Mask': '#B388FF',
  'Bottom Solder Mask': '#EA80FC',
  'Top Silkscreen': '#FFFFFF',
  'Bottom Silkscreen': '#BFFF00',
  'Top Paste': '#FFD700',
  'Bottom Paste': '#FFA500',
  'Outline': '#00FFCC',
  'Keep-Out': '#FF6B35',
  'Drill': '#00E676',
}

/** All assignable layer types in PCB stack order */
export const ALL_LAYER_TYPES: string[] = [
  'Drill',
  'Top Silkscreen',
  'Top Paste',
  'Top Solder Mask',
  'Top Copper',
  'Bottom Copper',
  'Bottom Solder Mask',
  'Bottom Paste',
  'Bottom Silkscreen',
  'Outline',
  'Keep-Out',
  'Unknown',
]

export function getColorForType(type: string): string {
  return LAYER_COLOR_MAP[type] || '#FF80AB'
}

export function detectLayerType(fileName: string): string {
  const lower = fileName.toLowerCase()
  const ext = lower.slice(lower.lastIndexOf('.'))
  if (LAYER_TYPE_MAP[ext]) return LAYER_TYPE_MAP[ext]

  // Try content-based keywords
  if (/top.*copper|copper.*top|f\.cu/i.test(lower)) return 'Top Copper'
  if (/bottom.*copper|copper.*bottom|b\.cu/i.test(lower)) return 'Bottom Copper'
  if (/top.*mask|mask.*top/i.test(lower)) return 'Top Solder Mask'
  if (/bottom.*mask|mask.*bottom/i.test(lower)) return 'Bottom Solder Mask'
  if (/top.*silk|silk.*top/i.test(lower)) return 'Top Silkscreen'
  if (/bottom.*silk|silk.*bottom/i.test(lower)) return 'Bottom Silkscreen'
  if (/outline|edge|board/i.test(lower)) return 'Outline'
  if (/drill|drl/i.test(lower)) return 'Drill'

  return 'Unknown'
}

export function getDefaultLayerColor(fileName: string): string {
  const type = detectLayerType(fileName)
  return LAYER_COLOR_MAP[type] || '#FF80AB'
}

/**
 * Sort priority for PCB layer stack (top-to-bottom as viewed from above).
 * Lower number = higher in the stack = rendered on top.
 */
const LAYER_SORT_ORDER: Record<string, number> = {
  'Drill': 0,
  'Top Silkscreen': 1,
  'Top Paste': 2,
  'Top Solder Mask': 3,
  'Top Copper': 4,
  'Bottom Copper': 5,
  'Bottom Solder Mask': 6,
  'Bottom Paste': 7,
  'Bottom Silkscreen': 8,
  'Outline': 9,
  'Keep-Out': 10,
  'Unknown': 11,
}

export function getLayerSortOrder(type: string): number {
  return LAYER_SORT_ORDER[type] ?? 99
}

export function sortLayersByPcbOrder(layers: LayerInfo[]): LayerInfo[] {
  return [...layers].sort((a, b) => getLayerSortOrder(a.type) - getLayerSortOrder(b.type))
}

export type LayerFilter = 'all' | 'top' | 'bot'

const TOP_LAYER_TYPES = new Set(['Top Silkscreen', 'Top Paste', 'Top Solder Mask', 'Top Copper'])
const BOT_LAYER_TYPES = new Set(['Bottom Silkscreen', 'Bottom Paste', 'Bottom Solder Mask', 'Bottom Copper'])
const SHARED_LAYER_TYPES = new Set(['Outline', 'Keep-Out', 'Drill'])

export function isTopLayer(type: string): boolean {
  return TOP_LAYER_TYPES.has(type)
}

export function isBottomLayer(type: string): boolean {
  return BOT_LAYER_TYPES.has(type)
}

export function isSharedLayer(type: string): boolean {
  return SHARED_LAYER_TYPES.has(type)
}

export function normalizeLayerName(fileName: string): string {
  return fileName
    .toLowerCase()
    .replace(/[_\-\s]+/g, '')
    .replace(/rev\d+[a-z]*/gi, '')
    .replace(/v\d+/gi, '')
    .replace(/\(\d+\)/g, '')
    .trim()
}

export function isGerberFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  // Skip common non-gerber files
  if (lower.endsWith('.json') || lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.csv')) return false
  if (lower === 'license' || lower === 'readme') return false

  const ext = lower.slice(lower.lastIndexOf('.'))
  const gerberExts = [
    // KiCad / modern
    '.gtl', '.gbl', '.gts', '.gbs', '.gto', '.gbo', '.gtp', '.gbp',
    '.gm1', '.gm2', '.gm3', '.gko', '.gbr', '.ger', '.pho',
    // Protel / Altium / Eagle
    '.cmp', '.sol', '.stc', '.sts', '.plc', '.pls', '.crc', '.crs',
    // Drill
    '.drl', '.drd', '.xln', '.exc', '.ncd',
    // Other
    '.art', '.phd', '.top', '.bot', '.smt', '.smb',
  ]
  if (gerberExts.includes(ext)) return true

  // Check if the file has no standard extension but named 'drills' etc.
  if (/^(drill|drills|outline)$/i.test(fileName)) return true

  return false
}
