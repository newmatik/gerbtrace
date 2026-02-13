/**
 * Newmatik Gerber Parser
 *
 * Parses RS-274X Gerber files and Excellon drill files into a typed AST.
 *
 * Architecture inspired by tracespace (https://github.com/tracespace/tracespace)
 * by @mcous, licensed under MIT.
 */

import type { GerberAST } from './types'
import { parseGerberSource } from './parser'
import { parseDrillSource } from './drill-parser'

export type { GerberAST, ASTNode } from './types'
export type { ImageTree, ImageGraphic } from './types'

/**
 * Auto-detect file type and parse accordingly.
 */
export function parseGerber(source: string): GerberAST {
  const filetype = detectFileType(source)
  if (filetype === 'drill') {
    return parseDrillSource(source)
  }
  return parseGerberSource(source)
}

/**
 * Detect whether a file is a Gerber or Excellon drill file.
 *
 * Heuristic:
 * - Drill files typically start with M48 or have T commands in a header
 * - Gerber files typically start with % extended blocks (%FS, %MO, %AD, etc.)
 * - Excellon also uses % but as a standalone rewind/header marker (just "%" on a line)
 */
function detectFileType(source: string): 'gerber' | 'drill' {
  // Trim leading whitespace/newlines (addresses tracespace #307)
  const trimmed = source.trimStart()

  // Strong drill indicators
  if (trimmed.startsWith('M48')) return 'drill'

  // If starts with %, determine if it's a Gerber extended block or Excellon header marker
  if (trimmed.startsWith('%')) {
    // In Gerber, % is followed by command content on the same logical line (e.g., %MOIN*%)
    // In Excellon, % is standalone on a line, often followed by M48
    const afterPercent = trimmed.slice(1).trimStart()
    const firstChar = afterPercent[0]

    // If % is immediately followed by content that looks like Gerber extended commands
    if (firstChar && firstChar !== '\n' && firstChar !== '\r' && firstChar !== '%') {
      // Check for common Gerber extended prefixes
      if (/^(MO|FS|AD|AM|LP|LM|LR|LS|SR|TF|TA|TD|TO|IP|OF|IN|AS|IR)/.test(afterPercent)) {
        return 'gerber'
      }
    }

    // The % was standalone or not a clear Gerber prefix — check next lines for drill markers
    const lines = trimmed.split('\n', 20)
    for (const line of lines) {
      const l = line.trim()
      if (l === 'M48') return 'drill'
      if (/^T\d+C[\d.]/.test(l)) return 'drill'
      if (l.startsWith('%FS') || l.startsWith('%MO') || l.startsWith('%AD') || l.startsWith('%AM')) return 'gerber'
    }
  }

  // G04 comment is a Gerber indicator
  if (trimmed.startsWith('G04')) return 'gerber'

  // Check first few lines for comments (drill) or Gerber extended commands
  if (trimmed.startsWith(';')) {
    const lines = trimmed.split('\n', 20)
    for (const line of lines) {
      if (line.trim() === 'M48') return 'drill'
      if (line.trim().startsWith('%FS')) return 'gerber'
      if (line.trim().startsWith('%MO')) return 'gerber'
    }
    return 'drill'
  }

  // Check for Gerber extended commands in first 50 lines
  const lines = trimmed.split('\n', 50)
  for (const line of lines) {
    const l = line.trim()
    if (l.includes('%FS') || l.includes('%MO') || l.includes('%AD') || l.includes('%AM')) return 'gerber'
    if (l === 'M48' || /^T\d+C[\d.]/.test(l)) return 'drill'
  }

  // Default to gerber
  return 'gerber'
}
