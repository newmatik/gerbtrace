import type { ComputedRef, InjectionKey } from 'vue'
import type {
  MachineSettings,
  PackageVariation,
  PackageDefinition,
  TpsysGenericLeadGroup,
} from '~/utils/package-types'

export type PackageType = PackageDefinition['type']

export interface PackageFormData {
  name: string
  aliases: string[]
  type: PackageType
  body: { length: number; width: number }
  // Physical properties
  height?: { nominal: number; min: number; max: number }
  searchArea?: { x: number; y: number }
  centerOffset?: { x: number; y: number }
  // Machine settings
  machine?: MachineSettings
  // Variations
  variations?: PackageVariation[]
  // Type-specific params
  chip?: { chipLength: number; leadWidth: number; leadLength: number }
  threePole?: { widthOverLeads: number; ccDistance: number; leadWidth: number; leadLength: number }
  twoSymmetric?: { numberOfLeads: number; widthOverLeads: number; leadPitch: number; leadWidth: number; leadLength: number }
  fourSymmetric?: { numberOfLeads: number; widthOverLeads: number; leadPitch: number; leadWidth: number; leadLength: number }
  twoPlusTwo?: { leadsLong: number; leadsShort: number; widthOverLeadsX: number; widthOverLeadsY: number; leadPitch: number; leadWidth: number; leadLength: number }
  fourOnTwo?: { leadsPerGroup: number; widthOverLeads: number; leadPitch: number; leadWidth: number; leadLength: number; groupGap: number }
  bga?: { leadsPerRow: number; leadsPerColumn: number; leadPitch: number; leadDiameter: number; leadsPerRowInHole?: number; leadsPerColumnInHole?: number }
  outline?: { length: number; width: number }
  generic?: { leadGroups: TpsysGenericLeadGroup[] }
}

export interface PackageFormContext {
  form: ComputedRef<PackageFormData>
  readonly: ComputedRef<boolean>
  updateForm: (overrides: Record<string, any>) => void
  toNumber: (val: string | number, integer?: boolean) => number
}

export const PACKAGE_FORM_KEY: InjectionKey<PackageFormContext> = Symbol('packageForm')

export function usePackageFormContext(): PackageFormContext {
  const ctx = inject(PACKAGE_FORM_KEY)
  if (!ctx) throw new Error('usePackageFormContext() must be used within a PackageForm component')
  return ctx
}
