<template>
  <div
    class="rounded-md bg-neutral-50/60 dark:bg-neutral-900/40 p-2"
    @click="focusInput"
  >
    <div class="flex flex-nowrap items-center gap-1.5">
      <UBadge
        v-for="qty in quantities"
        :key="qty"
        size="xs"
        color="neutral"
        variant="subtle"
        class="gap-1 pr-1"
      >
        <span class="font-mono">{{ qty }}</span>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          class="!p-0.5"
          title="Remove quantity"
          :disabled="locked"
          @click.stop="removeQuantity(qty)"
        />
      </UBadge>

      <UInput
        ref="qtyInputEl"
        v-model="inputValue"
        size="xs"
        autocomplete="off"
        placeholder="Add qty..."
        :disabled="locked"
        class="w-24 min-w-0"
        @keydown="onInputKeydown"
        @blur="commitInput"
        @paste="handlePaste"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: number[]
  locked?: boolean
}>(), {
  locked: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
}>()

const inputValue = ref('')
const qtyInputEl = ref<{ inputRef?: { focus?: () => void } } | null>(null)

const quantities = computed(() => sanitize(props.modelValue))

function sanitize(values: number[]): number[] {
  const next = Array.from(
    new Set(
      (values ?? [])
        .map(v => Number(v))
        .filter(v => Number.isFinite(v) && v >= 1)
        .map(v => Math.round(v)),
    ),
  )
  return next.sort((a, b) => a - b)
}

function parseQuantities(raw: string): number[] {
  return sanitize(
    raw
      .split(/[,;\s]+/)
      .map(v => Number(v.trim()))
      .filter(v => Number.isFinite(v) && v >= 1),
  )
}

function updateQuantities(next: number[]) {
  emit('update:modelValue', sanitize(next))
}

function focusInput() {
  if (props.locked) return
  qtyInputEl.value?.inputRef?.focus?.()
}

function commitInput() {
  if (props.locked) return
  const parsed = parseQuantities(inputValue.value)
  if (parsed.length > 0) updateQuantities([...quantities.value, ...parsed])
  inputValue.value = ''
}

function removeQuantity(qty: number) {
  if (props.locked) return
  updateQuantities(quantities.value.filter(v => v !== qty))
}

function onInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',' || event.key === ' ' || event.key === 'Tab') {
    event.preventDefault()
    commitInput()
  }
}

function handlePaste(event: ClipboardEvent) {
  if (props.locked) return
  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (!text) return
  const parsed = parseQuantities(text)
  if (parsed.length === 0) return
  event.preventDefault()
  updateQuantities([...quantities.value, ...parsed])
  inputValue.value = ''
}
</script>
