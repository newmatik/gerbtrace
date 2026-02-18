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
    const response = await fetch(`${ELEXESS_URL}/exchange-rate`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Upstream error ${response.status}` }), {
        status: 502,
        headers: corsHeaders,
      })
    }

    const payload = await response.json()
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
