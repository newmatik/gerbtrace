<template>
  <div class="space-y-4">
    <!-- Mount Precision -->
    <fieldset class="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <legend class="px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Mount Precision</legend>
      <div class="flex items-center gap-4">
        <label v-for="opt in precisionOptions" :key="opt" class="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <input
            type="radio"
            name="mountPrecision"
            :value="opt"
            :checked="machine.mountPrecision === opt"
            :disabled="isReadonly"
            @change="updateMachine({ mountPrecision: opt })"
          >
          {{ opt.charAt(0).toUpperCase() + opt.slice(1) }}
        </label>
      </div>
      <label class="flex items-center gap-2 text-[11px] text-neutral-400">
        <input
          type="checkbox"
          :checked="machine.hydraFinePitch ?? false"
          :disabled="isReadonly"
          class="rounded"
          @change="updateMachine({ hydraFinePitch: ($event.target as HTMLInputElement).checked })"
        >
        HYDRA fine pitch
      </label>
    </fieldset>

    <!-- Acceleration Codes -->
    <fieldset class="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <legend class="px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Acceleration Codes</legend>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div v-for="axis in axisOptions" :key="axis.key">
          <label class="mb-0.5 block text-[11px] text-neutral-400">{{ axis.label }}</label>
          <USelect
            :model-value="accels[axis.key] ?? DEFAULT_VALUE"
            size="sm"
            :items="accLevelItems"
            value-key="value"
            label-key="label"
            :disabled="isReadonly"
            @update:model-value="updateAccel(axis.key, String($event))"
          />
        </div>
      </div>
    </fieldset>

    <!-- Motion Sequences -->
    <fieldset class="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <legend class="px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Motion Sequence — Picking</legend>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Downwards Speed (mm/s)</label>
          <UInput
            :model-value="machine.motionPicking?.downSpeed ?? ''"
            size="sm"
            type="number"
            step="1"
            min="0"
            :disabled="isReadonly"
            @update:model-value="updateMachine({ motionPicking: { ...machine.motionPicking, downSpeed: toNumber($event) } })"
          />
        </div>
        <div class="flex items-end pb-1">
          <label class="flex items-center gap-2 text-[11px] text-neutral-400">
            <input
              type="checkbox"
              :checked="machine.motionPicking?.downSpeedAuto ?? false"
              :disabled="isReadonly"
              class="rounded"
              @change="updateMachine({ motionPicking: { ...machine.motionPicking, downSpeedAuto: ($event.target as HTMLInputElement).checked } })"
            >
            Auto
          </label>
        </div>
      </div>
    </fieldset>

    <fieldset class="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <legend class="px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Motion Sequence — Placing</legend>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Upwards Distance (mm)</label>
          <UInput
            :model-value="machine.motionPlacing?.upDistance ?? ''"
            size="sm"
            type="number"
            step="0.1"
            min="0"
            :disabled="isReadonly"
            @update:model-value="updateMotionPlacing('upDistance', $event)"
          />
        </div>
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Upwards Speed (mm/s)</label>
          <UInput
            :model-value="machine.motionPlacing?.upSpeed ?? ''"
            size="sm"
            type="number"
            step="1"
            min="0"
            :disabled="isReadonly"
            @update:model-value="updateMotionPlacing('upSpeed', $event)"
          />
        </div>
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Downwards Speed (mm/s)</label>
          <UInput
            :model-value="machine.motionPlacing?.downSpeed ?? ''"
            size="sm"
            type="number"
            step="1"
            min="0"
            :disabled="isReadonly"
            @update:model-value="updateMotionPlacing('downSpeed', $event)"
          />
        </div>
      </div>
      <label class="flex items-center gap-2 text-[11px] text-neutral-400">
        <input
          type="checkbox"
          :checked="machine.motionPlacing?.downSpeedAuto ?? false"
          :disabled="isReadonly"
          class="rounded"
          @change="updateMachine({ motionPlacing: { ...machine.motionPlacing, downSpeedAuto: ($event.target as HTMLInputElement).checked } })"
        >
        Auto downward speed
      </label>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import type { AccLevel, MachineSettings } from '~/utils/package-types'
import { usePackageFormContext } from '~/composables/usePackageFormContext'

const { form, readonly: isReadonly, updateForm, toNumber } = usePackageFormContext()

const machine = computed(() => form.value.machine ?? {})
const accels = computed(() => machine.value.accelerations ?? {})

const precisionOptions = ['low', 'normal', 'high'] as const

type AccAxisKey = 'x' | 'y' | 'tape' | 'theta' | 'z' | 'hydraTheta' | 'hydraZ'

const axisOptions: Array<{ key: AccAxisKey; label: string }> = [
  { key: 'x', label: 'X' },
  { key: 'y', label: 'Y' },
  { key: 'tape', label: 'Tape' },
  { key: 'theta', label: 'Theta' },
  { key: 'z', label: 'Z' },
  { key: 'hydraTheta', label: 'HYDRA Theta' },
  { key: 'hydraZ', label: 'HYDRA Z' },
]

// Reka UI <SelectItem> forbids empty-string values, but we still need a
// "(default)" option to clear a previously-set acceleration.
const DEFAULT_VALUE = '__default__'

const accLevelItems = [
  { label: '(default)', value: DEFAULT_VALUE },
  { label: 'Lowest', value: 'lowest' },
  { label: 'Low', value: 'low' },
  { label: 'High', value: 'high' },
  { label: 'Highest', value: 'highest' },
]

function updateMachine(overrides: Partial<MachineSettings>) {
  updateForm({ machine: { ...(form.value.machine ?? {}), ...overrides } })
}

function updateAccel(key: AccAxisKey, val: string) {
  const current = { ...(form.value.machine?.accelerations ?? {}) }
  if (val && val !== DEFAULT_VALUE) {
    current[key] = val as AccLevel
  } else {
    delete current[key]
  }
  updateMachine({ accelerations: current })
}

function updateMotionPlacing(field: string, val: string | number) {
  updateMachine({
    motionPlacing: { ...(machine.value.motionPlacing ?? {}), [field]: toNumber(val) },
  })
}
</script>
