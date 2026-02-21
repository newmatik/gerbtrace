<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    :class="props.class"
  >
    <!-- Stylized "x" inspired by Elexess branding -->
    <path d="M7 4l10 16" />
    <path d="M17 4L7 20" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </svg>
</template>

<script setup lang="ts">
const props = defineProps<{
  class?: string
}>()
</script>
