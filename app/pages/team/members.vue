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
            <div class="text-xs font-semibold tracking-wide uppercase text-neutral-400 mb-3">
              Team
            </div>
            <nav class="space-y-1">
              <NuxtLink
                v-for="item in navItems"
                :key="item.label"
                :to="item.to"
                class="flex items-center gap-2 rounded-md px-3 py-2 text-sm border transition-colors"
                :class="isActive(item)
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-transparent text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'"
              >
                <UIcon :name="item.icon" class="text-sm" />
                {{ item.label }}
              </NuxtLink>
            </nav>
          </aside>

          <section>
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold">Members</h2>
              <UButton
                v-if="isAdmin"
                size="sm"
                icon="i-lucide-user-plus"
                @click="inviteModalOpen = true"
              >
                Invite
              </UButton>
            </div>
            <p v-if="passwordActionMessage" class="mb-4 text-xs" :class="passwordActionError ? 'text-red-500' : 'text-green-600 dark:text-green-400'">
              {{ passwordActionMessage }}
            </p>

            <!-- Search -->
            <div class="mb-4">
              <UInput
                v-model="search"
                icon="i-lucide-search"
                placeholder="Search members..."
                size="sm"
                class="w-full"
              />
            </div>

            <!-- Members list -->
            <div v-if="membersLoading" class="text-center py-8 text-sm text-neutral-400">
              Loading...
            </div>

            <div v-else-if="filteredMembers.length === 0" class="text-center py-8 text-sm text-neutral-400">
              {{ search ? 'No members match your search.' : 'No team members yet.' }}
            </div>

            <div v-else class="space-y-2">
              <div
                v-for="member in filteredMembers"
                :key="member.id"
                class="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800"
                :class="{ 'opacity-50': member.status === 'disabled' }"
              >
            <img
              v-if="member.profile?.avatar_url"
              :src="member.profile.avatar_url"
              alt="Avatar"
              class="size-8 rounded-full object-cover shrink-0"
            >
            <div v-else class="size-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
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
            <div v-if="filteredInvitations.length > 0" class="mt-8">
              <h3 class="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-3">
                Pending Invitations
              </h3>
              <div class="space-y-2">
                <div
                  v-for="inv in filteredInvitations"
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
          </section>
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

    <!-- Edit Name Modal -->
    <UModal v-model:open="editNameModalOpen">
      <template #content>
        <div class="p-5 space-y-4">
          <h3 class="text-sm font-semibold">Edit Member Name</h3>
          <form @submit.prevent="handleUpdateName" class="space-y-3">
            <UFormField label="Name">
              <UInput
                v-model="editNameValue"
                placeholder="Full name"
                required
                autofocus
              />
            </UFormField>
            <p v-if="editNameError" class="text-xs text-red-500">{{ editNameError }}</p>
            <div class="flex justify-end gap-2 pt-2">
              <UButton size="sm" variant="outline" color="neutral" @click="editNameModalOpen = false">
                Cancel
              </UButton>
              <UButton type="submit" size="sm" :loading="editNameSaving">
                Save
              </UButton>
            </div>
          </form>
        </div>
      </template>
    </UModal>

    <!-- Confirm Remove Modal -->
    <UModal v-model:open="confirmRemoveOpen">
      <template #content>
        <div class="p-5 space-y-4">
          <h3 class="text-sm font-semibold">Remove Member</h3>
          <p class="text-sm text-neutral-500">
            Are you sure you want to remove <strong>{{ removingMemberName }}</strong> from the team? This action cannot be undone.
          </p>
          <p v-if="removeError" class="text-xs text-red-500">{{ removeError }}</p>
          <div class="flex justify-end gap-2 pt-2">
            <UButton size="sm" variant="outline" color="neutral" @click="confirmRemoveOpen = false">
              Cancel
            </UButton>
            <UButton size="sm" color="error" :loading="removing" @click="handleConfirmRemove">
              Remove
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Reset Password Modal -->
    <UModal v-model:open="resetPasswordModalOpen">
      <template #content>
        <div class="p-5 space-y-4">
          <h3 class="text-sm font-semibold">Reset Member Password</h3>
          <p class="text-sm text-neutral-500">
            Set a new password for <strong>{{ resettingMemberName }}</strong>.
          </p>
          <form @submit.prevent="handleConfirmPasswordReset" class="space-y-3">
            <UFormField label="New password">
              <UInput
                v-model="resetPasswordValue"
                type="password"
                placeholder="At least 8 characters"
                required
                autofocus
              />
            </UFormField>
            <UFormField label="Confirm password">
              <UInput
                v-model="resetPasswordConfirmValue"
                type="password"
                placeholder="Repeat password"
                required
              />
            </UFormField>
            <p v-if="resetPasswordError" class="text-xs text-red-500">{{ resetPasswordError }}</p>
            <div class="flex justify-end gap-2 pt-2">
              <UButton size="sm" variant="outline" color="neutral" @click="resetPasswordModalOpen = false">
                Cancel
              </UButton>
              <UButton
                type="submit"
                size="sm"
                :loading="resetPasswordSaving"
                :disabled="!resetPasswordValue || resetPasswordValue.length < 8 || resetPasswordValue !== resetPasswordConfirmValue"
              >
                Reset Password
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
const route = useRoute()
const { isAuthenticated, user: currentUser } = useAuth()
const { isAdmin, currentTeamRole } = useTeam()
const {
  members,
  invitations,
  membersLoading,
  invite,
  changeRole,
  toggleStatus,
  removeMember,
  cancelInvitation,
  updateMemberName,
  resetMemberPassword,
} = useTeamMembers()

watch(isAuthenticated, (authed) => {
  if (!authed) router.replace('/auth/login')
}, { immediate: true })

watch(currentTeamRole, (role) => {
  if (role === 'guest') router.replace('/')
}, { immediate: true })

const navItems = [
  { label: 'Spaces', icon: 'i-lucide-folders', to: '/team/spaces' },
  { label: 'General', icon: 'i-lucide-settings-2', to: '/team/settings' },
  { label: 'Defaults', icon: 'i-lucide-sliders-horizontal', to: '/team/settings?section=defaults' },
  { label: 'Integrations', icon: 'i-lucide-plug-zap', to: '/team/settings?section=integrations' },
  { label: 'Members', icon: 'i-lucide-users', to: '/team/members' },
]

function isActive(item: { to: string }) {
  if (item.to === '/team/spaces') return route.path === '/team/spaces'
  if (item.to === '/team/members') return route.path === '/team/members'
  if (item.to.includes('section=defaults')) return route.path === '/team/settings' && route.query.section === 'defaults'
  if (item.to.includes('section=integrations')) return route.path === '/team/settings' && route.query.section === 'integrations'
  return route.path === '/team/settings' && !route.query.section
}

// ── Search ──────────────────────────────────────────────────────────
const search = ref('')

const filteredMembers = computed(() => {
  if (!search.value.trim()) return members.value
  const q = search.value.toLowerCase()
  return members.value.filter(m =>
    (m.profile?.name ?? '').toLowerCase().includes(q) ||
    (m.profile?.email ?? '').toLowerCase().includes(q),
  )
})

const filteredInvitations = computed(() => {
  if (!search.value.trim()) return invitations.value
  const q = search.value.toLowerCase()
  return invitations.value.filter(inv =>
    inv.email.toLowerCase().includes(q),
  )
})

// ── Invite ──────────────────────────────────────────────────────────
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

// ── Edit Name ───────────────────────────────────────────────────────
const editNameModalOpen = ref(false)
const editNameValue = ref('')
const editNameError = ref('')
const editNameSaving = ref(false)
const editNameMember = ref<TeamMember | null>(null)

function openEditName(member: TeamMember) {
  editNameMember.value = member
  editNameValue.value = member.profile?.name ?? ''
  editNameError.value = ''
  editNameModalOpen.value = true
}

async function handleUpdateName() {
  if (!editNameMember.value || !editNameValue.value.trim()) return
  editNameError.value = ''
  editNameSaving.value = true
  try {
    const { error } = await updateMemberName(editNameMember.value.user_id, editNameValue.value)
    if (error) {
      editNameError.value = (error as any).message ?? 'Failed to update name'
    } else {
      editNameModalOpen.value = false
    }
  } finally {
    editNameSaving.value = false
  }
}

// ── Confirm Remove ──────────────────────────────────────────────────
const confirmRemoveOpen = ref(false)
const removingMemberId = ref<string | null>(null)
const removingMemberName = ref('')
const removing = ref(false)
const removeError = ref('')

// ── Password action feedback ────────────────────────────────────────
const passwordActionMessage = ref('')
const passwordActionError = ref(false)
let passwordActionTimer: ReturnType<typeof setTimeout> | null = null

// ── Reset Password Modal ────────────────────────────────────────────
const resetPasswordModalOpen = ref(false)
const resetPasswordSaving = ref(false)
const resetPasswordError = ref('')
const resetPasswordValue = ref('')
const resetPasswordConfirmValue = ref('')
const resettingMember = ref<TeamMember | null>(null)
const resettingMemberName = computed(() =>
  resettingMember.value?.profile?.name ?? resettingMember.value?.profile?.email ?? 'this member',
)

function openConfirmRemove(member: TeamMember) {
  removingMemberId.value = member.id
  removingMemberName.value = member.profile?.name ?? member.profile?.email ?? 'this member'
  removeError.value = ''
  confirmRemoveOpen.value = true
}

async function handleConfirmRemove() {
  if (!removingMemberId.value) return
  removing.value = true
  removeError.value = ''
  try {
    const { error } = await removeMember(removingMemberId.value)
    if (error) {
      removeError.value = (error as any).message ?? 'Failed to remove member'
    } else {
      confirmRemoveOpen.value = false
    }
  } finally {
    removing.value = false
  }
}

// ── Helpers ─────────────────────────────────────────────────────────
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
      { label: 'Edit Name', icon: 'i-lucide-pen-line', onSelect: () => openEditName(member) },
    ],
    [
      { label: 'Set as Viewer', icon: 'i-lucide-eye', disabled: member.role === 'viewer', onSelect: () => changeRole(member.id, 'viewer') },
      { label: 'Set as Editor', icon: 'i-lucide-pencil', disabled: member.role === 'editor', onSelect: () => changeRole(member.id, 'editor') },
      { label: 'Set as Admin', icon: 'i-lucide-shield', disabled: member.role === 'admin', onSelect: () => changeRole(member.id, 'admin') },
    ],
    [
      {
        label: 'Reset Password',
        icon: 'i-lucide-key-round',
        onSelect: () => openResetPassword(member),
      },
    ],
    [
      {
        label: member.status === 'active' ? 'Disable' : 'Enable',
        icon: member.status === 'active' ? 'i-lucide-ban' : 'i-lucide-check-circle',
        onSelect: () => toggleStatus(member.id),
      },
      { label: 'Remove', icon: 'i-lucide-user-minus', color: 'error' as const, onSelect: () => openConfirmRemove(member) },
    ],
  ]
}

function openResetPassword(member: TeamMember) {
  resettingMember.value = member
  resetPasswordValue.value = ''
  resetPasswordConfirmValue.value = ''
  resetPasswordError.value = ''
  resetPasswordModalOpen.value = true
}

async function handleConfirmPasswordReset() {
  if (!resettingMember.value) return
  if (resetPasswordValue.value.length < 8) {
    resetPasswordError.value = 'Password must be at least 8 characters.'
    return
  }
  if (resetPasswordValue.value !== resetPasswordConfirmValue.value) {
    resetPasswordError.value = 'Passwords do not match.'
    return
  }

  resetPasswordError.value = ''
  resetPasswordSaving.value = true
  passwordActionMessage.value = ''
  passwordActionError.value = false
  try {
    const { error } = await resetMemberPassword(resettingMember.value.user_id, resetPasswordValue.value)
    if (error) {
      resetPasswordError.value = (error as any).message ?? 'Failed to reset password'
      return
    }

    const target = resettingMember.value.profile?.email || resettingMember.value.profile?.name || 'member'
    passwordActionMessage.value = `Password reset for ${target}.`
    if (passwordActionTimer) clearTimeout(passwordActionTimer)
    passwordActionTimer = setTimeout(() => {
      passwordActionMessage.value = ''
      passwordActionError.value = false
    }, 5000)
    resetPasswordModalOpen.value = false
  } finally {
    resetPasswordSaving.value = false
  }
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
