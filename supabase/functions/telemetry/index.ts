import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const body = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    await supabase.from('telemetry_events').insert({
      hostname: String(body.h ?? '').slice(0, 255),
      path: String(body.p ?? '').slice(0, 2048),
      referrer: String(body.r ?? '').slice(0, 2048),
      reported_at: body.t ? new Date(body.t).toISOString() : new Date().toISOString(),
      ip: req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? null,
    })
  } catch {}

  return new Response(null, { status: 204, headers: corsHeaders })
})
