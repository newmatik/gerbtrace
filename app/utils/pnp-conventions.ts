export type RotationPositiveDirection = 'cw' | 'ccw'

/** Available PnP convention choices in the UI */
export type PnPConvention = 'mycronic' | 'ipc7351' | 'iec61188'

/** Package type keys (must match `PackageDefinition['type']` — uses TPSys technical names) */
export type PackageTypeKey =
  | 'PT_TWO_POLE'
  | 'PT_THREE_POLE'
  | 'PT_TWO_SYM'
  | 'PT_FOUR_SYM'
  | 'PT_TWO_PLUS_TWO'
  | 'PT_FOUR_ON_TWO'
  | 'PT_BGA'
  | 'PT_OUTLINE'
  | 'PT_GENERIC'

export interface PnPConventionConfig {
  /** Label shown in the UI selector */
  label: string
  /** Whether positive rotation numbers in the PnP file mean CW or CCW (top view) */
  rotationPositive: RotationPositiveDirection
  /**
   * Degrees CCW to add after normalising direction to CCW.
   *
   * Final formula used by the renderer:
   *   rotationCCW = (rotationPositive === 'ccw' ? +1 : -1) * pnpRotation + offsetDegByType[pkg.type]
   */
  offsetDegByType: Partial<Record<PackageTypeKey, number>>
}

/**
 * Authoritative PnP convention configuration.
 *
 * This is the single place to change:
 * - available conventions (Mycronic / IPC-7351 / IEC 61188-7)
 * - rotation direction (CW vs CCW positive)
 * - per-package-type offset angles
 *
 * Baseline: ALL package definitions are authored in Mycronic/TPSys 0°.
 */
export const PNP_CONVENTIONS: Record<PnPConvention, PnPConventionConfig> = {
  mycronic: {
    label: 'Mycronic',
    rotationPositive: 'cw',
    offsetDegByType: {
      PT_TWO_POLE: 0,
      PT_THREE_POLE: 0,
      PT_TWO_SYM: 0,
      PT_FOUR_SYM: 0,
      PT_TWO_PLUS_TWO: 0,
      PT_FOUR_ON_TWO: 0,
      PT_BGA: 0,
      PT_OUTLINE: 0,
      PT_GENERIC: 0,
    },
  },
  ipc7351: {
    label: 'IPC-7351',
    rotationPositive: 'ccw',
    offsetDegByType: {
      // PT_TWO_POLE: IPC 0° differs from Mycronic/TPSys baseline (pad1 top vs left)
      PT_TWO_POLE: 90,

      // All other package types match Mycronic baseline at 0°
      PT_THREE_POLE: 0,
      PT_TWO_SYM: 0,
      PT_FOUR_SYM: 0,
      PT_TWO_PLUS_TWO: 0,
      PT_FOUR_ON_TWO: 0,
      PT_BGA: 0,
      PT_OUTLINE: 0,
      PT_GENERIC: 0,
    },
  },
  iec61188: {
    label: 'IEC 61188-7',
    rotationPositive: 'ccw',
    offsetDegByType: {
      // IEC behaves like IPC, but the 0° reference is rotated 90° CCW for leaded packages.
      // PT_TWO_POLE: same as IPC
      PT_TWO_POLE: 90,

      // Leaded multi-pin: +90° CCW vs IPC
      PT_THREE_POLE: 90,
      PT_TWO_SYM: 90,
      PT_FOUR_SYM: 90,
      PT_TWO_PLUS_TWO: 90,
      PT_FOUR_ON_TWO: 90,

      // BGA: same as IPC
      PT_BGA: 0,
      PT_OUTLINE: 0,
      PT_GENERIC: 90,
    },
  },
}

export const PNP_CONVENTION_LABELS: Record<PnPConvention, string> = {
  mycronic: PNP_CONVENTIONS.mycronic.label,
  ipc7351: PNP_CONVENTIONS.ipc7351.label,
  iec61188: PNP_CONVENTIONS.iec61188.label,
}

