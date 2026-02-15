// Supabase Edge Function: handle-team-join
// Handles auto-join requests when a user's email domain matches a team's auto_join_domain.
//
// Called from the frontend. Uses the user's JWT to verify identity.
// Expects: { team_id: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface JoinPayload {
  team_id: string
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { team_id } = (await req.json()) as JoinPayload

    if (!team_id) {
      return new Response(JSON.stringify({ error: 'team_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create client with user's auth token for identity verification
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Service role client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // User client for identity
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get the team's auto_join_domain
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('id, name, auto_join_domain')
      .eq('id', team_id)
      .single()

    if (teamError || !team) {
      return new Response(JSON.stringify({ error: 'Team not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!team.auto_join_domain) {
      return new Response(JSON.stringify({ error: 'This team does not allow domain-based auto-join' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Verify the user's email domain matches
    const userDomain = user.email?.split('@')[1]?.toLowerCase()
    const allowedDomain = team.auto_join_domain.toLowerCase()

    if (userDomain !== allowedDomain) {
      return new Response(JSON.stringify({
        error: `Your email domain (${userDomain}) does not match the required domain (${allowedDomain})`,
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check if already a member
    const { data: existing } = await supabaseAdmin
      .from('team_members')
      .select('id')
      .eq('team_id', team_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      return new Response(JSON.stringify({ success: true, already_member: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Add user as viewer (default role for auto-join)
    const { error: insertError } = await supabaseAdmin
      .from('team_members')
      .insert({
        team_id,
        user_id: user.id,
        role: 'viewer',
        status: 'active',
      })

    if (insertError) {
      console.error('Failed to add team member:', insertError)
      return new Response(JSON.stringify({ error: 'Failed to join team' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, role: 'viewer' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('handle-team-join error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
