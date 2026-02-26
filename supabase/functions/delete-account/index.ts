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
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : ''
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  const userId = user.id

  try {
    // 1. Find teams where user is the sole admin with active Stripe subscriptions
    const { data: adminTeams, error: adminTeamsError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .eq('status', 'active')
    if (adminTeamsError) {
      throw new Error(`Failed to load admin teams: ${adminTeamsError.message}`)
    }

    if (adminTeams) {
      for (const { team_id } of adminTeams) {
        // Check if there are other admins on this team
        const { count, error: adminCountError } = await supabase
          .from('team_members')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', team_id)
          .eq('role', 'admin')
          .eq('status', 'active')
          .neq('user_id', userId)
        if (adminCountError) {
          throw new Error(`Failed to count team admins: ${adminCountError.message}`)
        }

        // If sole admin, cancel any active Stripe subscription
        if (count === 0) {
          const { data: sub, error: subError } = await supabase
            .from('subscriptions')
            .select('stripe_subscription_id, status')
            .eq('team_id', team_id)
            .eq('status', 'active')
            .maybeSingle()
          if (subError) {
            throw new Error(`Failed to load team subscription: ${subError.message}`)
          }

          if (sub?.stripe_subscription_id) {
            if (!STRIPE_SECRET_KEY) {
              return json({ error: 'Account deletion unavailable: billing configuration missing.' }, 500)
            }
            try {
              const stripeRes = await fetch(`https://api.stripe.com/v1/subscriptions/${sub.stripe_subscription_id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
              })
              if (!stripeRes.ok) {
                throw new Error(`Stripe cancellation failed: ${await stripeRes.text()}`)
              }
              const { error: subUpdateError } = await supabase
                .from('subscriptions')
                .update({ status: 'canceled' })
                .eq('stripe_subscription_id', sub.stripe_subscription_id)
              if (subUpdateError) {
                throw new Error(`Failed to update subscription status: ${subUpdateError.message}`)
              }

              const { error: teamUpdateError } = await supabase
                .from('teams')
                .update({ plan: 'free' })
                .eq('id', team_id)
              if (teamUpdateError) {
                throw new Error(`Failed to downgrade team plan: ${teamUpdateError.message}`)
              }
            } catch (e) {
              console.error('Failed to cancel Stripe subscription:', e)
              return json({ error: 'Failed to cancel active subscription. Please contact support.' }, 500)
            }
          }
        }
      }
    }

    // 2. Delete user's files from storage
    const { data: memberTeams, error: memberTeamsError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
    if (memberTeamsError) {
      throw new Error(`Failed to load member teams: ${memberTeamsError.message}`)
    }

    if (memberTeams) {
      for (const { team_id } of memberTeams) {
        const { data: projects, error: projectsError } = await supabase
          .from('projects')
          .select('id')
          .eq('team_id', team_id)
          .eq('created_by', userId)
        if (projectsError) {
          throw new Error(`Failed to load projects: ${projectsError.message}`)
        }

        if (projects) {
          for (const { id: projectId } of projects) {
            const prefix = `${team_id}/${projectId}/`
            let offset = 0
            const batchSize = 1000
            while (true) {
              const { data: files, error: filesError } = await supabase.storage
                .from('gerber-files')
                .list(prefix, { limit: batchSize, offset })
              if (filesError) {
                throw new Error(`Failed to list project files: ${filesError.message}`)
              }
              if (!files?.length) break
              const paths = files.map(f => `${prefix}${f.name}`)
              const { error: removeError } = await supabase.storage.from('gerber-files').remove(paths)
              if (removeError) {
                throw new Error(`Failed to remove project files: ${removeError.message}`)
              }
              if (files.length < batchSize) break
              offset += batchSize
            }
          }
        }
      }
    }

    // 3. Delete avatar
    let avatarOffset = 0
    const avatarBatchSize = 1000
    while (true) {
      const { data: avatarFiles, error: avatarListError } = await supabase.storage
        .from('avatars')
        .list(userId, { limit: avatarBatchSize, offset: avatarOffset })
      if (avatarListError) {
        throw new Error(`Failed to list avatar files: ${avatarListError.message}`)
      }
      if (!avatarFiles?.length) break

      const paths = avatarFiles.map(f => `${userId}/${f.name}`)
      const { error: avatarRemoveError } = await supabase.storage.from('avatars').remove(paths)
      if (avatarRemoveError) {
        throw new Error(`Failed to remove avatar files: ${avatarRemoveError.message}`)
      }
      if (avatarFiles.length < avatarBatchSize) break
      avatarOffset += avatarBatchSize
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
