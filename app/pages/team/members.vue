<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader />
    <main class="flex-1 px-4 py-10">
      <div class="w-full max-w-2xl mx-auto">
        <NuxtLink to="/" class="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 flex items-center gap-1 mb-4">
          <UIcon name="i-lucide-arrow-left" class="text-sm" />
          Back to projects
        </NuxtLink>

        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold">Team Members</h1>
          <UButton
            v-if="isAdmin"
            size="sm"
            icon="i-lucide-user-plus"
            @click="inviteModalOpen = true"
          >
            Invite
          </UButton>
        </div>

        <!-- Members list -->
        <div v-if="membersLoading" class="text-center py-8 text-sm text-neutral-400">
          Loading...
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="member in members"
            :key="member.id"
            class="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800"
            :class="{ 'opacity-50': member.status === 'disabled' }"
          >
            <div class="size-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
              {{ initials(member.profile?.name ?? member.profile?.email) }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">
                {{ member.profile?.name ?? 'Unknown' }}
                <span v-if="member.status === 'disabled'" class="text-xs text-neutral-400">(disabled)</span>
              </div>
              <div class="text-xs text-neutral-500 truncate">{{ member.profile?.email }}</div>
            </div>
            <UBadge
              :color="roleBadgeColor(member.role)"
              size="xs"
              variant="subtle"
            >
              {{ member.role }}
            </UBadge>
            <UDropdownMenu v-if="isAdmin && member.user_id !== currentUser?.id" :items="memberActions(member)">
              <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-more-vertical" />
            </UDropdownMenu>
          </div>
        </div>

        <!-- Pending invitations -->
        <div v-if="invitations.length > 0" class="mt-8">
          <h2 class="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">
            Pending Invitations
          </h2>
          <div class="space-y-2">
            <div
              v-for="inv in invitations"
              :key="inv.id"
              class="flex items-center gap-3 p-3 rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800"
            >
              <UIcon name="i-lucide-mail" class="text-lg text-neutral-400 shrink-0" />
              <div class="flex-1 min-w-0">
                <div class="text-sm truncate">{{ inv.email }}</div>
                <div class="text-xs text-neutral-400">Expires {{ formatDate(inv.expires_at) }}</div>
              </div>
              <UBadge :color="roleBadgeColor(inv.role)" size="xs" variant="subtle">
                {{ inv.role }}
              </UBadge>
              <UButton
                v-if="isAdmin"
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-x"
                title="Cancel invitation"
                @click="handleCancelInvitation(inv.id)"
              />
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Invite Modal -->
    <UModal v-model:open="inviteModalOpen">
      <template #content>
        <div class="p-5 space-y-4">
          <h3 class="text-sm font-semibold">Invite a Team Member</h3>
          <form @submit.prevent="handleInvite" class="space-y-3">
            <UFormField label="Email">
              <UInput
                v-model="inviteEmail"
                type="email"
                placeholder="colleague@company.com"
                required
                autofocus
              />
            </UFormField>
            <UFormField label="Role">
              <USelect
                v-model="inviteRole"
                :items="roleOptions"
                value-key="value"
                label-key="label"
              />
            </UFormField>
            <p v-if="inviteError" class="text-xs text-red-500">{{ inviteError }}</p>
            <div class="flex justify-end gap-2 pt-2">
              <UButton size="sm" variant="outline" color="neutral" @click="inviteModalOpen = false">
                Cancel
              </UButton>
              <UButton type="submit" size="sm" :loading="inviting" icon="i-lucide-send">
                Send Invitation
              </UButton>
            </div>
          </form>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { TeamMember } from '~/composables/useTeamMembers'

const router = useRouter()
const { isAuthenticated, user: currentUser } = useAuth()
const { isAdmin } = useTeam()
const { members, invitations, membersLoading, invite, changeRole, toggleStatus, removeMember, cancelInvitation } = useTeamMembers()

watch(isAuthenticated, (authed) => {
  if (!authed) router.replace('/auth/login')
}, { immediate: true })

const inviteModalOpen = ref(false)
const inviteEmail = ref('')
const inviteRole = ref<'admin' | 'editor' | 'viewer'>('viewer')
const inviting = ref(false)
const inviteError = ref('')

const roleOptions = [
  { label: 'Viewer', value: 'viewer' },
  { label: 'Editor', value: 'editor' },
  { label: 'Admin', value: 'admin' },
]

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function roleBadgeColor(role: string) {
  switch (role) {
    case 'admin': return 'error' as const
    case 'editor': return 'primary' as const
    default: return 'neutral' as const
  }
}

function memberActions(member: TeamMember) {
  return [
    [
      { label: 'Set as Viewer', icon: 'i-lucide-eye', disabled: member.role === 'viewer', click: () => changeRole(member.id, 'viewer') },
      { label: 'Set as Editor', icon: 'i-lucide-pencil', disabled: member.role === 'editor', click: () => changeRole(member.id, 'editor') },
      { label: 'Set as Admin', icon: 'i-lucide-shield', disabled: member.role === 'admin', click: () => changeRole(member.id, 'admin') },
    ],
    [
      { label: member.status === 'active' ? 'Disable' : 'Enable', icon: 'i-lucide-ban', click: () => toggleStatus(member.id) },
      { label: 'Remove', icon: 'i-lucide-user-minus', color: 'error' as const, click: () => removeMember(member.id) },
    ],
  ]
}

async function handleInvite() {
  inviteError.value = ''
  inviting.value = true
  try {
    const { error } = await invite(inviteEmail.value, inviteRole.value)
    if (error) {
      inviteError.value = (error as any).message ?? 'Failed to send invitation'
    } else {
      inviteModalOpen.value = false
      inviteEmail.value = ''
      inviteRole.value = 'viewer'
    }
  } finally {
    inviting.value = false
  }
}

async function handleCancelInvitation(id: string) {
  await cancelInvitation(id)
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
</script>
