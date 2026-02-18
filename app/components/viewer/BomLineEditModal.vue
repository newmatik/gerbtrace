<template>
  <UModal v-model:open="open" :ui="{ content: 'sm:max-w-lg' }">
    <template #content>
      <div class="p-5 space-y-4" @keydown.stop>
        <!-- Header -->
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">
            {{ isNew ? 'Add BOM Line' : 'Edit BOM Line' }}
          </h3>
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" @click="open = false" />
        </div>

        <!-- PnP mismatch warning -->
        <div v-if="missingInPnP.length > 0" class="flex items-start gap-1.5 px-2 py-1.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
          <UIcon name="i-lucide-triangle-alert" class="text-xs shrink-0 mt-0.5" />
          <div>
            <span class="font-medium">Not found in Pick &amp; Place:</span>
            {{ missingInPnP.join(', ') }}
          </div>
        </div>

        <!-- Core fields -->
        <div class="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
          <div class="col-span-2">
            <label class="text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-[10px] font-medium">Description</label>
            <input
              v-model="local.description"
              type="text"
              class="mt-0.5 w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label class="text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-[10px] font-medium">References</label>
            <input
              v-model="local.references"
              type="text"
              placeholder="R1, R2, R3"
              class="mt-0.5 w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label class="text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-[10px] font-medium">Quantity</label>
            <input
              v-model.number="local.quantity"
              type="number"
              min="0"
              class="mt-0.5 w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 outline-none tabular-nums focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label class="text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-[10px] font-medium">Type</label>
            <USelect
              :model-value="local.type"
              :items="bomTypeItems"
              value-key="value"
              label-key="label"
              size="xs"
              class="mt-0.5 w-full"
              @update:model-value="local.type = String($event) as BomLine['type']"
            />
          </div>

          <div>
            <label class="text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-[10px] font-medium">Package</label>
            <input
              v-model="local.package"
              type="text"
              class="mt-0.5 w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label class="text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-[10px] font-medium">Customer Item No</label>
            <input
              v-model="local.customerItemNo"
              type="text"
              class="mt-0.5 w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label class="text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-[10px] font-medium">Customer Provided</label>
            <div class="mt-1.5 flex items-center gap-2">
              <USwitch
                :model-value="local.customerProvided"
                size="sm"
                @update:model-value="local.customerProvided = !!$event"
              />
              <span class="text-xs text-neutral-600 dark:text-neutral-300">{{ local.customerProvided ? 'Yes' : 'No' }}</span>
            </div>
          </div>

          <div>
            <label class="text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-[10px] font-medium">DNP</label>
            <div class="mt-1.5 flex items-center gap-2">
              <USwitch
                :model-value="local.dnp"
                size="sm"
                @update:model-value="local.dnp = !!$event"
              />
              <span class="text-xs text-neutral-600 dark:text-neutral-300">{{ local.dnp ? 'Do Not Populate' : 'No' }}</span>
            </div>
          </div>

          <div class="col-span-2">
            <label class="text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-[10px] font-medium">Comment</label>
            <input
              v-model="local.comment"
              type="text"
              class="mt-0.5 w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        <!-- Manufacturers -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-[10px] font-medium">Manufacturers</label>
            <button
              class="text-[10px] text-primary hover:text-primary/80 font-medium"
              @click="addMfr"
            >
              + Add
            </button>
          </div>

          <div v-if="localMfrs.length === 0" class="text-xs text-neutral-400 italic">
            No manufacturers added.
          </div>

          <div v-for="(mfr, idx) in localMfrs" :key="idx" class="flex items-center gap-2 mb-1.5">
            <input
              v-model="mfr.manufacturer"
              type="text"
              placeholder="Manufacturer"
              class="flex-1 text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 outline-none focus:border-primary transition-colors"
            />
            <input
              v-model="mfr.manufacturerPart"
              type="text"
              placeholder="MPN"
              class="flex-1 text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 outline-none focus:border-primary transition-colors"
            />
            <button
              class="text-neutral-400 hover:text-red-500 transition-colors shrink-0"
              @click="removeMfr(idx)"
            >
              <UIcon name="i-lucide-x" class="text-sm" />
            </button>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-between pt-2">
          <UButton
            v-if="!isNew"
            variant="ghost"
            color="error"
            size="sm"
            icon="i-lucide-trash-2"
            @click="handleDelete"
          >
            Delete Line
          </UButton>
          <div v-else />
          <div class="flex gap-2">
            <UButton variant="ghost" color="neutral" size="sm" @click="open = false">Cancel</UButton>
            <UButton size="sm" @click="handleSave">{{ isNew ? 'Add' : 'Save' }}</UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { BomLine, BomManufacturer } from '~/utils/bom-types'
import { BOM_LINE_TYPES } from '~/utils/bom-types'

const props = defineProps<{
  line: BomLine | null
  /** Set of designators present in PnP data (SMD + THT, excluding DNP) */
  pnpDesignators?: Set<string>
}>()

const emit = defineEmits<{
  save: [line: BomLine]
  delete: [id: string]
}>()

const open = defineModel<boolean>('open', { default: false })

const isNew = computed(() => !props.line)
const bomTypeItems = BOM_LINE_TYPES.map((t) => ({ label: t, value: t }))

const missingInPnP = computed(() => {
  if (!props.pnpDesignators || local.dnp) return []
  const refs = local.references.split(/[,;\s]+/).map((r: string) => r.trim()).filter(Boolean)
  return refs.filter((r: string) => !props.pnpDesignators!.has(r))
})

const local = reactive({
  description: '',
  type: 'SMD' as BomLine['type'],
  customerProvided: false,
  customerItemNo: '',
  quantity: 1,
  package: '',
  references: '',
  comment: '',
  dnp: false,
})

const localMfrs = ref<BomManufacturer[]>([])

// Sync local state when the modal opens or the line changes
watch([() => props.line, open], ([line, isOpen]) => {
  if (!isOpen) return
  if (line) {
    local.description = line.description
    local.type = line.type
    local.customerProvided = line.customerProvided
    local.customerItemNo = line.customerItemNo
    local.quantity = line.quantity
    local.package = line.package
    local.references = line.references
    local.comment = line.comment
    local.dnp = line.dnp ?? false
    localMfrs.value = line.manufacturers.map(m => ({ ...m }))
  } else {
    local.description = ''
    local.type = 'SMD'
    local.customerProvided = false
    local.customerItemNo = ''
    local.quantity = 1
    local.package = ''
    local.references = ''
    local.comment = ''
    local.dnp = false
    localMfrs.value = []
  }
}, { immediate: true })

function addMfr() {
  localMfrs.value.push({ manufacturer: '', manufacturerPart: '' })
}

function removeMfr(idx: number) {
  localMfrs.value.splice(idx, 1)
}

function handleSave() {
  const result: BomLine = {
    id: props.line?.id ?? crypto.randomUUID(),
    description: local.description,
    type: local.type,
    customerProvided: local.customerProvided,
    customerItemNo: local.customerItemNo,
    quantity: local.quantity,
    package: local.package,
    references: local.references,
    comment: local.comment,
    dnp: local.dnp,
    manufacturers: localMfrs.value.filter(m => m.manufacturer || m.manufacturerPart),
  }
  emit('save', result)
  open.value = false
}

function handleDelete() {
  if (props.line) {
    emit('delete', props.line.id)
    open.value = false
  }
}
</script>
