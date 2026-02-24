import { describe, it, expect, beforeAll } from 'vitest'
import { config } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

config()

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!

describe('Supabase Environment Variables', () => {
  it('SUPABASE_URL is set and looks like a valid URL', () => {
    expect(SUPABASE_URL).toBeDefined()
    expect(SUPABASE_URL).toMatch(/^https:\/\/.*\.supabase\.co$/)
  })

  it('SUPABASE_ANON_KEY is set and non-empty', () => {
    expect(SUPABASE_ANON_KEY).toBeDefined()
    expect(SUPABASE_ANON_KEY.length).toBeGreaterThan(10)
  })

  it('SUPABASE_SECRET_KEY is set and non-empty', () => {
    expect(SUPABASE_SECRET_KEY).toBeDefined()
    expect(SUPABASE_SECRET_KEY.length).toBeGreaterThan(10)
  })
})

describe('Supabase Connection — Anon Key', () => {
  let client: SupabaseClient

  beforeAll(() => {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  })

  it('can reach the Supabase REST API', async () => {
    const { error } = await client.from('_test_ping').select('*').limit(1)
    if (error) {
      const isExpected = ['42P01', 'PGRST205', '42501'].includes(error.code ?? '')
        || error.message.includes('does not exist')
        || error.message.includes('schema cache')
      expect(
        isExpected,
        `Unexpected Supabase error: ${error.code} — ${error.message}`,
      ).toBe(true)
    }
  })

  it('can reach the Supabase Auth API', async () => {
    const { data, error } = await client.auth.getSession()
    expect(error).toBeNull()
    expect(data).toBeDefined()
  })
})

describe('Supabase Connection — Service Role Key (Admin)', () => {
  let adminClient: SupabaseClient

  beforeAll(() => {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  })

  it('can reach the Supabase REST API with service role privileges', async () => {
    const { error } = await adminClient.from('_test_ping').select('*').limit(1)
    if (error) {
      const isExpected = ['42P01', 'PGRST205'].includes(error.code ?? '')
        || error.message.includes('does not exist')
        || error.message.includes('schema cache')
      expect(
        isExpected,
        `Unexpected Supabase admin error: ${error.code} — ${error.message}`,
      ).toBe(true)
    }
  })

  it('can list users via the Admin Auth API', async () => {
    const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1 })
    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data.users).toBeInstanceOf(Array)
  })
})
