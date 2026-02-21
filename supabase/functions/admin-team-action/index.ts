import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PLATFORM_ADMIN_IDS = (Deno.env.get('PLATFORM_ADMIN_IDS') ?? '').split(',').map(s => s.trim()).filter(Boolean)
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user || !PLATFORM_ADMIN_IDS.includes(user.id)) {
    return json({ error: 'Forbidden' }, 403)
  }

  try {
    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'change_plan': {
        const { team_id, plan } = body
        if (!team_id || !['free', 'pro', 'team', 'enterprise'].includes(plan)) {
          return json({ error: 'Invalid team_id or plan' }, 400)
        }
        const { error } = await supabase.from('teams').update({ plan }).eq('id', team_id)
        if (error) throw error
        return json({ success: true, team_id, plan })
      }

      case 'cancel_subscription': {
        const { team_id } = body
        if (!team_id) return json({ error: 'team_id required' }, 400)

        const { data: sub } = await supabase
          .from('subscriptions')
          .select('stripe_subscription_id')
          .eq('team_id', team_id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (!sub?.stripe_subscription_id) {
          return json({ error: 'No active subscription found' }, 404)
        }

        const stripeResp = await fetch(`https://api.stripe.com/v1/subscriptions/${sub.stripe_subscription_id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
        })
        const stripeData = await stripeResp.json()

        if (stripeData.error) {
          console.error('Stripe cancel error:', stripeData.error)
          return json({ error: 'Failed to cancel Stripe subscription' }, 500)
        }

        await supabase.from('subscriptions').update({ status: 'canceled' }).eq('stripe_subscription_id', sub.stripe_subscription_id)
        await supabase.from('teams').update({ plan: 'free' }).eq('id', team_id)

        return json({ success: true, team_id })
      }

      case 'delete_team': {
        const { team_id } = body
        if (!team_id) return json({ error: 'team_id required' }, 400)

        const { error } = await supabase.from('teams').delete().eq('id', team_id)
        if (error) throw error
        return json({ success: true, team_id })
      }

      case 'disable_user': {
        const { user_id } = body
        if (!user_id) return json({ error: 'user_id required' }, 400)

        const { error } = await supabase.from('team_members').update({ status: 'disabled' }).eq('user_id', user_id)
        if (error) throw error
        return json({ success: true, user_id, status: 'disabled' })
      }

      case 'enable_user': {
        const { user_id } = body
        if (!user_id) return json({ error: 'user_id required' }, 400)

        const { error } = await supabase.from('team_members').update({ status: 'active' }).eq('user_id', user_id)
        if (error) throw error
        return json({ success: true, user_id, status: 'active' })
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400)
    }
  } catch (err) {
    console.error('admin-team-action error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})
