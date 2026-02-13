/**
 * Gerber Source Editor
 *
 * Utilities for modifying Gerber file source text by removing specific
 * character ranges (corresponding to deleted graphics).
 */

import type { SourceRange } from './types'

/**
 * Remove the specified character ranges from the source string.
 *
 * - Sorts and merges overlapping/adjacent ranges
 * - Builds a new string with the ranges removed
 * - Cleans up resulting blank lines
 *
 * @param source The original Gerber file source text
 * @param ranges Array of [start, end) character ranges to remove
 * @returns Modified source with the ranges excised
 */
export function removeSourceRanges(source: string, ranges: SourceRange[]): string {
  if (ranges.length === 0) return source

  // Sort ranges by start position
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])

  // Merge overlapping/adjacent ranges
  const merged: SourceRange[] = [sorted[0]!]
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!
    const last = merged[merged.length - 1]!
    if (current[0] <= last[1]) {
      // Overlapping or adjacent — extend
      last[1] = Math.max(last[1], current[1])
    } else {
      merged.push([...current])
    }
  }

  // Build result by copying everything except the deleted ranges.
  // For each removed range, also consume surrounding whitespace/newlines
  // to avoid leaving blank lines.
  const parts: string[] = []
  let cursor = 0

  for (const [start, end] of merged) {
    // Copy content before this range
    if (start > cursor) {
      parts.push(source.slice(cursor, start))
    }

    // Advance cursor past the range
    cursor = end

    // Consume trailing whitespace (spaces/tabs) after the removed range
    while (cursor < source.length && (source[cursor] === ' ' || source[cursor] === '\t')) {
      cursor++
    }
    // Consume a single trailing newline (or \r\n) to avoid blank lines
    if (cursor < source.length && source[cursor] === '\r') cursor++
    if (cursor < source.length && source[cursor] === '\n') cursor++
    // If the range started at the beginning of a line, also consume
    // a trailing * (end-of-block marker in Gerber)
    if (cursor < source.length && source[cursor] === '*') cursor++
    if (cursor < source.length && source[cursor] === '\r') cursor++
    if (cursor < source.length && source[cursor] === '\n') cursor++
  }

  // Copy remaining content after last range
  if (cursor < source.length) {
    parts.push(source.slice(cursor))
  }

  let result = parts.join('')

  // Clean up: remove any blank lines that were left behind
  result = result.replace(/\n[ \t]*\n/g, '\n')

  return result
}
