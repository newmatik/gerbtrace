<template>
  <UTabs :items="tabItems" :unmount-on-hide="false" size="sm" variant="link" color="neutral" class="w-full">
    <template #general>
      <div class="pt-4">
        <PackageFormGeneral />
      </div>
    </template>
    <template #accelerations>
      <div class="pt-4">
        <PackageFormAccelerations />
      </div>
    </template>
    <template #index-marks>
      <div class="pt-4">
        <PackageFormIndexMarks />
      </div>
    </template>
    <template #lead-groups>
      <div class="pt-4">
        <PackageFormLeadGroups />
      </div>
    </template>
    <template #centering>
      <div class="pt-4">
        <PackageFormCentering />
      </div>
    </template>
    <template #glue-dots>
      <div class="pt-4">
        <PackageFormGlueDots />
      </div>
    </template>
    <template #variations>
      <div class="pt-4">
        <PackageFormVariations />
      </div>
    </template>
  </UTabs>
</template>

<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import type { PackageDefinition, TpsysGenericLeadGroup, PackageVariation, MachineSettings } from '~/utils/package-types'
import { PACKAGE_FORM_KEY, type PackageFormData, type PackageType } from '~/composables/usePackageFormContext'

const props = defineProps<{
  modelValue: PackageDefinition
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: PackageDefinition]
}>()

const tabItems: TabsItem[] = [
  { label: 'General', icon: 'i-lucide-settings', slot: 'general' },
  { label: 'Lead Groups', icon: 'i-lucide-layers', slot: 'lead-groups' },
  { label: 'Accelerations', icon: 'i-lucide-gauge', slot: 'accelerations' },
  { label: 'Index Marks', icon: 'i-lucide-crosshair', slot: 'index-marks' },
  { label: 'Centering', icon: 'i-lucide-focus', slot: 'centering' },
  { label: 'Glue Dots', icon: 'i-lucide-droplet', slot: 'glue-dots' },
  { label: 'Variations', icon: 'i-lucide-copy', slot: 'variations' },
]

// ── Form data (decompose PackageDefinition into form fields) ──

const form = computed<PackageFormData>(() => {
  const pkg = props.modelValue
  const base: PackageFormData = {
    name: pkg.name,
    aliases: pkg.aliases ?? [],
    type: pkg.type,
    body: { ...pkg.body },
    height: pkg.height ? { ...pkg.height } : undefined,
    searchArea: pkg.searchArea ? { ...pkg.searchArea } : undefined,
    centerOffset: pkg.centerOffset ? { ...pkg.centerOffset } : undefined,
    machine: pkg.machine ? JSON.parse(JSON.stringify(pkg.machine)) : undefined,
    variations: pkg.variations ? JSON.parse(JSON.stringify(pkg.variations)) : undefined,
  }
  switch (pkg.type) {
    case 'Chip': base.chip = { ...pkg.chip }; break
    case 'ThreePole': base.threePole = { ...pkg.threePole }; break
    case 'TwoSymmetricLeadGroups': base.twoSymmetric = { ...pkg.twoSymmetric }; break
    case 'FourSymmetricLeadGroups': base.fourSymmetric = { ...pkg.fourSymmetric }; break
    case 'TwoPlusTwo': base.twoPlusTwo = { ...pkg.twoPlusTwo }; break
    case 'FourOnTwo': base.fourOnTwo = { ...pkg.fourOnTwo }; break
    case 'BGA': base.bga = { ...pkg.bga }; break
    case 'PT_GENERIC': base.generic = { leadGroups: pkg.generic.leadGroups.map(g => ({ ...g })) }; break
    case 'Outline': base.outline = { ...pkg.outline }; break
  }
  return base
})

// ── Shared helpers ──

function toNumber(val: string | number, integer = false): number {
  const next = typeof val === 'number' ? val : Number(val)
  if (!Number.isFinite(next)) return 0
  return integer ? Math.round(next) : next
}

function emitPkg(overrides: Record<string, any>) {
  const merged = { ...form.value, ...overrides }
  emit('update:modelValue', buildPackageDefinition(merged))
}

function buildPackageDefinition(data: PackageFormData): PackageDefinition {
  const base: any = {
    name: data.name,
    aliases: data.aliases,
    body: data.body,
  }
  // Attach optional physical / machine / variation properties
  if (data.height) base.height = data.height
  if (data.searchArea) base.searchArea = data.searchArea
  if (data.centerOffset) base.centerOffset = data.centerOffset
  if (data.machine && Object.keys(data.machine).length) base.machine = data.machine
  if (data.variations?.length) base.variations = data.variations

  switch (data.type) {
    case 'Chip':
      return { ...base, type: 'Chip', chip: data.chip! }
    case 'ThreePole':
      return { ...base, type: 'ThreePole', threePole: data.threePole! }
    case 'TwoSymmetricLeadGroups':
      return { ...base, type: 'TwoSymmetricLeadGroups', twoSymmetric: data.twoSymmetric! }
    case 'FourSymmetricLeadGroups':
      return { ...base, type: 'FourSymmetricLeadGroups', fourSymmetric: data.fourSymmetric! }
    case 'TwoPlusTwo':
      return { ...base, type: 'TwoPlusTwo', twoPlusTwo: data.twoPlusTwo! }
    case 'FourOnTwo':
      return { ...base, type: 'FourOnTwo', fourOnTwo: data.fourOnTwo! }
    case 'BGA':
      return { ...base, type: 'BGA', bga: data.bga! }
    case 'PT_GENERIC':
      return { ...base, type: 'PT_GENERIC', generic: data.generic ?? { leadGroups: [] } }
    case 'Outline':
      return { ...base, type: 'Outline', outline: data.outline! }
    default:
      return { ...base, type: 'Outline', outline: { length: 1, width: 1 } }
  }
}

// ── Provide context to sub-components ──

provide(PACKAGE_FORM_KEY, {
  form,
  readonly: computed(() => props.readonly ?? false),
  updateForm: emitPkg,
  toNumber,
})
</script>
