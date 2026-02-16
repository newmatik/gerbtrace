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
  '.gp3': 'Inner Layer',
  '.gp4': 'Inner Layer',
  '.gp5': 'Inner Layer',
  '.gp6': 'Inner Layer',
  '.gp7': 'Inner Layer',
  '.gp8': 'Inner Layer',
  '.gp9': 'Inner Layer',
  '.gp10': 'Inner Layer',
  '.gp11': 'Inner Layer',
  '.gp12': 'Inner Layer',
  '.gp13': 'Inner Layer',
  '.gp14': 'Inner Layer',
  '.gp15': 'Inner Layer',
  '.gp16': 'Inner Layer',
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
  'PnP Top (THT)': '#7B68EE',
  'PnP Bottom (THT)': '#9370DB',
  'PnP Top + Bot (THT)': '#8A6FDF',
  'BOM': '#4FC3F7',
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
  'PnP Top (THT)',
  'PnP Bottom (THT)',
  'PnP Top + Bot (THT)',
  'BOM',
  'Unmatched',
]

const VALID_LAYER_TYPES = new Set(ALL_LAYER_TYPES)

/**
 * Return a validated layer type for a file.  If the stored `layerType`
 * is a recognised value it is returned as-is; otherwise the type is
 * re-detected from the filename.  This guards against stale or renamed
 * type strings persisted in older DB records.
 */
export function resolveLayerType(fileName: string, storedLayerType?: string | null): string {
  // Re-detect if stored type is missing, unknown, or 'Unmatched' (may have been imported
  // before support for new layer types like BOM was added).
  if (storedLayerType && storedLayerType !== 'Unmatched' && VALID_LAYER_TYPES.has(storedLayerType)) return storedLayerType
  return detectLayerType(fileName)
}

export function getColorForType(type: string): string {
  return LAYER_COLOR_MAP[type] || '#FF80AB'
}

/**
 * Return a version of the layer color darkened enough to be readable on a
 * light background.  Colours whose relative luminance is above the threshold
 * are shifted toward a darker variant of the same hue.
 */
export function getReadableColorForType(type: string, isDark: boolean): string {
  const hex = getColorForType(type)
  if (isDark) return hex

  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  // Relative luminance (sRGB approximation)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  if (luminance <= 0.6) return hex

  // Darken by mixing toward black; stronger for very bright colours
  const factor = 0.45
  const dr = Math.round(r * factor)
  const dg = Math.round(g * factor)
  const db = Math.round(b * factor)

  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`
}

export function detectLayerType(fileName: string): string {
  const lower = fileName.toLowerCase()
  const ext = lower.slice(lower.lastIndexOf('.'))

  // Return immediately for unambiguous extensions (skip 'Unmatched' mapped ones like .gbr)
  const extType = LAYER_TYPE_MAP[ext]
  if (extType && extType !== 'Unmatched') return extType

  // Altium numbered layers not in the static map:
  // .gpN → internal plane (copper), .gmN → mechanical (non-copper, treat as Unmatched)
  if (/^\.gp\d{1,2}$/.test(ext)) return 'Inner Layer'
  if (/^\.gm\d{1,2}$/.test(ext)) return 'Unmatched'

  // Allegro / Cadence naming: CS = Component Side (Top), PS = Print Side (Bottom)
  if (/sm[_\-]cs|soldermask[_\-]cs|mask[_\-]cs/i.test(lower)) return 'Top Solder Mask'
  if (/sm[_\-]ps|soldermask[_\-]ps|mask[_\-]ps/i.test(lower)) return 'Bottom Solder Mask'
  if (/silk[_\-]cs/i.test(lower)) return 'Top Silkscreen'
  if (/silk[_\-]ps/i.test(lower)) return 'Bottom Silkscreen'
  if (/sp[_\-]cs|paste[_\-]cs/i.test(lower)) return 'Top Paste'
  if (/sp[_\-]ps|paste[_\-]ps/i.test(lower)) return 'Bottom Paste'

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
  if (isBomFile(fileName)) return 'BOM'
  if (/inner|internal|mid.*layer|layer.*mid/i.test(lower)) return 'Inner Layer'

  // Generic standalone "top" / "bottom" (e.g. _TOP.art, _BOTTOM.gbr from Allegro)
  if (/[_\-.]top[_\-.]|[_\-]top$/i.test(lower)) return 'Top Copper'
  if (/[_\-.]bot(?:tom)?[_\-.]|[_\-]bot(?:tom)?$/i.test(lower)) return 'Bottom Copper'

  // Inner layer number patterns (e.g. _L2-GND.art, _L3-SIG.art from Allegro)
  if (/[_\-]l\d+[_\-.]/i.test(lower)) return 'Inner Layer'

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
  'PnP Top (THT)': 2.1,
  'PnP Top + Bot (THT)': 2.2,
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
  'PnP Bottom (THT)': 12.1,
  'Outline': 13,
  'Keep-Out': 14,
  'BOM': 14.5,
  'Unmatched': 15,
}

export function getLayerSortOrder(type: string): number {
  return LAYER_SORT_ORDER[type] ?? 99
}

export function sortLayersByPcbOrder(layers: LayerInfo[]): LayerInfo[] {
  return [...layers].sort((a, b) => getLayerSortOrder(a.type) - getLayerSortOrder(b.type))
}

export type LayerFilter = 'all' | 'top' | 'bot'

const TOP_LAYER_TYPES = new Set(['Top Silkscreen', 'Top Paste', 'Top Solder Mask', 'Top Copper', 'PnP Top', 'PnP Top (THT)'])
const BOT_LAYER_TYPES = new Set(['Bottom Silkscreen', 'Bottom Paste', 'Bottom Solder Mask', 'Bottom Copper', 'PnP Bottom', 'PnP Bottom (THT)'])
const SHARED_LAYER_TYPES = new Set(['Outline', 'Keep-Out', 'Drill', 'PnP Top + Bot', 'PnP Top + Bot (THT)'])

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
    '.in1', '.in2', '.in3', '.in4',
    // Protel / Altium / Eagle
    '.cmp', '.sol', '.stc', '.sts', '.plc', '.pls', '.crc', '.crs',
    // Drill
    '.drl', '.drd', '.xln', '.exc', '.ncd',
    // Other
    '.art', '.phd', '.top', '.bot', '.smt', '.smb',
  ]
  if (gerberExts.includes(ext)) return true

  // Altium numbered layers: .gm1-.gm32 (mechanical), .gp1-.gp16 (internal plane)
  if (/^\.(gm\d{1,2}|gp\d{1,2})$/.test(ext)) return true

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

/** Check if a layer type is a Pick & Place layer (SMD or THT) */
export function isPnPLayer(type: string): boolean {
  return type === 'PnP Top' || type === 'PnP Bottom' || type === 'PnP Top + Bot'
    || type === 'PnP Top (THT)' || type === 'PnP Bottom (THT)' || type === 'PnP Top + Bot (THT)'
}

/** Check if a layer type is a SMD PnP layer */
export function isSmdPnPLayer(type: string): boolean {
  return type === 'PnP Top' || type === 'PnP Bottom' || type === 'PnP Top + Bot'
}

/** Check if a layer type is a THT PnP layer */
export function isThtPnPLayer(type: string): boolean {
  return type === 'PnP Top (THT)' || type === 'PnP Bottom (THT)' || type === 'PnP Top + Bot (THT)'
}

// ── BOM file detection ──

const BOM_EXTENSIONS = new Set(['.csv', '.tsv', '.xlsx', '.xls', '.txt'])
const BOM_NAME_PATTERNS = /(?:bom|bill[_\-\s]?of[_\-\s]?materials?|stückliste|stueckliste)/i

/** Detect whether a file is a BOM file based on its name. */
export function isBomFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  const ext = lower.slice(lower.lastIndexOf('.'))
  if (!BOM_EXTENSIONS.has(ext)) return false
  return BOM_NAME_PATTERNS.test(lower)
}

/** Check if a layer type is a BOM layer */
export function isBomLayer(type: string): boolean {
  return type === 'BOM'
}

/** Check if a file is importable (Gerber, PnP, or BOM) */
export function isImportableFile(fileName: string): boolean {
  return isGerberFile(fileName) || isPnPFile(fileName) || isBomFile(fileName)
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

export type LayerGroupKey = 'gerber' | 'drill' | 'pnp' | 'bom' | 'docs' | 'unknown'

export function getLayerGroup(type: string, fileName?: string): LayerGroupKey {
  if (type === 'Drill') return 'drill'
  if (isPnPLayer(type)) return 'pnp'
  if (isBomLayer(type) || (fileName && isBomFile(fileName))) return 'bom'
  if (type === 'Unmatched') return 'unknown'
  return 'gerber'
}

/** Whether a layer type represents a non-renderable file (BOM or document) */
export function isNonRenderableLayer(type: string): boolean {
  return isBomLayer(type)
}

export const LAYER_GROUP_LABELS: Record<LayerGroupKey, string> = {
  gerber: 'Gerber Files',
  drill: 'Drill Files',
  pnp: 'Pick and Place',
  bom: 'Bill of Materials',
  docs: 'Documents',
  unknown: 'Unknown',
}

export const LAYER_GROUP_ORDER: LayerGroupKey[] = ['gerber', 'drill', 'pnp', 'bom', 'docs', 'unknown']
