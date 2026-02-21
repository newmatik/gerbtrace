export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const apiKey = body?.apiKey

  if (!apiKey || typeof apiKey !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing apiKey' })
  }

  try {
    const response = await $fetch<{ data: Array<{ id: string, display_name: string }> }>(
      'https://api.anthropic.com/v1/models?limit=100',
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      },
    )

    const allModels = response.data ?? []

    const chatModels = allModels
      .filter((m) => {
        if (!/^claude-/i.test(m.id)) return false
        if (/embed|legacy/i.test(m.id)) return false
        // Skip dated snapshots (e.g. claude-sonnet-4-5-20250514) -- keep only aliases
        if (/\d{8}$/.test(m.id)) return false
        return true
      })
      .map(m => ({ id: m.id, name: m.display_name }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return { valid: true, models: chatModels }
  } catch (err: any) {
    const status = err?.statusCode ?? err?.response?.status ?? err?.status ?? 0

    if (status === 401 || status === 403) {
      return { valid: false, models: [], error: 'Invalid API key' }
    }

    return { valid: false, models: [], error: err?.message ?? 'Connection failed' }
  }
})
