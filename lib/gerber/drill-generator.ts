/**
 * Excellon Drill Source Generator
 *
 * Generates valid Excellon drill commands for adding drill hits to existing
 * drill files. Mirrors the approach of generator.ts for Gerber files.
 */

import type { UnitsType, Format, ZeroSuppression } from './types'

export interface DrillFormatSpec {
  units: UnitsType
  format: Format
  zeroSuppression: ZeroSuppression
}

/**
 * Parse the format specification from existing Excellon drill source.
 * Handles both header directives and format comments.
 */
export function parseDrillFormat(source: string): DrillFormatSpec {
  let units: UnitsType = 'in'
  let format: Format = [2, 4]
  let zeroSuppression: ZeroSuppression = 'leading'

  // Check header for METRIC/INCH with TZ/LZ
  // Excellon convention: TZ = trailing zeros kept = leading suppressed
  //                      LZ = leading zeros kept  = trailing suppressed
  const unitsLine = source.match(/^(INCH|METRIC)\s*,?\s*(TZ|LZ)?(?:\s*,\s*(\d+)\.(\d+))?/im)
  if (unitsLine) {
    units = /^INCH/i.test(unitsLine[1]!) ? 'in' : 'mm'
    if (unitsLine[2]) {
      zeroSuppression = /TZ/i.test(unitsLine[2]) ? 'leading' : 'trailing'
    }
    if (unitsLine[3] && unitsLine[4]) {
      format = [unitsLine[3].length, unitsLine[4].length]
    }
  }

  // Body unit commands override header
  const bodyLines = source.split(/\r?\n/)
  for (const line of bodyLines) {
    if (line.trim() === 'M71') units = 'mm'
    if (line.trim() === 'M72') units = 'in'
  }

  // Format from comments: ;FORMAT={2:4} or ;FILE_FORMAT=2:4
  const fmtComment = source.match(/;\s*(?:FILE_)?FORMAT[=:\s]*\{?(\d)[:\.](\d)/i)
  if (fmtComment) {
    format = [parseInt(fmtComment[1]!, 10), parseInt(fmtComment[2]!, 10)]
  }

  // Detect format from coordinates with decimal points (common in modern files)
  if (!fmtComment && !unitsLine?.[3]) {
    const coordWithDot = source.match(/^X([+-]?\d+\.\d+)/m)
    if (coordWithDot) {
      // File uses explicit decimals — format is effectively irrelevant,
      // but we note it so our output also uses decimals
      const parts = coordWithDot[1]!.split('.')
      format = [Math.max(parts[0]!.replace(/[+-]/, '').length, 2), parts[1]!.length]
    }
  }

  return { units, format, zeroSuppression }
}

/**
 * Detect whether the drill file uses explicit decimal points in coordinates.
 */
export function usesExplicitDecimals(source: string): boolean {
  return /^X[+-]?\d+\.\d+/m.test(source)
}

/**
 * Find the next available tool number in the source.
 * Scans for T\d+C... definitions and returns one higher.
 */
export function findNextToolNumber(source: string): number {
  let maxTool = 0
  const regex = /^T(\d+)/gm
  let match
  while ((match = regex.exec(source)) !== null) {
    const num = parseInt(match[1]!, 10)
    if (num > maxTool) maxTool = num
  }
  return maxTool + 1
}

/**
 * Find an existing tool number with a matching diameter, or return null.
 */
export function findToolByDiameter(source: string, diameter: number, tolerance = 0.001): { toolNum: number; code: string } | null {
  const regex = /^T(\d+).*?C([\d.]+)/gm
  let match
  while ((match = regex.exec(source)) !== null) {
    const d = parseFloat(match[2]!)
    if (Math.abs(d - diameter) < tolerance) {
      const num = parseInt(match[1]!, 10)
      return { toolNum: num, code: `T${num}` }
    }
  }
  return null
}

/**
 * Format a coordinate for Excellon output.
 * If the source file uses explicit decimals, output with decimal point.
 * Otherwise, use the format spec with zero suppression.
 */
export function formatDrillCoordinate(
  value: number,
  fmt: Format,
  zeroSuppression: ZeroSuppression,
  explicitDecimals: boolean,
): string {
  if (explicitDecimals) {
    const sign = value < 0 ? '-' : ''
    return sign + Math.abs(value).toFixed(fmt[1])
  }

  const [intPlaces, decPlaces] = fmt
  const totalDigits = intPlaces + decPlaces
  const sign = value < 0 ? '-' : ''
  const absVal = Math.abs(value)
  const scaled = Math.round(absVal * Math.pow(10, decPlaces))
  let digits = scaled.toString().padStart(totalDigits, '0')

  if (zeroSuppression === 'leading') {
    digits = digits.replace(/^0+/, '') || '0'
  } else {
    digits = digits.replace(/0+$/, '') || '0'
  }

  return sign + digits
}

export interface GenerateDrillHitOpts {
  x: number
  y: number
  /** Diameter in file units */
  diameter: number
}

/**
 * Generate Excellon commands for a single drill hit.
 * Returns tool definition (if new) and the drill coordinate line.
 */
export function generateDrillHit(
  opts: GenerateDrillHitOpts,
  spec: DrillFormatSpec,
  source: string,
): { toolDef: string; toolSelect: string; hitCommand: string } {
  if (!(opts.diameter > 0)) {
    throw new Error('Drill diameter must be greater than 0')
  }

  const explicitDec = usesExplicitDecimals(source)
  const fmtC = (v: number) => formatDrillCoordinate(v, spec.format, spec.zeroSuppression, explicitDec)

  const existing = findToolByDiameter(source, opts.diameter)

  let toolDef = ''
  let toolCode: string

  if (existing) {
    toolCode = existing.code
  } else {
    const nextNum = findNextToolNumber(source)
    toolCode = `T${String(nextNum).padStart(2, '0')}`
    const diaStr = opts.diameter.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
    toolDef = `${toolCode}C${diaStr}`
  }

  const toolSelect = toolCode
  const hitCommand = `X${fmtC(opts.x)}Y${fmtC(opts.y)}`

  return { toolDef, toolSelect, hitCommand }
}

/**
 * Inject a drill hit into existing Excellon source.
 * - New tool definitions go into the header (before %)
 * - Tool select + coordinate go before M30/M00 end marker
 */
export function injectDrillCommands(
  source: string,
  toolDef: string,
  toolSelect: string,
  hitCommand: string,
): string {
  let result = source

  // Insert tool definition in the header if needed
  if (toolDef) {
    const headerEndIdx = findHeaderEnd(result)
    if (headerEndIdx >= 0) {
      result = result.slice(0, headerEndIdx) + toolDef + '\n' + result.slice(headerEndIdx)
    } else {
      // No header found; synthesize a minimal Excellon header.
      result = `M48\n${toolDef}\n%\n${result}`
    }
  }

  // Insert tool select + drill hit before M30/M00
  const insertIdx = findDrillInsertionPoint(result)
  // If the file is currently in routing mode at insertion point, switch back
  // to drill mode first so coordinate-only commands become drill hits.
  const needsRouteDisable = isRoutingEnabledAt(result, insertIdx)
  const block = `${needsRouteDisable ? 'M16\n' : ''}${toolSelect}\n${hitCommand}\n`
  result = result.slice(0, insertIdx) + block + result.slice(insertIdx)

  return result
}

/**
 * Find the end of the header section (the line with % or M95).
 * Returns the character index of that line (to insert before it).
 */
function findHeaderEnd(source: string): number {
  const lines = source.split(/\r?\n/)
  let offset = 0
  let inHeader = false

  for (const line of lines) {
    const trimmed = line.trim()
    const lineEnd = offset + line.length
    const newlineLen = source[lineEnd] === '\r' && source[lineEnd + 1] === '\n' ? 2 : 1
    if (trimmed === 'M48') {
      inHeader = true
      offset = lineEnd + newlineLen
      continue
    }
    if (inHeader && (trimmed === '%' || trimmed === 'M95')) {
      return offset
    }
    offset = lineEnd + newlineLen
  }
  return -1
}

/**
 * Find the insertion point for drill commands (before M30/M00 end marker).
 */
function findDrillInsertionPoint(source: string): number {
  const endMatch = source.match(/^M30|^M00/m)
  if (endMatch?.index !== undefined) {
    let pos = endMatch.index
    while (pos > 0 && (source[pos - 1] === '\n' || source[pos - 1] === '\r')) {
      pos--
    }
    return pos
  }
  return source.length
}

function isRoutingEnabledAt(source: string, pos: number): boolean {
  const upto = source.slice(0, pos)
  const lines = upto.split(/\r?\n/)
  let routingEnabled = false
  for (const line of lines) {
    const trimmed = line.trim().toUpperCase()
    if (trimmed === 'M15') routingEnabled = true
    if (trimmed === 'M16' || trimmed === 'M17') routingEnabled = false
  }
  return routingEnabled
}

export function drillMmToFileUnits(mm: number, units: UnitsType): number {
  return units === 'in' ? mm / 25.4 : mm
}

export function drillFileUnitsToMm(value: number, units: UnitsType): number {
  return units === 'in' ? value * 25.4 : value
}
