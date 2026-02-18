// Supabase Edge Function: elexess-exchange-rate
// Proxies Elexess exchange-rate endpoint to avoid browser CORS issues.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const ELEXESS_URL = Deno.env.get('ELEXESS_URL') ?? 'https://api.dev.elexess.com/api'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    })
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10_000)

    const response = await fetch(`${ELEXESS_URL}/exchange-rate`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Upstream error ${response.status}` }), {
        status: 502,
        headers: corsHeaders,
      })
    }

    let payload
    try {
      payload = await response.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON from upstream' }), {
        status: 502,
        headers: corsHeaders,
      })
    }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: corsHeaders,
    })
  } catch (err) {
    console.error('elexess-exchange-rate error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
