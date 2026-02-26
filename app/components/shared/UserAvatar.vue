<template>
  <span class="inline-flex items-center justify-center rounded-full overflow-hidden shrink-0">
    <img
      v-if="src && !imgError"
      :src="src"
      alt=""
      class="size-full object-cover"
      @error="imgError = true"
    >
    <span v-else class="select-none">{{ initials }}</span>
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  src?: string | null
  name: string
}>()

const imgError = ref(false)

watch(() => props.src, () => {
  imgError.value = false
})

const initials = computed(() => {
  if (!props.name) return '?'
  return props.name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2) || '?'
})
</script>
