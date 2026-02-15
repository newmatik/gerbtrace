<template>
  <div class="space-y-4">
    <fieldset class="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <legend class="px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Package Variations</legend>
      <p class="text-xs text-neutral-400">
        Variations allow different heights or centering methods for the same base package geometry (e.g. different component heights, Hydra vs. slow centering).
      </p>

      <div class="flex items-center justify-between">
        <p class="text-[11px] text-neutral-400">{{ variations.length }} variation(s)</p>
        <UButton
          v-if="!isReadonly"
          size="xs"
          variant="outline"
          color="neutral"
          icon="i-lucide-plus"
          @click="addVariation"
        >
          Add Variation
        </UButton>
      </div>

      <div v-if="variations.length" class="space-y-3">
        <div
          v-for="(v, idx) in variations"
          :key="v.id"
          class="space-y-2 rounded-md border border-neutral-200 p-3 dark:border-neutral-700"
        >
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              Variation: {{ v.label || v.id }}
            </h4>
            <UButton
              v-if="!isReadonly"
              size="xs"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              @click="removeVariation(idx)"
            />
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-0.5 block text-[11px] text-neutral-400">ID</label>
              <UInput
                :model-value="v.id"
                size="sm"
                placeholder="e.g. 04, slow, hydra"
                :disabled="isReadonly"
                @update:model-value="updateVariation(idx, 'id', String($event))"
              />
            </div>
            <div>
              <label class="mb-0.5 block text-[11px] text-neutral-400">Label</label>
              <UInput
                :model-value="v.label ?? ''"
                size="sm"
                placeholder="e.g. H0.4, Slow (no Hydra)"
                :disabled="isReadonly"
                @update:model-value="updateVariation(idx, 'label', String($event))"
              />
            </div>
          </div>
          <!-- Height override -->
          <div class="grid gap-3 sm:grid-cols-3">
            <div>
              <label class="mb-0.5 block text-[11px] text-neutral-400">Height Nominal (mm)</label>
              <UInput
                :model-value="v.height?.nominal ?? ''"
                size="sm"
                type="number"
                step="0.1"
                min="0"
                :disabled="isReadonly"
                @update:model-value="updateVariationHeight(idx, 'nominal', $event)"
              />
            </div>
            <div>
              <label class="mb-0.5 block text-[11px] text-neutral-400">Height Min (mm)</label>
              <UInput
                :model-value="v.height?.min ?? ''"
                size="sm"
                type="number"
                step="0.1"
                min="0"
                :disabled="isReadonly"
                @update:model-value="updateVariationHeight(idx, 'min', $event)"
              />
            </div>
            <div>
              <label class="mb-0.5 block text-[11px] text-neutral-400">Height Max (mm)</label>
              <UInput
                :model-value="v.height?.max ?? ''"
                size="sm"
                type="number"
                step="0.1"
                min="0"
                :disabled="isReadonly"
                @update:model-value="updateVariationHeight(idx, 'max', $event)"
              />
            </div>
          </div>
          <!-- Machine overrides (simplified: tools only) -->
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="mb-0.5 block text-[11px] text-neutral-400">Mount Tools Override</label>
              <UInput
                :model-value="(v.machine?.mountTools ?? []).join(', ')"
                size="sm"
                placeholder="Leave empty to inherit"
                :disabled="isReadonly"
                @update:model-value="updateVariationMachine(idx, 'mountTools', parseList(String($event)))"
              />
            </div>
            <div>
              <label class="mb-0.5 block text-[11px] text-neutral-400">HYDRA Tools Override</label>
              <UInput
                :model-value="(v.machine?.hydraTools ?? []).join(', ')"
                size="sm"
                placeholder="Leave empty to inherit"
                :disabled="isReadonly"
                @update:model-value="updateVariationMachine(idx, 'hydraTools', parseList(String($event)))"
              />
            </div>
          </div>
          <div>
            <label class="mb-0.5 block text-[11px] text-neutral-400">Vision Modes Override</label>
            <UInput
              :model-value="(v.machine?.visionModes ?? []).join(', ')"
              size="sm"
              placeholder="e.g. standard, linescan (leave empty to inherit)"
              :disabled="isReadonly"
              @update:model-value="updateVariationMachine(idx, 'visionModes', parseList(String($event)))"
            />
          </div>
        </div>
      </div>
      <p v-else class="rounded-md border border-dashed border-neutral-300 p-3 text-xs text-neutral-400 dark:border-neutral-700">
        No variations configured. Add variations for different heights or centering methods.
      </p>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import type { PackageVariation, MachineSettings } from '~/utils/package-types'
import { usePackageFormContext } from '~/composables/usePackageFormContext'

const { form, readonly: isReadonly, updateForm, toNumber } = usePackageFormContext()

const variations = computed(() => form.value.variations ?? [])

function addVariation() {
  const newVariation: PackageVariation = {
    id: `var-${Date.now()}`,
    label: '',
  }
  updateForm({ variations: [...variations.value, newVariation] })
}

function removeVariation(idx: number) {
  updateForm({ variations: variations.value.filter((_, i) => i !== idx) })
}

function updateVariation(idx: number, field: keyof PackageVariation, value: any) {
  const updated = variations.value.map((v, i) =>
    i === idx ? { ...v, [field]: value } : v,
  )
  updateForm({ variations: updated })
}

function updateVariationHeight(idx: number, field: 'nominal' | 'min' | 'max', val: string | number) {
  const v = variations.value[idx]
  if (!v) return
  const height = { nominal: v.height?.nominal ?? 0, min: v.height?.min ?? 0, max: v.height?.max ?? 0 }
  height[field] = toNumber(val)
  const updated = variations.value.map((vv, i) =>
    i === idx ? { ...vv, height } : vv,
  )
  updateForm({ variations: updated })
}

function updateVariationMachine(idx: number, field: keyof MachineSettings, value: any) {
  const v = variations.value[idx]
  if (!v) return
  const machine = { ...(v.machine ?? {}), [field]: value } as Partial<MachineSettings>
  const updated = variations.value.map((vv, i) =>
    i === idx ? { ...vv, machine } : vv,
  )
  updateForm({ variations: updated })
}

function parseList(val: string): string[] {
  return val.split(/[,;]+/).map(s => s.trim()).filter(Boolean)
}
</script>
