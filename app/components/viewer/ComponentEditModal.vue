<template>
  <UModal v-model:open="open" :ui="{ content: 'sm:max-w-md' }">
    <template #content>
      <div class="p-5 space-y-4" @keydown.stop>
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">
              {{ component?.manual ? 'Manual Component' : component?.originalDesignator }}
            </h3>
            <span
              v-if="component?.side"
              class="text-[10px] px-1.5 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-400"
            >{{ component.side === 'top' ? 'Top' : 'Bottom' }}</span>
            <span
              v-if="component?.manual"
              class="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800"
            >Manual</span>
            <span
              v-if="localDnp"
              class="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
            >DNP</span>
          </div>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-x"
            @click="open = false"
          />
        </div>

        <!-- BOM mismatch warning -->
        <div v-if="notInBom" class="flex items-start gap-1.5 px-2 py-1.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
          <UIcon name="i-lucide-triangle-alert" class="text-xs shrink-0 mt-0.5" />
          <span><span class="font-medium">{{ localDesignator }}</span> not found in BOM</span>
        </div>

        <!-- Editable core fields -->
        <div class="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
          <div>
            <label class="text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-[10px] font-medium">Designator</label>
            <input
              v-model="localDesignator"
              type="text"
              class="mt-0.5 w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 outline-none focus:border-primary transition-colors"
              :class="{ 'text-amber-600 dark:text-amber-300': localDesignator !== (component?.originalDesignator ?? '') }"
            />
          </div>
          <div>
            <label class="text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-[10px] font-medium">Value</label>
            <input
              v-model="localValue"
              type="text"
              class="mt-0.5 w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 outline-none focus:border-primary transition-colors"
              :class="{ 'text-amber-600 dark:text-amber-300': localValue !== (component?.originalValue ?? '') }"
            />
          </div>
          <div>
            <label class="text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-[10px] font-medium">X (mm)</label>
            <input
              v-model="localX"
              type="number"
              step="0.001"
              class="mt-0.5 w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 outline-none tabular-nums focus:border-primary transition-colors"
              :class="{ 'text-amber-600 dark:text-amber-300': Number(localX) !== (component?.originalX ?? 0) }"
            />
          </div>
          <div>
            <label class="text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-[10px] font-medium">Y (mm)</label>
            <input
              v-model="localY"
              type="number"
              step="0.001"
              class="mt-0.5 w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 outline-none tabular-nums focus:border-primary transition-colors"
              :class="{ 'text-amber-600 dark:text-amber-300': Number(localY) !== (component?.originalY ?? 0) }"
            />
          </div>
        </div>

        <!-- CAD package (read-only for parsed, editable for manual) -->
        <div v-if="!component?.manual" class="text-xs">
          <span class="text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-[10px] font-medium">CAD Package</span>
          <div class="text-neutral-700 dark:text-neutral-300 mt-0.5">{{ component?.cadPackage || '—' }}</div>
        </div>

        <div class="h-px bg-neutral-200 dark:bg-neutral-700" />

        <!-- Editable fields -->
        <div class="space-y-3">
          <!-- Rotation -->
          <div class="flex items-center justify-between">
            <label class="text-xs text-neutral-500 dark:text-neutral-400">Rotation</label>
            <div class="flex items-center gap-1.5">
              <input
                v-model="localRotation"
                type="number"
                step="0.1"
                class="w-20 text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 outline-none tabular-nums text-right focus:border-primary transition-colors"
                :class="{ 'text-amber-600 dark:text-amber-300': isRotationOverridden }"
                @keydown.enter="($event.target as HTMLInputElement).blur()"
              />
              <span class="text-[10px] text-neutral-400">deg</span>
              <button
                class="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors p-0.5"
                title="Rotate 90 CCW"
                @click="localRotation = normaliseRotation(Number(localRotation) - 90).toString()"
              >
                <UIcon name="i-lucide-rotate-ccw" class="text-xs" />
              </button>
              <button
                v-if="isRotationOverridden"
                class="text-amber-600/90 dark:text-amber-300/90 hover:text-red-500 transition-colors p-0.5"
                title="Reset to original rotation"
                @click="localRotation = formatRotation(component!.originalRotation)"
              >
                <UIcon name="i-lucide-undo-2" class="text-xs" />
              </button>
            </div>
          </div>

          <!-- Side (manual components only) -->
          <div v-if="component?.manual" class="flex items-center justify-between">
            <label class="text-xs text-neutral-500 dark:text-neutral-400">Side</label>
            <div class="flex gap-1.5">
              <button
                v-for="s in sideOptions"
                :key="s.value"
                class="px-2.5 py-1 text-xs rounded border transition-colors"
                :class="localSide === s.value
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'"
                @click="localSide = s.value"
              >
                {{ s.label }}
              </button>
            </div>
          </div>

          <!-- DNP -->
          <div class="flex items-center justify-between">
            <label class="text-xs text-neutral-500 dark:text-neutral-400">Do Not Populate</label>
            <button
              class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
              :class="localDnp ? 'bg-red-500' : 'bg-neutral-200 dark:bg-neutral-700'"
              role="switch"
              :aria-checked="localDnp"
              @click="localDnp = !localDnp"
            >
              <span
                class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                :class="localDnp ? 'translate-x-4' : 'translate-x-0'"
              />
            </button>
          </div>

          <!-- Polarized -->
          <div class="flex items-center justify-between">
            <label class="text-xs text-neutral-500 dark:text-neutral-400">Polarized (Pin 1)</label>
            <button
              class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
              :class="localPolarized ? 'bg-primary' : 'bg-neutral-200 dark:bg-neutral-700'"
              role="switch"
              :aria-checked="localPolarized"
              @click="localPolarized = !localPolarized"
            >
              <span
                class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                :class="localPolarized ? 'translate-x-4' : 'translate-x-0'"
              />
            </button>
          </div>

          <!-- Package mapping -->
          <div class="flex items-center justify-between">
            <label class="text-xs text-neutral-500 dark:text-neutral-400">Package</label>
            <USelectMenu
              v-model="localPackage"
              v-model:search-term="modalPkgSearchTerm"
              :items="packageSelectItems"
              value-key="value"
              label-key="displayLabel"
              size="xs"
              searchable
              ignore-filter
              class="max-w-[16rem] w-full"
              :class="localPackage ? 'text-blue-700 dark:text-blue-300' : ''"
              :search-input="{ placeholder: 'Search package or library...' }"
              :ui="{ content: 'min-w-[28rem] max-w-[40rem]', itemLabel: 'whitespace-normal leading-tight' }"
              placeholder="—"
              @highlight="onPkgHighlight($event as any)"
              @update:open="!$event && emit('preview:package', null)"
            >
              <template #item="{ item }">
                <div class="w-full py-0.5">
                  <div class="text-xs font-medium text-neutral-800 dark:text-neutral-100 break-all leading-tight">
                    {{ getPackageOption(item)?.label ?? getItemLabel(item) }}
                  </div>
                  <div class="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {{ getPackageOption(item)?.libraryLabel ?? 'Local' }}
                  </div>
                </div>
              </template>
            </USelectMenu>
          </div>

          <!-- Group assignment -->
          <div class="flex items-center justify-between">
            <label class="text-xs text-neutral-500 dark:text-neutral-400">Group</label>
            <USelect
              v-model="localGroupId"
              :items="groupSelectItems"
              value-key="value"
              label-key="label"
              size="xs"
              class="max-w-[12rem] w-full"
            />
          </div>
        </div>

        <div class="h-px bg-neutral-200 dark:bg-neutral-700" />

        <!-- Note -->
        <div class="space-y-1.5">
          <label class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Note</label>
          <textarea
            ref="noteInput"
            v-model="localNote"
            rows="3"
            class="w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2.5 py-2 outline-none placeholder:text-neutral-400 focus:border-primary transition-colors resize-none"
            placeholder="Add a note for this component..."
          />
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between pt-1">
          <button
            class="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors flex items-center gap-1"
            @click="handleDelete"
          >
            <UIcon name="i-lucide-trash-2" class="text-xs" />
            Delete
          </button>
          <UButton size="sm" color="primary" @click="save">
            Done
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { EditablePnPComponent } from '~/composables/usePickAndPlace'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  component: EditablePnPComponent | null
  packageOptions: Array<{
    value: string
    label: string
    libraryLabel: string
    searchText: string
    previewKind: 'smd' | 'tht'
    previewPkg?: Record<string, any>
    packageType?: string
  }>
  groups: { id: string; name: string }[]
  currentGroupId: string | null
  /** Set of designators present in BOM data (excluding DNP lines) */
  bomDesignators?: Set<string>
}>()

const emit = defineEmits<{
  'update:rotation': [payload: { key: string; rotation: number }]
  'reset:rotation': [payload: { key: string }]
  'toggle:dnp': [key: string]
  'update:polarized': [payload: { key: string; polarized: boolean }]
  'update:packageMapping': [payload: { cadPackage: string; packageName: string | null; componentKey?: string; isManual?: boolean }]
  'update:note': [payload: { key: string; note: string }]
  'update:fields': [payload: { key: string; designator?: string; value?: string; x?: number; y?: number }]
  'update:manualComponent': [payload: { id: string; designator?: string; value?: string; package?: string; x?: number; y?: number; rotation?: number; side?: 'top' | 'bottom' }]
  'delete:manualComponent': [id: string]
  'delete:component': [key: string]
  'assign:group': [payload: { key: string; groupId: string | null }]
  'preview:package': [payload: { componentKey: string; packageName: string } | null]
}>()

const noteInput = ref<HTMLTextAreaElement | null>(null)

const notInBom = computed(() => {
  if (!props.bomDesignators || props.bomDesignators.size === 0) return false
  if (localDnp.value) return false
  return !props.bomDesignators.has(localDesignator.value)
})

const localDesignator = ref('')
const localValue = ref('')
const localX = ref('')
const localY = ref('')
const localRotation = ref('')
const localDnp = ref(false)
const localPolarized = ref(false)
const localPackage = ref('')
const localNote = ref('')
const localSide = ref<'top' | 'bottom'>('top')
const localGroupId = ref('')
const NO_SECTION_GROUP_VALUE = '__NO_SECTION__'
const PKG_DROPDOWN_LIMIT = 80
const allPackageSelectItems = computed(() =>
  props.packageOptions.map((opt) => ({
    ...opt,
    displayLabel: `${opt.label} · ${opt.libraryLabel}`,
  })),
)
const modalPkgSearchTerm = ref('')
const packageSelectItems = computed(() => {
  const q = modalPkgSearchTerm.value.trim().toLowerCase()
  const source = allPackageSelectItems.value
  if (!q) return source.slice(0, PKG_DROPDOWN_LIMIT)
  const out: typeof source = []
  for (const item of source) {
    if (item.searchText.toLowerCase().includes(q)) {
      out.push(item)
      if (out.length >= PKG_DROPDOWN_LIMIT) break
    }
  }
  return out
})
function onPkgHighlight(payload: { value: string } | undefined) {
  if (!props.component) return
  emit('preview:package', payload?.value ? { componentKey: props.component.key, packageName: payload.value } : null)
}
const packageOptionsByValue = computed(() => {
  const map = new Map<string, (typeof props.packageOptions)[number]>()
  for (const opt of props.packageOptions) map.set(opt.value, opt)
  return map
})

function getItemValue(item: any): string | undefined {
  if (!item || typeof item !== 'object') return undefined
  if (typeof item.value === 'string') return item.value
  if (item.raw && typeof item.raw === 'object' && typeof item.raw.value === 'string') return item.raw.value
  return undefined
}

function getItemLabel(item: any): string {
  if (!item || typeof item !== 'object') return ''
  if (typeof item.label === 'string') return item.label
  if (typeof item.displayLabel === 'string') return item.displayLabel
  if (item.raw && typeof item.raw === 'object') {
    if (typeof item.raw.label === 'string') return item.raw.label
    if (typeof item.raw.displayLabel === 'string') return item.raw.displayLabel
  }
  return ''
}

function getPackageOption(item: any) {
  const value = getItemValue(item)
  if (!value) return null
  return packageOptionsByValue.value.get(value) ?? null
}
const groupSelectItems = computed(() => [
  { value: NO_SECTION_GROUP_VALUE, label: 'No section' },
  ...props.groups.map((g) => ({ value: g.id, label: g.name })),
])

const sideOptions = [
  { label: 'Top', value: 'top' as const },
  { label: 'Bottom', value: 'bottom' as const },
]

const isRotationOverridden = computed(() => {
  if (!props.component) return false
  const parsed = Number(localRotation.value)
  if (!Number.isFinite(parsed)) return props.component.rotationOverridden
  return Math.abs(parsed - props.component.originalRotation) > 1e-6
})

function formatRotation(rotation: number): string {
  if (Number.isInteger(rotation)) return rotation.toString()
  return rotation.toFixed(2).replace(/\.?0+$/, '')
}

function normaliseRotation(deg: number): number {
  return ((deg % 360) + 360) % 360
}

// Sync local state when modal opens or component changes
watch([open, () => props.component], ([isOpen, comp]) => {
  if (isOpen && comp) {
    localDesignator.value = comp.designator
    localValue.value = comp.value
    localX.value = comp.x.toFixed(4).replace(/\.?0+$/, '')
    localY.value = comp.y.toFixed(4).replace(/\.?0+$/, '')
    localRotation.value = formatRotation(comp.rotation)
    localDnp.value = comp.dnp
    localPolarized.value = comp.polarized
    localPackage.value = comp.matchedPackage
    localNote.value = comp.note
    localSide.value = comp.side
    localGroupId.value = props.currentGroupId ?? NO_SECTION_GROUP_VALUE
  }
}, { immediate: true })

function handleDelete() {
  if (!props.component) return
  if (props.component.manual) {
    const id = props.component.key.replace('manual|', '')
    emit('delete:manualComponent', id)
  } else {
    emit('delete:component', props.component.key)
  }
  open.value = false
}

function save() {
  if (!props.component) { open.value = false; return }
  const comp = props.component

  if (comp.manual) {
    // Manual component: update via updateManualComponent
    const id = comp.key.replace('manual|', '')
    const updates: Record<string, any> = {}
    if (localDesignator.value !== comp.designator) updates.designator = localDesignator.value
    if (localValue.value !== comp.value) updates.value = localValue.value
    const parsedX = Number(localX.value)
    const parsedY = Number(localY.value)
    if (Number.isFinite(parsedX) && Math.abs(parsedX - comp.x) > 1e-6) updates.x = parsedX
    if (Number.isFinite(parsedY) && Math.abs(parsedY - comp.y) > 1e-6) updates.y = parsedY
    const parsedRot = Number(localRotation.value)
    if (Number.isFinite(parsedRot)) {
      const normRot = normaliseRotation(parsedRot)
      if (Math.abs(normRot - comp.rotation) > 1e-6) updates.rotation = normRot
    }
    if (localSide.value !== comp.side) updates.side = localSide.value
    if (localPackage.value !== comp.package) updates.package = localPackage.value

    if (Object.keys(updates).length > 0) {
      emit('update:manualComponent', { id, ...updates })
    }

    // DNP
    if (localDnp.value !== comp.dnp) {
      emit('toggle:dnp', comp.key)
    }

    // Polarized
    if (localPolarized.value !== comp.polarized) {
      emit('update:polarized', { key: comp.key, polarized: localPolarized.value })
    }
  } else {
    // Parsed component: use field overrides for designator/value/x/y changes
    const fieldChanges: Record<string, any> = { key: comp.key }
    let hasFieldChanges = false
    if (localDesignator.value !== comp.originalDesignator) {
      fieldChanges.designator = localDesignator.value
      hasFieldChanges = true
    }
    if (localValue.value !== comp.originalValue) {
      fieldChanges.value = localValue.value
      hasFieldChanges = true
    }
    const parsedX = Number(localX.value)
    if (Number.isFinite(parsedX) && Math.abs(parsedX - comp.originalX) > 1e-6) {
      fieldChanges.x = parsedX
      hasFieldChanges = true
    }
    const parsedY = Number(localY.value)
    if (Number.isFinite(parsedY) && Math.abs(parsedY - comp.originalY) > 1e-6) {
      fieldChanges.y = parsedY
      hasFieldChanges = true
    }
    emit('update:fields', fieldChanges as any)

    // Rotation
    const parsedRot = Number(localRotation.value)
    if (Number.isFinite(parsedRot)) {
      const normRot = normaliseRotation(parsedRot)
      if (Math.abs(normRot - comp.rotation) > 1e-6) {
        emit('update:rotation', { key: comp.key, rotation: normRot })
      }
    }

    // DNP
    if (localDnp.value !== comp.dnp) {
      emit('toggle:dnp', comp.key)
    }

    // Polarized
    if (localPolarized.value !== comp.polarized) {
      emit('update:polarized', { key: comp.key, polarized: localPolarized.value })
    }

    // Package mapping
    if (localPackage.value !== comp.matchedPackage) {
      emit('update:packageMapping', { cadPackage: comp.cadPackage, packageName: localPackage.value || null, componentKey: comp.key, isManual: comp.manual })
    }
  }

  // Note (for both manual and parsed)
  if (localNote.value.trim() !== comp.note) {
    emit('update:note', { key: comp.key, note: localNote.value })
  }

  // Group assignment
  const nextGroupId = localGroupId.value === NO_SECTION_GROUP_VALUE ? null : localGroupId.value
  const currentGroupId = props.currentGroupId ?? null
  if (nextGroupId !== currentGroupId) {
    emit('assign:group', { key: comp.key, groupId: nextGroupId })
  }

  open.value = false
}
</script>
