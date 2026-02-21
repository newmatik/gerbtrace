import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export interface ProjectConversationMessage {
  id: string
  project_id: string
  team_id: string
  author_id: string | null
  parent_message_id: string | null
  message_type: 'comment' | 'system'
  body: string
  metadata: Record<string, any> | null
  created_at: string
  updated_at: string
  author_profile?: {
    id: string
    email: string
    name: string | null
    avatar_url: string | null
  } | null
}

export function useProjectConversation(projectId: Ref<string | null>, teamId: Ref<string | null>) {
  const supabase = useSupabase()
  const { user } = useAuth()
  const { members, fetchMembers } = useTeamMembers()

  const messages = ref<ProjectConversationMessage[]>([])
  const loading = ref(false)
  let channel: RealtimeChannel | null = null

  const topLevelMessages = computed(() =>
    messages.value.filter(m => !m.parent_message_id),
  )

  function repliesFor(parentId: string) {
    return messages.value.filter(m => m.parent_message_id === parentId)
  }

  function extractMentionUserIds(body: string): string[] {
    const mentionTokens = Array.from(body.matchAll(/@([a-zA-Z0-9._-]+)/g)).map(m => m[1].toLowerCase())
    if (mentionTokens.length === 0) return []

    const byHandle = new Map<string, string>()
    for (const member of members.value) {
      const profile = member.profile
      if (!profile) continue
      const nameToken = (profile.name ?? '').trim().toLowerCase().replace(/\s+/g, '.')
      const emailToken = (profile.email ?? '').trim().toLowerCase().split('@')[0]
      if (nameToken) byHandle.set(nameToken, profile.id)
      if (emailToken) byHandle.set(emailToken, profile.id)
    }

    return Array.from(new Set(mentionTokens.map(token => byHandle.get(token)).filter((id): id is string => !!id)))
  }

  async function createMentionNotifications(messageId: string, mentionedUserIds: string[]) {
    if (!teamId.value || !projectId.value) return
    for (const mentionedUserId of mentionedUserIds) {
      await supabase
        .from('project_conversation_mentions')
        .upsert({
          message_id: messageId,
          mentioned_user_id: mentionedUserId,
        }, { onConflict: 'message_id,mentioned_user_id' })

      await supabase.rpc('create_notification', {
        p_recipient_user_id: mentionedUserId,
        p_type: 'mention',
        p_team_id: teamId.value,
        p_project_id: projectId.value,
        p_message_id: messageId,
        p_payload: {},
      })
    }
  }

  async function postMessage(body: string, parentMessageId: string | null = null) {
    if (!projectId.value || !teamId.value || !user.value) {
      return { data: null, error: new Error('Missing project context') }
    }
    const trimmed = body.trim()
    if (!trimmed) return { data: null, error: new Error('Message cannot be empty') }

    const { data, error } = await supabase
      .from('project_conversation_messages')
      .insert({
        project_id: projectId.value,
        team_id: teamId.value,
        author_id: user.value.id,
        parent_message_id: parentMessageId,
        message_type: 'comment',
        body: trimmed,
      })
      .select('*')
      .single()

    if (error || !data) return { data: null, error }

    const message = data as ProjectConversationMessage
    const mentionUserIds = extractMentionUserIds(trimmed)
    if (mentionUserIds.length > 0) {
      await createMentionNotifications(message.id, mentionUserIds)
    }
    return { data: message, error: null }
  }

  async function fetchMessages() {
    if (!projectId.value) return
    loading.value = true
    try {
      if (members.value.length === 0) {
        await fetchMembers()
      }

      const { data, error } = await supabase
        .from('project_conversation_messages')
        .select('*')
        .eq('project_id', projectId.value)
        .order('created_at', { ascending: true })

      if (error) {
        console.warn('[useProjectConversation] fetch failed:', error.message)
        return
      }

      const profiles = new Map(
        members.value
          .map(m => m.profile)
          .filter(Boolean)
          .map(p => [p!.id, p!]),
      )

      messages.value = (data ?? []).map((item) => {
        const row = item as ProjectConversationMessage
        return {
          ...row,
          author_profile: row.author_id ? (profiles.get(row.author_id) ?? null) : null,
        }
      })
    } finally {
      loading.value = false
    }
  }

  function handleRowChange(payload: RealtimePostgresChangesPayload<ProjectConversationMessage>) {
    if (payload.eventType === 'INSERT' && payload.new) {
      const next = payload.new as ProjectConversationMessage
      if (!messages.value.some(m => m.id === next.id)) {
        messages.value.push(next)
      }
    } else if (payload.eventType === 'UPDATE' && payload.new) {
      const next = payload.new as ProjectConversationMessage
      const idx = messages.value.findIndex(m => m.id === next.id)
      if (idx >= 0) messages.value[idx] = { ...messages.value[idx], ...next }
    } else if (payload.eventType === 'DELETE' && payload.old) {
      const old = payload.old as ProjectConversationMessage
      messages.value = messages.value.filter(m => m.id !== old.id)
    }
  }

  async function subscribe() {
    if (!projectId.value) return
    channel = supabase.channel(`conversation:${projectId.value}`)
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'project_conversation_messages',
      filter: `project_id=eq.${projectId.value}`,
    }, handleRowChange as any)
    await channel.subscribe()
  }

  function unsubscribe() {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  }

  watch(projectId, async (next, prev) => {
    if (prev) unsubscribe()
    if (next) {
      await fetchMessages()
      await subscribe()
    } else {
      messages.value = []
    }
  }, { immediate: true })

  onBeforeUnmount(() => unsubscribe())

  return {
    loading: readonly(loading),
    messages: readonly(messages),
    topLevelMessages,
    repliesFor,
    fetchMessages,
    postMessage,
  }
}
