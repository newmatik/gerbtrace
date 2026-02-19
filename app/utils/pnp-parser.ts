/**
 * Pick & Place (PnP) file parser.
 *
 * Supports tab-delimited, comma-delimited, and semicolon-delimited formats.
 * Expected columns: Designator, X (mm), Y (mm), Rotation (deg), Value, Package
 *
 * Auto-detects delimiter from content (tab → semicolon → comma).
 * Handles European decimal format (comma as decimal separator) when semicolons
 * are used as field delimiter. Handles optional header rows, empty value fields,
 * and trailing blank lines.
 */
import * as XLSX from 'xlsx'

export interface PnPComponent {
  /** Component reference designator (e.g. "C1", "U3", "R5") */
  designator: string
  /** Center X coordinate in mm */
  x: number
  /** Center Y coordinate in mm */
  y: number
  /** Rotation in degrees */
  rotation: number
  /** Component value (e.g. "100n", "10K") — may be empty */
  value: string
  /** Package / footprint name (e.g. "C0603-ROUND", "SOT-23") */
  package: string
  /** Side the component belongs to */
  side: 'top' | 'bottom'
}

export type PnPCoordUnit = 'mm' | 'mils' | 'inches'

export interface PnPColumnMapping {
  designator?: number
  x?: number
  y?: number
  rotation?: number
  value?: number
  package?: number
  side?: number
}

export interface ParsePnPOptions {
  unitOverride?: PnPCoordUnit
  skipRows?: number
  mapping?: PnPColumnMapping
}

type Delimiter = '\t' | ',' | ';'

function isExcelFileName(fileName?: string): boolean {
  return !!fileName && /\.(xlsx|xls)$/i.test(fileName)
}

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer | null {
  const match = dataUrl.match(/^data:.*;base64,(.+)$/i)
  if (!match?.[1]) return null
  try {
    const binary = atob(match[1])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes.buffer
  } catch {
    return null
  }
}

function excelContentToText(content: string): string {
  let wb: XLSX.WorkBook | null = null
  if (/^data:.*;base64,/i.test(content)) {
    const buffer = dataUrlToArrayBuffer(content)
    if (buffer) wb = XLSX.read(buffer, { type: 'array' })
  } else {
    try {
      wb = XLSX.read(content, { type: 'binary' })
    } catch {
      wb = null
    }
  }
  if (!wb) return content
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return ''
  const sheet = wb.Sheets[sheetName]
  if (!sheet) return ''
  return XLSX.utils.sheet_to_csv(sheet, { FS: '\t', RS: '\n' })
}

/**
 * Detect delimiter from content: tab first, then semicolon, then comma.
 * Semicolons are checked before commas because European CSV files use
 * semicolons as field delimiters and commas as decimal separators.
 */
function detectDelimiter(content: string): Delimiter {
  const firstLines = content.split('\n').slice(0, 5)
  for (const line of firstLines) {
    if (line.includes('\t')) return '\t'
  }
  for (const line of firstLines) {
    if (line.includes(';')) return ';'
  }
  return ','
}

/**
 * Parse a single CSV/TSV line into fields, respecting quoted fields that may
 * contain the delimiter character (e.g. commas inside double-quoted strings).
 */
function splitLine(line: string, delimiter: Delimiter): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote ("") inside a quoted field
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++ // skip next quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

type ColumnKey = keyof PnPColumnMapping

function normaliseHeaderName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

interface HeaderMapResult {
  map: PnPColumnMapping
  /** Scale factor to convert X/Y coordinates to mm (1 = already mm) */
  coordScale: number
}

/**
 * Detect coordinate unit from a raw header name like "X mil", "X (inch)", "X mm".
 * Returns a scale factor to convert to mm.
 */
function detectCoordUnit(rawHeader: string): number {
  if (/\bmils?\b|\bthous?\b/i.test(rawHeader)) return 0.0254
  if (/\bin(?:ch(?:es)?)?\b/i.test(rawHeader)) return 25.4
  return 1
}

function getCoordScale(unit: PnPCoordUnit | undefined): number {
  if (unit === 'mils') return 0.0254
  if (unit === 'inches') return 25.4
  return 1
}

function buildHeaderMap(fields: string[], unitOverride?: PnPCoordUnit): HeaderMapResult {
  const map: Partial<Record<ColumnKey, number>> = {}
  let coordScale = getCoordScale(unitOverride)
  for (let i = 0; i < fields.length; i++) {
    const raw = fields[i] || ''
    const h = normaliseHeaderName(raw)

    if (!map.designator && /^(refdes(ignator)?|ref|designator|reference|name|component|part)$/.test(h)) map.designator = i
    else if (!map.x && /^(posx|x|centerx|midx|cx)/.test(h)) {
      map.x = i
      if (!unitOverride) coordScale = detectCoordUnit(raw)
    }
    else if (!map.y && /^(posy|y|centery|midy|cy)/.test(h)) map.y = i
    else if (!map.rotation && /^(rot|rotation|angle|deg)/.test(h)) map.rotation = i
    else if (!map.value && /value|^val$|^comment$/.test(h)) map.value = i
    else if (!map.package && /package|footprint|^pkg$/.test(h)) map.package = i
    else if (!map.side && /^(side|layer|tb)$/.test(h)) map.side = i
  }
  return { map, coordScale }
}

function getField(fields: string[], idx: number | undefined): string {
  if (idx == null || idx < 0 || idx >= fields.length) return ''
  return fields[idx] ?? ''
}

export interface PnPParsePreview {
  delimiter: Delimiter
  headers: string[]
  rows: string[][]
  mapping: PnPColumnMapping | null
  headerRowIndex: number | null
  coordScale: number
}

function countMappedColumns(map: PnPColumnMapping): number {
  let count = 0
  if (map.designator != null) count++
  if (map.x != null) count++
  if (map.y != null) count++
  if (map.rotation != null) count++
  if (map.value != null) count++
  if (map.package != null) count++
  if (map.side != null) count++
  return count
}

export function parsePnPPreview(content: string, options?: ParsePnPOptions, fileName?: string): PnPParsePreview {
  const normalizedContent = isExcelFileName(fileName) ? excelContentToText(content) : content
  const lines = normalizedContent.split(/\r?\n/)
  const delimiter = detectDelimiter(normalizedContent)
  const skipRows = Math.max(0, options?.skipRows ?? 0)
  const unitOverride = options?.unitOverride
  const manualMapping = options?.mapping

  const dataLines = lines.slice(skipRows).filter(line => line.trim() !== '')
  const tableRows = dataLines.map(line => splitLine(line, delimiter))

  if (tableRows.length === 0) {
    return {
      delimiter,
      headers: [],
      rows: [],
      mapping: null,
      headerRowIndex: null,
      coordScale: getCoordScale(unitOverride),
    }
  }

  if (manualMapping) {
    const headers = tableRows[0] || []
    return {
      delimiter,
      headers,
      rows: tableRows.slice(1),
      mapping: { ...manualMapping },
      headerRowIndex: 0,
      coordScale: getCoordScale(unitOverride),
    }
  }

  let bestHeaderIdx: number | null = null
  let bestMap: PnPColumnMapping | null = null
  let bestScore = -1
  let bestCoordScale = getCoordScale(unitOverride)
  const scanLimit = Math.min(tableRows.length, 30)

  for (let i = 0; i < scanLimit; i++) {
    const fields = tableRows[i] || []
    const result = buildHeaderMap(fields, unitOverride)
    const requiredFound = result.map.designator != null && result.map.x != null && result.map.y != null && result.map.rotation != null
    if (!requiredFound) continue
    const score = countMappedColumns(result.map)
    if (score > bestScore) {
      bestScore = score
      bestHeaderIdx = i
      bestMap = result.map
      bestCoordScale = result.coordScale
    }
  }

  if (bestHeaderIdx != null && bestMap) {
    return {
      delimiter,
      headers: tableRows[bestHeaderIdx] || [],
      rows: tableRows.slice(bestHeaderIdx + 1),
      mapping: bestMap,
      headerRowIndex: bestHeaderIdx,
      coordScale: bestCoordScale,
    }
  }

  return {
    delimiter,
    headers: tableRows[0] || [],
    rows: tableRows.slice(1),
    mapping: null,
    headerRowIndex: null,
    coordScale: getCoordScale(unitOverride),
  }
}

/**
 * Parse a numeric string, handling European comma decimal separators.
 * When semicolons are used as field delimiter, commas within numeric
 * fields are treated as decimal separators (e.g. "111,415" → 111.415).
 */
function parseNumeric(s: string, delimiter: Delimiter): number {
  if (delimiter === ';') {
    // Replace commas with periods for European decimal format
    s = s.replace(/,/g, '.')
  }
  return parseFloat(s)
}

/**
 * Parse a PnP file content string into an array of components.
 *
 * @param content  Raw text content of the PnP file
 * @param side     Which side these components belong to
 * @returns        Parsed components array
 */
/**
 * Detect whether a PnP component is a fiducial marker.
 * Fiducials have a single point and are used for alignment, so they need
 * only one click to locate on the PCB.
 */
export function isFiducial(comp: PnPComponent): boolean {
  const lower = (comp.value + ' ' + comp.package + ' ' + comp.designator).toLowerCase()
  return /fiducial|fiducia|fid\b/.test(lower) || /^fd\d/i.test(comp.designator)
}

export function parsePnPFile(content: string, side: 'top' | 'bottom', options?: ParsePnPOptions, fileName?: string): PnPComponent[] {
  const preview = parsePnPPreview(content, options, fileName)
  const delimiter = preview.delimiter
  const components: PnPComponent[] = []
  const headerMap = preview.mapping
  const coordScale = preview.coordScale

  for (const fields of preview.rows) {
    // Need at least 4 fields (designator, x, y, rotation) — value and package are optional
    if (fields.length < 4) continue

    // Default fixed order (legacy): Designator, X, Y, Rotation, Value, Package
    const designator = headerMap ? getField(fields, headerMap.designator) : (fields[0] || '')
    const xStr = headerMap ? getField(fields, headerMap.x) : (fields[1] || '')
    const yStr = headerMap ? getField(fields, headerMap.y) : (fields[2] || '')
    const rotStr = headerMap ? getField(fields, headerMap.rotation) : (fields[3] || '')
    const value = headerMap ? getField(fields, headerMap.value) : (fields[4] || '')
    let pkg = headerMap ? getField(fields, headerMap.package) : (fields[5] || '')

    const x = parseNumeric(xStr, delimiter) * coordScale
    const y = parseNumeric(yStr, delimiter) * coordScale
    const rotation = parseNumeric(rotStr, delimiter)

    // Validate numeric fields
    if (isNaN(x) || isNaN(y) || isNaN(rotation)) continue

    // Normalise KiCad-style footprints like "Package_SO:SOIC-8_5.3x5.3mm_P1.27mm"
    // to "SOIC-8_5.3x5.3mm_P1.27mm" (library prefix removed).
    if (pkg.includes(':')) {
      pkg = pkg.split(':').pop() || pkg
    }

    // Allow an explicit Side/Layer column to override the inferred side.
    // Common values: "top", "bottom", "F.Cu", "B.Cu".
    let effectiveSide: 'top' | 'bottom' = side
    if (headerMap?.side != null) {
      const sideVal = getField(fields, headerMap.side).toLowerCase()
      if (/(bottom|bot|b\.cu)/.test(sideVal)) effectiveSide = 'bottom'
      else if (/(top|f\.cu)/.test(sideVal)) effectiveSide = 'top'
    }

    components.push({
      designator: designator.trim(),
      x,
      y,
      rotation,
      value: value.trim(),
      package: pkg.trim(),
      side: effectiveSide,
    })
  }

  return components
}
