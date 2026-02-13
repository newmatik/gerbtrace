/**
 * Pick & Place (PnP) file parser.
 *
 * Supports tab-delimited and comma-delimited formats.
 * Expected columns: Designator, X (mm), Y (mm), Rotation (deg), Value, Package
 *
 * Auto-detects delimiter from content. Handles optional header rows,
 * empty value fields, and trailing blank lines.
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

/**
 * Detect delimiter from content: tab if any line contains a tab,
 * otherwise comma.
 */
function detectDelimiter(content: string): '\t' | ',' {
  const firstLines = content.split('\n').slice(0, 5)
  for (const line of firstLines) {
    if (line.includes('\t')) return '\t'
  }
  return ','
}

/**
 * Split a line by the given delimiter, trimming whitespace from each field.
 */
function splitLine(line: string, delimiter: '\t' | ','): string[] {
  return line.split(delimiter).map(f => f.trim())
}

/**
 * Check if a row looks like a header rather than data.
 */
function isHeaderRow(fields: string[]): boolean {
  if (fields.length === 0) return false
  // If the second field is not a number, it's likely a header
  if (fields.length >= 2 && isNaN(parseFloat(fields[1]!))) return true
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

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    const fields = splitLine(line, delimiter)

    // Need at least 4 fields (designator, x, y, rotation) — value and package are optional
    if (fields.length < 4) continue

    // Skip header rows
    if (isHeaderRow(fields)) continue

    const x = parseFloat(fields[1]!)
    const y = parseFloat(fields[2]!)
    const rotation = parseFloat(fields[3]!)

    // Validate numeric fields
    if (isNaN(x) || isNaN(y) || isNaN(rotation)) continue

    components.push({
      designator: fields[0]!,
      x,
      y,
      rotation,
      value: fields[4]?.trim() || '',
      package: fields[5]?.trim() || '',
      side,
    })
  }

  return components
}
