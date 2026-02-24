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
    .maybeSingle()

  if (membershipError) {
    throw createError({ statusCode: 500, statusMessage: membershipError.message })
  }
  if (!adminMembership) {
    throw createError({ statusCode: 403, statusMessage: 'You must be an admin of this team.' })
  }

  const siteUrl = (config.public as any).siteUrl as string || 'https://www.gerbtrace.com'
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/callback`,
  })

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }

  return { ok: true, message: `Invitation sent to ${email}.`, userId: data.user.id }
})
