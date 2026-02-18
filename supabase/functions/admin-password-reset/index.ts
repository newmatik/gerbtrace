// Supabase Edge Function: admin-password-reset
// Allows a team admin to set a new password for a team member.
//
// Called from the frontend. Uses the caller JWT for authorization checks.
// Expects: { team_id: string, user_id: string, new_password: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ResetPayload {
  team_id: string
  user_id: string
  new_password: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    const { team_id, user_id, new_password } = (await req.json()) as ResetPayload
    if (!team_id || !user_id || !new_password) {
      return new Response(JSON.stringify({ error: 'team_id, user_id and new_password are required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }
    if (new_password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    // Ensure caller is an active admin of this team.
    const { data: callerMembership, error: callerError } = await supabaseAdmin
      .from('team_members')
      .select('id')
      .eq('team_id', team_id)
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .eq('status', 'active')
      .maybeSingle()

    if (callerError) {
      console.error('admin-password-reset caller lookup error:', callerError)
      return new Response(JSON.stringify({ error: 'Failed to verify admin status' }), {
        status: 500,
        headers: corsHeaders,
      })
    }
    if (!callerMembership) {
      return new Response(JSON.stringify({ error: 'Only team admins can reset member passwords' }), {
        status: 403,
        headers: corsHeaders,
      })
    }

    // Ensure target user belongs to the same team.
    const { data: targetMembership, error: targetError } = await supabaseAdmin
      .from('team_members')
      .select('id')
      .eq('team_id', team_id)
      .eq('user_id', user_id)
      .maybeSingle()

    if (targetError) {
      console.error('admin-password-reset target lookup error:', targetError)
      return new Response(JSON.stringify({ error: 'Failed to verify target membership' }), {
        status: 500,
        headers: corsHeaders,
      })
    }
    if (!targetMembership) {
      return new Response(JSON.stringify({ error: 'Target user is not a member of this team' }), {
        status: 404,
        headers: corsHeaders,
      })
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: new_password,
    })
    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders,
    })
  } catch (err) {
    console.error('admin-password-reset error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
