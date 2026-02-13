/**
 * Gerber/Excellon tokenizer
 *
 * Splits raw Gerber text into a flat token stream. Handles:
 * - Extended commands: %...%
 * - Aperture macros: %AM...% (kept as single token, not split on *)
 * - G-codes: G01, G02, G03, G04 (comments), G36/G37, G54, G74/G75
 * - D-codes: D01, D02, D03, D10+
 * - M-codes: M00, M02
 * - Coordinate blocks: X...Y...I...J...D01/D02/D03*
 * - Comments in Gerber (G04) and drill (;)
 */

export interface Token {
  type: TokenType
  value: string
  line: number
  /** Character offset of the start of this token in the source string */
  sourceStart: number
  /** Character offset past the end of this token in the source string */
  sourceEnd: number
}

export type TokenType =
  | 'extended'    // %...% block (without the delimiters)
  | 'gcode'       // G-code (e.g., "01", "36")
  | 'dcode'       // D-code for operations (01, 02, 03)
  | 'toolSelect'  // D-code for tool selection (10+)
  | 'mcode'       // M-code
  | 'coord'       // Coordinate block (X...Y...I...J...)
  | 'comment'     // Comment text
  | 'newline'     // Line separator (for drill file line-based parsing)
  | 'word'        // Generic word (for drill file parsing)

export function tokenizeGerber(source: string): Token[] {
  const tokens: Token[] = []
  let pos = 0
  let line = 1

  while (pos < source.length) {
    const ch = source[pos]

    // Skip whitespace (except newlines which may matter for drill)
    if (ch === '\r') {
      pos++
      continue
    }

    if (ch === '\n') {
      line++
      pos++
      continue
    }

    if (ch === ' ' || ch === '\t') {
      pos++
      continue
    }

    // Extended command block: %...%
    if (ch === '%') {
      const blockSourceStart = pos
      pos++
      const start = pos
      while (pos < source.length && source[pos] !== '%') {
        if (source[pos] === '\n') line++
        pos++
      }
      const content = source.slice(start, pos).replace(/[\r\n]/g, '')
      pos++ // skip closing %
      const blockSourceEnd = pos

      // Aperture macro definitions (%AM...%) must be kept as a single token
      // because the macro body uses * as primitive delimiter, not command separator
      if (content.startsWith('AM')) {
        tokens.push({ type: 'extended', value: content, line, sourceStart: blockSourceStart, sourceEnd: blockSourceEnd })
      } else {
        // Split on * to get individual extended commands
        const parts = content.split('*').filter(p => p.length > 0)
        for (const part of parts) {
          tokens.push({ type: 'extended', value: part, line, sourceStart: blockSourceStart, sourceEnd: blockSourceEnd })
        }
      }
      continue
    }

    // End-of-block marker
    if (ch === '*') {
      pos++
      continue
    }

    // G-code (may be followed by coordinates on the same block, e.g., G01X...Y...D01*)
    if (ch === 'G' || ch === 'g') {
      const gSourceStart = pos
      pos++
      const numStart = pos
      while (pos < source.length && /\d/.test(source[pos])) pos++
      const code = source.slice(numStart, pos)

      if (code === '04' || code === '4') {
        // G04 comment - read until * or newline
        const commentStart = pos
        while (pos < source.length && source[pos] !== '*' && source[pos] !== '\n') pos++
        const text = source.slice(commentStart, pos).trim()
        if (pos < source.length && source[pos] === '*') pos++
        tokens.push({ type: 'comment', value: text, line, sourceStart: gSourceStart, sourceEnd: pos })
      } else {
        tokens.push({ type: 'gcode', value: code.padStart(2, '0'), line, sourceStart: gSourceStart, sourceEnd: pos })
        // Don't consume further — next char (X, Y, D) will be picked up on next loop
      }
      continue
    }

    // M-code
    if (ch === 'M' || ch === 'm') {
      const mSourceStart = pos
      pos++
      const numStart = pos
      while (pos < source.length && /\d/.test(source[pos])) pos++
      tokens.push({ type: 'mcode', value: source.slice(numStart, pos).padStart(2, '0'), line, sourceStart: mSourceStart, sourceEnd: pos })
      continue
    }

    // D-code (standalone, at start of line or after *)
    if (ch === 'D' || ch === 'd') {
      const dSourceStart = pos
      const ahead = source.slice(pos + 1)
      const match = ahead.match(/^(\d+)/)
      if (match) {
        const code = parseInt(match[1], 10)
        pos += 1 + match[1].length
        if (code >= 10) {
          tokens.push({ type: 'toolSelect', value: `D${code}`, line, sourceStart: dSourceStart, sourceEnd: pos })
        } else if (code === 1) {
          tokens.push({ type: 'dcode', value: '01', line, sourceStart: dSourceStart, sourceEnd: pos })
        } else if (code === 2) {
          tokens.push({ type: 'dcode', value: '02', line, sourceStart: dSourceStart, sourceEnd: pos })
        } else if (code === 3) {
          tokens.push({ type: 'dcode', value: '03', line, sourceStart: dSourceStart, sourceEnd: pos })
        }
        continue
      }
    }

    // Coordinate block: starts with X, Y, I, or J
    if (/[XYIJxyij]/.test(ch)) {
      const blockStart = pos
      let emittedDCode = false
      // Read the coordinate data until we hit end-of-block, G-code, or M-code
      while (pos < source.length) {
        const c = source[pos]
        if (c === '*' || c === '\n' || c === '\r' || c === '%') break
        // G or M starts a new command
        if ((c === 'G' || c === 'M' || c === 'g' || c === 'm') && pos > blockStart) break
        // D followed by digits: part of this coord block (trailing D-code)
        if ((c === 'D' || c === 'd') && pos > blockStart) {
          const dAhead = source.slice(pos + 1).match(/^(\d+)/)
          if (dAhead) {
            const dCode = parseInt(dAhead[1], 10)
            const coordStr = source.slice(blockStart, pos)
            if (coordStr.length > 0) {
              tokens.push({ type: 'coord', value: coordStr, line, sourceStart: blockStart, sourceEnd: pos })
            }
            const dStart = pos
            pos += 1 + dAhead[1].length
            if (dCode >= 10) {
              tokens.push({ type: 'toolSelect', value: `D${dCode}`, line, sourceStart: dStart, sourceEnd: pos })
            } else {
              tokens.push({ type: 'dcode', value: dCode.toString().padStart(2, '0'), line, sourceStart: dStart, sourceEnd: pos })
            }
            emittedDCode = true
            break
          }
          break
        }
        pos++
      }
      if (!emittedDCode && pos > blockStart) {
        const val = source.slice(blockStart, pos)
        if (val.length > 0 && /[XYIJxyij]/.test(val[0])) {
          tokens.push({ type: 'coord', value: val, line, sourceStart: blockStart, sourceEnd: pos })
        }
      }
      continue
    }

    // Skip unknown characters
    pos++
  }

  return tokens
}

/**
 * Parse coordinate axes from a coordinate string like "X12345Y67890I100J200"
 */
export function parseCoordAxes(coordStr: string): Record<string, string> {
  const result: Record<string, string> = {}
  const re = /([XYIJxyij])([+-]?\d*\.?\d+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(coordStr)) !== null) {
    result[m[1].toLowerCase()] = m[2]
  }
  return result
}
