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
  'PnP Top': '#FF69B4',
  'PnP Bottom': '#DDA0DD',
}

/** All assignable layer types in PCB stack order */
export const ALL_LAYER_TYPES: string[] = [
  'Drill',
  'PnP Top',
  'Top Silkscreen',
  'Top Paste',
  'Top Solder Mask',
  'Top Copper',
  'Bottom Copper',
  'Bottom Solder Mask',
  'Bottom Paste',
  'Bottom Silkscreen',
  'PnP Bottom',
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

  // Return immediately for unambiguous extensions (skip 'Unknown' mapped ones like .gbr)
  const extType = LAYER_TYPE_MAP[ext]
  if (extType && extType !== 'Unknown') return extType

  // Try filename-based keyword matching (works for descriptive names like copper_top.gbr)
  if (/top.*copper|copper.*top|f\.cu/i.test(lower)) return 'Top Copper'
  if (/bottom.*copper|copper.*bottom|b\.cu/i.test(lower)) return 'Bottom Copper'
  if (/top.*mask|mask.*top|soldermask.*top|top.*soldermask/i.test(lower)) return 'Top Solder Mask'
  if (/bottom.*mask|mask.*bottom|soldermask.*bottom|bottom.*soldermask/i.test(lower)) return 'Bottom Solder Mask'
  if (/top.*silk|silk.*top/i.test(lower)) return 'Top Silkscreen'
  if (/bottom.*silk|silk.*bottom/i.test(lower)) return 'Bottom Silkscreen'
  if (/top.*paste|paste.*top|solderpaste.*top|top.*solderpaste/i.test(lower)) return 'Top Paste'
  if (/bottom.*paste|paste.*bottom|solderpaste.*bottom|bottom.*solderpaste/i.test(lower)) return 'Bottom Paste'
  if (/outline|edge|board|profile|contour/i.test(lower)) return 'Outline'
  if (/drill|drl/i.test(lower)) return 'Drill'

  // Fall back to extension-based type (e.g. 'Unknown' for .gbr/.ger/.pho/.art)
  if (extType) return extType

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
  'PnP Top': 1,
  'Top Silkscreen': 2,
  'Top Paste': 3,
  'Top Solder Mask': 4,
  'Top Copper': 5,
  'Bottom Copper': 6,
  'Bottom Solder Mask': 7,
  'Bottom Paste': 8,
  'Bottom Silkscreen': 9,
  'PnP Bottom': 10,
  'Outline': 11,
  'Keep-Out': 12,
  'Unknown': 13,
}

export function getLayerSortOrder(type: string): number {
  return LAYER_SORT_ORDER[type] ?? 99
}

export function sortLayersByPcbOrder(layers: LayerInfo[]): LayerInfo[] {
  return [...layers].sort((a, b) => getLayerSortOrder(a.type) - getLayerSortOrder(b.type))
}

export type LayerFilter = 'all' | 'top' | 'bot'

const TOP_LAYER_TYPES = new Set(['Top Silkscreen', 'Top Paste', 'Top Solder Mask', 'Top Copper', 'PnP Top'])
const BOT_LAYER_TYPES = new Set(['Bottom Silkscreen', 'Bottom Paste', 'Bottom Solder Mask', 'Bottom Copper', 'PnP Bottom'])
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
  if (lower.endsWith('.gbrjob')) return false
  if (lower === 'license' || lower === 'readme') return false
  // Skip macOS resource fork files (._filename)
  if (fileName.startsWith('._')) return false

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

// ── Pick & Place file detection ──

const PNP_EXTENSIONS = new Set(['.txt', '.csv', '.xy', '.pos'])
const PNP_NAME_PATTERNS = /(?:pnp|pick[_\-\s]?(?:and[_\-\s]?)?place|pos(?:ition)?|centroid|cpl)/i

/**
 * Detect whether a file is a Pick & Place file based on its name.
 * PnP files are typically .txt/.csv/.xy/.pos with keywords like "pnp", "pos", "pick" in the name.
 */
export function isPnPFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  const ext = lower.slice(lower.lastIndexOf('.'))
  if (!PNP_EXTENSIONS.has(ext)) return false
  return PNP_NAME_PATTERNS.test(lower)
}

/**
 * Detect which PCB side a PnP file belongs to from its filename.
 * Defaults to 'top' if no side indicator is found.
 */
export function detectPnPSide(fileName: string): 'PnP Top' | 'PnP Bottom' {
  const lower = fileName.toLowerCase()
  if (/bot(tom)?/i.test(lower)) return 'PnP Bottom'
  return 'PnP Top'
}

/** Check if a layer type is a Pick & Place layer */
export function isPnPLayer(type: string): boolean {
  return type === 'PnP Top' || type === 'PnP Bottom'
}

/** Check if a file is importable (Gerber or PnP) */
export function isImportableFile(fileName: string): boolean {
  return isGerberFile(fileName) || isPnPFile(fileName)
}
