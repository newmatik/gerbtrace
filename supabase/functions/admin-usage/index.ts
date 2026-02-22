import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PLATFORM_ADMIN_IDS = (Deno.env.get('PLATFORM_ADMIN_IDS') ?? '').split(',').map(s => s.trim()).filter(Boolean)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user || !PLATFORM_ADMIN_IDS.includes(user.id)) {
    return json({ error: 'Forbidden' }, 403)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const mode = body.mode ?? 'teams'

    switch (mode) {
      case 'overview': return json(await handleOverview(supabase))
      case 'teams': return json(await handleTeams(supabase))
      case 'users': return json(await handleUsers(supabase))
      case 'subscriptions': return json(await handleSubscriptions(supabase))
      case 'usage_logs': return json(await handleUsageLogs(supabase, body))
      case 'team_detail': return json(await handleTeamDetail(supabase, body.team_id))
      case 'platform_config': return json(await handlePlatformConfig(supabase))
      default: return json({ error: `Unknown mode: ${mode}` }, 400)
    }
  } catch (err) {
    console.error('admin-usage error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})

async function handleOverview(supabase: any) {
  const [teamsRes, usersRes, subsRes, usageRes] = await Promise.all([
    supabase.from('teams').select('plan'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('subscriptions').select('status, price_id'),
    supabase.rpc('get_platform_monthly_usage'),
  ])

  const teams = teamsRes.data ?? []
  const planCounts: Record<string, number> = {}
  for (const t of teams) {
    planCounts[t.plan] = (planCounts[t.plan] ?? 0) + 1
  }

  const subs = subsRes.data ?? []
  const activeSubs = subs.filter((s: any) => s.status === 'active').length

  let usage = { elexess_searches: 0, spark_ai_runs: 0 }
  if (Array.isArray(usageRes.data) && usageRes.data.length > 0) {
    usage = usageRes.data[0]
  }

  return {
    total_teams: teams.length,
    plan_counts: planCounts,
    total_users: usersRes.count ?? 0,
    active_subscriptions: activeSubs,
    total_subscriptions: subs.length,
    elexess_searches_this_month: Number(usage.elexess_searches) || 0,
    spark_ai_runs_this_month: Number(usage.spark_ai_runs) || 0,
  }
}

async function handleTeams(supabase: any) {
  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name, slug, plan, stripe_customer_id, created_at')
    .order('created_at', { ascending: true })

  if (error) throw error

  const result = await Promise.all((teams ?? []).map(async (team: any) => {
    const [membersRes, projectsRes, spacesRes, usageRes, subsRes] = await Promise.all([
      supabase.from('team_members').select('id', { count: 'exact', head: true }).eq('team_id', team.id),
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('team_id', team.id),
      supabase.from('spaces').select('id', { count: 'exact', head: true }).eq('team_id', team.id),
      supabase.rpc('get_team_monthly_usage', { p_team_id: team.id }),
      supabase.from('subscriptions').select('status').eq('team_id', team.id).order('created_at', { ascending: false }).limit(1),
    ])

    const usage = Array.isArray(usageRes.data) && usageRes.data.length > 0 ? usageRes.data[0] : { elexess_searches: 0, spark_ai_runs: 0 }

    return {
      ...team,
      members_count: membersRes.count ?? 0,
      projects_count: projectsRes.count ?? 0,
      spaces_count: spacesRes.count ?? 0,
      elexess_searches: Number(usage.elexess_searches) || 0,
      spark_ai_runs: Number(usage.spark_ai_runs) || 0,
      stripe_status: subsRes.data?.[0]?.status ?? null,
    }
  }))

  return { teams: result }
}

async function handleUsers(supabase: any) {
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('id, email, name, avatar_url, created_at')
    .order('created_at', { ascending: true })

  if (pError) throw pError

  const { data: memberships, error: mError } = await supabase
    .from('team_members')
    .select('user_id, team_id, role, status, teams(name, slug)')

  if (mError) throw mError

  const membersByUser = new Map<string, any[]>()
  for (const m of memberships ?? []) {
    const list = membersByUser.get(m.user_id) ?? []
    list.push({ team_id: m.team_id, role: m.role, status: m.status, team_name: m.teams?.name, team_slug: m.teams?.slug })
    membersByUser.set(m.user_id, list)
  }

  const users = (profiles ?? []).map((p: any) => ({
    ...p,
    teams: membersByUser.get(p.id) ?? [],
    team_count: (membersByUser.get(p.id) ?? []).length,
  }))

  return { users }
}

async function handleSubscriptions(supabase: any) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, teams(id, name, slug, plan)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return { subscriptions: data ?? [] }
}

async function handleUsageLogs(supabase: any, params: any) {
  const limit = Math.min(params.limit ?? 100, 500)
  const offset = params.offset ?? 0

  let query = supabase
    .from('usage_events')
    .select('id, team_id, user_id, event_type, metadata, created_at, teams(name), profiles:user_id(name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (params.event_type) query = query.eq('event_type', params.event_type)
  if (params.team_id) query = query.eq('team_id', params.team_id)
  if (params.from) query = query.gte('created_at', params.from)
  if (params.to) query = query.lte('created_at', params.to)

  const { data, count, error } = await query
  if (error) throw error

  return { events: data ?? [], total: count ?? 0, limit, offset }
}

async function handleTeamDetail(supabase: any, teamId: string) {
  if (!teamId) throw new Error('team_id required')

  const [teamRes, membersRes, projectsRes, subsRes, usageRes, eventsRes] = await Promise.all([
    supabase.from('teams').select('*').eq('id', teamId).single(),
    supabase.from('team_members').select('id, user_id, role, status, created_at, profiles(name, email, avatar_url)').eq('team_id', teamId),
    supabase.from('projects').select('id, name, mode, status, created_at, updated_at').eq('team_id', teamId).order('updated_at', { ascending: false }),
    supabase.from('subscriptions').select('*').eq('team_id', teamId).order('created_at', { ascending: false }).limit(1),
    supabase.rpc('get_team_monthly_usage', { p_team_id: teamId }),
    supabase.from('usage_events').select('id, user_id, event_type, metadata, created_at, profiles:user_id(name)').eq('team_id', teamId).order('created_at', { ascending: false }).limit(50),
  ])

  if (teamRes.error) throw teamRes.error

  const usage = Array.isArray(usageRes.data) && usageRes.data.length > 0 ? usageRes.data[0] : { elexess_searches: 0, spark_ai_runs: 0 }

  const team = teamRes.data
  const { ai_api_key, elexess_password, ...safeTeam } = team
  return {
    team: safeTeam,
    members: membersRes.data ?? [],
    projects: projectsRes.data ?? [],
    subscription: subsRes.data?.[0] ?? null,
    usage: {
      elexess_searches: Number(usage.elexess_searches) || 0,
      spark_ai_runs: Number(usage.spark_ai_runs) || 0,
    },
    integrations: {
      elexess_enabled: team.elexess_enabled,
      elexess_has_custom_credentials: !!(team.elexess_username && team.elexess_password),
      ai_enabled: team.ai_enabled,
      ai_has_custom_key: !!team.ai_api_key,
    },
    recent_events: eventsRes.data ?? [],
  }
}

async function handlePlatformConfig(supabase: any) {
  const { data, error } = await supabase
    .from('platform_config')
    .select('id, spark_api_key, spark_model, elexess_username, elexess_password, updated_at')
    .limit(1)
    .single()

  if (error) throw error

  return {
    ...data,
    spark_api_key: data.spark_api_key ? `${data.spark_api_key.slice(0, 12)}...` : null,
    elexess_password: data.elexess_password ? '••••••••' : null,
  }
}
