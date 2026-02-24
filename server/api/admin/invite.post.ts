export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const adminClient = getAdminClient()

  const authHeader = getHeader(event, 'authorization')
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!accessToken) {
    throw createError({ statusCode: 401, statusMessage: 'Missing access token.' })
  }

  const body = await readBody<{ teamId: string; email: string }>(event)
  const teamId = body?.teamId?.trim()
  const email = body?.email?.trim().toLowerCase()

  if (!teamId || !email) {
    throw createError({ statusCode: 400, statusMessage: 'teamId and email are required.' })
  }

  const { data: callerData, error: callerError } = await adminClient.auth.getUser(accessToken)
  if (callerError || !callerData.user) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid session.' })
  }

  const { data: adminMembership, error: membershipError } = await adminClient
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', callerData.user.id)
    .eq('role', 'admin')
    .eq('status', 'active')
    .maybeSingle()

  if (membershipError) {
    console.error('[invite] membership query error:', membershipError.message)
    throw createError({ statusCode: 500, statusMessage: 'Failed to verify team membership.' })
  }
  if (!adminMembership) {
    throw createError({ statusCode: 403, statusMessage: 'You must be an active admin of this team.' })
  }

  const siteUrl = (config.public as any).siteUrl as string
  if (!siteUrl) {
    throw createError({ statusCode: 500, statusMessage: 'siteUrl is not configured.' })
  }
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/callback`,
  })

  if (error) {
    console.error('[invite] inviteUserByEmail error:', error.message)
    throw createError({ statusCode: 400, statusMessage: 'Failed to send invitation.' })
  }

  return { ok: true, message: `Invitation sent to ${email}.`, userId: data.user.id }
})
