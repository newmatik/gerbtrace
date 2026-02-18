<template>
  <UModal v-model:open="model">
    <template #content>
      <div class="p-5 space-y-4 max-w-md">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-alert-triangle" class="text-amber-500 text-lg shrink-0" />
          <h3 class="text-sm font-semibold">Overwrite Files</h3>
        </div>

        <!-- Single file mode -->
        <template v-if="conflicts.length === 1 && !isZip">
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            <span class="font-medium text-neutral-700 dark:text-neutral-300">{{ conflicts[0] }}</span>
            already exists. Do you want to overwrite it?
          </p>
        </template>

        <!-- Multi file mode (ZIP) -->
        <template v-else>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            The following files already exist. Select which ones to overwrite:
          </p>
          <p v-if="newFiles.length" class="text-xs text-neutral-400">
            {{ newFiles.length }} new file{{ newFiles.length !== 1 ? 's' : '' }} will be added automatically.
          </p>
          <div class="flex items-center gap-2 text-[11px]">
            <button class="text-primary hover:underline" @click="selectAll">Select all</button>
            <span class="text-neutral-300 dark:text-neutral-600">|</span>
            <button class="text-primary hover:underline" @click="selectNone">Select none</button>
          </div>
          <div class="max-h-60 overflow-y-auto space-y-0.5 -mx-1">
            <label
              v-for="name in conflicts"
              :key="name"
              class="flex items-center gap-2 text-xs py-1.5 px-2 rounded hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
            >
              <USwitch
                :model-value="selected.has(name)"
                size="sm"
                @update:model-value="toggleFile(name)"
              />
              <span class="truncate">{{ name }}</span>
            </label>
          </div>
        </template>

        <div class="flex items-center justify-end gap-2 pt-1">
          <UButton size="xs" variant="ghost" color="neutral" @click="cancel">Cancel</UButton>
          <UButton size="xs" :disabled="!canConfirm" @click="confirm">
            {{ confirmLabel }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const model = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  /** File names that already exist in the project */
  conflicts: string[]
  /** File names that are new (no conflict) */
  newFiles: string[]
  /** Whether the source was a ZIP file (multi-select mode) */
  isZip: boolean
}>()

const emit = defineEmits<{
  confirm: [selectedFiles: string[]]
  cancel: []
}>()

const selected = ref(new Set<string>())

// Pre-select all conflicts when the modal opens
watch(model, (open) => {
  if (open) {
    selected.value = new Set(props.conflicts)
  }
})

const canConfirm = computed(() => {
  if (!props.isZip && props.conflicts.length === 1) return true
  return selected.value.size > 0 || props.newFiles.length > 0
})

const confirmLabel = computed(() => {
  if (!props.isZip && props.conflicts.length === 1) return 'Overwrite'
  const total = selected.value.size + props.newFiles.length
  return `Import${total > 0 ? ` (${total} file${total !== 1 ? 's' : ''})` : ''}`
})

function toggleFile(name: string) {
  const next = new Set(selected.value)
  if (next.has(name)) {
    next.delete(name)
  } else {
    next.add(name)
  }
  selected.value = next
}

function selectAll() {
  selected.value = new Set(props.conflicts)
}

function selectNone() {
  selected.value = new Set()
}

function confirm() {
  if (!props.isZip && props.conflicts.length === 1) {
    emit('confirm', [...props.conflicts])
  } else {
    emit('confirm', [...selected.value])
  }
}

function cancel() {
  emit('cancel')
}
</script>
