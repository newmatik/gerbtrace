<template>
  <div class="min-h-screen flex flex-col">
    <AppHeader compact />
    <main class="flex-1 px-4 py-6">
      <div class="mx-auto w-full max-w-5xl space-y-4">
        <div class="flex items-center justify-between gap-3">
          <div class="space-y-1">
            <NuxtLink :to="projectBackLink" class="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
              Back to project
            </NuxtLink>
            <h1 class="text-xl font-semibold">Conversation</h1>
          </div>
          <UButton size="xs" icon="i-lucide-refresh-cw" variant="ghost" color="neutral" @click="fetchMessages">
            Refresh
          </UButton>
        </div>

        <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-4">
          <div class="space-y-3">
            <div v-for="message in topLevelMessages" :key="message.id" class="rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
              <div class="flex items-center justify-between gap-3 text-xs text-neutral-500">
                <span class="font-medium text-neutral-700 dark:text-neutral-200">
                  {{ authorLabel(message) }}
                </span>
                <span>{{ formatDate(message.created_at) }}</span>
              </div>
              <p class="mt-2 whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-100">
                {{ message.body }}
              </p>

              <div class="mt-3 border-t border-neutral-200 dark:border-neutral-800 pt-3 space-y-2">
                <div v-for="reply in repliesFor(message.id)" :key="reply.id" class="rounded-md bg-neutral-50 dark:bg-neutral-800/50 p-2">
                  <div class="flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                    <span class="font-medium text-neutral-700 dark:text-neutral-200">{{ authorLabel(reply) }}</span>
                    <span>{{ formatDate(reply.created_at) }}</span>
                  </div>
                  <p class="mt-1 whitespace-pre-wrap text-sm">{{ reply.body }}</p>
                </div>
                <div class="flex gap-2">
                  <UInput
                    v-model="replyDrafts[message.id]"
                    size="xs"
                    placeholder="Reply to thread..."
                    class="flex-1"
                  />
                  <UButton
                    size="xs"
                    :disabled="!replyDrafts[message.id]?.trim()"
                    @click="submitReply(message.id)"
                  >
                    Reply
                  </UButton>
                </div>
              </div>
            </div>

            <div v-if="!loading && topLevelMessages.length === 0" class="text-sm text-neutral-500 py-8 text-center">
              No conversation yet.
            </div>
          </div>

          <div class="border-t border-neutral-200 dark:border-neutral-800 pt-4 space-y-2">
            <UTextarea
              v-model="newMessage"
              :rows="5"
              placeholder="Write a message. Use @john.doe or @jdoe to mention teammates."
            />
            <div class="flex items-center justify-between gap-3">
              <p class="text-xs text-neutral-500 truncate">
                Mention handles:
                <span class="text-neutral-700 dark:text-neutral-300">{{ mentionHelpText }}</span>
              </p>
              <UButton
                :disabled="!newMessage.trim()"
                :loading="posting"
                size="sm"
                icon="i-lucide-send"
                @click="submitMessage"
              >
                Post message
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const route = useRoute()
const rawId = String(route.params.id || '')
const isTeamProject = rawId.startsWith('team-')
const teamProjectId = isTeamProject ? rawId.replace('team-', '') : null
const projectBackLink = computed(() => `/viewer/${rawId}`)

const { currentTeamId } = useTeam()
const { members, fetchMembers } = useTeamMembers()
const { topLevelMessages, repliesFor, postMessage, fetchMessages, loading } = useProjectConversation(
  ref(teamProjectId),
  currentTeamId,
)

const newMessage = ref('')
const posting = ref(false)
const replyDrafts = ref<Record<string, string>>({})

const mentionHelpText = computed(() =>
  members.value
    .slice(0, 6)
    .map(member => {
      const profile = member.profile
      if (!profile) return null
      const fromName = (profile.name ?? '').trim().toLowerCase().replace(/\s+/g, '.')
      const fromEmail = (profile.email ?? '').trim().toLowerCase().split('@')[0]
      return fromName || fromEmail
    })
    .filter((v): v is string => !!v)
    .map(v => `@${v}`)
    .join(', '),
)

function authorLabel(message: {
  author_profile?: { name: string | null; email: string } | null
  message_type: 'comment' | 'system'
}) {
  if (message.message_type === 'system') return 'Workflow'
  return message.author_profile?.name ?? message.author_profile?.email ?? 'Unknown user'
}

async function submitMessage() {
  if (!newMessage.value.trim()) return
  posting.value = true
  try {
    const { error } = await postMessage(newMessage.value)
    if (error) {
      useToast().add({ title: 'Failed to post message', description: error.message, color: 'error' })
      return
    }
    newMessage.value = ''
  } finally {
    posting.value = false
  }
}

async function submitReply(parentId: string) {
  const body = replyDrafts.value[parentId]?.trim()
  if (!body) return
  const { error } = await postMessage(body, parentId)
  if (error) {
    useToast().add({ title: 'Failed to post reply', description: error.message, color: 'error' })
    return
  }
  replyDrafts.value[parentId] = ''
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

onMounted(async () => {
  if (!isTeamProject || !teamProjectId) {
    await navigateTo(`/viewer/${rawId}`)
    return
  }
  await fetchMembers()
})
</script>
