export type RotationPositiveDirection = 'cw' | 'ccw'

/** Available PnP convention choices in the UI */
export type PnPConvention = 'mycronic' | 'ipc7351' | 'iec61188'

/** Package type keys (must match `PackageDefinition['type']`) */
export type PackageTypeKey =
  | 'Chip'
  | 'ThreePole'
  | 'TwoSymmetricLeadGroups'
  | 'FourSymmetricLeadGroups'
  | 'BGA'
  | 'Outline'
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
      Chip: 0,
      ThreePole: 0,
      TwoSymmetricLeadGroups: 0,
      FourSymmetricLeadGroups: 0,
      BGA: 0,
      Outline: 0,
      PT_GENERIC: 0,
    },
  },
  ipc7351: {
    label: 'IPC-7351',
    rotationPositive: 'ccw',
    offsetDegByType: {
      // Chip: IPC 0° differs from Mycronic/TPSys baseline (pad1 top vs left)
      Chip: 90,

      // All other package types match Mycronic baseline at 0°
      ThreePole: 0,
      TwoSymmetricLeadGroups: 0,
      FourSymmetricLeadGroups: 0,
      BGA: 0,
      Outline: 0,
      PT_GENERIC: 0,
    },
  },
  iec61188: {
    label: 'IEC 61188-7',
    rotationPositive: 'ccw',
    offsetDegByType: {
      // Per your instruction:
      // IEC behaves like IPC, but the 0° reference is rotated 90° CCW for leaded packages.
      // Chip: same as IPC
      Chip: 90,

      // Leaded multi-pin: +90° CCW vs IPC
      ThreePole: 90,
      TwoSymmetricLeadGroups: 90,
      FourSymmetricLeadGroups: 90,

      // BGA: same as IPC
      BGA: 0,
      Outline: 0,
      PT_GENERIC: 90,
    },
  },
}

export const PNP_CONVENTION_LABELS: Record<PnPConvention, string> = {
  mycronic: PNP_CONVENTIONS.mycronic.label,
  ipc7351: PNP_CONVENTIONS.ipc7351.label,
  iec61188: PNP_CONVENTIONS.iec61188.label,
}

