/**
 * Excellon drill file parser
 *
 * Handles NC drill files with:
 * - Header/body sections
 * - Tool definitions (T01C0.8)
 * - Coordinate blocks (X...Y...)
 * - Routing commands (G85 slots)
 * - Format detection from comments
 */

import type { GerberAST, ASTNode, Format, ZeroSuppression, UnitsType } from './types'

const FORMAT_COMMENT_RE = /FORMAT[=:\s]*\{?(\d)[:\.](\d)/i
const SUPPRESS_TRAILING_RE = /suppress\s*trail/i
const SUPPRESS_LEADING_RE = /(suppress\s*lead|keep\s*zeros)/i
const UNITS_INCH_RE = /(INCH|english)/i
const UNITS_METRIC_RE = /(METRIC|MILLI)/i

export function parseDrillSource(source: string): GerberAST {
  const children: ASTNode[] = []
  const lines = source.split(/\r?\n/)
  let inHeader = false
  let units: UnitsType | undefined
  let format: Format | undefined
  let zeroSuppression: ZeroSuppression | undefined
  let currentTool: string | undefined

  /** Current character offset in the source string */
  let offset = 0

  for (const rawLine of lines) {
    const lineStart = offset
    const lineEnd = offset + rawLine.length
    // Advance offset past this line + the newline separator
    offset = lineEnd + (source[lineEnd] === '\r' && source[lineEnd + 1] === '\n' ? 2 : 1)

    const line = rawLine.trim()
    if (!line) continue

    // Comments
    if (line.startsWith(';')) {
      const comment = line.slice(1).trim()
      children.push({ type: 'comment', text: comment, sourceStart: lineStart, sourceEnd: lineEnd })
      detectFormatFromComment(comment)
      continue
    }

    // Header start
    if (line === 'M48') {
      inHeader = true
      continue
    }

    // Header end
    if (line === '%' || line === 'M95') {
      if (inHeader) {
        inHeader = false
        // Emit format/units detected so far
        if (units) children.push({ type: 'units', units })
        if (format || zeroSuppression) {
          children.push({ type: 'format', format, zeroSuppression, mode: 'absolute' })
        }
      }
      continue
    }

    // End of file
    if (line === 'M30' || line === 'M00') {
      children.push({ type: 'done', sourceStart: lineStart, sourceEnd: lineEnd })
      continue
    }

    // Header commands
    if (inHeader) {
      // INCH or METRIC
      // NOTE: Excellon TZ/LZ convention is REVERSED from Gerber:
      //   TZ = "trailing zeros included" = leading zeros suppressed
      //   LZ = "leading zeros included"  = trailing zeros suppressed
      if (UNITS_INCH_RE.test(line)) {
        units = 'in'
        if (/TZ/i.test(line)) zeroSuppression = 'leading'
        if (/LZ/i.test(line)) zeroSuppression = 'trailing'
        continue
      }
      if (UNITS_METRIC_RE.test(line)) {
        units = 'mm'
        if (/TZ/i.test(line)) zeroSuppression = 'leading'
        if (/LZ/i.test(line)) zeroSuppression = 'trailing'
        continue
      }

      // Tool definition: T{num}C{diameter}
      const toolMatch = line.match(/^T(\d+)(?:C([\d.]+))?/)
      if (toolMatch) {
        const code = `T${parseInt(toolMatch[1])}`
        const diameter = toolMatch[2] ? parseFloat(toolMatch[2]) : 0
        if (diameter > 0) {
          children.push({
            type: 'toolDef',
            code,
            shape: { type: 'circle', params: [diameter] },
            sourceStart: lineStart,
            sourceEnd: lineEnd,
          })
        }
        continue
      }

      // FMAT,2 (format 2 = Excellon format)
      if (line.startsWith('FMAT')) continue

      continue
    }

    // Body commands

    // Tool change: T{num}
    const toolChange = line.match(/^T(\d+)$/)
    if (toolChange) {
      currentTool = `T${parseInt(toolChange[1])}`
      children.push({ type: 'toolChange', code: currentTool, sourceStart: lineStart, sourceEnd: lineEnd })
      continue
    }

    // Coordinate line: X...Y... (drill hit)
    const coordMatch = line.match(/^([XY].+)$/)
    if (coordMatch) {
      const coords = parseDrillCoords(coordMatch[1])
      children.push({ type: 'graphic', graphic: 'shape', coordinates: coords, sourceStart: lineStart, sourceEnd: lineEnd })
      continue
    }

    // Routing / slot: G85X...Y...
    if (line.startsWith('G85')) {
      // Slot from current position to X...Y...
      const slotCoords = parseDrillCoords(line.slice(3))
      children.push({ type: 'graphic', graphic: 'slot', coordinates: slotCoords, sourceStart: lineStart, sourceEnd: lineEnd })
      continue
    }

    // G-codes in drill
    if (line.startsWith('G05') || line.startsWith('G81')) {
      // Drill mode (default)
      continue
    }

    // Repeat hole patterns (R) - simplified, ignore
    if (line.startsWith('R') && /^\d/.test(line[1])) continue
  }

  // Ensure format defaults
  if (!children.some(n => n.type === 'units')) {
    children.unshift({ type: 'units', units: units || 'in' })
  }
  if (!children.some(n => n.type === 'format')) {
    children.unshift({
      type: 'format',
      format: format || [2, 4],
      zeroSuppression: zeroSuppression || 'leading',
      mode: 'absolute',
    })
  }

  return { type: 'root', filetype: 'drill', children }

  function detectFormatFromComment(comment: string) {
    const fmtMatch = FORMAT_COMMENT_RE.exec(comment)
    if (fmtMatch) {
      format = [parseInt(fmtMatch[1]), parseInt(fmtMatch[2])]
    }
    if (SUPPRESS_TRAILING_RE.test(comment)) {
      zeroSuppression = 'trailing'
    } else if (SUPPRESS_LEADING_RE.test(comment)) {
      zeroSuppression = 'leading'
    }
  }
}

function parseDrillCoords(str: string): Record<string, string> {
  const result: Record<string, string> = {}
  const re = /([XYxy])([+-]?\d*\.?\d+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(str)) !== null) {
    result[m[1].toLowerCase()] = m[2]
  }
  return result
}
