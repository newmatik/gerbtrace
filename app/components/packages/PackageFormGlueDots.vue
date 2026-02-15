<template>
  <div class="space-y-4">
    <!-- Glue Config -->
    <fieldset class="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <legend class="px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Glue Configuration</legend>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Mode</label>
          <USelect
            :model-value="glue.mode ?? 'NONE'"
            size="sm"
            :items="modeItems"
            value-key="value"
            label-key="label"
            :disabled="isReadonly"
            @update:model-value="updateGlue({ mode: String($event) })"
          />
        </div>
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Matching</label>
          <USelect
            :model-value="glue.matching ?? 'STANDARD'"
            size="sm"
            :items="matchingItems"
            value-key="value"
            label-key="label"
            :disabled="isReadonly"
            @update:model-value="updateGlue({ matching: String($event) })"
          />
        </div>
      </div>

      <!-- Glue positions -->
      <div class="flex items-center justify-between">
        <p class="text-[11px] text-neutral-400">Glue positions: {{ gluePositions.length }}</p>
        <UButton
          v-if="!isReadonly"
          size="xs"
          variant="outline"
          color="neutral"
          icon="i-lucide-plus"
          @click="addGluePosition"
        >
          Add
        </UButton>
      </div>
      <div v-if="gluePositions.length" class="space-y-2">
        <div
          v-for="(pos, idx) in gluePositions"
          :key="idx"
          class="flex items-center gap-2"
        >
          <div class="flex-1 grid grid-cols-4 gap-2">
            <div>
              <label class="mb-0.5 block text-[10px] text-neutral-400">X (mm)</label>
              <UInput
                :model-value="pos.x"
                size="sm"
                type="number"
                step="0.1"
                :disabled="isReadonly"
                @update:model-value="updateGluePosition(idx, 'x', toNumber($event))"
              />
            </div>
            <div>
              <label class="mb-0.5 block text-[10px] text-neutral-400">Y (mm)</label>
              <UInput
                :model-value="pos.y"
                size="sm"
                type="number"
                step="0.1"
                :disabled="isReadonly"
                @update:model-value="updateGluePosition(idx, 'y', toNumber($event))"
              />
            </div>
            <div>
              <label class="mb-0.5 block text-[10px] text-neutral-400">Param 1</label>
              <UInput
                :model-value="pos.param1"
                size="sm"
                type="number"
                :disabled="isReadonly"
                @update:model-value="updateGluePosition(idx, 'param1', toNumber($event))"
              />
            </div>
            <div>
              <label class="mb-0.5 block text-[10px] text-neutral-400">Param 2</label>
              <UInput
                :model-value="pos.param2"
                size="sm"
                type="number"
                :disabled="isReadonly"
                @update:model-value="updateGluePosition(idx, 'param2', toNumber($event))"
              />
            </div>
          </div>
          <UButton
            v-if="!isReadonly"
            size="xs"
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            class="mt-4"
            @click="removeGluePosition(idx)"
          />
        </div>
      </div>
    </fieldset>

    <!-- Marking Positions -->
    <fieldset class="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <legend class="px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Marking Positions</legend>
      <div class="flex items-center justify-between">
        <p class="text-[11px] text-neutral-400">{{ markingPositions.length }} position(s)</p>
        <UButton
          v-if="!isReadonly"
          size="xs"
          variant="outline"
          color="neutral"
          icon="i-lucide-plus"
          @click="addMarkingPosition"
        >
          Add
        </UButton>
      </div>
      <div v-if="markingPositions.length" class="space-y-2">
        <div
          v-for="(pos, idx) in markingPositions"
          :key="idx"
          class="flex items-center gap-2"
        >
          <div class="flex-1 grid grid-cols-3 gap-2">
            <div>
              <label class="mb-0.5 block text-[10px] text-neutral-400">X (mm)</label>
              <UInput
                :model-value="pos.x"
                size="sm"
                type="number"
                step="0.1"
                :disabled="isReadonly"
                @update:model-value="updateMarkingPosition(idx, 'x', toNumber($event))"
              />
            </div>
            <div>
              <label class="mb-0.5 block text-[10px] text-neutral-400">Y (mm)</label>
              <UInput
                :model-value="pos.y"
                size="sm"
                type="number"
                step="0.1"
                :disabled="isReadonly"
                @update:model-value="updateMarkingPosition(idx, 'y', toNumber($event))"
              />
            </div>
            <div>
              <label class="mb-0.5 block text-[10px] text-neutral-400">Dot Type</label>
              <UInput
                :model-value="pos.dotType"
                size="sm"
                placeholder="e.g. DOT0.5mm"
                :disabled="isReadonly"
                @update:model-value="updateMarkingPosition(idx, 'dotType', String($event))"
              />
            </div>
          </div>
          <UButton
            v-if="!isReadonly"
            size="xs"
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            class="mt-4"
            @click="removeMarkingPosition(idx)"
          />
        </div>
      </div>
      <p v-else class="rounded-md border border-dashed border-neutral-300 p-3 text-xs text-neutral-400 dark:border-neutral-700">
        No marking positions configured.
      </p>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import type { GlueConfig, MarkingPosition, MachineSettings } from '~/utils/package-types'
import { usePackageFormContext } from '~/composables/usePackageFormContext'

const { form, readonly: isReadonly, updateForm, toNumber } = usePackageFormContext()

const machine = computed(() => form.value.machine ?? {})
const glue = computed(() => machine.value.glue ?? { mode: 'NONE' })
const gluePositions = computed(() => glue.value.positions ?? [])
const markingPositions = computed(() => machine.value.markingPositions ?? [])

const modeItems = [
  { label: 'NONE', value: 'NONE' },
  { label: 'Dispense', value: 'DISPENSE' },
]

const matchingItems = [
  { label: 'Standard', value: 'STANDARD' },
  { label: 'Matching', value: 'MATCHING' },
]

function updateMachine(overrides: Partial<MachineSettings>) {
  updateForm({ machine: { ...(form.value.machine ?? {}), ...overrides } })
}

function updateGlue(overrides: Partial<GlueConfig>) {
  updateMachine({ glue: { ...glue.value, ...overrides } as GlueConfig })
}

function addGluePosition() {
  const positions = [...gluePositions.value, { x: 0, y: 0, param1: 0, param2: 0 }]
  updateGlue({ positions })
}

function removeGluePosition(idx: number) {
  updateGlue({ positions: gluePositions.value.filter((_, i) => i !== idx) })
}

function updateGluePosition(idx: number, field: string, value: number) {
  const positions = gluePositions.value.map((p, i) => i === idx ? { ...p, [field]: value } : p)
  updateGlue({ positions })
}

function addMarkingPosition() {
  const positions = [...markingPositions.value, { x: 0, y: 0, dotType: 'DOT0.5mm' }]
  updateMachine({ markingPositions: positions })
}

function removeMarkingPosition(idx: number) {
  updateMachine({ markingPositions: markingPositions.value.filter((_, i) => i !== idx) })
}

function updateMarkingPosition(idx: number, field: string, value: string | number) {
  const positions = markingPositions.value.map((p, i) =>
    i === idx ? { ...p, [field]: value } as MarkingPosition : p,
  )
  updateMachine({ markingPositions: positions })
}
</script>
