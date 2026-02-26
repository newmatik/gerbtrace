import { describe, it, expect } from 'vitest'
import { config } from 'dotenv'

config()

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!

describe('Cloudflare API Token — Environment', () => {
  it('CLOUDFLARE_API_TOKEN is set and non-empty', () => {
    expect(CLOUDFLARE_API_TOKEN).toBeDefined()
    expect(CLOUDFLARE_API_TOKEN.length).toBeGreaterThan(10)
  })
})

describe('Cloudflare API Token — Verification', () => {
  it('token is valid (GET /user/tokens/verify)', async () => {
    const res = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
      headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
    })
    const body = await res.json() as {
      success: boolean
      result: { status: string }
      errors: { code: number; message: string }[]
    }

    expect(res.ok, `HTTP ${res.status}: ${JSON.stringify(body.errors)}`).toBe(true)
    expect(body.success).toBe(true)
    expect(body.result.status).toBe('active')
  })

  it('token can list accounts', async () => {
    const res = await fetch('https://api.cloudflare.com/client/v4/accounts?per_page=5', {
      headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
    })
    const body = await res.json() as {
      success: boolean
      result: { id: string; name: string }[]
      errors: { code: number; message: string }[]
    }

    expect(res.ok, `HTTP ${res.status}: ${JSON.stringify(body.errors)}`).toBe(true)
    expect(body.success).toBe(true)
    expect(body.result.length).toBeGreaterThan(0)

    console.log('Cloudflare accounts accessible with this token:')
    for (const account of body.result) {
      console.log(`  - ${account.name} (${account.id})`)
    }
  })

  it('token has Workers Scripts read access', async () => {
    const accountsRes = await fetch('https://api.cloudflare.com/client/v4/accounts?per_page=1', {
      headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` },
    })
    const accountsBody = await accountsRes.json() as {
      success: boolean
      result: { id: string }[]
    }
    expect(accountsBody.result.length, 'No Cloudflare accounts accessible').toBeGreaterThan(0)
    const accountId = accountsBody.result[0].id

    const workersRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`,
      { headers: { Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}` } },
    )
    const workersBody = await workersRes.json() as {
      success: boolean
      result: { id: string }[]
      errors: { code: number; message: string }[]
    }

    if (!workersRes.ok) {
      console.error(
        `⚠ Workers Scripts access DENIED (HTTP ${workersRes.status}).`,
        '\n  Your token is missing the "Workers Scripts:Edit" permission.',
        '\n  Go to https://dash.cloudflare.com/profile/api-tokens to update it.',
      )
    }

    expect(workersRes.ok, `HTTP ${workersRes.status}: ${JSON.stringify(workersBody.errors)}`).toBe(true)
    expect(workersBody.success).toBe(true)
  })
})
