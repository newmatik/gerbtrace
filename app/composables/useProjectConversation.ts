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

export interface ProjectConversationAttachment {
  id: string
  message_id: string
  project_id: string
  team_id: string
  file_name: string
  storage_path: string
  file_size: number
  mime_type: string | null
  created_at: string
  publicUrl?: string
}

interface ProjectConversationCacheEntry {
  messages: ProjectConversationMessage[]
  attachments: ProjectConversationAttachment[]
  fetchedAt: number
}

const CONVERSATION_CACHE_TTL_MS = 60_000
const conversationCache = new Map<string, ProjectConversationCacheEntry>()
const inFlightByProject = new Map<string, Promise<void>>()

export function useProjectConversation(projectId: Ref<string | null>, teamId: Ref<string | null>) {
  const supabase = useSupabase()
  const { user, isAuthenticated } = useAuth()
  const { members, fetchMembers } = useTeamMembers()

  const messages = ref<ProjectConversationMessage[]>([])
  const attachments = ref<ProjectConversationAttachment[]>([])
  const loading = ref(false)
  let channel: RealtimeChannel | null = null

  const topLevelMessages = computed(() =>
    messages.value.filter(m => !m.parent_message_id),
  )

  function profileById(profileId: string | null | undefined) {
    if (!profileId) return null
    const entry = members.value.find(member => member.profile?.id === profileId)
    return entry?.profile ?? null
  }

  function hydrateMessage(row: ProjectConversationMessage): ProjectConversationMessage {
    return {
      ...row,
      author_profile: row.author_id ? profileById(row.author_id) : null,
    }
  }

  function repliesFor(parentId: string) {
    return messages.value.filter(m => m.parent_message_id === parentId)
  }

  function attachmentsFor(messageId: string) {
    return attachments.value.filter(a => a.message_id === messageId)
  }

  function cloneMessages(source: ProjectConversationMessage[]) {
    return source.map(item => ({ ...item }))
  }

  function cloneAttachments(source: ProjectConversationAttachment[]) {
    return source.map(item => ({ ...item }))
  }

  function updateCache(projectKey?: string | null) {
    if (!projectKey) return
    conversationCache.set(projectKey, {
      messages: cloneMessages(messages.value),
      attachments: cloneAttachments(attachments.value),
      fetchedAt: Date.now(),
    })
  }

  function hydrateFromCache(projectKey?: string | null) {
    if (!projectKey) return false
    const cached = conversationCache.get(projectKey)
    if (!cached) return false
    messages.value = cloneMessages(cached.messages)
    attachments.value = cloneAttachments(cached.attachments)
    return true
  }

  function isCacheFresh(projectKey?: string | null) {
    if (!projectKey) return false
    const cached = conversationCache.get(projectKey)
    if (!cached) return false
    return Date.now() - cached.fetchedAt < CONVERSATION_CACHE_TTL_MS
  }

  function safeFileName(fileName: string) {
    return fileName.replace(/[^\w.\-]+/g, '_')
  }

  async function buildSignedUrl(storagePath: string) {
    const { data } = await supabase.storage
      .from('gerber-files')
      .createSignedUrl(storagePath, 60 * 60 * 24)
    return data?.signedUrl
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

  async function postMessage(body: string, parentMessageId: string | null = null, files: File[] = []) {
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

    if (error || !data) return { data: null, error, warnings: [] as string[] }

    const message = hydrateMessage(data as ProjectConversationMessage)
    if (!messages.value.some(m => m.id === message.id)) {
      messages.value.push(message)
    }
    if (members.value.length === 0) {
      await fetchMembers()
    }
    const mentionUserIds = extractMentionUserIds(trimmed)
    if (mentionUserIds.length > 0) {
      await createMentionNotifications(message.id, mentionUserIds)
    }

    const warnings: string[] = []
    if (files.length > 0) {
      for (const file of files) {
        const storagePath = `${teamId.value}/${projectId.value}/conversation/${message.id}/${Date.now()}-${safeFileName(file.name)}`
        const { error: uploadError } = await supabase.storage
          .from('gerber-files')
          .upload(storagePath, file, {
            upsert: false,
            contentType: file.type || 'application/octet-stream',
          })

        if (uploadError) {
          warnings.push(`Failed to upload ${file.name}: ${uploadError.message}`)
          continue
        }

        const { data: attachmentRow, error: attachmentError } = await supabase
          .from('project_conversation_attachments')
          .insert({
            message_id: message.id,
            project_id: projectId.value,
            team_id: teamId.value,
            file_name: file.name,
            storage_path: storagePath,
            file_size: file.size,
            mime_type: file.type || null,
          })
          .select('*')
          .single()

        if (attachmentError || !attachmentRow) {
          warnings.push(`Failed to save attachment ${file.name}: ${attachmentError?.message ?? 'unknown error'}`)
          await supabase.storage.from('gerber-files').remove([storagePath])
          continue
        }

        const signedUrl = await buildSignedUrl(storagePath)
        attachments.value.push({
          ...(attachmentRow as ProjectConversationAttachment),
          publicUrl: signedUrl,
        })
        updateCache(projectId.value)
      }
    }

    updateCache(projectId.value)
    return { data: message, error: null, warnings }
  }

  async function updateMessage(messageId: string, body: string) {
    const trimmed = body.trim()
    if (!trimmed) return { data: null, error: new Error('Message cannot be empty') }

    const { data, error } = await supabase
      .from('project_conversation_messages')
      .update({ body: trimmed })
      .eq('id', messageId)
      .select('*')
      .single()

    if (error || !data) return { data: null, error }

    const next = hydrateMessage(data as ProjectConversationMessage)
    const idx = messages.value.findIndex(m => m.id === messageId)
    if (idx >= 0) messages.value[idx] = next

    updateCache(projectId.value)
    return { data: next, error: null }
  }

  async function deleteMessage(messageId: string) {
    const { error } = await supabase
      .from('project_conversation_messages')
      .delete()
      .eq('id', messageId)

    if (error) return { error }

    const toDelete = new Set<string>([messageId])
    let changed = true
    while (changed) {
      changed = false
      for (const message of messages.value) {
        if (message.parent_message_id && toDelete.has(message.parent_message_id) && !toDelete.has(message.id)) {
          toDelete.add(message.id)
          changed = true
        }
      }
    }
    messages.value = messages.value.filter(message => !toDelete.has(message.id))
    attachments.value = attachments.value.filter(attachment => !toDelete.has(attachment.message_id))

    updateCache(projectId.value)
    return { error: null }
  }

  async function fetchAttachments(projectKey: string) {
    const { data, error } = await supabase
      .from('project_conversation_attachments')
      .select('*')
      .eq('project_id', projectKey)
      .order('created_at', { ascending: true })

    if (error) {
      console.warn('[useProjectConversation] attachment fetch failed:', error.message)
      return [] as ProjectConversationAttachment[]
    }

    const rows = (data ?? []) as ProjectConversationAttachment[]
    const withUrls = await Promise.all(rows.map(async (row) => ({
      ...row,
      publicUrl: await buildSignedUrl(row.storage_path),
    })))
    return withUrls
  }

  async function fetchMessages(options?: { force?: boolean; background?: boolean }) {
    const projectKey = projectId.value
    if (!projectKey) return

    const cached = conversationCache.get(projectKey)
    const hasCached = Boolean(cached)
    const fresh = isCacheFresh(projectKey)

    if (!options?.force && hasCached && fresh) {
      if (projectId.value === projectKey) hydrateFromCache(projectKey)
      if (!options?.background) return
    }

    const inFlight = inFlightByProject.get(projectKey)
    if (inFlight) {
      await inFlight
      return
    }

    if (!options?.background || !hasCached) {
      loading.value = true
    }

    const request = (async () => {
      if (members.value.length === 0) {
        await fetchMembers()
      }

      const { data, error } = await supabase
        .from('project_conversation_messages')
        .select('*')
        .eq('project_id', projectKey)
        .order('created_at', { ascending: true })

      if (error) {
        console.warn('[useProjectConversation] fetch failed:', error.message)
        return
      }

      const nextMessages = (data ?? []).map((item) => {
        const row = item as ProjectConversationMessage
        return hydrateMessage(row)
      })
      const nextAttachments = await fetchAttachments(projectKey)

      conversationCache.set(projectKey, {
        messages: cloneMessages(nextMessages),
        attachments: cloneAttachments(nextAttachments),
        fetchedAt: Date.now(),
      })

      if (projectId.value === projectKey) {
        messages.value = nextMessages
        attachments.value = nextAttachments
      }
    })()

    inFlightByProject.set(projectKey, request)

    try {
      await request
    } finally {
      inFlightByProject.delete(projectKey)
      if (projectId.value === projectKey) {
        loading.value = false
      }
    }
  }

  function handleRowChange(payload: RealtimePostgresChangesPayload<ProjectConversationMessage>) {
    if (payload.eventType === 'INSERT' && payload.new) {
      const next = hydrateMessage(payload.new as ProjectConversationMessage)
      if (!messages.value.some(m => m.id === next.id)) {
        messages.value.push(next)
        updateCache(projectId.value)
      }
    } else if (payload.eventType === 'UPDATE' && payload.new) {
      const next = hydrateMessage(payload.new as ProjectConversationMessage)
      const idx = messages.value.findIndex(m => m.id === next.id)
      if (idx >= 0) {
        messages.value[idx] = { ...messages.value[idx], ...next }
        updateCache(projectId.value)
      }
    } else if (payload.eventType === 'DELETE' && payload.old) {
      const old = payload.old as ProjectConversationMessage
      messages.value = messages.value.filter(m => m.id !== old.id)
      updateCache(projectId.value)
    }
  }

  async function handleAttachmentRowChange(payload: RealtimePostgresChangesPayload<ProjectConversationAttachment>) {
    try {
      if (payload.eventType === 'INSERT' && payload.new) {
        const next = payload.new as ProjectConversationAttachment
        if (!attachments.value.some(a => a.id === next.id)) {
          attachments.value.push({
            ...next,
            publicUrl: await buildSignedUrl(next.storage_path),
          })
          updateCache(projectId.value)
        }
      } else if (payload.eventType === 'UPDATE' && payload.new) {
        const next = payload.new as ProjectConversationAttachment
        const idx = attachments.value.findIndex(a => a.id === next.id)
        if (idx >= 0) {
          attachments.value[idx] = {
            ...attachments.value[idx],
            ...next,
            publicUrl: await buildSignedUrl(next.storage_path),
          }
          updateCache(projectId.value)
        }
      } else if (payload.eventType === 'DELETE' && payload.old) {
        const old = payload.old as ProjectConversationAttachment
        attachments.value = attachments.value.filter(a => a.id !== old.id)
        updateCache(projectId.value)
      }
    } catch (err) {
      console.warn('[useProjectConversation] attachment realtime handler error:', err)
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
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'project_conversation_attachments',
      filter: `project_id=eq.${projectId.value}`,
    }, handleAttachmentRowChange as any)
    await channel.subscribe()
  }

  function unsubscribe() {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  }

  watch(projectId, async (next, prev) => {
    if (next === prev) return
    if (prev) unsubscribe()
    if (next) {
      const hasCached = hydrateFromCache(next)
      await subscribe()
      if (!hasCached || !isCacheFresh(next)) {
        await fetchMessages({ background: hasCached })
      }
    } else {
      messages.value = []
      attachments.value = []
    }
  }, { immediate: true })

  watch(isAuthenticated, (authed) => {
    if (!authed) {
      unsubscribe()
      conversationCache.clear()
      inFlightByProject.clear()
      messages.value = []
      attachments.value = []
    }
  })

  onBeforeUnmount(() => unsubscribe())

  return {
    loading: readonly(loading),
    messages: readonly(messages),
    attachments: readonly(attachments),
    topLevelMessages,
    repliesFor,
    attachmentsFor,
    fetchMessages,
    postMessage,
    updateMessage,
    deleteMessage,
  }
}
