const BLOCKED_SUPPLIERS = new Set(['Winsource', 'ChipCart', 'Unikeyic', 'CoreStaff'])

function stripBlockedSuppliers(data: any): any {
  if (data?.results && Array.isArray(data.results)) {
    data.results = data.results.filter(
      (r: any) => !BLOCKED_SUPPLIERS.has(r.supplier),
    )
  }
  return data
}

export default defineEventHandler(async (event) => {
  const access = await verifyTeamAccess(event)

  const body = await readBody(event)
  const searchTerm = body?.searchTerm
  if (!searchTerm || typeof searchTerm !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing searchTerm' })
  }

  const client = getAdminClient()
  const { data: team } = await client
    .from('teams')
    .select('elexess_enabled')
    .eq('id', access.teamId)
    .single()

  if (team?.elexess_enabled === false) {
    throw createError({ statusCode: 403, statusMessage: 'Elexess is disabled for this team' })
  }

  const credentials = await resolveElexessCredentials(access.teamId)
  const config = useRuntimeConfig()
  const baseUrl = (config.public as any).elexessUrl as string || 'https://api.dev.elexess.com/api'
  const encoded = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')

  try {
    const url = `${baseUrl}/search?searchterm=${encodeURIComponent(searchTerm)}`
    const response = await $fetch<any>(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${encoded}`,
        Accept: 'application/json',
      },
    })
    return stripBlockedSuppliers(response)
  } catch (err: any) {
    const status = err?.statusCode ?? err?.response?.status ?? err?.status ?? 502
    console.error(`[Elexess] Search proxy error for "${searchTerm}":`, {
      status,
      message: err?.message,
    })
    throw createError({
      statusCode: status === 401 || status === 403 ? status : 502,
      statusMessage: status === 401 || status === 403 ? 'Invalid Elexess credentials' : 'Elexess search failed',
    })
  }
})
