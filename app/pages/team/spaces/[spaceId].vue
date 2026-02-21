<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 px-4 py-10">
      <div class="w-full max-w-4xl mx-auto">
        <NuxtLink to="/team/spaces" class="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 flex items-center gap-1 mb-4">
          <UIcon name="i-lucide-arrow-left" class="text-sm" />
          Back to spaces
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

          <section class="space-y-5">
            <div v-if="!spaceReady" class="text-sm text-neutral-500 py-8 text-center">
              Loading space...
            </div>

            <template v-else-if="selectedSpace">
              <div class="flex items-center justify-between gap-3">
                <h2 class="text-lg font-semibold truncate">{{ selectedSpace.name }}</h2>
                <UButton
                  v-if="isAdmin"
                  size="xs"
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  @click="handleDeleteSpace"
                >
                  Delete Space
                </UButton>
              </div>

              <div v-if="isAdmin" class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
                <h3 class="text-sm font-semibold">Space Settings</h3>
                <UFormField label="Space Name">
                  <UInput
                    v-model="spaceName"
                    maxlength="15"
                    :disabled="savingName"
                    placeholder="Space name"
                  />
                </UFormField>
                <div class="flex justify-end">
                  <UButton
                    size="sm"
                    :loading="savingName"
                    :disabled="!canSaveName"
                    @click="handleSaveSpaceName"
                  >
                    Save Name
                  </UButton>
                </div>
              </div>

              <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
                <h3 class="text-sm font-semibold">Members</h3>
                <div class="space-y-2">
                  <div
                    v-for="member in members"
                    :key="member.id"
                    class="flex items-center justify-between rounded border border-neutral-200 dark:border-neutral-800 px-2 py-1.5"
                  >
                    <div class="text-xs truncate">
                      {{ member.profile?.name ?? member.profile?.email }}
                      <span class="text-neutral-400">({{ member.role }})</span>
                    </div>
                    <UButton
                      size="xs"
                      :variant="isInSelectedSpace(member.user_id) ? 'outline' : 'solid'"
                      color="neutral"
                      :disabled="!isAdmin"
                      @click="toggleMemberInSpace(member.user_id)"
                    >
                      {{ isInSelectedSpace(member.user_id) ? 'Remove' : 'Add' }}
                    </UButton>
                  </div>
                </div>
              </div>

              <div v-if="isAdmin" class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
                <h3 class="text-sm font-semibold">Invite Guest</h3>
                <div class="flex gap-2">
                  <UInput v-model="guestInviteEmail" type="email" class="flex-1" placeholder="customer@example.com" />
                  <UButton size="sm" :disabled="!guestInviteEmail.trim()" @click="sendGuestInvite">Invite</UButton>
                </div>
                <div v-if="pendingInvitations.length > 0" class="space-y-1 pt-2">
                  <div class="text-xs font-medium text-neutral-500">Pending invitations</div>
                  <div
                    v-for="inv in pendingInvitations"
                    :key="inv.id"
                    class="text-xs text-neutral-500 rounded border border-neutral-200 dark:border-neutral-800 px-2 py-1"
                  >
                    {{ inv.email }} · expires {{ formatDate(inv.expires_at) }}
                  </div>
                </div>
              </div>
            </template>
          </section>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { isAuthenticated } = useAuth()
const { reportError } = useErrorReporting()
const { currentTeamRole, isAdmin } = useTeam()
const { members, fetchMembers } = useTeamMembers()
const {
  spaces,
  membersBySpaceId,
  invitationsBySpaceId,
  fetchSpaces,
  updateSpace,
  deleteSpace,
  fetchSpaceMembers,
  addSpaceMember,
  removeSpaceMember,
  fetchSpaceInvitations,
  inviteGuestToSpace,
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

const selectedSpaceId = computed(() => String(route.params.spaceId || ''))
const selectedSpace = computed(() => spaces.value.find(space => space.id === selectedSpaceId.value) ?? null)
const spaceReady = ref(false)
const spaceName = ref('')
const savingName = ref(false)
const guestInviteEmail = ref('')

const pendingInvitations = computed(() => {
  if (!selectedSpaceId.value) return []
  return invitationsBySpaceId.value[selectedSpaceId.value] ?? []
})

const canSaveName = computed(() => {
  if (!selectedSpace.value || !isAdmin.value) return false
  const nextName = spaceName.value.trim()
  return nextName.length > 0 && nextName.length <= 15 && nextName !== selectedSpace.value.name
})

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

function isInSelectedSpace(userId: string) {
  if (!selectedSpaceId.value) return false
  return (membersBySpaceId.value[selectedSpaceId.value] ?? []).some(member => member.user_id === userId && member.status === 'active')
}

async function toggleMemberInSpace(userId: string) {
  if (!selectedSpaceId.value || !isAdmin.value) return
  if (isInSelectedSpace(userId)) {
    await removeSpaceMember(selectedSpaceId.value, userId)
  } else {
    await addSpaceMember(selectedSpaceId.value, userId)
  }
}

async function handleSaveSpaceName() {
  if (!selectedSpace.value || !canSaveName.value) return
  savingName.value = true
  try {
    const { error } = await updateSpace(selectedSpace.value.id, spaceName.value)
    if (error) {
      reportError(error, { title: 'Failed to update space', context: 'team.space.update' })
      return
    }
    spaceName.value = spaceName.value.trim()
    useToast().add({ title: 'Space updated', color: 'success' })
  } finally {
    savingName.value = false
  }
}

async function sendGuestInvite() {
  if (!selectedSpace.value || !isAdmin.value) return
  const email = guestInviteEmail.value.trim()
  if (!email) return

  const { error } = await inviteGuestToSpace(selectedSpace.value.id, email)
  if (error) {
    reportError(error, { title: 'Failed to send invite', context: 'team.space.invite_guest' })
    return
  }
  guestInviteEmail.value = ''
  await fetchSpaceInvitations(selectedSpace.value.id)
  useToast().add({ title: 'Guest invitation sent', color: 'success' })
}

async function handleDeleteSpace() {
  if (!selectedSpace.value || !isAdmin.value) return
  const { error } = await deleteSpace(selectedSpace.value.id)
  if (error) {
    reportError(error, { title: 'Failed to delete space', context: 'team.space.delete' })
    return
  }
  useToast().add({ title: 'Space deleted', color: 'success' })
  await router.replace('/team/spaces')
}

async function loadSpacePage() {
  spaceReady.value = false
  await Promise.all([fetchSpaces(), fetchMembers()])

  if (!selectedSpace.value) {
    useToast().add({ title: 'Space not found', color: 'warning' })
    await router.replace('/team/spaces')
    return
  }

  spaceName.value = selectedSpace.value.name
  await fetchSpaceMembers(selectedSpace.value.id)
  if (isAdmin.value) {
    await fetchSpaceInvitations(selectedSpace.value.id)
  }
  spaceReady.value = true
}

watch(selectedSpaceId, () => {
  loadSpacePage()
})

onMounted(async () => {
  await loadSpacePage()
})
</script>
