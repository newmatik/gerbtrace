import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const STRIPE_PRICE_ID_PRO = Deno.env.get('STRIPE_PRICE_ID_PRO') ?? ''
const STRIPE_PRICE_ID_TEAM = Deno.env.get('STRIPE_PRICE_ID_TEAM') ?? ''
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') ?? 'https://gerbtrace.com'

const VALID_PRICES = new Set([STRIPE_PRICE_ID_PRO, STRIPE_PRICE_ID_TEAM])

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function stripeRequest(path: string, body: Record<string, string>): Promise<any> {
  const resp = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  })
  return resp.json()
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

    const { team_id, price_id } = await req.json()
    if (!team_id || !price_id) {
      return json({ error: 'team_id and price_id are required' }, 400)
    }

    if (!VALID_PRICES.has(price_id)) {
      return json({ error: 'Invalid price_id' }, 400)
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
      .select('id, name, stripe_customer_id')
      .eq('id', team_id)
      .single()

    if (!team) {
      return json({ error: 'Team not found' }, 404)
    }

    let customerId = team.stripe_customer_id

    if (!customerId) {
      const customer = await stripeRequest('/customers', {
        email: user.email ?? '',
        name: team.name,
        'metadata[team_id]': team_id,
        'metadata[gerbtrace_user_id]': user.id,
      })

      if (customer.error) {
        console.error('Stripe customer creation failed:', customer.error)
        return json({ error: 'Failed to create billing account' }, 500)
      }

      customerId = customer.id

      await supabase
        .from('teams')
        .update({ stripe_customer_id: customerId })
        .eq('id', team_id)
    }

    const session = await stripeRequest('/checkout/sessions', {
      customer: customerId!,
      mode: 'subscription',
      'line_items[0][price]': price_id,
      'line_items[0][quantity]': '1',
      success_url: `${FRONTEND_URL}/team/settings?section=billing&checkout=success`,
      cancel_url: `${FRONTEND_URL}/team/settings?section=billing&checkout=cancelled`,
      'metadata[team_id]': team_id,
      'automatic_tax[enabled]': 'true',
      'tax_id_collection[enabled]': 'true',
      'customer_update[address]': 'auto',
      'customer_update[name]': 'auto',
    })

    if (session.error) {
      console.error('Stripe session creation failed:', session.error)
      return json({ error: 'Failed to create checkout session' }, 500)
    }

    return json({ url: session.url })
  } catch (err) {
    console.error('stripe-checkout error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
