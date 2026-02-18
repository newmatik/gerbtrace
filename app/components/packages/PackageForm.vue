<template>
  <UTabs :items="tabItems" :unmount-on-hide="false" size="sm" variant="link" color="neutral" class="w-full">
    <template #general>
      <div class="pt-4">
        <PackageFormGeneral />
      </div>
    </template>
    <template #attribution>
      <div class="pt-4">
        <PackageFormAttribution
          :provenance="props.modelValue.provenance"
          :library-attribution="props.libraryAttribution ?? undefined"
        />
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

interface PackageLibraryAttribution {
  upstreamOwner?: string
  upstreamRepo?: string
  upstreamUrl?: string
  notice?: string
}

const props = defineProps<{
  modelValue: PackageDefinition
  readonly?: boolean
  libraryAttribution?: PackageLibraryAttribution | null
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
  { label: 'Attribution', icon: 'i-lucide-bookmark', slot: 'attribution' },
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
    case 'PT_TWO_POLE': base.chip = { ...pkg.chip }; break
    case 'PT_THREE_POLE': base.threePole = { ...pkg.threePole }; break
    case 'PT_TWO_SYM': base.twoSymmetric = { ...pkg.twoSymmetric }; break
    case 'PT_FOUR_SYM': base.fourSymmetric = { ...pkg.fourSymmetric }; break
    case 'PT_TWO_PLUS_TWO': base.twoPlusTwo = { ...pkg.twoPlusTwo }; break
    case 'PT_FOUR_ON_TWO': base.fourOnTwo = { ...pkg.fourOnTwo }; break
    case 'PT_BGA': base.bga = { ...pkg.bga }; break
    case 'PT_GENERIC': base.generic = { leadGroups: pkg.generic.leadGroups.map(g => ({ ...g })) }; break
    case 'PT_OUTLINE': base.outline = { ...pkg.outline }; break
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
    provenance: props.modelValue.provenance,
  }
  // Attach optional physical / machine / variation properties
  if (data.height) base.height = data.height
  if (data.searchArea) base.searchArea = data.searchArea
  if (data.centerOffset) base.centerOffset = data.centerOffset
  if (data.machine && Object.keys(data.machine).length) base.machine = data.machine
  if (data.variations?.length) base.variations = data.variations

  switch (data.type) {
    case 'PT_TWO_POLE':
      return { ...base, type: 'PT_TWO_POLE', chip: data.chip! }
    case 'PT_THREE_POLE':
      return { ...base, type: 'PT_THREE_POLE', threePole: data.threePole! }
    case 'PT_TWO_SYM':
      return { ...base, type: 'PT_TWO_SYM', twoSymmetric: data.twoSymmetric! }
    case 'PT_FOUR_SYM':
      return { ...base, type: 'PT_FOUR_SYM', fourSymmetric: data.fourSymmetric! }
    case 'PT_TWO_PLUS_TWO':
      return { ...base, type: 'PT_TWO_PLUS_TWO', twoPlusTwo: data.twoPlusTwo! }
    case 'PT_FOUR_ON_TWO':
      return { ...base, type: 'PT_FOUR_ON_TWO', fourOnTwo: data.fourOnTwo! }
    case 'PT_BGA':
      return { ...base, type: 'PT_BGA', bga: data.bga! }
    case 'PT_GENERIC':
      return { ...base, type: 'PT_GENERIC', generic: data.generic ?? { leadGroups: [] } }
    case 'PT_OUTLINE':
      return { ...base, type: 'PT_OUTLINE', outline: data.outline! }
    default:
      return { ...base, type: 'PT_OUTLINE', outline: { length: 1, width: 1 } }
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
