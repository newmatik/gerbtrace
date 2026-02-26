import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const config = useRuntimeConfig()
  const supabase = createClient(
    config.public.supabaseUrl as string,
    config.supabaseServiceRoleKey,
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const userId = user.id

  const [profileRes, teamsRes, projectsRes, consentsRes, usageRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase
      .from('team_members')
      .select('team_id, role, status, teams:team_id(name, slug)')
      .eq('user_id', userId),
    supabase
      .from('projects')
      .select('id, name, mode, status, bom_data, pnp_data, pcb_data, created_at, updated_at')
      .eq('created_by', userId),
    supabase
      .from('user_consents')
      .select('consent_type, version, accepted, ip_address, user_agent, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('usage_events')
      .select('event_type, metadata, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  ])

  const queryErrors = [
    profileRes.error,
    teamsRes.error,
    projectsRes.error,
    consentsRes.error,
    usageRes.error,
  ].filter(Boolean)
  if (queryErrors.length > 0) {
    console.error('[account/export] query failure', queryErrors)
    throw createError({ statusCode: 500, statusMessage: 'Failed to generate account export' })
  }

  const exportData = {
    exported_at: new Date().toISOString(),
    user: {
      id: userId,
      email: user.email,
      created_at: user.created_at,
    },
    profile: profileRes.data ?? null,
    teams: teamsRes.data ?? [],
    projects: projectsRes.data ?? [],
    consents: consentsRes.data ?? [],
    usage_events: usageRes.data ?? [],
  }

  const date = new Date().toISOString().split('T')[0]
  setHeader(event, 'Content-Type', 'application/json')
  setHeader(event, 'Cache-Control', 'no-store, private, max-age=0')
  setHeader(event, 'Pragma', 'no-cache')
  setHeader(event, 'Expires', '0')
  setHeader(event, 'Content-Disposition', `attachment; filename="gerbtrace-export-${date}.json"`)
  return exportData
})
