<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <!-- Global About modal – opened via native "Check for Updates…" menu -->
    <AppAboutModal v-if="isTauri" v-model:open="aboutOpen" />

    <!-- Post-update "What's New" modal -->
    <WhatsNewModal
      v-if="postUpdateInfo"
      v-model:open="whatsNewOpen"
      :version="postUpdateInfo.version"
      :notes="postUpdateInfo.notes"
    />

    <!-- Global desktop update prompt -->
    <div
      v-if="isTauri && showUpdatePrompt"
      class="fixed bottom-4 right-4 z-[70] w-[min(28rem,calc(100vw-2rem))]"
    >
      <div class="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white/95 dark:bg-neutral-900/95 backdrop-blur shadow-xl px-4 py-3">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <UIcon name="i-lucide-gift" class="text-primary shrink-0" />
            <div class="text-sm text-neutral-800 dark:text-neutral-100 truncate">
              New update available
              <span v-if="updaterStatus.version" class="font-mono text-neutral-500 dark:text-neutral-400">
                v{{ updaterStatus.version }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              :disabled="updaterStatus.downloading"
              @click="dismissUpdatePrompt"
            >
              Later
            </UButton>
            <UButton
              size="xs"
              color="primary"
              :loading="updaterStatus.downloading"
              @click="downloadAndInstall"
            >
              Install Now
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </UApp>
</template>

<script setup lang="ts">
const {
  status: updaterStatus,
  isTauri,
  menuTriggered,
  promptDismissed,
  postUpdateInfo,
  checkForUpdateOnStartup,
  downloadAndInstall,
  dismissUpdatePrompt,
  dismissPostUpdate,
} = useUpdater()
const aboutOpen = ref(false)
const whatsNewOpen = ref(false)
const showUpdatePrompt = computed(() =>
  updaterStatus.available && !promptDismissed.value,
)

// Open the About modal when the native menu "Check for Updates…" is clicked
watch(menuTriggered, (triggered) => {
  if (triggered) {
    aboutOpen.value = true
    menuTriggered.value = false
  }
})

// Show "What's New" when post-update info is available
watch(postUpdateInfo, (info) => {
  if (info) whatsNewOpen.value = true
}, { immediate: true })

watch(whatsNewOpen, (open) => {
  if (!open) dismissPostUpdate()
})

onMounted(() => {
  checkForUpdateOnStartup()
})
</script>
