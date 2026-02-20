/**
 * BOM (Bill of Materials) type definitions.
 */

/** Valid BOM line component types */
export const BOM_LINE_TYPES = ['SMD', 'THT', 'Mounting', 'Other'] as const
export type BomLineType = (typeof BOM_LINE_TYPES)[number]

/** SMD placement classification */
export const SMD_CLASSIFICATIONS = ['Fast', 'Slow', 'Finepitch', 'BGA'] as const
export type SmdClassification = (typeof SMD_CLASSIFICATIONS)[number]

/** A manufacturer entry for a BOM line */
export interface BomManufacturer {
  manufacturer: string
  manufacturerPart: string
}

/** A single BOM line item */
export interface BomLine {
  /** Unique identifier (UUID) */
  id: string
  /** Component description */
  description: string
  /** Component type */
  type: BomLineType
  /** Whether the component is customer-provided */
  customerProvided: boolean
  /** Customer item number */
  customerItemNo: string
  /** Required quantity */
  quantity: number
  /** Package / footprint name */
  package: string
  /** Reference designators, comma-separated (e.g. "R1, R2, R3") */
  references: string
  /** Free-form comment */
  comment: string
  /** Do Not Populate flag */
  dnp: boolean
  /** One or more manufacturer + part number entries */
  manufacturers: BomManufacturer[]
  /** Values from unmapped columns selected by the user (header name → cell value) */
  extra?: Record<string, string>
  /** Pin count (primarily for THT components) */
  pinCount?: number | null
  /** SMD placement classification */
  smdClassification?: SmdClassification | null
}

/** Cached Elexess pricing data for a single manufacturer part */
export interface BomPricingEntry {
  /** Raw Elexess search response JSON */
  data: any
  /** ISO 8601 timestamp when the data was fetched */
  fetchedAt: string
}

/** Pricing cache keyed by manufacturer part number */
export type BomPricingCache = Record<string, BomPricingEntry>

/** Column mapping used when auto-detection fails */
export interface BomColumnMapping {
  description?: number
  type?: number
  customerProvided?: number
  customerItemNo?: number
  quantity?: number
  package?: number
  references?: number
  comment?: number
  manufacturer?: number
  manufacturerPart?: number
}

/** AI-suggested enrichment for a single BOM line */
export interface AiSuggestion {
  description?: string
  type?: BomLineType
  pinCount?: number | null
  smdClassification?: SmdClassification | null
  manufacturers?: BomManufacturer[]
}

/** AI suggestions keyed by BomLine.id */
export type BomAiSuggestions = Record<string, AiSuggestion>
