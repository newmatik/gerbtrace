<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div
        v-if="visible"
        class="fixed bottom-0 inset-x-0 z-[60] p-4 pointer-events-none"
      >
        <div class="max-w-xl mx-auto pointer-events-auto rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white/95 dark:bg-neutral-900/95 backdrop-blur shadow-xl px-5 py-4">
          <div class="flex items-start gap-4">
            <p class="text-sm text-neutral-600 dark:text-neutral-400 flex-1">
              This website uses essential cookies for authentication and functionality.
              See our <NuxtLink to="/privacy" class="text-primary hover:underline">Privacy Policy</NuxtLink> for details.
            </p>
            <UButton size="sm" @click="accept">
              Accept
            </UButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const STORAGE_KEY = 'gerbtrace-cookie-consent'

const visible = ref(false)

onMounted(() => {
  if (!localStorage.getItem(STORAGE_KEY)) {
    visible.value = true
  }
})

function accept() {
  localStorage.setItem(STORAGE_KEY, '1')
  visible.value = false
}
</script>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
