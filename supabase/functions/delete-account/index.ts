import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  const userId = user.id

  try {
    // 1. Find teams where user is the sole admin with active Stripe subscriptions
    const { data: adminTeams } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .eq('status', 'active')

    if (adminTeams) {
      for (const { team_id } of adminTeams) {
        // Check if there are other admins on this team
        const { count } = await supabase
          .from('team_members')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', team_id)
          .eq('role', 'admin')
          .eq('status', 'active')
          .neq('user_id', userId)

        // If sole admin, cancel any active Stripe subscription
        if (count === 0) {
          const { data: sub } = await supabase
            .from('subscriptions')
            .select('stripe_subscription_id, status')
            .eq('team_id', team_id)
            .eq('status', 'active')
            .maybeSingle()

          if (sub?.stripe_subscription_id && STRIPE_SECRET_KEY) {
            try {
              const stripeRes = await fetch(`https://api.stripe.com/v1/subscriptions/${sub.stripe_subscription_id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
              })
              if (!stripeRes.ok) {
                throw new Error(`Stripe cancellation failed: ${await stripeRes.text()}`)
              }
              await supabase.from('subscriptions').update({ status: 'canceled' }).eq('stripe_subscription_id', sub.stripe_subscription_id)
              await supabase.from('teams').update({ plan: 'free' }).eq('id', team_id)
            } catch (e) {
              console.error('Failed to cancel Stripe subscription:', e)
              return json({ error: 'Failed to cancel active subscription. Please contact support.' }, 500)
            }
          }
        }
      }
    }

    // 2. Delete user's files from storage
    const { data: memberTeams } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)

    if (memberTeams) {
      for (const { team_id } of memberTeams) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id')
          .eq('team_id', team_id)
          .eq('created_by', userId)

        if (projects) {
          for (const { id: projectId } of projects) {
            const prefix = `${team_id}/${projectId}/`
            let offset = 0
            const batchSize = 1000
            while (true) {
              const { data: files } = await supabase.storage.from('gerber-files').list(prefix, { limit: batchSize, offset })
              if (!files?.length) break
              const paths = files.map(f => `${prefix}${f.name}`)
              await supabase.storage.from('gerber-files').remove(paths)
              if (files.length < batchSize) break
              offset += batchSize
            }
          }
        }
      }
    }

    // 3. Delete avatar
    const { data: avatarFiles } = await supabase.storage.from('avatars').list(userId, { limit: 10 })
    if (avatarFiles?.length) {
      const paths = avatarFiles.map(f => `${userId}/${f.name}`)
      await supabase.storage.from('avatars').remove(paths)
    }

    // 4. Delete the auth user (cascades through profiles -> all dependent tables)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError)
      return json({ error: 'Failed to delete account. Please contact support.' }, 500)
    }

    return json({ success: true })
  } catch (e) {
    console.error('Account deletion error:', e)
    return json({ error: 'An unexpected error occurred' }, 500)
  }
})
