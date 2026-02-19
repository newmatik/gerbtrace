<template>
  <DocsShell :path="docPath" />
</template>

<script setup lang="ts">
const route = useRoute()

const docPath = computed(() => {
  const slug = route.params.slug
  const joined = Array.isArray(slug) ? slug.join('/') : String(slug ?? '')
  return `/docs/${joined}`
})
</script>
