<template>
  <UModal v-model:open="open" :ui="{ content: 'sm:max-w-md' }">
    <template #content>
      <div class="p-5 space-y-4" @keydown.stop>
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-neutral-900 dark:text-white">
            Create Group
          </h3>
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-x" @click="open = false" />
        </div>

        <div class="space-y-2">
          <div>
            <label class="text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-[10px] font-medium">Name</label>
            <input
              v-model="name"
              type="text"
              class="mt-0.5 w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 outline-none focus:border-primary transition-colors"
              @keydown.enter.prevent="submit"
            >
          </div>
          <div>
            <label class="text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-[10px] font-medium">Comment</label>
            <input
              v-model="comment"
              type="text"
              class="mt-0.5 w-full text-xs bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 outline-none focus:border-primary transition-colors"
              @keydown.enter.prevent="submit"
            >
          </div>
        </div>

        <div class="flex items-center justify-end gap-2">
          <UButton size="sm" variant="ghost" color="neutral" @click="open = false">Cancel</UButton>
          <UButton size="sm" :disabled="!name.trim()" @click="submit">Create</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  defaultName: string
}>()

const emit = defineEmits<{
  create: [payload: { name: string; comment: string }]
}>()

const name = ref('')
const comment = ref('')

watch(open, (isOpen) => {
  if (!isOpen) return
  name.value = props.defaultName
  comment.value = ''
}, { immediate: true })

function submit() {
  const trimmedName = name.value.trim()
  if (!trimmedName) return
  emit('create', { name: trimmedName, comment: comment.value.trim() })
  open.value = false
}
</script>
