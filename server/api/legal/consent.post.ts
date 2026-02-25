import { createClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import { CURRENT_LEGAL_VERSIONS } from '~/utils/legalVersions'

type ConsentType = keyof typeof CURRENT_LEGAL_VERSIONS
type ConsentPayload = { types?: ConsentType[] }

function getClientIp(event: H3Event) {
  return getHeader(event, 'cf-connecting-ip')
    || getHeader(event, 'x-real-ip')
    || getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim()
    || null
}

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const config = useRuntimeConfig()
  const supabaseUrl = config.public.supabaseUrl as string
  const serviceKey = config.supabaseServiceRoleKey
  if (!serviceKey) {
    throw createError({ statusCode: 500, statusMessage: 'Service role key not configured' })
  }

  const payload = await readBody<ConsentPayload>(event)
  const requestedTypes = payload.types ?? []
  const allowedTypes: ConsentType[] = ['terms', 'privacy']
  const consentTypes = requestedTypes.filter((type): type is ConsentType => allowedTypes.includes(type))
  if (consentTypes.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid consent types provided' })
  }

  const token = authHeader.slice(7)
  const userClient = createClient(supabaseUrl, config.public.supabaseAnonKey as string)
  const { data: { user }, error: authError } = await userClient.auth.getUser(token)
  if (authError || !user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid session' })
  }

  const adminClient = createClient(supabaseUrl, serviceKey)
  const ipAddress = getClientIp(event)
  const userAgent = getHeader(event, 'user-agent') || null
  const now = new Date().toISOString()

  const rows = consentTypes.map(type => ({
    user_id: user.id,
    consent_type: type,
    version: CURRENT_LEGAL_VERSIONS[type],
    accepted: true,
    ip_address: ipAddress,
    user_agent: userAgent,
    created_at: now,
  }))

  const { error } = await adminClient
    .from('user_consents')
    .upsert(rows, { onConflict: 'user_id,consent_type,version' })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to record consent' })
  }

  return { success: true }
})
