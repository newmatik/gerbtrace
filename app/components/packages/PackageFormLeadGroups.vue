<template>
  <div class="space-y-4">
    <!-- Package Type Selector -->
    <fieldset class="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <legend class="px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Package Type</legend>
      <USelect
        :model-value="form.type"
        size="sm"
        :items="typeOptions"
        value-key="value"
        label-key="label"
        :disabled="isReadonly"
        @update:model-value="changeType($event as PackageType)"
      />
      <p class="text-xs text-neutral-400">
        {{ currentTypeMeta.description }}
      </p>
    </fieldset>

    <!-- Type-Specific Parameters -->
    <fieldset class="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <legend class="px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
        {{ currentTypeMeta.title }}
      </legend>
      <p class="text-xs text-neutral-400">
        TPSys class: <span class="font-medium">{{ currentTypeMeta.tpsysType }}</span>
      </p>

      <!-- Parametric fields (Chip, ThreePole, etc.) -->
      <div v-if="currentTypeMeta.group && currentTypeMeta.fields.length" class="grid gap-3 sm:grid-cols-2">
        <div
          v-for="field in currentTypeMeta.fields"
          :key="field.key"
          class="sm:col-span-1"
        >
          <label class="mb-0.5 block text-[11px] text-neutral-400">{{ field.label }}</label>
          <UInput
            :model-value="getTypeGroupValue(currentTypeMeta.group, field.key)"
            size="sm"
            type="number"
            :step="field.step"
            :min="field.min"
            :disabled="isReadonly"
            @update:model-value="updateTypeField(currentTypeMeta.group, field.key, $event, field.integer)"
          />
        </div>
      </div>

      <!-- PT_GENERIC lead groups editor -->
      <div v-if="form.type === 'PT_GENERIC'" class="space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-xs text-neutral-400">Lead groups mirror TPSys P051 + P055 geometry.</p>
          <UButton
            v-if="!isReadonly"
            size="xs"
            icon="i-lucide-plus"
            variant="outline"
            color="neutral"
            @click="addGenericLeadGroup"
          >
            Add Group
          </UButton>
        </div>

        <div v-if="form.generic?.leadGroups.length" class="space-y-3">
          <div
            v-for="(group, idx) in form.generic!.leadGroups"
            :key="idx"
            class="space-y-2 rounded-md border border-neutral-200 p-3 dark:border-neutral-700"
          >
            <div class="flex items-center justify-between">
              <h4 class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">Lead Group {{ idx + 1 }}</h4>
              <UButton
                v-if="!isReadonly"
                size="xs"
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                @click="removeGenericLeadGroup(idx)"
              />
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Shape</label>
                <USelect
                  :model-value="group.shape"
                  size="sm"
                  :items="leadShapeOptions"
                  value-key="value"
                  label-key="label"
                  :disabled="isReadonly"
                  @update:model-value="updateGenericLeadGroup(idx, 'shape', String($event))"
                />
              </div>
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Number of Leads</label>
                <UInput
                  :model-value="group.numLeads"
                  size="sm"
                  type="number"
                  step="1"
                  min="1"
                  :disabled="isReadonly"
                  @update:model-value="updateGenericLeadGroup(idx, 'numLeads', $event, true)"
                />
              </div>
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Distance From Center</label>
                <UInput
                  :model-value="group.distFromCenter"
                  size="sm"
                  type="number"
                  step="0.05"
                  :disabled="isReadonly"
                  @update:model-value="updateGenericLeadGroup(idx, 'distFromCenter', $event)"
                />
              </div>
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">CC Half</label>
                <UInput
                  :model-value="group.ccHalf"
                  size="sm"
                  type="number"
                  step="0.05"
                  :disabled="isReadonly"
                  @update:model-value="updateGenericLeadGroup(idx, 'ccHalf', $event)"
                />
              </div>
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Angle (millideg)</label>
                <UInput
                  :model-value="group.angleMilliDeg"
                  size="sm"
                  type="number"
                  step="1000"
                  :disabled="isReadonly"
                  @update:model-value="updateGenericLeadGroup(idx, 'angleMilliDeg', $event, true)"
                />
              </div>
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Pad Length</label>
                <UInput
                  :model-value="group.padLength"
                  size="sm"
                  type="number"
                  step="0.05"
                  min="0"
                  :disabled="isReadonly"
                  @update:model-value="updateGenericLeadGroup(idx, 'padLength', $event)"
                />
              </div>
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Pad Width</label>
                <UInput
                  :model-value="group.padWidth"
                  size="sm"
                  type="number"
                  step="0.05"
                  min="0"
                  :disabled="isReadonly"
                  @update:model-value="updateGenericLeadGroup(idx, 'padWidth', $event)"
                />
              </div>
            </div>
          </div>
        </div>
        <p v-else class="rounded-md border border-dashed border-neutral-300 p-3 text-xs text-neutral-400 dark:border-neutral-700">
          No lead groups configured yet.
        </p>
      </div>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import type { PackageDefinition, TpsysGenericLeadGroup } from '~/utils/package-types'
import { PACKAGE_TYPE_LABELS } from '~/utils/package-types'
import { usePackageFormContext, type PackageType, type PackageFormData } from '~/composables/usePackageFormContext'

const { form, readonly: isReadonly, updateForm, toNumber } = usePackageFormContext()

type ParamGroupKey = 'chip' | 'threePole' | 'twoSymmetric' | 'fourSymmetric' | 'twoPlusTwo' | 'fourOnTwo' | 'bga' | 'outline'

interface TypeNumericField {
  key: string
  label: string
  step: string
  min: number
  integer?: boolean
}

interface TypeMeta {
  title: string
  description: string
  tpsysType: string
  group: ParamGroupKey | null
  fields: TypeNumericField[]
}

const typeOptions = Object.entries(PACKAGE_TYPE_LABELS).map(([value, label]) => ({ label, value }))

const leadShapeOptions = [
  { label: 'GULLWING', value: 'GULLWING' },
  { label: 'FLAT', value: 'FLAT' },
  { label: 'J_LEAD', value: 'J_LEAD' },
]

const typeMeta: Record<PackageType, TypeMeta> = {
  PT_TWO_POLE: {
    title: 'PT_TWO_POLE Parameters (mm)',
    description: 'Two-terminal passive with lead 1 at top in TPSys 0°.',
    tpsysType: 'PT_TWO_POLE',
    group: 'chip',
    fields: [
      { key: 'chipLength', label: 'Chip Length', step: '0.1', min: 0 },
      { key: 'leadWidth', label: 'Lead Width', step: '0.05', min: 0 },
      { key: 'leadLength', label: 'Lead Length', step: '0.05', min: 0 },
    ],
  },
  PT_THREE_POLE: {
    title: 'PT_THREE_POLE Parameters (mm)',
    description: 'SOT-like geometry with 2 leads on one side and 1 on the opposite side.',
    tpsysType: 'PT_THREE_POLE',
    group: 'threePole',
    fields: [
      { key: 'widthOverLeads', label: 'Width Over Leads', step: '0.05', min: 0 },
      { key: 'ccDistance', label: 'CC Distance', step: '0.05', min: 0 },
      { key: 'leadWidth', label: 'Lead Width', step: '0.05', min: 0 },
      { key: 'leadLength', label: 'Lead Length', step: '0.05', min: 0 },
    ],
  },
  PT_TWO_SYM: {
    title: 'PT_TWO_SYM Parameters (mm)',
    description: 'Dual-row package with symmetric left/right lead groups.',
    tpsysType: 'PT_TWO_SYM',
    group: 'twoSymmetric',
    fields: [
      { key: 'numberOfLeads', label: 'Number Of Leads', step: '2', min: 2, integer: true },
      { key: 'widthOverLeads', label: 'Width Over Leads', step: '0.05', min: 0 },
      { key: 'leadPitch', label: 'Lead Pitch', step: '0.05', min: 0 },
      { key: 'leadWidth', label: 'Lead Width', step: '0.05', min: 0 },
      { key: 'leadLength', label: 'Lead Length', step: '0.05', min: 0 },
    ],
  },
  PT_FOUR_SYM: {
    title: 'PT_FOUR_SYM Parameters (mm)',
    description: 'QFP/QFN-like geometry with leads on all four sides.',
    tpsysType: 'PT_FOUR_SYM',
    group: 'fourSymmetric',
    fields: [
      { key: 'numberOfLeads', label: 'Number Of Leads', step: '4', min: 4, integer: true },
      { key: 'widthOverLeads', label: 'Width Over Leads', step: '0.05', min: 0 },
      { key: 'leadPitch', label: 'Lead Pitch', step: '0.05', min: 0 },
      { key: 'leadWidth', label: 'Lead Width', step: '0.05', min: 0 },
      { key: 'leadLength', label: 'Lead Length', step: '0.05', min: 0 },
    ],
  },
  PT_TWO_PLUS_TWO: {
    title: 'PT_TWO_PLUS_TWO Parameters (mm)',
    description: 'Asymmetric quad with different lead counts on long vs short sides.',
    tpsysType: 'PT_TWO_PLUS_TWO',
    group: 'twoPlusTwo',
    fields: [
      { key: 'leadsLong', label: 'Leads (long side)', step: '1', min: 1, integer: true },
      { key: 'leadsShort', label: 'Leads (short side)', step: '1', min: 1, integer: true },
      { key: 'widthOverLeadsX', label: 'Width Over Leads X', step: '0.05', min: 0 },
      { key: 'widthOverLeadsY', label: 'Width Over Leads Y', step: '0.05', min: 0 },
      { key: 'leadPitch', label: 'Lead Pitch', step: '0.05', min: 0 },
      { key: 'leadWidth', label: 'Lead Width', step: '0.05', min: 0 },
      { key: 'leadLength', label: 'Lead Length', step: '0.05', min: 0 },
    ],
  },
  PT_FOUR_ON_TWO: {
    title: 'PT_FOUR_ON_TWO Parameters (mm)',
    description: '4 lead groups arranged on 2 sides with a gap between groups on each side.',
    tpsysType: 'PT_FOUR_ON_TWO',
    group: 'fourOnTwo',
    fields: [
      { key: 'leadsPerGroup', label: 'Leads Per Group', step: '1', min: 1, integer: true },
      { key: 'widthOverLeads', label: 'Width Over Leads', step: '0.05', min: 0 },
      { key: 'leadPitch', label: 'Lead Pitch', step: '0.05', min: 0 },
      { key: 'leadWidth', label: 'Lead Width', step: '0.05', min: 0 },
      { key: 'leadLength', label: 'Lead Length', step: '0.05', min: 0 },
      { key: 'groupGap', label: 'Group Gap (C-C)', step: '0.1', min: 0 },
    ],
  },
  PT_BGA: {
    title: 'PT_BGA Parameters (mm)',
    description: 'Grid package definition with optional center hole region.',
    tpsysType: 'PT_BGA',
    group: 'bga',
    fields: [
      { key: 'leadsPerRow', label: 'Leads Per Row', step: '1', min: 1, integer: true },
      { key: 'leadsPerColumn', label: 'Leads Per Column', step: '1', min: 1, integer: true },
      { key: 'leadPitch', label: 'Lead Pitch', step: '0.05', min: 0 },
      { key: 'leadDiameter', label: 'Lead Diameter', step: '0.05', min: 0 },
      { key: 'leadsPerColumnInHole', label: 'Hole Rows', step: '1', min: 0, integer: true },
      { key: 'leadsPerRowInHole', label: 'Hole Columns', step: '1', min: 0, integer: true },
    ],
  },
  PT_GENERIC: {
    title: 'PT_GENERIC Parameters',
    description: 'Catch-all TPSys model using explicit lead-group geometry.',
    tpsysType: 'PT_GENERIC',
    group: null,
    fields: [],
  },
  PT_OUTLINE: {
    title: 'PT_OUTLINE Parameters (mm)',
    description: 'Body outline only, no explicit lead geometry.',
    tpsysType: 'PT_OUTLINE',
    group: 'outline',
    fields: [
      { key: 'length', label: 'Length', step: '0.1', min: 0 },
      { key: 'width', label: 'Width', step: '0.1', min: 0 },
    ],
  },
}

const currentTypeMeta = computed(() => typeMeta[form.value.type])

const typeDefaults: Record<PackageType, Partial<PackageFormData>> = {
  PT_TWO_POLE: {
    body: { length: 1.0, width: 0.5 },
    chip: { chipLength: 1.0, leadWidth: 0.5, leadLength: 0.25 },
  },
  PT_THREE_POLE: {
    body: { length: 2.9, width: 1.3 },
    threePole: { widthOverLeads: 2.4, ccDistance: 1.9, leadWidth: 0.4, leadLength: 0.4 },
  },
  PT_TWO_SYM: {
    body: { length: 5.0, width: 4.0 },
    twoSymmetric: { numberOfLeads: 8, widthOverLeads: 6.0, leadPitch: 1.27, leadWidth: 0.4, leadLength: 0.8 },
  },
  PT_FOUR_SYM: {
    body: { length: 7.0, width: 7.0 },
    fourSymmetric: { numberOfLeads: 32, widthOverLeads: 9.0, leadPitch: 0.5, leadWidth: 0.25, leadLength: 0.5 },
  },
  PT_TWO_PLUS_TWO: {
    body: { length: 7.0, width: 5.0 },
    twoPlusTwo: { leadsLong: 8, leadsShort: 4, widthOverLeadsX: 8.0, widthOverLeadsY: 6.0, leadPitch: 0.65, leadWidth: 0.25, leadLength: 0.5 },
  },
  PT_FOUR_ON_TWO: {
    body: { length: 5.0, width: 4.0 },
    fourOnTwo: { leadsPerGroup: 4, widthOverLeads: 6.0, leadPitch: 0.65, leadWidth: 0.3, leadLength: 0.5, groupGap: 2.0 },
  },
  PT_BGA: {
    body: { length: 7.0, width: 7.0 },
    bga: { leadsPerRow: 8, leadsPerColumn: 8, leadPitch: 0.8, leadDiameter: 0.4, leadsPerRowInHole: 0, leadsPerColumnInHole: 0 },
  },
  PT_GENERIC: {
    body: { length: 3.0, width: 2.0 },
    generic: {
      leadGroups: [
        { shape: 'GULLWING', numLeads: 2, distFromCenter: 0.8, ccHalf: 0.5, angleMilliDeg: 0, padLength: 0.8, padWidth: 0.4 },
      ],
    },
  },
  PT_OUTLINE: {
    body: { length: 3.0, width: 2.0 },
    outline: { length: 3.0, width: 2.0 },
  },
}

function getTypeGroupValue(group: ParamGroupKey, field: string): number {
  const value = (form.value as any)[group]?.[field]
  return typeof value === 'number' ? value : 0
}

function updateTypeField(group: ParamGroupKey, field: string, val: string | number, integer = false) {
  const current = (form.value as any)[group] ?? {}
  updateForm({ [group]: { ...current, [field]: toNumber(val, integer) } })
}

function changeType(newType: PackageType) {
  if (newType === form.value.type) return
  const defaults = typeDefaults[newType]
  updateForm({
    type: newType,
    body: defaults.body ?? form.value.body,
    ...defaults,
  })
}

function addGenericLeadGroup() {
  const leadGroups = [...(form.value.generic?.leadGroups ?? [])]
  leadGroups.push({
    shape: 'GULLWING',
    numLeads: 1,
    distFromCenter: 0.5,
    ccHalf: 0,
    angleMilliDeg: 0,
    padLength: 0.6,
    padWidth: 0.3,
  })
  updateForm({ generic: { leadGroups } })
}

function removeGenericLeadGroup(index: number) {
  const leadGroups = (form.value.generic?.leadGroups ?? []).filter((_, i) => i !== index)
  updateForm({ generic: { leadGroups } })
}

function updateGenericLeadGroup(
  index: number,
  field: keyof TpsysGenericLeadGroup,
  value: string | number,
  integer = false,
) {
  const leadGroups = [...(form.value.generic?.leadGroups ?? [])]
  const current = leadGroups[index]
  if (!current) return
  if (field === 'shape') {
    current.shape = String(value) as TpsysGenericLeadGroup['shape']
  } else {
    ;(current as any)[field] = toNumber(value, integer)
  }
  updateForm({ generic: { leadGroups } })
}
</script>
