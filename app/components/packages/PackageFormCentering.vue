<template>
  <div class="space-y-4">
    <!-- Vision settings -->
    <fieldset class="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <legend class="px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Vision</legend>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Vision Modes (comma-separated)</label>
          <UInput
            :model-value="(machine.visionModes ?? []).join(', ')"
            size="sm"
            placeholder="e.g. standard, linescan, hydra"
            :disabled="isReadonly"
            @update:model-value="updateMachine({ visionModes: parseList(String($event)) })"
          />
        </div>
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Lighting Brightness</label>
          <UInput
            :model-value="machine.visionLighting?.brightness ?? ''"
            size="sm"
            placeholder="e.g. BRIGHT"
            :disabled="isReadonly"
            @update:model-value="updateMachine({ visionLighting: { brightness: String($event), modes: machine.visionLighting?.modes ?? [] } })"
          />
        </div>
      </div>
      <label class="flex items-center gap-2 text-[11px] text-neutral-400">
        <input
          type="checkbox"
          :checked="machine.coplanarityCheck ?? false"
          :disabled="isReadonly"
          class="rounded"
          @change="updateMachine({ coplanarityCheck: ($event.target as HTMLInputElement).checked })"
        >
        Coplanarity check (P07)
      </label>
    </fieldset>

    <!-- Centering Phases -->
    <fieldset class="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <legend class="px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Centering Phases</legend>

      <div class="flex items-center justify-between">
        <p class="text-xs text-neutral-400">{{ phases.length }} phase(s) configured</p>
        <div v-if="!isReadonly" class="flex gap-1">
          <UButton size="xs" variant="outline" color="neutral" icon="i-lucide-plus" @click="addPhase('optical')">
            Optical
          </UButton>
          <UButton size="xs" variant="outline" color="neutral" icon="i-lucide-plus" @click="addPhase('mechanical')">
            Mechanical
          </UButton>
          <UButton size="xs" variant="outline" color="neutral" icon="i-lucide-plus" @click="addPhase('dip')">
            Dip
          </UButton>
        </div>
      </div>

      <div v-if="phases.length" class="space-y-3">
        <div
          v-for="(phase, idx) in phases"
          :key="idx"
          class="space-y-2 rounded-md border border-neutral-200 p-3 dark:border-neutral-700"
        >
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              Phase {{ idx + 1 }}: {{ phase.method.charAt(0).toUpperCase() + phase.method.slice(1) }}
            </h4>
            <UButton
              v-if="!isReadonly"
              size="xs"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              @click="removePhase(idx)"
            />
          </div>

          <!-- Optical phase settings -->
          <template v-if="phase.method === 'optical'">
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Tools (comma-separated)</label>
                <UInput
                  :model-value="(phase.tools ?? []).join(', ')"
                  size="sm"
                  placeholder="e.g. Z_TOOL, HYDRA_TOOL"
                  :disabled="isReadonly"
                  @update:model-value="updatePhase(idx, { tools: parseList(String($event)) })"
                />
              </div>
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Coarse Search Method</label>
                <USelect
                  :model-value="phase.coarseSearchMethod ?? 'Standard'"
                  size="sm"
                  :items="searchMethodItems"
                  value-key="value"
                  label-key="label"
                  :disabled="isReadonly"
                  @update:model-value="updatePhase(idx, { coarseSearchMethod: String($event) })"
                />
              </div>
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Usable Cameras (comma-separated)</label>
                <UInput
                  :model-value="(phase.usableCameras ?? []).join(', ')"
                  size="sm"
                  placeholder="e.g. standard, linescan, hydra"
                  :disabled="isReadonly"
                  @update:model-value="updatePhase(idx, { usableCameras: parseList(String($event)) })"
                />
              </div>
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Presentation Angle</label>
                <USelect
                  :model-value="phase.presentationAngle ?? 'Auto'"
                  size="sm"
                  :items="angleItems"
                  value-key="value"
                  label-key="label"
                  :disabled="isReadonly"
                  @update:model-value="updatePhase(idx, { presentationAngle: String($event) })"
                />
              </div>
            </div>
            <!-- Illumination -->
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Z Illumination</label>
                <USelect
                  :model-value="phase.illumination?.zIllumination ?? 'Auto'"
                  size="sm"
                  :items="[{ label: 'Auto', value: 'Auto' }, { label: 'Custom', value: 'Custom' }]"
                  value-key="value"
                  label-key="label"
                  :disabled="isReadonly"
                  @update:model-value="updatePhaseIllumination(idx, 'zIllumination', String($event))"
                />
              </div>
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Dark Field (%)</label>
                <UInput
                  :model-value="phase.illumination?.darkField ?? ''"
                  size="sm"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  :disabled="isReadonly"
                  @update:model-value="updatePhaseIllumination(idx, 'darkField', toNumber($event))"
                />
              </div>
            </div>
          </template>

          <!-- Mechanical phase settings -->
          <template v-if="phase.method === 'mechanical'">
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Angle (millideg)</label>
                <UInput
                  :model-value="phase.mechanical?.angle ?? 0"
                  size="sm"
                  type="number"
                  step="1000"
                  :disabled="isReadonly"
                  @update:model-value="updatePhaseMechanical(idx, 'angle', toNumber($event, true))"
                />
              </div>
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Position</label>
                <USelect
                  :model-value="phase.mechanical?.position ?? 'POS_MIDDLE'"
                  size="sm"
                  :items="positionItems"
                  value-key="value"
                  label-key="label"
                  :disabled="isReadonly"
                  @update:model-value="updatePhaseMechanical(idx, 'position', String($event))"
                />
              </div>
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Force</label>
                <USelect
                  :model-value="phase.mechanical?.force ?? 'MIDDLE_FORCE'"
                  size="sm"
                  :items="forceItems"
                  value-key="value"
                  label-key="label"
                  :disabled="isReadonly"
                  @update:model-value="updatePhaseMechanical(idx, 'force', String($event))"
                />
              </div>
            </div>
            <!-- Jaw dimensions -->
            <div class="grid gap-3 sm:grid-cols-3">
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Jaw Nominal (mm)</label>
                <UInput
                  :model-value="phase.jaw?.nominal ?? ''"
                  size="sm"
                  type="number"
                  step="0.05"
                  min="0"
                  :disabled="isReadonly"
                  @update:model-value="updatePhaseJaw(idx, 'nominal', toNumber($event))"
                />
              </div>
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Jaw Min (mm)</label>
                <UInput
                  :model-value="phase.jaw?.min ?? ''"
                  size="sm"
                  type="number"
                  step="0.05"
                  min="0"
                  :disabled="isReadonly"
                  @update:model-value="updatePhaseJaw(idx, 'min', toNumber($event))"
                />
              </div>
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Jaw Max (mm)</label>
                <UInput
                  :model-value="phase.jaw?.max ?? ''"
                  size="sm"
                  type="number"
                  step="0.05"
                  min="0"
                  :disabled="isReadonly"
                  @update:model-value="updatePhaseJaw(idx, 'max', toNumber($event))"
                />
              </div>
            </div>
          </template>

          <!-- Dip phase settings -->
          <template v-if="phase.method === 'dip'">
            <div class="grid gap-3 sm:grid-cols-2">
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Cavity ID</label>
                <UInput
                  :model-value="phase.dip?.cavityId ?? ''"
                  size="sm"
                  :disabled="isReadonly"
                  @update:model-value="updatePhase(idx, { dip: { ...phase.dip, cavityId: String($event) } })"
                />
              </div>
              <div>
                <label class="mb-0.5 block text-[11px] text-neutral-400">Angle</label>
                <UInput
                  :model-value="phase.dip?.angle ?? ''"
                  size="sm"
                  type="number"
                  step="1"
                  :disabled="isReadonly"
                  @update:model-value="updatePhase(idx, { dip: { ...phase.dip, angle: toNumber($event) } })"
                />
              </div>
            </div>
          </template>
        </div>
      </div>
      <p v-else class="rounded-md border border-dashed border-neutral-300 p-3 text-xs text-neutral-400 dark:border-neutral-700">
        No centering phases configured.
      </p>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import type { CenteringPhase, MachineSettings } from '~/utils/package-types'
import { usePackageFormContext } from '~/composables/usePackageFormContext'

const { form, readonly: isReadonly, updateForm, toNumber } = usePackageFormContext()

const machine = computed(() => form.value.machine ?? {})
const phases = computed(() => machine.value.centering ?? [])

const searchMethodItems = [
  { label: 'Standard', value: 'Standard' },
  { label: 'Centered', value: 'Centered' },
  { label: 'Outline', value: 'Outline' },
  { label: 'Matching', value: 'Matching' },
  { label: 'Bounding box', value: 'Bounding box' },
]

const angleItems = [
  { label: 'Auto', value: 'Auto' },
  { label: '0°', value: '0' },
  { label: '90°', value: '90' },
  { label: '180°', value: '180' },
  { label: '270°', value: '270' },
]

const positionItems = [
  { label: 'Upper', value: 'POS_UPPER' },
  { label: 'Middle', value: 'POS_MIDDLE' },
  { label: 'Lower', value: 'POS_LOWER' },
]

const forceItems = [
  { label: 'No Force', value: 'NO_FORCE' },
  { label: 'Low Force', value: 'LOW_FORCE' },
  { label: 'Middle Force', value: 'MIDDLE_FORCE' },
  { label: 'High Force', value: 'HIGH_FORCE' },
]

function updateMachine(overrides: Partial<MachineSettings>) {
  updateForm({ machine: { ...(form.value.machine ?? {}), ...overrides } })
}

function addPhase(method: CenteringPhase['method']) {
  const newPhase: CenteringPhase = { method }
  if (method === 'optical') {
    newPhase.tools = ['Z_TOOL']
    newPhase.coarseSearchMethod = 'Standard'
    newPhase.usableCameras = ['standard']
    newPhase.presentationAngle = 'Auto'
  } else if (method === 'mechanical') {
    newPhase.mechanical = { angle: 0, position: 'POS_MIDDLE', force: 'MIDDLE_FORCE' }
  }
  updateMachine({ centering: [...phases.value, newPhase] })
}

function removePhase(idx: number) {
  updateMachine({ centering: phases.value.filter((_, i) => i !== idx) })
}

function updatePhase(idx: number, overrides: Partial<CenteringPhase>) {
  const updated = phases.value.map((p, i) => i === idx ? { ...p, ...overrides } : p)
  updateMachine({ centering: updated })
}

function updatePhaseIllumination(idx: number, field: string, value: any) {
  const phase = phases.value[idx]
  if (!phase) return
  updatePhase(idx, { illumination: { ...(phase.illumination ?? {}), [field]: value } })
}

function updatePhaseMechanical(idx: number, field: string, value: any) {
  const phase = phases.value[idx]
  if (!phase) return
  updatePhase(idx, {
    mechanical: {
      angle: phase.mechanical?.angle ?? 0,
      position: phase.mechanical?.position ?? 'POS_MIDDLE',
      force: phase.mechanical?.force ?? 'MIDDLE_FORCE',
      [field]: value,
    },
  })
}

function updatePhaseJaw(idx: number, field: string, value: number) {
  const phase = phases.value[idx]
  if (!phase) return
  updatePhase(idx, {
    jaw: {
      nominal: phase.jaw?.nominal ?? 0,
      min: phase.jaw?.min ?? 0,
      max: phase.jaw?.max ?? 0,
      [field]: value,
    },
  })
}

function parseList(val: string): string[] {
  return val.split(/[,;]+/).map(s => s.trim()).filter(Boolean)
}
</script>
