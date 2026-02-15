// Supabase Edge Function: send-invitation
// Sends an invitation email when a team admin invites a new member.
//
// Called from the frontend after inserting a team_invitations row.
// Expects: { invitation_id: string }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') ?? 'https://gerbtrace.com'

interface InvitationPayload {
  invitation_id: string
}

serve(async (req: Request) => {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { invitation_id } = (await req.json()) as InvitationPayload

    if (!invitation_id) {
      return new Response(JSON.stringify({ error: 'invitation_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Create Supabase client with service role key for full access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Fetch the invitation with team details
    const { data: invitation, error: invError } = await supabase
      .from('team_invitations')
      .select(`
        id, email, role, token, expires_at,
        team:teams(name, slug),
        inviter:profiles!invited_by(name, email)
      `)
      .eq('id', invitation_id)
      .single()

    if (invError || !invitation) {
      return new Response(JSON.stringify({ error: 'Invitation not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const team = invitation.team as { name: string; slug: string }
    const inviter = invitation.inviter as { name: string; email: string } | null
    const inviterName = inviter?.name ?? inviter?.email ?? 'A team admin'

    // Build the invitation accept URL
    const acceptUrl = `${FRONTEND_URL}/auth/callback?invitation=${invitation.token}`

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
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

    if (!emailResponse.ok) {
      const errorBody = await emailResponse.text()
      console.error('Resend API error:', errorBody)
      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-invitation error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
