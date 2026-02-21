export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const username = body?.username
  const password = body?.password

  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing username or password' })
  }

  const config = useRuntimeConfig()
  const baseUrl = (config.public as any).elexessUrl as string || 'https://api.dev.elexess.com/api'
  const encoded = Buffer.from(`${username}:${password}`).toString('base64')

  try {
    const response = await $fetch.raw(`${baseUrl}/search?searchterm=test`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${encoded}`,
        Accept: 'application/json',
      },
    })

    if (response.status >= 200 && response.status < 300) {
      return { valid: true }
    }

    return { valid: false, error: 'Connection failed' }
  } catch (err: any) {
    const status = err?.statusCode ?? err?.response?.status ?? err?.status ?? 0
    if (status === 401 || status === 403) {
      return { valid: false, error: 'Invalid credentials' }
    }
    return { valid: false, error: err?.message ?? 'Connection failed' }
  }
})
