export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const baseUrl = (config.public as any).elexessUrl as string || 'https://api.dev.elexess.com/api'
  const url = `${baseUrl}/exchange-rate`

  try {
    const payload = await $fetch(url, {
      headers: { Accept: 'application/json' },
    })
    return payload
  } catch (err: any) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Failed to fetch Elexess exchange rate',
      data: {
        message: err?.message ?? 'Unknown error',
      },
    })
  }
})
