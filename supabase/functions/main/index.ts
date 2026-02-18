import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') ?? 'https://gerbtrace.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders })
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
}

function getSupabaseUser(authHeader: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  )
}

async function handleAdminPasswordReset(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Not authenticated' }, 401)

  const { team_id, user_id, new_password } = await req.json()
  if (!team_id || !user_id || !new_password) {
    return jsonResponse({ error: 'team_id, user_id and new_password are required' }, 400)
  }
  if (String(new_password).length < 8) {
    return jsonResponse({ error: 'Password must be at least 8 characters' }, 400)
  }

  const supabaseAdmin = getSupabaseAdmin()
  const supabaseUser = getSupabaseUser(authHeader)

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
  if (userError || !user) return jsonResponse({ error: 'Invalid authentication' }, 401)

  const { data: callerMembership } = await supabaseAdmin
    .from('team_members')
    .select('id')
    .eq('team_id', team_id)
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .eq('status', 'active')
    .maybeSingle()

  if (!callerMembership) {
    return jsonResponse({ error: 'Only team admins can reset member passwords' }, 403)
  }

  const { data: targetMembership } = await supabaseAdmin
    .from('team_members')
    .select('id')
    .eq('team_id', team_id)
    .eq('user_id', user_id)
    .maybeSingle()

  if (!targetMembership) {
    return jsonResponse({ error: 'Target user is not a member of this team' }, 404)
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
    password: String(new_password),
  })
  if (updateError) return jsonResponse({ error: updateError.message }, 400)

  return jsonResponse({ success: true }, 200)
}

async function handleTeamJoin(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Not authenticated' }, 401)

  const { team_id } = await req.json()
  if (!team_id) return jsonResponse({ error: 'team_id is required' }, 400)

  const supabaseAdmin = getSupabaseAdmin()
  const supabaseUser = getSupabaseUser(authHeader)

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
  if (userError || !user) return jsonResponse({ error: 'Invalid authentication' }, 401)

  const { data: team, error: teamError } = await supabaseAdmin
    .from('teams')
    .select('id, name, auto_join_domain')
    .eq('id', team_id)
    .single()
  if (teamError || !team) return jsonResponse({ error: 'Team not found' }, 404)

  if (!team.auto_join_domain) {
    return jsonResponse({ error: 'This team does not allow domain-based auto-join' }, 403)
  }

  const userDomain = user.email?.split('@')[1]?.toLowerCase()
  const allowedDomain = String(team.auto_join_domain).toLowerCase()
  if (userDomain !== allowedDomain) {
    return jsonResponse({ error: `Your email domain (${userDomain}) does not match the required domain (${allowedDomain})` }, 403)
  }

  const { data: existing } = await supabaseAdmin
    .from('team_members')
    .select('id')
    .eq('team_id', team_id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing) return jsonResponse({ success: true, already_member: true }, 200)

  const { error: insertError } = await supabaseAdmin
    .from('team_members')
    .insert({
      team_id,
      user_id: user.id,
      role: 'viewer',
      status: 'active',
    })
  if (insertError) return jsonResponse({ error: 'Failed to join team' }, 500)

  return jsonResponse({ success: true, role: 'viewer' }, 200)
}

async function handleSendInvitation(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const { invitation_id } = await req.json()
  if (!invitation_id) return jsonResponse({ error: 'invitation_id is required' }, 400)

  const supabaseAdmin = getSupabaseAdmin()

  const { data: invitation, error: invError } = await supabaseAdmin
    .from('team_invitations')
    .select(`
      id, email, role, token, expires_at,
      team:teams(name, slug),
      inviter:profiles!invited_by(name, email)
    `)
    .eq('id', invitation_id)
    .single()

  if (invError || !invitation) return jsonResponse({ error: 'Invitation not found' }, 404)

  const team = invitation.team as { name: string; slug: string }
  const inviter = invitation.inviter as { name: string; email: string } | null
  const inviterName = inviter?.name ?? inviter?.email ?? 'A team admin'
  const acceptUrl = `${FRONTEND_URL}/auth/callback?invitation=${invitation.token}`

  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Gerbtrace <noreply@gerbtrace.com>',
      to: [invitation.email],
      subject: `You've been invited to join ${team.name} on Gerbtrace`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #111; margin-bottom: 8px;">Join ${team.name} on Gerbtrace</h2>
          <p style="color: #555; font-size: 15px; line-height: 1.6;">
            ${inviterName} has invited you to join <strong>${team.name}</strong> as a <strong>${invitation.role}</strong>.
          </p>
          <p style="color: #555; font-size: 15px; line-height: 1.6;">
            Gerbtrace is a collaborative Gerber file viewer and comparator for PCB teams.
          </p>
          <div style="margin: 32px 0;">
            <a href="${acceptUrl}" style="display: inline-block; background: #3B8EF0; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #999; font-size: 13px;">
            This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
          </p>
        </div>
      `,
    }),
  })

  if (!emailResponse.ok) return jsonResponse({ error: 'Failed to send email' }, 500)
  return jsonResponse({ success: true }, 200)
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const path = new URL(req.url).pathname
      .replace(/^\/+/, '')
      .replace(/^functions\/v1\//, '')
    const fn = path.split('/')[0]

    if (fn === 'admin-password-reset') return await handleAdminPasswordReset(req)
    if (fn === 'handle-team-join') return await handleTeamJoin(req)
    if (fn === 'send-invitation') return await handleSendInvitation(req)

    return jsonResponse({ error: `Function not found: ${fn}` }, 404)
  } catch (err) {
    console.error('main edge router error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
