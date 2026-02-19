<template>
  <UModal v-model:open="open" :ui="{ content: 'sm:max-w-2xl' }">
    <template #content>
      <div class="p-5 space-y-4" @keydown.stop>
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">
            Map Pick and Place Columns
          </h3>
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" @click="handleCancel" />
        </div>

        <p class="text-xs text-neutral-500 dark:text-neutral-400">
          Map columns to required PnP fields. Designator, X, Y, and Rotation are required.
        </p>

        <div class="grid grid-cols-2 gap-x-4 gap-y-3">
          <div v-for="field in mappableFields" :key="field.key">
            <label class="text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-[10px] font-medium">
              {{ field.label }}
              <span v-if="field.required" class="text-red-400">*</span>
            </label>
            <USelect
              :model-value="mapping[field.key] != null ? String(mapping[field.key]) : ''"
              :items="headerOptions"
              value-key="value"
              label-key="label"
              size="xs"
              class="mt-0.5 w-full"
              @update:model-value="onFieldChange(field.key, $event)"
            />
          </div>
        </div>

        <div v-if="previewRows.length > 0" class="mt-4">
          <p class="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Preview (first 3 rows)</p>
          <div class="overflow-x-auto rounded border border-neutral-200 dark:border-neutral-700">
            <table class="w-full text-[11px]">
              <thead>
                <tr class="bg-neutral-50 dark:bg-neutral-800/50">
                  <th v-for="field in mappableFields" :key="field.key" class="px-2 py-1 text-left font-medium text-neutral-500">
                    {{ field.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, ri) in previewRows" :key="ri" class="border-t border-neutral-100 dark:border-neutral-800">
                  <td v-for="field in mappableFields" :key="field.key" class="px-2 py-1 text-neutral-700 dark:text-neutral-300 truncate max-w-[140px]">
                    {{ mapping[field.key] !== undefined ? (row[mapping[field.key]!] ?? '') : '' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <UButton variant="ghost" color="neutral" size="sm" @click="handleCancel">Cancel</UButton>
          <UButton size="sm" :disabled="!isValid" @click="handleConfirm">Apply Mapping</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { PnPColumnMapping } from '~/utils/pnp-parser'

const props = defineProps<{
  headers: string[]
  rows: string[][]
  initialMapping?: PnPColumnMapping | null
}>()

const emit = defineEmits<{
  confirm: [mapping: PnPColumnMapping]
  cancel: []
}>()

const open = defineModel<boolean>('open', { default: false })

const mappableFields: { key: keyof PnPColumnMapping; label: string; required: boolean }[] = [
  { key: 'designator', label: 'Designator', required: true },
  { key: 'x', label: 'X', required: true },
  { key: 'y', label: 'Y', required: true },
  { key: 'rotation', label: 'Rotation', required: true },
  { key: 'value', label: 'Value', required: false },
  { key: 'package', label: 'Package', required: false },
  { key: 'side', label: 'Side', required: false },
]

const mapping = reactive<PnPColumnMapping>({})

watch(
  () => props.initialMapping,
  (next) => {
    Object.assign(mapping, next ?? {})
  },
  { immediate: true, deep: true },
)

const headerOptions = computed(() => [
  { value: '', label: '-- Not mapped --' },
  ...props.headers.map((header, idx) => ({
    value: String(idx),
    label: header || `Column ${idx + 1}`,
  })),
])

const previewRows = computed(() => props.rows.slice(0, 3))

function onFieldChange(key: keyof PnPColumnMapping, value: unknown) {
  const raw = String(value ?? '')
  mapping[key] = raw === '' ? undefined : Number(raw)
}

const isValid = computed(() => {
  return Number.isFinite(mapping.designator) && Number.isFinite(mapping.x) && Number.isFinite(mapping.y) && Number.isFinite(mapping.rotation)
})

function handleConfirm() {
  if (!isValid.value) return
  emit('confirm', { ...mapping })
  open.value = false
}

function handleCancel() {
  emit('cancel')
  open.value = false
}
</script>
