<template>
  <div class="space-y-4">
    <!-- Package Name -->
    <div>
      <label class="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Package Name</label>
      <UInput
        :model-value="form.name"
        size="sm"
        placeholder="e.g. C0402, SOT-23, SOIC-8"
        :disabled="readonly"
        @update:model-value="update('name', $event)"
      />
    </div>

    <!-- Aliases -->
    <div>
      <label class="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Aliases (comma-separated)</label>
      <UInput
        :model-value="aliasesStr"
        size="sm"
        placeholder="e.g. R0402, C0402-ROUND"
        :disabled="readonly"
        @update:model-value="updateAliases($event)"
      />
    </div>

    <!-- Package Type -->
    <div>
      <label class="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Package Type</label>
      <USelect
        :model-value="form.type"
        size="sm"
        :items="typeOptions"
        value-key="value"
        label-key="label"
        :disabled="readonly"
        @update:model-value="changeType($event as PackageType)"
      />
    </div>

    <!-- Body Dimensions -->
    <fieldset class="border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 space-y-3">
      <legend class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 px-1">Body Dimensions (mm)</legend>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Length</label>
          <UInput
            :model-value="form.body.length"
            size="sm"
            type="number"
            step="0.1"
            min="0"
            :disabled="readonly"
            @update:model-value="updateBody('length', Number($event))"
          />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Width</label>
          <UInput
            :model-value="form.body.width"
            size="sm"
            type="number"
            step="0.1"
            min="0"
            :disabled="readonly"
            @update:model-value="updateBody('width', Number($event))"
          />
        </div>
      </div>
    </fieldset>

    <!-- Type-specific parameters -->
    <!-- Chip -->
    <fieldset v-if="form.type === 'Chip'" class="border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 space-y-3">
      <legend class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 px-1">Chip Parameters (mm)</legend>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Chip Length</label>
          <UInput :model-value="form.chip!.chipLength" size="sm" type="number" step="0.1" min="0" :disabled="readonly" @update:model-value="updateTypeParam('chip', 'chipLength', Number($event))" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Lead Width</label>
          <UInput :model-value="form.chip!.leadWidth" size="sm" type="number" step="0.1" min="0" :disabled="readonly" @update:model-value="updateTypeParam('chip', 'leadWidth', Number($event))" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Lead Length</label>
          <UInput :model-value="form.chip!.leadLength" size="sm" type="number" step="0.1" min="0" :disabled="readonly" @update:model-value="updateTypeParam('chip', 'leadLength', Number($event))" />
        </div>
      </div>
    </fieldset>

    <!-- ThreePole -->
    <fieldset v-if="form.type === 'ThreePole'" class="border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 space-y-3">
      <legend class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 px-1">Three-Pole Parameters (mm)</legend>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Width Over Leads</label>
          <UInput :model-value="form.threePole!.widthOverLeads" size="sm" type="number" step="0.1" min="0" :disabled="readonly" @update:model-value="updateTypeParam('threePole', 'widthOverLeads', Number($event))" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">CC Distance</label>
          <UInput :model-value="form.threePole!.ccDistance" size="sm" type="number" step="0.1" min="0" :disabled="readonly" @update:model-value="updateTypeParam('threePole', 'ccDistance', Number($event))" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Lead Width</label>
          <UInput :model-value="form.threePole!.leadWidth" size="sm" type="number" step="0.1" min="0" :disabled="readonly" @update:model-value="updateTypeParam('threePole', 'leadWidth', Number($event))" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Lead Length</label>
          <UInput :model-value="form.threePole!.leadLength" size="sm" type="number" step="0.1" min="0" :disabled="readonly" @update:model-value="updateTypeParam('threePole', 'leadLength', Number($event))" />
        </div>
      </div>
    </fieldset>

    <!-- TwoSymmetricLeadGroups -->
    <fieldset v-if="form.type === 'TwoSymmetricLeadGroups'" class="border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 space-y-3">
      <legend class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 px-1">Two-Symmetric Parameters (mm)</legend>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Number of Leads</label>
          <UInput :model-value="form.twoSymmetric!.numberOfLeads" size="sm" type="number" step="2" min="2" :disabled="readonly" @update:model-value="updateTypeParam('twoSymmetric', 'numberOfLeads', Number($event))" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Width Over Leads</label>
          <UInput :model-value="form.twoSymmetric!.widthOverLeads" size="sm" type="number" step="0.1" min="0" :disabled="readonly" @update:model-value="updateTypeParam('twoSymmetric', 'widthOverLeads', Number($event))" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Lead Pitch</label>
          <UInput :model-value="form.twoSymmetric!.leadPitch" size="sm" type="number" step="0.05" min="0" :disabled="readonly" @update:model-value="updateTypeParam('twoSymmetric', 'leadPitch', Number($event))" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Lead Width</label>
          <UInput :model-value="form.twoSymmetric!.leadWidth" size="sm" type="number" step="0.05" min="0" :disabled="readonly" @update:model-value="updateTypeParam('twoSymmetric', 'leadWidth', Number($event))" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Lead Length</label>
          <UInput :model-value="form.twoSymmetric!.leadLength" size="sm" type="number" step="0.05" min="0" :disabled="readonly" @update:model-value="updateTypeParam('twoSymmetric', 'leadLength', Number($event))" />
        </div>
      </div>
    </fieldset>

    <!-- FourSymmetricLeadGroups -->
    <fieldset v-if="form.type === 'FourSymmetricLeadGroups'" class="border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 space-y-3">
      <legend class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 px-1">Four-Symmetric Parameters (mm)</legend>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Number of Leads</label>
          <UInput :model-value="form.fourSymmetric!.numberOfLeads" size="sm" type="number" step="4" min="4" :disabled="readonly" @update:model-value="updateTypeParam('fourSymmetric', 'numberOfLeads', Number($event))" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Width Over Leads</label>
          <UInput :model-value="form.fourSymmetric!.widthOverLeads" size="sm" type="number" step="0.1" min="0" :disabled="readonly" @update:model-value="updateTypeParam('fourSymmetric', 'widthOverLeads', Number($event))" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Lead Pitch</label>
          <UInput :model-value="form.fourSymmetric!.leadPitch" size="sm" type="number" step="0.05" min="0" :disabled="readonly" @update:model-value="updateTypeParam('fourSymmetric', 'leadPitch', Number($event))" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Lead Width</label>
          <UInput :model-value="form.fourSymmetric!.leadWidth" size="sm" type="number" step="0.05" min="0" :disabled="readonly" @update:model-value="updateTypeParam('fourSymmetric', 'leadWidth', Number($event))" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Lead Length</label>
          <UInput :model-value="form.fourSymmetric!.leadLength" size="sm" type="number" step="0.05" min="0" :disabled="readonly" @update:model-value="updateTypeParam('fourSymmetric', 'leadLength', Number($event))" />
        </div>
      </div>
    </fieldset>

    <!-- BGA -->
    <fieldset v-if="form.type === 'BGA'" class="border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 space-y-3">
      <legend class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 px-1">BGA Parameters (mm)</legend>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Leads Per Row</label>
          <UInput :model-value="form.bga!.leadsPerRow" size="sm" type="number" step="1" min="1" :disabled="readonly" @update:model-value="updateTypeParam('bga', 'leadsPerRow', Number($event))" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Leads Per Column</label>
          <UInput :model-value="form.bga!.leadsPerColumn" size="sm" type="number" step="1" min="1" :disabled="readonly" @update:model-value="updateTypeParam('bga', 'leadsPerColumn', Number($event))" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Lead Pitch</label>
          <UInput :model-value="form.bga!.leadPitch" size="sm" type="number" step="0.1" min="0" :disabled="readonly" @update:model-value="updateTypeParam('bga', 'leadPitch', Number($event))" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Lead Diameter</label>
          <UInput :model-value="form.bga!.leadDiameter" size="sm" type="number" step="0.05" min="0" :disabled="readonly" @update:model-value="updateTypeParam('bga', 'leadDiameter', Number($event))" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Hole Rows</label>
          <UInput :model-value="form.bga!.leadsPerColumnInHole ?? 0" size="sm" type="number" step="1" min="0" :disabled="readonly" @update:model-value="updateTypeParam('bga', 'leadsPerColumnInHole', Number($event))" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Hole Columns</label>
          <UInput :model-value="form.bga!.leadsPerRowInHole ?? 0" size="sm" type="number" step="1" min="0" :disabled="readonly" @update:model-value="updateTypeParam('bga', 'leadsPerRowInHole', Number($event))" />
        </div>
      </div>
    </fieldset>

    <!-- Outline -->
    <fieldset v-if="form.type === 'Outline'" class="border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 space-y-3">
      <legend class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 px-1">Outline Parameters (mm)</legend>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Length</label>
          <UInput :model-value="form.outline!.length" size="sm" type="number" step="0.1" min="0" :disabled="readonly" @update:model-value="updateTypeParam('outline', 'length', Number($event))" />
        </div>
        <div>
          <label class="block text-[11px] text-neutral-400 mb-0.5">Width</label>
          <UInput :model-value="form.outline!.width" size="sm" type="number" step="0.1" min="0" :disabled="readonly" @update:model-value="updateTypeParam('outline', 'width', Number($event))" />
        </div>
      </div>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import type { PackageDefinition } from '~/utils/package-types'

type PackageType = PackageDefinition['type']

interface FormData {
  name: string
  aliases: string[]
  type: PackageType
  body: { length: number; width: number }
  chip?: { chipLength: number; leadWidth: number; leadLength: number }
  threePole?: { widthOverLeads: number; ccDistance: number; leadWidth: number; leadLength: number }
  twoSymmetric?: { numberOfLeads: number; widthOverLeads: number; leadPitch: number; leadWidth: number; leadLength: number }
  fourSymmetric?: { numberOfLeads: number; widthOverLeads: number; leadPitch: number; leadWidth: number; leadLength: number }
  bga?: { leadsPerRow: number; leadsPerColumn: number; leadPitch: number; leadDiameter: number; leadsPerRowInHole?: number; leadsPerColumnInHole?: number }
  outline?: { length: number; width: number }
}

const props = defineProps<{
  modelValue: PackageDefinition
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: PackageDefinition]
}>()

const typeOptions = [
  { label: 'Chip (2-terminal)', value: 'Chip' },
  { label: 'Three-Pole (SOT-23)', value: 'ThreePole' },
  { label: 'Two-Symmetric (SOIC, SSOP)', value: 'TwoSymmetricLeadGroups' },
  { label: 'Four-Symmetric (QFP, QFN)', value: 'FourSymmetricLeadGroups' },
  { label: 'BGA (Ball Grid Array)', value: 'BGA' },
  { label: 'Outline (body only)', value: 'Outline' },
]

// Decompose the PackageDefinition into form fields
const form = computed<FormData>(() => {
  const pkg = props.modelValue
  const base: FormData = {
    name: pkg.name,
    aliases: pkg.aliases ?? [],
    type: pkg.type,
    body: { ...pkg.body },
  }
  switch (pkg.type) {
    case 'Chip': base.chip = { ...pkg.chip }; break
    case 'ThreePole': base.threePole = { ...pkg.threePole }; break
    case 'TwoSymmetricLeadGroups': base.twoSymmetric = { ...pkg.twoSymmetric }; break
    case 'FourSymmetricLeadGroups': base.fourSymmetric = { ...pkg.fourSymmetric }; break
    case 'BGA': base.bga = { ...pkg.bga }; break
    case 'Outline': base.outline = { ...pkg.outline }; break
  }
  return base
})

const aliasesStr = computed(() => form.value.aliases.join(', '))

function updateAliases(val: string | number) {
  const str = String(val)
  const aliases = str.split(',').map(s => s.trim()).filter(Boolean)
  emitPkg({ aliases })
}

function update(field: 'name', val: string | number) {
  emitPkg({ [field]: String(val) })
}

function updateBody(field: 'length' | 'width', val: number) {
  emitPkg({ body: { ...form.value.body, [field]: val } })
}

function updateTypeParam(group: string, field: string, val: number) {
  const current = (form.value as any)[group] ?? {}
  emitPkg({ [group]: { ...current, [field]: val } })
}

/** Default parameters for each package type */
const typeDefaults: Record<PackageType, Partial<FormData>> = {
  Chip: {
    body: { length: 1.0, width: 0.5 },
    chip: { chipLength: 1.0, leadWidth: 0.5, leadLength: 0.25 },
  },
  ThreePole: {
    body: { length: 2.9, width: 1.3 },
    threePole: { widthOverLeads: 2.4, ccDistance: 1.9, leadWidth: 0.4, leadLength: 0.4 },
  },
  TwoSymmetricLeadGroups: {
    body: { length: 5.0, width: 4.0 },
    twoSymmetric: { numberOfLeads: 8, widthOverLeads: 6.0, leadPitch: 1.27, leadWidth: 0.4, leadLength: 0.8 },
  },
  FourSymmetricLeadGroups: {
    body: { length: 7.0, width: 7.0 },
    fourSymmetric: { numberOfLeads: 32, widthOverLeads: 9.0, leadPitch: 0.5, leadWidth: 0.25, leadLength: 0.5 },
  },
  BGA: {
    body: { length: 7.0, width: 7.0 },
    bga: { leadsPerRow: 8, leadsPerColumn: 8, leadPitch: 0.8, leadDiameter: 0.4, leadsPerRowInHole: 0, leadsPerColumnInHole: 0 },
  },
  Outline: {
    body: { length: 3.0, width: 2.0 },
    outline: { length: 3.0, width: 2.0 },
  },
}

function changeType(newType: PackageType) {
  if (newType === form.value.type) return
  const defaults = typeDefaults[newType]
  const newPkg = buildPackageDefinition({
    name: form.value.name,
    aliases: form.value.aliases,
    type: newType,
    body: defaults.body ?? form.value.body,
    ...defaults,
  })
  emit('update:modelValue', newPkg)
}

function emitPkg(overrides: Record<string, any>) {
  const merged = { ...form.value, ...overrides }
  emit('update:modelValue', buildPackageDefinition(merged))
}

function buildPackageDefinition(data: FormData): PackageDefinition {
  const base = { name: data.name, aliases: data.aliases, body: data.body }
  switch (data.type) {
    case 'Chip':
      return { ...base, type: 'Chip', chip: data.chip! }
    case 'ThreePole':
      return { ...base, type: 'ThreePole', threePole: data.threePole! }
    case 'TwoSymmetricLeadGroups':
      return { ...base, type: 'TwoSymmetricLeadGroups', twoSymmetric: data.twoSymmetric! }
    case 'FourSymmetricLeadGroups':
      return { ...base, type: 'FourSymmetricLeadGroups', fourSymmetric: data.fourSymmetric! }
    case 'BGA':
      return { ...base, type: 'BGA', bga: data.bga! }
    case 'Outline':
      return { ...base, type: 'Outline', outline: data.outline! }
  }
}
</script>
