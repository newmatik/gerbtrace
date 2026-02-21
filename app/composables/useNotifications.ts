import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

export interface InboxNotification {
  id: string
  recipient_user_id: string
  actor_user_id: string | null
  team_id: string | null
  project_id: string | null
  message_id: string | null
  type: 'mention' | 'approval_requested' | 'approved' | 'changes_requested' | 'status_changed'
  payload: Record<string, any> | null
  read_at: string | null
  created_at: string
}

const notifications = useState<InboxNotification[]>('inbox:notifications', () => [])
const loading = useState<boolean>('inbox:loading', () => false)
let channel: RealtimeChannel | null = null

export function useNotifications() {
  const supabase = useSupabase()
  const { user } = useAuth()

  const unreadCount = computed(() => notifications.value.filter(n => !n.read_at).length)

  async function fetchNotifications() {
    if (!user.value?.id) {
      notifications.value = []
      return
    }
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', user.value.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) {
        console.warn('[useNotifications] fetch failed:', error.message)
        return
      }
      notifications.value = (data ?? []) as InboxNotification[]
    } finally {
      loading.value = false
    }
  }

  async function markAsRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .is('read_at', null)
    if (!error) {
      const next = notifications.value.map(n =>
        n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n,
      )
      notifications.value = next
    }
    return { error }
  }

  async function markAllAsRead() {
    if (!user.value?.id) return
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_user_id', user.value.id)
      .is('read_at', null)
    if (!error) {
      const now = new Date().toISOString()
      notifications.value = notifications.value.map(n => ({ ...n, read_at: n.read_at ?? now }))
    }
    return { error }
  }

  function onNotificationChange(payload: RealtimePostgresChangesPayload<InboxNotification>) {
    if (payload.eventType === 'INSERT' && payload.new) {
      const next = payload.new as InboxNotification
      if (!notifications.value.some(n => n.id === next.id)) {
        notifications.value = [next, ...notifications.value]
      }
    } else if (payload.eventType === 'UPDATE' && payload.new) {
      const next = payload.new as InboxNotification
      notifications.value = notifications.value.map(n => (n.id === next.id ? next : n))
    } else if (payload.eventType === 'DELETE' && payload.old) {
      const old = payload.old as InboxNotification
      notifications.value = notifications.value.filter(n => n.id !== old.id)
    }
  }

  async function subscribe() {
    if (!user.value?.id || channel) return
    channel = supabase.channel(`notifications:${user.value.id}`)
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `recipient_user_id=eq.${user.value.id}`,
    }, onNotificationChange as any)
    await channel.subscribe()
  }

  function unsubscribe() {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  }

  watch(() => user.value?.id, async (next) => {
    unsubscribe()
    if (next) {
      await fetchNotifications()
      await subscribe()
    } else {
      notifications.value = []
    }
  }, { immediate: true })

  onBeforeUnmount(() => unsubscribe())

  return {
    notifications: readonly(notifications),
    loading: readonly(loading),
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  }
}
