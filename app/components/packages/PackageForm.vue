<template>
  <div class="grid gap-4 xl:grid-cols-12">
    <section class="space-y-4 xl:col-span-5">
      <fieldset class="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
        <legend class="px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          Identity
        </legend>
        <div>
          <label class="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Package Name</label>
          <UInput
            :model-value="form.name"
            size="sm"
            placeholder="e.g. C0402, SOT-23, SOIC-8"
            :disabled="readonly"
            @update:model-value="update('name', $event)"
          />
        </div>

        <div>
          <div class="mb-1 flex items-center justify-between gap-2">
            <label class="block text-xs font-medium text-neutral-500 dark:text-neutral-400">Aliases</label>
            <span class="text-[11px] text-neutral-400">{{ form.aliases.length }} aliases</span>
          </div>
          <div class="space-y-2 rounded-md border border-neutral-200 p-2 dark:border-neutral-700">
            <div v-if="form.aliases.length" class="flex flex-wrap gap-1.5">
              <UBadge
                v-for="alias in form.aliases"
                :key="alias"
                size="sm"
                color="neutral"
                variant="subtle"
                class="flex items-center gap-1"
              >
                <span>{{ alias }}</span>
                <button
                  v-if="!readonly"
                  type="button"
                  class="text-neutral-400 transition hover:text-neutral-100"
                  @click="removeAlias(alias)"
                >
                  <UIcon name="i-lucide-x" class="h-3 w-3" />
                </button>
              </UBadge>
            </div>
            <p v-else class="text-xs text-neutral-400">
              No aliases yet.
            </p>
            <div v-if="!readonly" class="flex gap-2">
              <UInput
                v-model="aliasDraft"
                size="sm"
                class="flex-1"
                placeholder="Type alias and press Enter"
                @keydown="handleAliasKeydown"
                @blur="commitAliasDraft"
              />
              <UButton size="sm" variant="outline" color="neutral" icon="i-lucide-plus" @click="commitAliasDraft">
                Add
              </UButton>
            </div>
          </div>
        </div>

        <div>
          <label class="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Package Type</label>
          <USelect
            :model-value="form.type"
            size="sm"
            :items="typeOptions"
            value-key="value"
            label-key="label"
            :disabled="readonly"
            @update:model-value="changeType($event as PackageType)"
          />
          <p class="mt-1 text-xs text-neutral-400">
            {{ currentTypeMeta.description }}
          </p>
        </div>
      </fieldset>

      <fieldset class="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
        <legend class="px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          Body Dimensions (mm)
        </legend>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-0.5 block text-[11px] text-neutral-400">Length</label>
            <UInput
              :model-value="form.body.length"
              size="sm"
              type="number"
              step="0.1"
              min="0"
              :disabled="readonly"
              @update:model-value="updateBody('length', $event)"
            />
          </div>
          <div>
            <label class="mb-0.5 block text-[11px] text-neutral-400">Width</label>
            <UInput
              :model-value="form.body.width"
              size="sm"
              type="number"
              step="0.1"
              min="0"
              :disabled="readonly"
              @update:model-value="updateBody('width', $event)"
            />
          </div>
        </div>
      </fieldset>
    </section>

    <section class="space-y-4 xl:col-span-7">
      <fieldset class="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
        <legend class="px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          {{ currentTypeMeta.title }}
        </legend>
        <p class="text-xs text-neutral-400">
          TPSys class: <span class="font-medium">{{ currentTypeMeta.tpsysType }}</span>
        </p>

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
              :disabled="readonly"
              @update:model-value="updateTypeField(currentTypeMeta.group, field.key, $event, field.integer)"
            />
          </div>
        </div>

        <div v-if="form.type === 'PT_GENERIC'" class="space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-xs text-neutral-400">
              Lead groups mirror TPSys `P051` + `P055` geometry.
            </p>
            <UButton
              v-if="!readonly"
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
                  v-if="!readonly"
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
                    :disabled="readonly"
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
                    :disabled="readonly"
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
                    :disabled="readonly"
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
                    :disabled="readonly"
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
                    :disabled="readonly"
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
                    :disabled="readonly"
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
                    :disabled="readonly"
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
    </section>
  </div>
</template>

<script setup lang="ts">
import type { PackageDefinition, TpsysGenericLeadGroup } from '~/utils/package-types'

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
  generic?: { leadGroups: Array<{ shape: 'GULLWING' | 'FLAT' | 'J_LEAD'; numLeads: number; distFromCenter: number; ccHalf: number; angleMilliDeg: number; padLength: number; padWidth: number }> }
}

type ParamGroupKey = 'chip' | 'threePole' | 'twoSymmetric' | 'fourSymmetric' | 'bga' | 'outline'

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
  { label: 'TPSys Generic (P051 + P055)', value: 'PT_GENERIC' },
  { label: 'Outline (body only)', value: 'Outline' },
]

const leadShapeOptions = [
  { label: 'GULLWING', value: 'GULLWING' },
  { label: 'FLAT', value: 'FLAT' },
  { label: 'J_LEAD', value: 'J_LEAD' },
]

const typeMeta: Record<PackageType, TypeMeta> = {
  Chip: {
    title: 'Chip Parameters (mm)',
    description: 'Two-terminal passive with lead 1 at top in TPSys 0°.',
    tpsysType: 'PT_TWO_POLE',
    group: 'chip',
    fields: [
      { key: 'chipLength', label: 'Chip Length', step: '0.1', min: 0 },
      { key: 'leadWidth', label: 'Lead Width', step: '0.05', min: 0 },
      { key: 'leadLength', label: 'Lead Length', step: '0.05', min: 0 },
    ],
  },
  ThreePole: {
    title: 'Three-Pole Parameters (mm)',
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
  TwoSymmetricLeadGroups: {
    title: 'Two-Symmetric Parameters (mm)',
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
  FourSymmetricLeadGroups: {
    title: 'Four-Symmetric Parameters (mm)',
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
  BGA: {
    title: 'BGA Parameters (mm)',
    description: 'Grid package definition with optional center hole region.',
    tpsysType: 'PT_BGA / PT_GENERIC_BGA',
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
    title: 'TPSys Generic Parameters',
    description: 'Catch-all TPSys model using explicit lead-group geometry.',
    tpsysType: 'PT_GENERIC',
    group: null,
    fields: [],
  },
  Outline: {
    title: 'Outline Parameters (mm)',
    description: 'Body outline only, no explicit lead geometry.',
    tpsysType: 'PT_OUTLINE',
    group: 'outline',
    fields: [
      { key: 'length', label: 'Length', step: '0.1', min: 0 },
      { key: 'width', label: 'Width', step: '0.1', min: 0 },
    ],
  },
}

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
    case 'PT_GENERIC': base.generic = { leadGroups: pkg.generic.leadGroups.map(g => ({ ...g })) }; break
    case 'Outline': base.outline = { ...pkg.outline }; break
  }
  return base
})

const aliasDraft = ref('')
const currentTypeMeta = computed(() => typeMeta[form.value.type])

function buildDedupedAliases(input: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of input) {
    const alias = raw.trim()
    if (!alias) continue
    const key = alias.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(alias)
  }
  return out
}

function commitAliasDraft() {
  const tokens = aliasDraft.value
    .split(/[,\n;]+/)
    .map(v => v.trim())
    .filter(Boolean)
  if (!tokens.length) {
    aliasDraft.value = ''
    return
  }
  emitPkg({ aliases: buildDedupedAliases([...form.value.aliases, ...tokens]) })
  aliasDraft.value = ''
}

function handleAliasKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
    event.preventDefault()
    commitAliasDraft()
  }
}

function removeAlias(alias: string) {
  emitPkg({ aliases: form.value.aliases.filter(a => a !== alias) })
}

function update(field: 'name', val: string | number) {
  emitPkg({ [field]: String(val) })
}

function toNumber(val: string | number, integer = false): number {
  const next = typeof val === 'number' ? val : Number(val)
  if (!Number.isFinite(next)) return 0
  return integer ? Math.round(next) : next
}

function updateBody(field: 'length' | 'width', val: string | number) {
  emitPkg({ body: { ...form.value.body, [field]: toNumber(val) } })
}

function getTypeGroupValue(group: ParamGroupKey, field: string): number {
  const value = (form.value as any)[group]?.[field]
  return typeof value === 'number' ? value : 0
}

function updateTypeField(group: ParamGroupKey, field: string, val: string | number, integer = false) {
  const current = (form.value as any)[group] ?? {}
  emitPkg({ [group]: { ...current, [field]: toNumber(val, integer) } })
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
  emitPkg({ generic: { leadGroups } })
}

function removeGenericLeadGroup(index: number) {
  const leadGroups = (form.value.generic?.leadGroups ?? []).filter((_, i) => i !== index)
  emitPkg({ generic: { leadGroups } })
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
  emitPkg({ generic: { leadGroups } })
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
  PT_GENERIC: {
    body: { length: 3.0, width: 2.0 },
    generic: {
      leadGroups: [
        {
          shape: 'GULLWING',
          numLeads: 2,
          distFromCenter: 0.8,
          ccHalf: 0.5,
          angleMilliDeg: 0,
          padLength: 0.8,
          padWidth: 0.4,
        },
      ],
    },
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
    case 'PT_GENERIC':
      return {
        ...base,
        type: 'PT_GENERIC',
        generic: data.generic ?? { leadGroups: [] },
      }
    case 'Outline':
      return { ...base, type: 'Outline', outline: data.outline! }
  }
}
</script>
