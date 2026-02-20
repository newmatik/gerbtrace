export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const apiKey = body?.apiKey

  if (!apiKey || typeof apiKey !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing apiKey' })
  }

  try {
    const response = await $fetch<{ type: string }>('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      },
    })

    return {
      valid: true,
      models: [
        'claude-sonnet-4-20250514',
        'claude-haiku-4-20250414',
      ],
    }
  } catch (err: any) {
    const status = err?.statusCode ?? err?.response?.status ?? 0
    if (status === 401 || status === 403) {
      return { valid: false, models: [], error: 'Invalid API key' }
    }
    return { valid: false, models: [], error: err?.message ?? 'Connection failed' }
  }
})
