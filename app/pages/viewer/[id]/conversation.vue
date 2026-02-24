<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader compact />
    <main class="flex-1 px-4 py-6">
      <div class="mx-auto w-full max-w-5xl space-y-4 h-[calc(100vh-7rem)]">
        <div class="flex items-center justify-between gap-3">
          <div class="space-y-1">
            <NuxtLink :to="projectBackLink" class="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
              Back to project
            </NuxtLink>
            <h1 class="text-xl font-semibold">Conversation</h1>
          </div>
        </div>
        <ConversationPanel :project-id="teamProjectId" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
definePageMeta({})

const route = useRoute()
const rawId = String(route.params.id || '')
const isTeamProject = rawId.startsWith('team-')
const teamProjectId = isTeamProject ? rawId.replace('team-', '') : null
const projectBackLink = computed(() => `/viewer/${rawId}`)

onMounted(async () => {
  if (!isTeamProject || !teamProjectId) {
    await navigateTo(`/viewer/${rawId}`)
    return
  }
})
</script>
