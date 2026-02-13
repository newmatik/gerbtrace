<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <!-- Global About modal – opened via native "Check for Updates…" menu -->
    <AppAboutModal v-if="isTauri" v-model:open="aboutOpen" />
  </UApp>
</template>

<script setup lang="ts">
const { isTauri, menuTriggered } = useUpdater()
const aboutOpen = ref(false)

// Open the About modal when the native menu "Check for Updates…" is clicked
watch(menuTriggered, (triggered) => {
  if (triggered) {
    aboutOpen.value = true
    menuTriggered.value = false
  }
})
</script>
