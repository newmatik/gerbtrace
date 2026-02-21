import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') ?? 'https://gerbtrace.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization' }, 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const { team_id } = await req.json()
    if (!team_id) {
      return json({ error: 'team_id is required' }, 400)
    }

    const { data: membership } = await supabase
      .from('team_members')
      .select('role')
      .eq('team_id', team_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!membership || membership.role !== 'admin') {
      return json({ error: 'Only team admins can manage billing' }, 403)
    }

    const { data: team } = await supabase
      .from('teams')
      .select('stripe_customer_id')
      .eq('id', team_id)
      .single()

    if (!team?.stripe_customer_id) {
      return json({ error: 'No billing account found' }, 404)
    }

    const resp = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: team.stripe_customer_id,
        return_url: `${FRONTEND_URL}/team/settings?section=billing`,
      }).toString(),
    })

    const session = await resp.json()
    if (session.error) {
      console.error('Stripe portal error:', session.error)
      return json({ error: 'Failed to create portal session' }, 500)
    }

    return json({ url: session.url })
  } catch (err) {
    console.error('stripe-portal error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
