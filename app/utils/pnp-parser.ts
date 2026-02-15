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

/** Common header keywords that indicate a header row rather than data */
const HEADER_KEYWORDS = /^(ref|designator|component|part|name|x|y|rotation|angle|value|package|footprint|side|layer|pos\s?x|pos\s?y)/i

type Delimiter = '\t' | ',' | ';'

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

type ColumnKey = 'designator' | 'x' | 'y' | 'rotation' | 'value' | 'package' | 'side'

function normaliseHeaderName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function buildHeaderMap(fields: string[]): Partial<Record<ColumnKey, number>> {
  const map: Partial<Record<ColumnKey, number>> = {}
  for (let i = 0; i < fields.length; i++) {
    const h = normaliseHeaderName(fields[i] || '')

    if (!map.designator && /^(ref|designator|reference|name|component|part)$/.test(h)) map.designator = i
    else if (!map.x && /^(posx|x|centerx|midx|cx)/.test(h)) map.x = i
    else if (!map.y && /^(posy|y|centery|midy|cy)/.test(h)) map.y = i
    else if (!map.rotation && /^(rot|rotation|angle|deg)/.test(h)) map.rotation = i
    else if (!map.value && /^(val|value|comment)$/.test(h)) map.value = i
    else if (!map.package && /^(package|footprint|pkg)$/.test(h)) map.package = i
    else if (!map.side && /^(side|layer)$/.test(h)) map.side = i
  }
  return map
}

function getField(fields: string[], idx: number | undefined): string {
  if (idx == null || idx < 0 || idx >= fields.length) return ''
  return fields[idx] ?? ''
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
 * Check if a row looks like a header rather than data.
 */
function isHeaderRow(fields: string[], delimiter: Delimiter): boolean {
  if (fields.length === 0) return false
  // If the second field is not a number, it's likely a header
  if (fields.length >= 2 && isNaN(parseNumeric(fields[1]!, delimiter))) return true
  // Check if the first field matches common header keywords
  if (HEADER_KEYWORDS.test(fields[0]!)) return true
  return false
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

export function parsePnPFile(content: string, side: 'top' | 'bottom'): PnPComponent[] {
  const lines = content.split('\n')
  const delimiter = detectDelimiter(content)
  const components: PnPComponent[] = []
  let headerMap: Partial<Record<ColumnKey, number>> | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const fields = splitLine(line, delimiter)

    // Need at least 4 fields (designator, x, y, rotation) — value and package are optional
    if (fields.length < 4) continue

    // If we haven't found a header yet, try to detect one.
    // Once a valid header map is established, skip the heuristic check so
    // data rows with non-numeric text columns (e.g. Altium "Comment") aren't
    // misidentified as headers.
    if (!headerMap && isHeaderRow(fields, delimiter)) {
      const maybeMap = buildHeaderMap(fields)
      if (
        maybeMap.designator != null
        && maybeMap.x != null
        && maybeMap.y != null
        && maybeMap.rotation != null
      ) {
        headerMap = maybeMap
      }
      continue
    }

    // Default fixed order (legacy): Designator, X, Y, Rotation, Value, Package
    const designator = headerMap ? getField(fields, headerMap.designator) : (fields[0] || '')
    const xStr = headerMap ? getField(fields, headerMap.x) : (fields[1] || '')
    const yStr = headerMap ? getField(fields, headerMap.y) : (fields[2] || '')
    const rotStr = headerMap ? getField(fields, headerMap.rotation) : (fields[3] || '')
    const value = headerMap ? getField(fields, headerMap.value) : (fields[4] || '')
    let pkg = headerMap ? getField(fields, headerMap.package) : (fields[5] || '')

    const x = parseNumeric(xStr, delimiter)
    const y = parseNumeric(yStr, delimiter)
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
