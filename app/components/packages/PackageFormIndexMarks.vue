<template>
  <div class="space-y-4">
    <fieldset class="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <legend class="px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Index Marks</legend>

      <div>
        <label class="mb-0.5 block text-[11px] text-neutral-400">Index Type</label>
        <USelect
          :model-value="indexMark.type ?? 'none'"
          size="sm"
          :items="indexTypeItems"
          value-key="value"
          label-key="label"
          :disabled="isReadonly"
          @update:model-value="updateIndex({ type: String($event) })"
        />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Offset X (mm)</label>
          <UInput
            :model-value="indexMark.offset?.x ?? ''"
            size="sm"
            type="number"
            step="0.1"
            :disabled="isReadonly"
            @update:model-value="updateIndex({ offset: { x: toNumber($event), y: indexMark.offset?.y ?? 0 } })"
          />
        </div>
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Offset Y (mm)</label>
          <UInput
            :model-value="indexMark.offset?.y ?? ''"
            size="sm"
            type="number"
            step="0.1"
            :disabled="isReadonly"
            @update:model-value="updateIndex({ offset: { x: indexMark.offset?.x ?? 0, y: toNumber($event) } })"
          />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Size (mm)</label>
          <UInput
            :model-value="indexMark.size ?? ''"
            size="sm"
            type="number"
            step="0.1"
            min="0"
            :disabled="isReadonly"
            @update:model-value="updateIndex({ size: toNumber($event) })"
          />
        </div>
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Min Correlation (%)</label>
          <UInput
            :model-value="indexMark.minCorrelation ?? ''"
            size="sm"
            type="number"
            step="1"
            min="0"
            max="100"
            :disabled="isReadonly"
            @update:model-value="updateIndex({ minCorrelation: toNumber($event) })"
          />
        </div>
      </div>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import type { MachineSettings } from '~/utils/package-types'
import { usePackageFormContext } from '~/composables/usePackageFormContext'

const { form, readonly: isReadonly, updateForm, toNumber } = usePackageFormContext()

const indexMark = computed(() => form.value.machine?.indexMark ?? {})

const indexTypeItems = [
  { label: 'No index', value: 'none' },
  { label: 'Standard', value: 'standard' },
  { label: 'Cross', value: 'cross' },
  { label: 'Circle', value: 'circle' },
]

function updateIndex(overrides: Partial<NonNullable<MachineSettings['indexMark']>>) {
  const machine = form.value.machine ?? {}
  updateForm({
    machine: {
      ...machine,
      indexMark: { ...(machine.indexMark ?? {}), ...overrides },
    },
  })
}
</script>
