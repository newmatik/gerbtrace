<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 px-4 py-10">
      <div class="w-full max-w-4xl mx-auto">
        <NuxtLink to="/" class="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 flex items-center gap-1 mb-4">
          <UIcon name="i-lucide-arrow-left" class="text-sm" />
          Back to projects
        </NuxtLink>

        <h1 class="text-2xl font-bold mb-6">Team</h1>

        <div class="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside>
            <div class="text-xs font-semibold tracking-wide uppercase text-neutral-400 mb-3">Team</div>
            <nav class="space-y-1">
              <NuxtLink
                v-for="item in navItems"
                :key="item.label"
                :to="item.to"
                class="flex items-center gap-2 rounded-md px-3 py-2 text-sm border transition-colors"
                :class="item.to === '/team/spaces'
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-transparent text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'"
              >
                <UIcon :name="item.icon" class="text-sm" />
                {{ item.label }}
              </NuxtLink>
            </nav>
          </aside>

          <section class="space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold">Spaces</h2>
              <UButton v-if="isAdmin" size="sm" icon="i-lucide-plus" @click="createModalOpen = true">
                New Space
              </UButton>
            </div>

            <div v-if="spacesLoading" class="text-sm text-neutral-500 py-8 text-center">Loading spaces...</div>
            <div v-else-if="spaces.length === 0" class="rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center text-sm text-neutral-500">
              No spaces available.
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="space in spaces"
                :key="space.id"
                class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 cursor-pointer hover:border-primary/40 transition-colors"
                @click="openSpace(space.id)"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <div class="font-medium truncate">{{ space.name }}</div>
                    <div class="text-xs text-neutral-500">Created {{ formatDate(space.created_at) }}</div>
                  </div>
                  <div class="flex items-center gap-2">
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="outline"
                      @click.stop="openSpace(space.id)"
                    >
                      Open
                    </UButton>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>

    <UModal v-model:open="createModalOpen">
      <template #content>
        <div class="p-4 space-y-3">
          <h3 class="text-sm font-semibold">Create Space</h3>
          <UFormField label="Name">
            <UInput v-model="newSpaceName" placeholder="Customer A" maxlength="15" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton size="sm" color="neutral" variant="outline" @click="createModalOpen = false">Cancel</UButton>
            <UButton size="sm" :disabled="!newSpaceName.trim() || newSpaceName.trim().length > 15" @click="handleCreateSpace">Create</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const { isAuthenticated } = useAuth()
const { currentTeamRole, isAdmin } = useTeam()
const { reportError } = useErrorReporting()
const {
  spaces,
  spacesLoading,
  fetchSpaces,
  createSpace,
} = useSpaces()

watch(isAuthenticated, (authed) => {
  if (!authed) router.replace('/auth/login')
}, { immediate: true })

watch(currentTeamRole, (role) => {
  if (role === 'guest') {
    router.replace('/')
  }
}, { immediate: true })

const navItems = [
  { label: 'Spaces', icon: 'i-lucide-folders', to: '/team/spaces' },
  { label: 'General', icon: 'i-lucide-settings-2', to: '/team/settings' },
  { label: 'Defaults', icon: 'i-lucide-sliders-horizontal', to: '/team/settings?section=defaults' },
  { label: 'Integrations', icon: 'i-lucide-plug-zap', to: '/team/settings?section=integrations' },
  { label: 'Members', icon: 'i-lucide-users', to: '/team/members' },
]

const createModalOpen = ref(false)
const newSpaceName = ref('')

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

function openSpace(spaceId: string) {
  router.push(`/team/spaces/${spaceId}`)
}

async function handleCreateSpace() {
  if (!newSpaceName.value.trim()) return
  if (newSpaceName.value.trim().length > 15) {
    useToast().add({ title: 'Space name must be 15 characters or fewer', color: 'warning' })
    return
  }
  const { error } = await createSpace(newSpaceName.value)
  if (error) {
    reportError(error, { title: 'Failed to create space', context: 'team.spaces.create' })
    return
  }
  newSpaceName.value = ''
  createModalOpen.value = false
}

onMounted(async () => {
  await fetchSpaces({ background: true })
})
</script>
