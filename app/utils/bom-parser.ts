/**
 * BOM (Bill of Materials) file parser.
 *
 * Supports CSV, TSV (tab-delimited), semicolon-delimited, and Excel (.xlsx/.xls) files.
 * Auto-detects delimiter and column mapping from header row keywords.
 */

import * as XLSX from 'xlsx'
import type { BomLine, BomManufacturer, BomColumnMapping, BomLineType } from './bom-types'
import { BOM_LINE_TYPES } from './bom-types'

type Delimiter = '\t' | ',' | ';'

/**
 * Detect delimiter from content: tab first, then semicolon, then comma.
 * Same strategy as the PnP parser.
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
 * Parse a single CSV/TSV line into fields, respecting quoted fields.
 */
function splitLine(line: string, delimiter: Delimiter): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
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

/** Normalise a header string for keyword matching. */
function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

type BomColumnKey = keyof BomColumnMapping

/** Keyword patterns for auto-detecting BOM columns. */
const COLUMN_PATTERNS: [BomColumnKey, RegExp][] = [
  ['description', /^(description|desc|component|comp|partdescription|partdesc)$/],
  ['type', /^(type|componenttype|comptype|mounttype|mountingtype|category)$/],
  ['customerProvided', /^(customerprovided|custprovided|customer|customersupplied|custsupplied)$/],
  ['customerItemNo', /^(customeritemno|custitemno|customeritem|customerpartnumber|customerpartno|custpartno|custpn)$/],
  ['quantity', /^(quantity|qty|count|amount|pcs|pieces|number)$/],
  ['package', /^(package|footprint|pkg|fp|land|landpattern|case|casecode)$/],
  ['references', /^(references|refdes|ref|referencedesignators|refs|designators|designator|parts)$/],
  ['comment', /^(comment|comments|note|notes|remark|remarks)$/],
  ['manufacturer', /^(manufacturer|mfr|mfg|make|vendor|brand)$/],
  ['manufacturerPart', /^(manufacturerpart|mpn|mfpn|manufacturerpartnumber|mfrpart|mfgpart|mfrpn|mfgpn|partno|partnumber)$/],
]

/**
 * Attempt to auto-map column indices from header strings.
 * Returns a mapping or null if too few columns could be identified.
 */
export function autoMapBomColumns(headers: string[]): BomColumnMapping | null {
  const mapping: BomColumnMapping = {}
  let matchCount = 0

  for (let i = 0; i < headers.length; i++) {
    const h = normalise(headers[i] || '')
    if (!h) continue
    for (const [key, pattern] of COLUMN_PATTERNS) {
      if (mapping[key] === undefined && pattern.test(h)) {
        mapping[key] = i
        matchCount++
        break
      }
    }
  }

  // Require at least 2 mapped columns (e.g. references + quantity) to consider it valid
  if (matchCount < 2) return null
  return mapping
}

/**
 * Detect a BOM line type from a raw cell value.
 */
function parseBomLineType(raw: string): BomLineType {
  const upper = raw.toUpperCase().trim()
  for (const t of BOM_LINE_TYPES) {
    if (upper === t.toUpperCase()) return t
  }
  if (/^SM[DT]$/i.test(upper)) return 'SMD'
  if (/^TH[TD]$/i.test(upper) || /through/i.test(upper)) return 'THT'
  if (/mount/i.test(upper) || /mech/i.test(upper)) return 'Mounting'
  return 'Other'
}

/**
 * Parse a boolean-ish value ("yes", "true", "1", "y" → true).
 */
function parseBool(raw: string): boolean {
  const v = raw.toLowerCase().trim()
  return v === 'yes' || v === 'true' || v === '1' || v === 'y'
}

/**
 * Parse a quantity value, handling potential comma decimals.
 */
function parseQuantity(raw: string): number {
  const cleaned = raw.replace(/[^\d]/g, '')
  const n = parseInt(cleaned, 10)
  return isNaN(n) ? 0 : n
}

/**
 * Detect DNP (Do Not Populate) from row data.
 * Checks if the comment field contains "DNP" or any cell is exactly "DNP".
 */
function isDnpRow(row: string[], mapping: BomColumnMapping): boolean {
  const comment = mapping.comment !== undefined ? (row[mapping.comment] ?? '').trim().toUpperCase() : ''
  if (comment === 'DNP' || comment.includes('DNP') || comment.includes('DO NOT POPULATE')) return true
  // Also check if any cell is exactly "DNP"
  return row.some(cell => cell.trim().toUpperCase() === 'DNP')
}

/**
 * Build a BomLine array from tabular rows + column mapping.
 * Each row is a string[] of cell values.
 */
export function buildBomLines(rows: string[][], mapping: BomColumnMapping): BomLine[] {
  const lines: BomLine[] = []

  // Group rows by references to merge multiple manufacturer rows for the same line
  const linesByRef = new Map<string, BomLine>()

  for (const row of rows) {
    // Skip empty rows
    if (row.every(c => !c.trim())) continue

    const refs = mapping.references !== undefined ? (row[mapping.references] ?? '').trim() : ''
    const mfrName = mapping.manufacturer !== undefined ? (row[mapping.manufacturer] ?? '').trim() : ''
    const mfrPart = mapping.manufacturerPart !== undefined ? (row[mapping.manufacturerPart] ?? '').trim() : ''

    const manufacturer: BomManufacturer | null =
      mfrName || mfrPart ? { manufacturer: mfrName, manufacturerPart: mfrPart } : null

    // Check if we already have a line with these references (multi-manufacturer rows)
    const existing = refs ? linesByRef.get(refs) : undefined
    if (existing && manufacturer) {
      // Avoid duplicate manufacturers
      const isDup = existing.manufacturers.some(
        m => m.manufacturer === manufacturer.manufacturer && m.manufacturerPart === manufacturer.manufacturerPart,
      )
      if (!isDup) existing.manufacturers.push(manufacturer)
      continue
    }

    const line: BomLine = {
      id: crypto.randomUUID(),
      description: mapping.description !== undefined ? (row[mapping.description] ?? '').trim() : '',
      type: mapping.type !== undefined ? parseBomLineType(row[mapping.type] ?? '') : 'Other',
      customerProvided: mapping.customerProvided !== undefined ? parseBool(row[mapping.customerProvided] ?? '') : false,
      customerItemNo: mapping.customerItemNo !== undefined ? (row[mapping.customerItemNo] ?? '').trim() : '',
      quantity: mapping.quantity !== undefined ? parseQuantity(row[mapping.quantity] ?? '') : 0,
      package: mapping.package !== undefined ? (row[mapping.package] ?? '').trim() : '',
      references: refs,
      comment: mapping.comment !== undefined ? (row[mapping.comment] ?? '').trim() : '',
      dnp: isDnpRow(row, mapping),
      manufacturers: manufacturer ? [manufacturer] : [],
    }

    lines.push(line)
    if (refs) linesByRef.set(refs, line)
  }

  return lines
}

/** Result from the parsing pipeline before final BomLine[] assembly. */
export interface BomParseResult {
  /** Raw headers from the first row */
  headers: string[]
  /** Data rows (each is a string[]) */
  rows: string[][]
  /** Auto-detected column mapping, or null if mapping is ambiguous */
  mapping: BomColumnMapping | null
  /** If mapping was found, the assembled BOM lines */
  lines: BomLine[] | null
  /** Delimiter used for CSV-like files */
  delimiter?: Delimiter
  /** Detected header row index within the scanned data (after skipRows) */
  headerRowIndex?: number
}

export interface BomParseOptions {
  skipRows?: number
  mapping?: BomColumnMapping
}

function countMappedColumns(mapping: BomColumnMapping | null): number {
  if (!mapping) return 0
  let count = 0
  for (const val of Object.values(mapping)) {
    if (val !== undefined) count++
  }
  return count
}

/**
 * Parse a CSV/TSV string into headers + rows.
 */
export function parseBomCsv(content: string, options?: BomParseOptions): BomParseResult {
  const delimiter = detectDelimiter(content)
  const rawLines = content.split(/\r?\n/).filter(l => l.trim() !== '')
  if (rawLines.length === 0) return { headers: [], rows: [], mapping: null, lines: null }

  const skipRows = Math.max(0, options?.skipRows ?? 0)
  const linesToScan = rawLines.slice(skipRows)
  if (linesToScan.length === 0) return { headers: [], rows: [], mapping: null, lines: null, delimiter, headerRowIndex: 0 }

  if (options?.mapping) {
    const headers = splitLine(linesToScan[0]!, delimiter)
    const rows = linesToScan.slice(1).map(l => splitLine(l, delimiter))
    const lines = buildBomLines(rows, options.mapping)
    return { headers, rows, mapping: options.mapping, lines, delimiter, headerRowIndex: 0 }
  }

  let bestHeaderIndex = 0
  let bestMapping: BomColumnMapping | null = null
  let bestScore = -1
  const scanLimit = Math.min(linesToScan.length, 30)

  for (let i = 0; i < scanLimit; i++) {
    const candidateHeaders = splitLine(linesToScan[i]!, delimiter)
    const candidateMapping = autoMapBomColumns(candidateHeaders)
    const score = countMappedColumns(candidateMapping)
    if (score > bestScore) {
      bestScore = score
      bestHeaderIndex = i
      bestMapping = candidateMapping
    }
  }

  const headers = splitLine(linesToScan[bestHeaderIndex]!, delimiter)
  const rows = linesToScan.slice(bestHeaderIndex + 1).map(l => splitLine(l, delimiter))
  const mapping = bestMapping
  const lines = mapping ? buildBomLines(rows, mapping) : null

  return { headers, rows, mapping, lines, delimiter, headerRowIndex: bestHeaderIndex }
}

/**
 * Parse an Excel file (ArrayBuffer) into headers + rows.
 * Uses the first sheet.
 */
export function parseBomExcel(buffer: ArrayBuffer, options?: BomParseOptions): BomParseResult {
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buffer, { type: 'array' })
  } catch (e) {
    console.warn('[BOM] Failed to parse Excel file:', e)
    return { headers: [], rows: [], mapping: null, lines: null }
  }
  return parseBomWorkbook(wb, options)
}

function parseBomWorkbook(wb: XLSX.WorkBook, options?: BomParseOptions): BomParseResult {
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { headers: [], rows: [], mapping: null, lines: null }

  const sheet = wb.Sheets[sheetName]!
  const data: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })

  if (data.length === 0) return { headers: [], rows: [], mapping: null, lines: null }

  const skipRows = Math.max(0, options?.skipRows ?? 0)
  const rowsToScan = data.slice(skipRows).map(row => row.map(String))
  if (rowsToScan.length === 0) return { headers: [], rows: [], mapping: null, lines: null, headerRowIndex: 0 }

  if (options?.mapping) {
    const headers = rowsToScan[0] ?? []
    const rows = rowsToScan.slice(1)
    const lines = buildBomLines(rows, options.mapping)
    return { headers, rows, mapping: options.mapping, lines, headerRowIndex: 0 }
  }

  let bestHeaderIndex = 0
  let bestMapping: BomColumnMapping | null = null
  let bestScore = -1
  const scanLimit = Math.min(rowsToScan.length, 30)

  for (let i = 0; i < scanLimit; i++) {
    const candidateHeaders = rowsToScan[i] ?? []
    const candidateMapping = autoMapBomColumns(candidateHeaders)
    const score = countMappedColumns(candidateMapping)
    if (score > bestScore) {
      bestScore = score
      bestHeaderIndex = i
      bestMapping = candidateMapping
    }
  }

  const headers = rowsToScan[bestHeaderIndex] ?? []
  const rows = rowsToScan.slice(bestHeaderIndex + 1)
  const mapping = bestMapping
  const lines = mapping ? buildBomLines(rows, mapping) : null

  return { headers, rows, mapping, lines, headerRowIndex: bestHeaderIndex }
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

/**
 * Entry point: parse a BOM file by name and content.
 * For CSV/TSV/TXT, pass the string content.
 * For Excel, pass the ArrayBuffer.
 */
export function parseBomFile(fileName: string, content: string | ArrayBuffer, options?: BomParseOptions): BomParseResult {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    if (content instanceof ArrayBuffer) return parseBomExcel(content, options)
    if (/^data:.*;base64,/i.test(content)) {
      const buffer = dataUrlToArrayBuffer(content)
      if (buffer) return parseBomExcel(buffer, options)
    }
    try {
      const wb = XLSX.read(content, { type: 'binary' })
      return parseBomWorkbook(wb, options)
    } catch {
      const buffer = new TextEncoder().encode(content).buffer
      return parseBomExcel(buffer as ArrayBuffer, options)
    }
  }
  const text = typeof content === 'string' ? content : new TextDecoder().decode(content)
  return parseBomCsv(text, options)
}
