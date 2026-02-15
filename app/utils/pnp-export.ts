import type { EditablePnPComponent } from '~/composables/usePickAndPlace'
import type { PnPConvention, PackageTypeKey } from '~/utils/pnp-conventions'
import { PNP_CONVENTIONS } from '~/utils/pnp-conventions'
import type { PackageDefinition } from '~/utils/package-types'

export type PnPExportFormat = 'tsv' | 'csv'
export type PnPExportSideMode = 'combined' | 'top' | 'bottom' | 'separate'

export interface PnPExportOptions {
  /** Project name for the header comment */
  projectName: string
  /** Convention the input PnP data is in (as selected in the component panel) */
  inputConvention: PnPConvention
  /** Convention to write the export in */
  outputConvention: PnPConvention
  /** Tab-separated or comma-separated */
  format: PnPExportFormat
  /** Components to export */
  components: EditablePnPComponent[]
  /** Look up a PackageDefinition by PnP package name (needed for rotation conversion) */
  matchPackage: (packageName: string) => PackageDefinition | undefined
  /** Whether to exclude DNP components (default: false — include but mark) */
  excludeDnp?: boolean
}

/** Human-readable convention labels for the export header */
const CONVENTION_EXPORT_LABELS: Record<PnPConvention, string> = {
  mycronic: 'Mycronic convention',
  ipc7351: 'IPC-7351 convention',
  iec61188: 'IEC 61188-7 convention',
}

/** Normalise an angle to the 0–359.99… range. */
function normaliseDeg(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/** Format a rotation value consistently: integers stay plain, decimals get up to 2 places. */
function fmtRotation(deg: number): string {
  const n = normaliseDeg(deg)
  if (Number.isInteger(n)) return n.toString()
  return n.toFixed(2).replace(/\.?0+$/, '')
}

/** Format a coordinate to 4 decimal places, trimming trailing zeros. */
function fmtCoord(val: number): string {
  return val.toFixed(4).replace(/\.?0+$/, '')
}

/** Format a boolean as "yes"/"no" for export columns. */
function fmtYesNo(value: boolean): string {
  return value ? 'yes' : 'no'
}

/** Format export timestamp: YYYY-MM-DD HH:MM */
function fmtTimestamp(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Convert a rotation value from one PnP convention to another.
 *
 * 1. Map the input rotation to a canonical baseline (degrees CCW, top view):
 *      baselineCCW = inputDirection * inputRotation + inputOffset
 *
 * 2. Map from baseline to the output convention:
 *      outputRotation = outputDirection * (baselineCCW − outputOffset)
 *
 * The per-package-type offsets account for different 0° reference orientations
 * across conventions (e.g. Chip pad-1 at top vs left).
 *
 * @param packageType  Matched package type, or null if the component's package
 *                     could not be resolved.  When null, offsets are assumed 0
 *                     (direction-only conversion).
 */
function convertRotation(
  inputRotation: number,
  inputConvention: PnPConvention,
  outputConvention: PnPConvention,
  packageType: PackageTypeKey | null,
): number {
  if (inputConvention === outputConvention) return inputRotation

  const inputCfg = PNP_CONVENTIONS[inputConvention]
  const outputCfg = PNP_CONVENTIONS[outputConvention]

  const inputDir = inputCfg.rotationPositive === 'ccw' ? 1 : -1
  const outputDir = outputCfg.rotationPositive === 'ccw' ? 1 : -1

  const inputOffset = packageType ? (inputCfg.offsetDegByType[packageType] ?? 0) : 0
  const outputOffset = packageType ? (outputCfg.offsetDegByType[packageType] ?? 0) : 0

  const baselineCCW = inputDir * inputRotation + inputOffset
  const outputRotation = outputDir * (baselineCCW - outputOffset)

  return normaliseDeg(outputRotation)
}

/**
 * Build comment fragments for a single component.
 * Joins multiple notes (rotation override, convention conversion info) with "; ".
 */
function buildComment(
  comp: EditablePnPComponent,
  convertedRotation: number,
  needsConversion: boolean,
  packageMatched: boolean,
): string {
  const parts: string[] = []

  if (comp.dnp) {
    parts.push('DNP')
  }

  if (comp.rotationOverridden) {
    parts.push(`Rotation edited (was ${fmtRotation(comp.originalRotation)}°)`)
  }

  if (needsConversion && !packageMatched) {
    parts.push('Package unmatched, rotation offset may differ')
  }

  return parts.join('; ')
}

/**
 * Escape a field value for CSV output.
 * Wraps in double-quotes if the value contains commas, quotes, or newlines.
 */
function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Generate a Pick & Place export file as a string.
 *
 * Format follows industry-standard column layout with assembly flags:
 *   Designator, Mid X, Mid Y, Rotation, Side, Value, Package, CAD Package, Polarized, Populated, Comment
 *
 * The first line is a comment with project metadata.
 * Rotation values are converted between conventions when input ≠ output.
 */
export function generatePnPExport(options: PnPExportOptions): string {
  const {
    projectName,
    inputConvention,
    outputConvention,
    format,
    components,
    matchPackage,
    excludeDnp = false,
  } = options

  const delimiter = format === 'tsv' ? '\t' : ','
  const escape = format === 'csv' ? csvEscape : (v: string) => v
  const needsConversion = inputConvention !== outputConvention

  const timestamp = fmtTimestamp(new Date())
  const conventionLabel = CONVENTION_EXPORT_LABELS[outputConvention]
  const name = projectName || 'Untitled'

  const lines: string[] = []

  // Header comment
  lines.push(`# ${name}, ${conventionLabel}, metric (mm), exported ${timestamp} from Gerbtrace`)

  // Column header
  const headers = ['Designator', 'Mid X', 'Mid Y', 'Rotation', 'Side', 'Value', 'Package', 'CAD Package', 'Polarized', 'Populated', 'Comment']
  lines.push(headers.join(delimiter))

  // Filter out DNP if requested
  const filtered = excludeDnp ? components.filter(c => !c.dnp) : components

  // Sort: top before bottom, then by designator (natural sort)
  const sorted = [...filtered].sort((a, b) => {
    if (a.side !== b.side) return a.side === 'top' ? -1 : 1
    return a.designator.localeCompare(b.designator, undefined, { numeric: true })
  })

  for (const comp of sorted) {
    const exportPkg = (comp as any).matchedPackage || comp.package
    const cadPkg = (comp as any).cadPackage || comp.package
    const pkg = matchPackage(exportPkg)
    const packageType: PackageTypeKey | null = pkg?.type ?? null

    const rotation = convertRotation(comp.rotation, inputConvention, outputConvention, packageType)
    const comment = buildComment(comp, rotation, needsConversion, !!pkg)

    const row = [
      escape(comp.designator),
      fmtCoord(comp.x),
      fmtCoord(comp.y),
      fmtRotation(rotation),
      comp.side,
      escape(comp.value),
      escape(exportPkg),
      escape(cadPkg),
      fmtYesNo(!!comp.polarized),
      fmtYesNo(!comp.dnp),
      escape(comment),
    ]
    lines.push(row.join(delimiter))
  }

  // Trailing newline
  return lines.join('\n') + '\n'
}

/**
 * Get the file extension for a given export format.
 */
export function getPnPExportExtension(format: PnPExportFormat): string {
  return format === 'csv' ? '.csv' : '.txt'
}

/**
 * Get the MIME type for a given export format.
 */
export function getPnPExportMimeType(format: PnPExportFormat): string {
  return format === 'csv' ? 'text/csv' : 'text/plain'
}
