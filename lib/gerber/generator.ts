/**
 * Gerber Source Generator
 *
 * Generates valid Gerber X2 source text for drawing primitives.
 * Used by the draw tool to inject new shapes into existing Gerber files.
 */

import type { UnitsType, Format, ZeroSuppression } from './types'

export interface GerberFormatSpec {
  units: UnitsType
  format: Format
  zeroSuppression: ZeroSuppression
}

/**
 * Parse the format specification from existing Gerber source.
 * Extracts units (%MO), format (%FS), and zero suppression.
 */
export function parseFormatFromSource(source: string): GerberFormatSpec {
  let units: UnitsType = 'mm'
  let format: Format = [2, 6]
  let zeroSuppression: ZeroSuppression = 'leading'

  const moMatch = source.match(/%MO(MM|IN)\*%/)
  if (moMatch) {
    units = moMatch[1] === 'IN' ? 'in' : 'mm'
  }

  const fsMatch = source.match(/%FS([LT]?)A?X(\d)(\d)Y(\d)(\d)\*%/)
  if (fsMatch) {
    zeroSuppression = fsMatch[1] === 'T' ? 'trailing' : 'leading'
    const xInt = parseInt(fsMatch[2]!, 10)
    const xDec = parseInt(fsMatch[3]!, 10)
    const yInt = parseInt(fsMatch[4]!, 10)
    const yDec = parseInt(fsMatch[5]!, 10)
    if (xInt !== yInt || xDec !== yDec) {
      throw new Error(`Unsupported mixed X/Y format: X${xInt}${xDec} Y${yInt}${yDec}`)
    }
    format = [xInt, xDec]
  }

  return { units, format, zeroSuppression }
}

/**
 * Format a coordinate value into a Gerber coordinate string.
 */
export function formatCoordinate(
  value: number,
  fmt: Format,
  zeroSuppression: ZeroSuppression,
): string {
  const [intPlaces, decPlaces] = fmt
  const totalDigits = intPlaces + decPlaces
  const sign = value < 0 ? '-' : ''
  const absVal = Math.abs(value)

  const scaled = Math.round(absVal * Math.pow(10, decPlaces))
  const scaledStr = scaled.toString()
  if (scaledStr.length > totalDigits) {
    throw new RangeError(`Coordinate ${value} exceeds format ${intPlaces}.${decPlaces}`)
  }
  let digits = scaledStr.padStart(totalDigits, '0')

  if (zeroSuppression === 'leading') {
    digits = digits.replace(/^0+/, '') || '0'
  } else {
    digits = digits.replace(/0+$/, '') || '0'
  }

  return sign + digits
}

/**
 * Find the next available aperture D-code in the source.
 * Scans for existing %ADD\d+ definitions and returns one higher.
 */
export function findNextApertureCode(source: string): number {
  let maxCode = 9
  const regex = /%ADD(\d+)/g
  let match
  while ((match = regex.exec(source)) !== null) {
    const code = parseInt(match[1]!, 10)
    if (code > maxCode) maxCode = code
  }
  return maxCode + 1
}

/**
 * Find the insertion point in the source (before M02* end marker).
 * Returns the character index where new commands should be inserted.
 */
function findInsertionPoint(source: string): number {
  const m02Match = source.match(/M02\s*\*/)
  if (m02Match?.index !== undefined) {
    let pos = m02Match.index
    while (pos > 0 && (source[pos - 1] === '\n' || source[pos - 1] === '\r')) {
      pos--
    }
    return pos
  }
  return source.length
}

/**
 * Find the insertion point for aperture definitions.
 * Inserts after the last existing %ADD...% block, or after %MO/%FS if none exist.
 */
function findApertureInsertionPoint(source: string): number {
  let lastApertureEnd = -1
  const apertureRegex = /%ADD\d+[^%]*\*%/g
  let match
  while ((match = apertureRegex.exec(source)) !== null) {
    lastApertureEnd = match.index + match[0].length
  }
  if (lastApertureEnd >= 0) return lastApertureEnd

  const fsMatch = source.match(/%FS[^%]*\*%/)
  if (fsMatch?.index !== undefined) {
    return fsMatch.index + fsMatch[0].length
  }

  const moMatch = source.match(/%MO(MM|IN)\*%/)
  if (moMatch?.index !== undefined) {
    return moMatch.index + moMatch[0].length
  }

  return 0
}

export interface GenerateLineOpts {
  start: [number, number]
  end: [number, number]
  width: number
}

export interface GenerateRectOpts {
  x: number
  y: number
  w: number
  h: number
  filled: boolean
  strokeWidth?: number
}

export interface GenerateCircleOpts {
  cx: number
  cy: number
  r: number
  filled: boolean
  strokeWidth?: number
}

/**
 * Generate Gerber commands for a line with a given stroke width.
 */
export function generateLine(
  opts: GenerateLineOpts,
  spec: GerberFormatSpec,
  apertureCode: number,
): { apertureDef: string; commands: string } {
  const { start, end, width } = opts
  const fmtX = (v: number) => formatCoordinate(v, spec.format, spec.zeroSuppression)
  const fmtY = (v: number) => formatCoordinate(v, spec.format, spec.zeroSuppression)

  const widthStr = width.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
  const apertureDef = `%ADD${apertureCode}C,${widthStr}*%`

  const commands = [
    `D${apertureCode}*`,
    `G01*`,
    `X${fmtX(start[0])}Y${fmtY(start[1])}D02*`,
    `X${fmtX(end[0])}Y${fmtY(end[1])}D01*`,
  ].join('\n')

  return { apertureDef, commands }
}

/**
 * Generate Gerber commands for a rectangle.
 * Filled rectangles use G36/G37 region mode.
 * Stroked rectangles use line draws with a round aperture.
 */
export function generateRect(
  opts: GenerateRectOpts,
  spec: GerberFormatSpec,
  apertureCode: number,
): { apertureDef: string; commands: string } {
  const { x, y, w, h, filled, strokeWidth = 0.1 } = opts
  const fmtX = (v: number) => formatCoordinate(v, spec.format, spec.zeroSuppression)
  const fmtY = (v: number) => formatCoordinate(v, spec.format, spec.zeroSuppression)

  if (filled) {
    const apertureDef = ''
    const commands = [
      `G36*`,
      `X${fmtX(x)}Y${fmtY(y)}D02*`,
      `G01*`,
      `X${fmtX(x + w)}Y${fmtY(y)}D01*`,
      `X${fmtX(x + w)}Y${fmtY(y + h)}D01*`,
      `X${fmtX(x)}Y${fmtY(y + h)}D01*`,
      `X${fmtX(x)}Y${fmtY(y)}D01*`,
      `G37*`,
    ].join('\n')
    return { apertureDef, commands }
  }

  const widthStr = strokeWidth.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
  const apertureDef = `%ADD${apertureCode}C,${widthStr}*%`

  const commands = [
    `D${apertureCode}*`,
    `G01*`,
    `X${fmtX(x)}Y${fmtY(y)}D02*`,
    `X${fmtX(x + w)}Y${fmtY(y)}D01*`,
    `X${fmtX(x + w)}Y${fmtY(y + h)}D01*`,
    `X${fmtX(x)}Y${fmtY(y + h)}D01*`,
    `X${fmtX(x)}Y${fmtY(y)}D01*`,
  ].join('\n')
  return { apertureDef, commands }
}

/**
 * Generate Gerber commands for a circle.
 * Filled circles use G36/G37 with arc interpolation.
 * Stroked circles use arc interpolation with a round aperture.
 */
export function generateCircle(
  opts: GenerateCircleOpts,
  spec: GerberFormatSpec,
  apertureCode: number,
): { apertureDef: string; commands: string } {
  const { cx, cy, r, filled, strokeWidth = 0.1 } = opts
  const fmtX = (v: number) => formatCoordinate(v, spec.format, spec.zeroSuppression)
  const fmtY = (v: number) => formatCoordinate(v, spec.format, spec.zeroSuppression)
  const fmtI = (v: number) => formatCoordinate(v, spec.format, spec.zeroSuppression)

  const startX = cx + r
  const startY = cy

  if (filled) {
    const commands = [
      `G36*`,
      `X${fmtX(startX)}Y${fmtY(startY)}D02*`,
      `G75*`,
      `G03X${fmtX(startX)}Y${fmtY(startY)}I${fmtI(-r)}J${fmtI(0)}D01*`,
      `G37*`,
    ].join('\n')
    return { apertureDef: '', commands }
  }

  const widthStr = strokeWidth.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
  const apertureDef = `%ADD${apertureCode}C,${widthStr}*%`

  const commands = [
    `D${apertureCode}*`,
    `X${fmtX(startX)}Y${fmtY(startY)}D02*`,
    `G75*`,
    `G03X${fmtX(startX)}Y${fmtY(startY)}I${fmtI(-r)}J${fmtI(0)}D01*`,
  ].join('\n')
  return { apertureDef, commands }
}

// Minimal stroke font: each character is a list of polylines defined
// as sequences of [x, y] offsets within a normalized cell (0..1 width, 0..1 height).
// null separates disconnected strokes within one character.
type StrokeGlyph = ([number, number] | null)[]

const STROKE_FONT: Record<string, { width: number; strokes: StrokeGlyph }> = {
  'A': { width: 0.7, strokes: [[0, 0], [0.35, 1], [0.7, 0], null, [0.15, 0.4], [0.55, 0.4]] },
  'B': { width: 0.65, strokes: [[0, 0], [0, 1], [0.45, 1], [0.6, 0.85], [0.6, 0.65], [0.45, 0.5], [0, 0.5], null, [0.45, 0.5], [0.6, 0.35], [0.6, 0.15], [0.45, 0], [0, 0]] },
  'C': { width: 0.65, strokes: [[0.6, 0.85], [0.45, 1], [0.15, 1], [0, 0.85], [0, 0.15], [0.15, 0], [0.45, 0], [0.6, 0.15]] },
  'D': { width: 0.65, strokes: [[0, 0], [0, 1], [0.4, 1], [0.6, 0.8], [0.6, 0.2], [0.4, 0], [0, 0]] },
  'E': { width: 0.55, strokes: [[0.55, 1], [0, 1], [0, 0], [0.55, 0], null, [0, 0.5], [0.4, 0.5]] },
  'F': { width: 0.55, strokes: [[0, 0], [0, 1], [0.55, 1], null, [0, 0.5], [0.4, 0.5]] },
  'G': { width: 0.65, strokes: [[0.6, 0.85], [0.45, 1], [0.15, 1], [0, 0.85], [0, 0.15], [0.15, 0], [0.45, 0], [0.6, 0.15], [0.6, 0.5], [0.35, 0.5]] },
  'H': { width: 0.65, strokes: [[0, 0], [0, 1], null, [0.65, 0], [0.65, 1], null, [0, 0.5], [0.65, 0.5]] },
  'I': { width: 0.3, strokes: [[0.15, 0], [0.15, 1]] },
  'J': { width: 0.5, strokes: [[0.4, 1], [0.4, 0.15], [0.25, 0], [0.1, 0], [0, 0.15]] },
  'K': { width: 0.6, strokes: [[0, 0], [0, 1], null, [0.6, 1], [0, 0.4], null, [0.2, 0.55], [0.6, 0]] },
  'L': { width: 0.55, strokes: [[0, 1], [0, 0], [0.55, 0]] },
  'M': { width: 0.8, strokes: [[0, 0], [0, 1], [0.4, 0.5], [0.8, 1], [0.8, 0]] },
  'N': { width: 0.65, strokes: [[0, 0], [0, 1], [0.65, 0], [0.65, 1]] },
  'O': { width: 0.7, strokes: [[0.15, 0], [0, 0.15], [0, 0.85], [0.15, 1], [0.55, 1], [0.7, 0.85], [0.7, 0.15], [0.55, 0], [0.15, 0]] },
  'P': { width: 0.6, strokes: [[0, 0], [0, 1], [0.45, 1], [0.6, 0.85], [0.6, 0.6], [0.45, 0.45], [0, 0.45]] },
  'Q': { width: 0.7, strokes: [[0.15, 0], [0, 0.15], [0, 0.85], [0.15, 1], [0.55, 1], [0.7, 0.85], [0.7, 0.15], [0.55, 0], [0.15, 0], null, [0.45, 0.2], [0.7, 0]] },
  'R': { width: 0.6, strokes: [[0, 0], [0, 1], [0.45, 1], [0.6, 0.85], [0.6, 0.6], [0.45, 0.45], [0, 0.45], null, [0.35, 0.45], [0.6, 0]] },
  'S': { width: 0.6, strokes: [[0.55, 0.85], [0.45, 1], [0.15, 1], [0, 0.85], [0, 0.6], [0.15, 0.5], [0.45, 0.5], [0.6, 0.4], [0.6, 0.15], [0.45, 0], [0.15, 0], [0, 0.15]] },
  'T': { width: 0.6, strokes: [[0, 1], [0.6, 1], null, [0.3, 0], [0.3, 1]] },
  'U': { width: 0.65, strokes: [[0, 1], [0, 0.15], [0.15, 0], [0.5, 0], [0.65, 0.15], [0.65, 1]] },
  'V': { width: 0.7, strokes: [[0, 1], [0.35, 0], [0.7, 1]] },
  'W': { width: 0.9, strokes: [[0, 1], [0.2, 0], [0.45, 0.6], [0.7, 0], [0.9, 1]] },
  'X': { width: 0.65, strokes: [[0, 0], [0.65, 1], null, [0.65, 0], [0, 1]] },
  'Y': { width: 0.65, strokes: [[0, 1], [0.325, 0.5], [0.65, 1], null, [0.325, 0.5], [0.325, 0]] },
  'Z': { width: 0.6, strokes: [[0, 1], [0.6, 1], [0, 0], [0.6, 0]] },
  '0': { width: 0.65, strokes: [[0.15, 0], [0, 0.15], [0, 0.85], [0.15, 1], [0.5, 1], [0.65, 0.85], [0.65, 0.15], [0.5, 0], [0.15, 0]] },
  '1': { width: 0.4, strokes: [[0.1, 0.8], [0.25, 1], [0.25, 0], null, [0.05, 0], [0.4, 0]] },
  '2': { width: 0.6, strokes: [[0, 0.8], [0.1, 1], [0.5, 1], [0.6, 0.85], [0.6, 0.65], [0, 0], [0.6, 0]] },
  '3': { width: 0.6, strokes: [[0, 0.85], [0.1, 1], [0.45, 1], [0.6, 0.85], [0.6, 0.6], [0.45, 0.5], [0.2, 0.5], null, [0.45, 0.5], [0.6, 0.4], [0.6, 0.15], [0.45, 0], [0.1, 0], [0, 0.15]] },
  '4': { width: 0.65, strokes: [[0.5, 0], [0.5, 1], [0, 0.35], [0.65, 0.35]] },
  '5': { width: 0.6, strokes: [[0.55, 1], [0, 1], [0, 0.55], [0.4, 0.55], [0.6, 0.4], [0.6, 0.15], [0.45, 0], [0.1, 0], [0, 0.15]] },
  '6': { width: 0.6, strokes: [[0.5, 1], [0.2, 1], [0, 0.75], [0, 0.15], [0.15, 0], [0.45, 0], [0.6, 0.15], [0.6, 0.4], [0.45, 0.55], [0.15, 0.55], [0, 0.4]] },
  '7': { width: 0.6, strokes: [[0, 1], [0.6, 1], [0.2, 0]] },
  '8': { width: 0.6, strokes: [[0.15, 0.5], [0, 0.65], [0, 0.85], [0.15, 1], [0.45, 1], [0.6, 0.85], [0.6, 0.65], [0.45, 0.5], [0.15, 0.5], [0, 0.35], [0, 0.15], [0.15, 0], [0.45, 0], [0.6, 0.15], [0.6, 0.35], [0.45, 0.5]] },
  '9': { width: 0.6, strokes: [[0.6, 0.6], [0.45, 0.45], [0.15, 0.45], [0, 0.6], [0, 0.85], [0.15, 1], [0.45, 1], [0.6, 0.85], [0.6, 0.25], [0.4, 0], [0.1, 0]] },
  '.': { width: 0.2, strokes: [[0.1, 0], [0.1, 0.05]] },
  ',': { width: 0.2, strokes: [[0.1, 0.1], [0.05, -0.05]] },
  '-': { width: 0.45, strokes: [[0.05, 0.45], [0.4, 0.45]] },
  '+': { width: 0.5, strokes: [[0.25, 0.25], [0.25, 0.7], null, [0.05, 0.475], [0.45, 0.475]] },
  '/': { width: 0.45, strokes: [[0, 0], [0.45, 1]] },
  ':': { width: 0.2, strokes: [[0.1, 0.2], [0.1, 0.25], null, [0.1, 0.7], [0.1, 0.75]] },
  ' ': { width: 0.35, strokes: [] },
  '(': { width: 0.3, strokes: [[0.25, 1], [0.05, 0.75], [0.05, 0.25], [0.25, 0]] },
  ')': { width: 0.3, strokes: [[0.05, 1], [0.25, 0.75], [0.25, 0.25], [0.05, 0]] },
}

export interface GenerateTextOpts {
  text: string
  x: number
  y: number
  height: number
  strokeWidth?: number
}

/**
 * Generate Gerber commands for stroke-rendered text.
 */
export function generateText(
  opts: GenerateTextOpts,
  spec: GerberFormatSpec,
  apertureCode: number,
): { apertureDef: string; commands: string } {
  const { text, x, y, height, strokeWidth = 0.1 } = opts
  const fmtX = (v: number) => formatCoordinate(v, spec.format, spec.zeroSuppression)
  const fmtY = (v: number) => formatCoordinate(v, spec.format, spec.zeroSuppression)

  const widthStr = strokeWidth.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
  const apertureDef = `%ADD${apertureCode}C,${widthStr}*%`

  const lines: string[] = [`D${apertureCode}*`, `G01*`]
  const charSpacing = 0.15
  let cursorX = x

  for (const ch of text.toUpperCase()) {
    const glyph = STROKE_FONT[ch]
    if (!glyph) {
      cursorX += 0.4 * height
      continue
    }

    let penDown = false
    for (const pt of glyph.strokes) {
      if (pt === null) {
        penDown = false
        continue
      }
      const px = cursorX + pt[0] * height
      const py = y + pt[1] * height
      if (!penDown) {
        lines.push(`X${fmtX(px)}Y${fmtY(py)}D02*`)
        penDown = true
      } else {
        lines.push(`X${fmtX(px)}Y${fmtY(py)}D01*`)
      }
    }

    cursorX += (glyph.width + charSpacing) * height
  }

  return { apertureDef, commands: lines.join('\n') }
}

/**
 * Inject new aperture definitions and drawing commands into existing Gerber source.
 * Aperture defs are inserted after existing aperture blocks.
 * Drawing commands are inserted before the M02* end marker.
 */
export function injectGerberCommands(
  source: string,
  apertureDef: string,
  commands: string,
): string {
  let result = source

  if (apertureDef) {
    const apInsert = findApertureInsertionPoint(result)
    result = result.slice(0, apInsert) + '\n' + apertureDef + '\n' + result.slice(apInsert)
  }

  const cmdInsert = findInsertionPoint(result)
  result = result.slice(0, cmdInsert) + '\n' + commands + '\n' + result.slice(cmdInsert)

  return result
}

/**
 * Convert a value from mm to the file's coordinate units.
 */
export function mmToFileUnits(mm: number, units: UnitsType): number {
  return units === 'in' ? mm / 25.4 : mm
}

/**
 * Convert a value from file coordinate units to mm.
 */
export function fileUnitsToMm(value: number, units: UnitsType): number {
  return units === 'in' ? value * 25.4 : value
}
