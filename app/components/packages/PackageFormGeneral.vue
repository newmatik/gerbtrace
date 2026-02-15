<template>
  <div class="space-y-4">
    <!-- Identity -->
    <fieldset class="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <legend class="px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Identity</legend>

      <div>
        <label class="mb-1 block text-xs font-medium text-neutral-500 dark:text-neutral-400">Package Name</label>
        <UInput
          :model-value="form.name"
          size="sm"
          placeholder="e.g. C0402, SOT-23, SOIC-8"
          :disabled="isReadonly"
          @update:model-value="updateForm({ name: String($event) })"
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
                v-if="!isReadonly"
                type="button"
                class="text-neutral-400 transition hover:text-neutral-100"
                @click="removeAlias(alias)"
              >
                <UIcon name="i-lucide-x" class="h-3 w-3" />
              </button>
            </UBadge>
          </div>
          <p v-else class="text-xs text-neutral-400">No aliases yet.</p>
          <div v-if="!isReadonly" class="flex gap-2">
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
    </fieldset>

    <!-- Body Dimensions -->
    <fieldset class="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <legend class="px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Body Dimensions (mm)</legend>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Length</label>
          <UInput
            :model-value="form.body.length"
            size="sm"
            type="number"
            step="0.1"
            min="0"
            :disabled="isReadonly"
            @update:model-value="updateForm({ body: { ...form.body, length: toNumber($event) } })"
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
            :disabled="isReadonly"
            @update:model-value="updateForm({ body: { ...form.body, width: toNumber($event) } })"
          />
        </div>
      </div>
    </fieldset>

    <!-- Height & Search Area -->
    <fieldset class="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <legend class="px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Physical Properties (mm)</legend>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Height (nominal)</label>
          <UInput
            :model-value="form.height?.nominal ?? ''"
            size="sm"
            type="number"
            step="0.1"
            min="0"
            :disabled="isReadonly"
            @update:model-value="updateHeight('nominal', $event)"
          />
        </div>
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Height (min)</label>
          <UInput
            :model-value="form.height?.min ?? ''"
            size="sm"
            type="number"
            step="0.1"
            min="0"
            :disabled="isReadonly"
            @update:model-value="updateHeight('min', $event)"
          />
        </div>
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Height (max)</label>
          <UInput
            :model-value="form.height?.max ?? ''"
            size="sm"
            type="number"
            step="0.1"
            min="0"
            :disabled="isReadonly"
            @update:model-value="updateHeight('max', $event)"
          />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Search Area X</label>
          <UInput
            :model-value="form.searchArea?.x ?? ''"
            size="sm"
            type="number"
            step="0.1"
            min="0"
            :disabled="isReadonly"
            @update:model-value="updateForm({ searchArea: { x: toNumber($event), y: form.searchArea?.y ?? 0 } })"
          />
        </div>
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Search Area Y</label>
          <UInput
            :model-value="form.searchArea?.y ?? ''"
            size="sm"
            type="number"
            step="0.1"
            min="0"
            :disabled="isReadonly"
            @update:model-value="updateForm({ searchArea: { x: form.searchArea?.x ?? 0, y: toNumber($event) } })"
          />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Center Offset X</label>
          <UInput
            :model-value="form.centerOffset?.x ?? ''"
            size="sm"
            type="number"
            step="0.05"
            :disabled="isReadonly"
            @update:model-value="updateForm({ centerOffset: { x: toNumber($event), y: form.centerOffset?.y ?? 0 } })"
          />
        </div>
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Center Offset Y</label>
          <UInput
            :model-value="form.centerOffset?.y ?? ''"
            size="sm"
            type="number"
            step="0.05"
            :disabled="isReadonly"
            @update:model-value="updateForm({ centerOffset: { x: form.centerOffset?.x ?? 0, y: toNumber($event) } })"
          />
        </div>
      </div>
    </fieldset>

    <!-- Mount Tools & Timing -->
    <fieldset class="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <legend class="px-1 text-xs font-semibold text-neutral-500 dark:text-neutral-400">Mount Tools &amp; Timing</legend>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Mount Tools (comma-separated)</label>
          <UInput
            :model-value="(form.machine?.mountTools ?? []).join(', ')"
            size="sm"
            placeholder="e.g. A34, B12"
            :disabled="isReadonly"
            @update:model-value="updateMachine({ mountTools: parseToolList(String($event)) })"
          />
        </div>
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">HYDRA Tools (comma-separated)</label>
          <UInput
            :model-value="(form.machine?.hydraTools ?? []).join(', ')"
            size="sm"
            placeholder="e.g. H04"
            :disabled="isReadonly"
            @update:model-value="updateMachine({ hydraTools: parseToolList(String($event)) })"
          />
        </div>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Pick Wait (ms)</label>
          <UInput
            :model-value="form.machine?.pickWaitTime ?? ''"
            size="sm"
            type="number"
            step="1"
            min="0"
            :disabled="isReadonly"
            @update:model-value="updateMachine({ pickWaitTime: toNumber($event, true) })"
          />
        </div>
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Place Wait (ms)</label>
          <UInput
            :model-value="form.machine?.placeWaitTime ?? ''"
            size="sm"
            type="number"
            step="1"
            min="0"
            :disabled="isReadonly"
            @update:model-value="updateMachine({ placeWaitTime: toNumber($event, true) })"
          />
        </div>
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Tool Top Offset (mm)</label>
          <UInput
            :model-value="form.machine?.toolTopOffset ?? ''"
            size="sm"
            type="number"
            step="0.1"
            :disabled="isReadonly"
            @update:model-value="updateMachine({ toolTopOffset: toNumber($event) })"
          />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="mb-0.5 block text-[11px] text-neutral-400">Z Mount Force (N)</label>
          <UInput
            :model-value="form.machine?.zMountForce ?? ''"
            size="sm"
            type="number"
            step="0.1"
            min="0"
            :disabled="isReadonly"
            @update:model-value="updateMachine({ zMountForce: toNumber($event) })"
          />
        </div>
        <div class="flex items-end pb-1">
          <label class="flex items-center gap-2 text-[11px] text-neutral-400">
            <input
              type="checkbox"
              :checked="form.machine?.zMountForceLow ?? false"
              :disabled="isReadonly"
              class="rounded"
              @change="updateMachine({ zMountForceLow: ($event.target as HTMLInputElement).checked })"
            >
            Low force
          </label>
        </div>
      </div>

      <!-- Flags -->
      <div class="space-y-1.5">
        <p class="text-[11px] font-medium text-neutral-400">Flags</p>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1.5">
          <label v-for="flag in flagOptions" :key="flag.key" class="flex items-center gap-2 text-[11px] text-neutral-400">
            <input
              type="checkbox"
              :checked="(form.machine?.flags as any)?.[flag.key] ?? false"
              :disabled="isReadonly"
              class="rounded"
              @change="updateFlag(flag.key, ($event.target as HTMLInputElement).checked)"
            >
            {{ flag.label }}
          </label>
        </div>
      </div>
    </fieldset>
  </div>
</template>

<script setup lang="ts">
import type { MachineSettings, MachineFlags } from '~/utils/package-types'
import { usePackageFormContext } from '~/composables/usePackageFormContext'

const { form, readonly: isReadonly, updateForm, toNumber } = usePackageFormContext()

const aliasDraft = ref('')

const flagOptions: Array<{ key: keyof MachineFlags; label: string }> = [
  { key: 'pickPositionFeedback', label: 'Pick position feedback' },
  { key: 'holdDuringXMove', label: 'Hold during X move' },
  { key: 'vacuumTest', label: 'Vacuum test' },
  { key: 'hydraHoverPick', label: 'HYDRA hover pick' },
  { key: 'hydraExtensiveReject', label: 'HYDRA extensive reject' },
]

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
  const tokens = aliasDraft.value.split(/[,\n;]+/).map(v => v.trim()).filter(Boolean)
  if (!tokens.length) { aliasDraft.value = ''; return }
  updateForm({ aliases: buildDedupedAliases([...form.value.aliases, ...tokens]) })
  aliasDraft.value = ''
}

function handleAliasKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',' || event.key === ';') {
    event.preventDefault()
    commitAliasDraft()
  }
}

function removeAlias(alias: string) {
  updateForm({ aliases: form.value.aliases.filter(a => a !== alias) })
}

function updateHeight(field: 'nominal' | 'min' | 'max', val: string | number) {
  const current = form.value.height ?? { nominal: 0, min: 0, max: 0 }
  updateForm({ height: { ...current, [field]: toNumber(val) } })
}

function parseToolList(val: string): string[] {
  return val.split(/[,;]+/).map(s => s.trim()).filter(Boolean)
}

function updateMachine(overrides: Partial<MachineSettings>) {
  updateForm({ machine: { ...(form.value.machine ?? {}), ...overrides } })
}

function updateFlag(key: keyof MachineFlags, value: boolean) {
  const flags = { ...(form.value.machine?.flags ?? {}), [key]: value }
  updateMachine({ flags })
}
</script>
