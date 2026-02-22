import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'

let _client: SupabaseClient | null = null

export function getAdminClient(): SupabaseClient {
  if (_client) return _client

  const config = useRuntimeConfig()
  const url = (config.public as any).supabaseUrl as string
  const serviceKey = config.supabaseServiceRoleKey as string

  if (!url || !serviceKey) {
    throw createError({ statusCode: 500, statusMessage: 'Missing Supabase service role configuration' })
  }

  _client = createClient(url, serviceKey, { auth: { persistSession: false } })
  return _client
}

export interface TeamAccess {
  userId: string
  teamId: string
  plan: string
}

/**
 * Verify the caller's JWT and team membership.
 * Reads teamId from the request body.
 */
export async function verifyTeamAccess(event: H3Event): Promise<TeamAccess> {
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Missing authorization header' })
  }

  const token = authHeader.slice(7)
  const client = getAdminClient()

  const { data: { user }, error: authError } = await client.auth.getUser(token)
  if (authError || !user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid token' })
  }

  const body = await readBody(event)
  const teamId = body?.teamId
  if (!teamId || typeof teamId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing teamId' })
  }

  const { data: membership, error: memError } = await client
    .from('team_members')
    .select('role, status')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (memError || !membership) {
    throw createError({ statusCode: 403, statusMessage: 'Not a member of this team' })
  }

  const { data: team, error: teamError } = await client
    .from('teams')
    .select('plan')
    .eq('id', teamId)
    .single()

  if (teamError || !team) {
    throw createError({ statusCode: 404, statusMessage: 'Team not found' })
  }

  return { userId: user.id, teamId, plan: team.plan }
}

export interface SparkCredentials {
  apiKey: string
  model: string
}

/**
 * Resolve Spark AI credentials: team override first, then platform_config global default.
 */
export async function resolveSparkCredentials(teamId: string): Promise<SparkCredentials> {
  const client = getAdminClient()

  const { data: team } = await client
    .from('teams')
    .select('ai_api_key, ai_model')
    .eq('id', teamId)
    .single()

  if (team?.ai_api_key) {
    return { apiKey: team.ai_api_key, model: team.ai_model || 'claude-sonnet-4-20250514' }
  }

  const { data: config } = await client
    .from('platform_config')
    .select('spark_api_key, spark_model')
    .limit(1)
    .single()

  if (!config?.spark_api_key) {
    throw createError({ statusCode: 503, statusMessage: 'Spark AI is not configured. Contact your administrator.' })
  }

  return { apiKey: config.spark_api_key, model: config.spark_model || 'claude-sonnet-4-20250514' }
}

export interface ElexessCredentials {
  username: string
  password: string
}

/**
 * Resolve Elexess credentials: team override first, then platform_config global default.
 */
export async function resolveElexessCredentials(teamId: string): Promise<ElexessCredentials> {
  const client = getAdminClient()

  const { data: team } = await client
    .from('teams')
    .select('elexess_username, elexess_password')
    .eq('id', teamId)
    .single()

  if (team?.elexess_username && team?.elexess_password) {
    return { username: team.elexess_username, password: team.elexess_password }
  }

  const { data: config } = await client
    .from('platform_config')
    .select('elexess_username, elexess_password')
    .limit(1)
    .single()

  if (!config?.elexess_username || !config?.elexess_password) {
    throw createError({ statusCode: 503, statusMessage: 'Elexess is not configured. Contact your administrator.' })
  }

  return { username: config.elexess_username, password: config.elexess_password }
}
