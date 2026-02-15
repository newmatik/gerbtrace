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
  '.gm7': 'Outline',
  '.gm': 'Outline',
  '.gko': 'Keep-Out',
  // Altium drawing / guide layers (Gerber-format, generic)
  '.gd1': 'Unmatched',
  '.gd2': 'Unmatched',
  '.gg1': 'Unmatched',
  '.gg2': 'Unmatched',
  // Inner / mid layers (Altium, KiCad, Protel)
  '.g1': 'Inner Layer',
  '.g2': 'Inner Layer',
  '.g3': 'Inner Layer',
  '.g4': 'Inner Layer',
  '.gp1': 'Inner Layer',
  '.gp2': 'Inner Layer',
  '.in1': 'Inner Layer',
  '.in2': 'Inner Layer',
  '.in3': 'Inner Layer',
  '.in4': 'Inner Layer',
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
  '.gbr': 'Unmatched',
  '.ger': 'Unmatched',
  '.pho': 'Unmatched',
  '.art': 'Unmatched',
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
  'Inner Layer': '#536DFE',
  'Drill': '#00E676',
  'PnP Top': '#FF69B4',
  'PnP Bottom': '#DDA0DD',
  'PnP Top + Bot': '#FF85C8',
  'Unmatched': '#666666',
}

/** All assignable layer types (PnP types grouped together) */
export const ALL_LAYER_TYPES: string[] = [
  'Drill',
  'Top Silkscreen',
  'Top Paste',
  'Top Solder Mask',
  'Top Copper',
  'Inner Layer',
  'Bottom Copper',
  'Bottom Solder Mask',
  'Bottom Paste',
  'Bottom Silkscreen',
  'Outline',
  'Keep-Out',
  'PnP Top',
  'PnP Bottom',
  'PnP Top + Bot',
  'Unmatched',
]

export function getColorForType(type: string): string {
  return LAYER_COLOR_MAP[type] || '#FF80AB'
}

export function detectLayerType(fileName: string): string {
  const lower = fileName.toLowerCase()
  const ext = lower.slice(lower.lastIndexOf('.'))

  // Return immediately for unambiguous extensions (skip 'Unmatched' mapped ones like .gbr)
  const extType = LAYER_TYPE_MAP[ext]
  if (extType && extType !== 'Unmatched') return extType

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
  if (/drill|drl|holes/i.test(lower)) return 'Drill'
  if (/inner|internal|mid.*layer|layer.*mid/i.test(lower)) return 'Inner Layer'

  // Fall back to extension-based type (e.g. 'Unmatched' for .gbr/.ger/.pho/.art)
  if (extType) return extType

  return 'Unmatched'
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
  'PnP Top + Bot': 2,
  'Top Silkscreen': 3,
  'Top Paste': 4,
  'Top Solder Mask': 5,
  'Top Copper': 6,
  'Inner Layer': 7,
  'Bottom Copper': 8,
  'Bottom Solder Mask': 9,
  'Bottom Paste': 10,
  'Bottom Silkscreen': 11,
  'PnP Bottom': 12,
  'Outline': 13,
  'Keep-Out': 14,
  'Unmatched': 15,
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
const SHARED_LAYER_TYPES = new Set(['Outline', 'Keep-Out', 'Drill', 'PnP Top + Bot'])

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
  if (lower.endsWith('.json') || lower.endsWith('.md') || lower.endsWith('.csv')) return false
  if (lower.endsWith('.gbrjob')) return false
  if (lower === 'license' || lower === 'readme') return false
  // Skip macOS resource fork files (._filename)
  if (fileName.startsWith('._')) return false

  const ext = lower.slice(lower.lastIndexOf('.'))
  const gerberExts = [
    // KiCad / modern
    '.gtl', '.gbl', '.gts', '.gbs', '.gto', '.gbo', '.gtp', '.gbp',
    '.gm1', '.gm2', '.gm3', '.gm7', '.gm', '.gko', '.gbr', '.ger', '.pho',
    // Altium drawing / guide / inner layers
    '.gd1', '.gd2', '.gg1', '.gg2',
    '.g1', '.g2', '.g3', '.g4',
    '.gp1', '.gp2',
    '.in1', '.in2', '.in3', '.in4',
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

  // .txt files with drill-related keywords (e.g. RoundHoles.TXT, SlotHoles.TXT)
  if (ext === '.txt' && /holes|drill/i.test(lower)) return true

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
  return type === 'PnP Top' || type === 'PnP Bottom' || type === 'PnP Top + Bot'
}

/** Check if a file is importable (Gerber or PnP) */
export function isImportableFile(fileName: string): boolean {
  return isGerberFile(fileName) || isPnPFile(fileName)
}

/**
 * Content-sniff for extensionless Gerber or Excellon drill files.
 * Returns `'gerber'` for RS-274X, `'drill'` for Excellon, or `null` if unrecognised.
 * Some CAM tools export extensionless files (e.g. "l1", "m2", "drl") inside ZIPs.
 */
export function sniffContentType(content: string): 'gerber' | 'drill' | null {
  const head = content.slice(0, 512)
  // RS-274X format specification (%FSLAX24Y24*% etc.) — mandatory in every Gerber file
  if (/%FS[LT][AI]X\d+Y\d+/.test(head)) return 'gerber'
  // Unit mode (%MOIN*% / %MOMM*%)
  if (/%MO(IN|MM)\*%/.test(head)) return 'gerber'
  // G04 comment — very common Gerber opening line
  if (/^G04\s/m.test(head)) return 'gerber'
  // Excellon header start (M48) — mandatory in every Excellon drill file
  if (/^M48\b/m.test(head)) return 'drill'
  // Excellon end-of-header (M95) or tool definitions (T01C0.025 etc.)
  if (/^M95\b/m.test(head)) return 'drill'
  if (/^T\d+C[\d.]+/m.test(head)) return 'drill'
  return null
}

// ── Layer grouping ──

export type LayerGroupKey = 'gerber' | 'drill' | 'pnp' | 'unknown'

export function getLayerGroup(type: string): LayerGroupKey {
  if (type === 'Drill') return 'drill'
  if (type === 'PnP Top' || type === 'PnP Bottom' || type === 'PnP Top + Bot') return 'pnp'
  if (type === 'Unmatched') return 'unknown'
  return 'gerber'
}

export const LAYER_GROUP_LABELS: Record<LayerGroupKey, string> = {
  gerber: 'Gerber Files',
  drill: 'Drill Files',
  pnp: 'Pick and Place',
  unknown: 'Unknown',
}

export const LAYER_GROUP_ORDER: LayerGroupKey[] = ['gerber', 'drill', 'pnp', 'unknown']
