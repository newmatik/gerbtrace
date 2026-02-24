import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') ?? 'https://gerbtrace.com'
const ELEXESS_URL = Deno.env.get('ELEXESS_URL') ?? 'https://api.dev.elexess.com/api'
const BLOCKED_SUPPLIERS = new Set(['Winsource', 'ChipCart', 'Unikeyic', 'CoreStaff'])
const MAX_BOM_LINES = 500
const MAX_PNP_COMPONENTS = 1000
const VALID_TYPES = ['SMD', 'THT', 'Mounting', 'Other'] as const
const VALID_SMD_CLASSES = ['Fast', 'Slow', 'Finepitch', 'BGA'] as const

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function stripBlockedSuppliers(data: any): any {
  if (data?.results && Array.isArray(data.results)) {
    data.results = data.results.filter(
      (r: any) => !BLOCKED_SUPPLIERS.has(r.supplier),
    )
  }
  return data
}

interface TeamAccess {
  userId: string
  teamId: string
  plan: string
}

async function verifyTeamAccess(req: Request, teamId: unknown): Promise<TeamAccess> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization header')
  }

  if (!teamId || typeof teamId !== 'string') {
    throw new Error('Missing teamId')
  }

  const token = authHeader.slice(7)
  const client = getSupabaseAdmin()
  const { data: { user }, error: authError } = await client.auth.getUser(token)
  if (authError || !user) throw new Error('Invalid token')

  const { data: membership, error: memError } = await client
    .from('team_members')
    .select('role, status')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (memError || !membership) throw new Error('Not a member of this team')

  const { data: team, error: teamError } = await client
    .from('teams')
    .select('plan')
    .eq('id', teamId)
    .single()
  if (teamError || !team) throw new Error('Team not found')

  return { userId: user.id, teamId, plan: team.plan }
}

interface SparkCredentials {
  apiKey: string
  model: string
}

async function resolveSparkCredentials(teamId: string): Promise<SparkCredentials> {
  const client = getSupabaseAdmin()
  const { data: team } = await client
    .from('teams')
    .select('ai_api_key, ai_model')
    .eq('id', teamId)
    .single()

  if (team?.ai_api_key) {
    return { apiKey: team.ai_api_key, model: team.ai_model || 'claude-sonnet-4-20250514' }
  }

  const { data: config } = await client
    .from('platform_config')
    .select('spark_api_key, spark_model')
    .limit(1)
    .single()

  if (!config?.spark_api_key) {
    throw new Error('Spark AI is not configured. Contact your administrator.')
  }

  return { apiKey: config.spark_api_key, model: config.spark_model || 'claude-sonnet-4-20250514' }
}

interface ElexessCredentials {
  username: string
  password: string
}

async function resolveElexessCredentials(teamId: string): Promise<ElexessCredentials> {
  const client = getSupabaseAdmin()
  const { data: team } = await client
    .from('teams')
    .select('elexess_username, elexess_password')
    .eq('id', teamId)
    .single()

  if (team?.elexess_username && team?.elexess_password) {
    return { username: team.elexess_username, password: team.elexess_password }
  }

  const { data: config } = await client
    .from('platform_config')
    .select('elexess_username, elexess_password')
    .limit(1)
    .single()

  if (!config?.elexess_username || !config?.elexess_password) {
    throw new Error('Elexess is not configured. Contact your administrator.')
  }

  return { username: config.elexess_username, password: config.elexess_password }
}

interface SanitizedManufacturer { manufacturer: string; manufacturerPart: string }
interface SanitizedSuggestion {
  description?: string
  type?: string
  pinCount?: number
  smdClassification?: string
  manufacturers?: SanitizedManufacturer[]
  group?: string
}
type SanitizedSuggestions = Record<string, SanitizedSuggestion>

function sanitizeSuggestions(raw: unknown): SanitizedSuggestions {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const dangerousKeys = new Set(['__proto__', 'prototype', 'constructor'])
  const result: SanitizedSuggestions = Object.create(null)

  for (const [lineId, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (dangerousKeys.has(lineId)) continue
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const src = entry as Record<string, unknown>
    const suggestion: SanitizedSuggestion = {}

    if (typeof src.description === 'string' && src.description.trim()) suggestion.description = src.description.trim()
    if (typeof src.type === 'string' && (VALID_TYPES as readonly string[]).includes(src.type)) suggestion.type = src.type
    if (typeof src.pinCount === 'number' && Number.isInteger(src.pinCount) && src.pinCount > 0) suggestion.pinCount = src.pinCount
    if (typeof src.smdClassification === 'string' && (VALID_SMD_CLASSES as readonly string[]).includes(src.smdClassification)) suggestion.smdClassification = src.smdClassification
    if (typeof src.group === 'string' && src.group.trim()) suggestion.group = src.group.trim()

    if (Array.isArray(src.manufacturers)) {
      const mfrs: SanitizedManufacturer[] = []
      for (const m of src.manufacturers) {
        if (m && typeof m === 'object' && typeof m.manufacturer === 'string' && typeof m.manufacturerPart === 'string') {
          const mfr = m.manufacturer.trim()
          const part = m.manufacturerPart.trim()
          if (mfr && part) mfrs.push({ manufacturer: mfr, manufacturerPart: part })
        }
      }
      if (mfrs.length > 0) suggestion.manufacturers = mfrs
    }

    if (Object.keys(suggestion).length > 0) result[lineId] = suggestion
  }

  return result
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
    return jsonResponse({ error: 'Failed to verify admin status' }, 500)
  }
  if (!callerMembership) {
    return jsonResponse({ error: 'Only team admins can reset member passwords' }, 403)
  }

  const { data: targetMembership, error: targetError } = await supabaseAdmin
    .from('team_members')
    .select('id')
    .eq('team_id', team_id)
    .eq('user_id', user_id)
    .maybeSingle()

  if (targetError) {
    console.error('admin-password-reset target lookup error:', targetError)
    return jsonResponse({ error: 'Failed to verify target membership' }, 500)
  }
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

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'Not authenticated' }, 401)

  const { invitation_id } = await req.json()
  if (!invitation_id) return jsonResponse({ error: 'invitation_id is required' }, 400)

  const supabaseAdmin = getSupabaseAdmin()
  const supabaseUser = getSupabaseUser(authHeader)

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
  if (userError || !user) return jsonResponse({ error: 'Invalid authentication' }, 401)

  const { data: invitation, error: invError } = await supabaseAdmin
    .from('team_invitations')
    .select(`
      id, team_id, email, role, token, expires_at,
      team:teams(name, slug),
      inviter:profiles!invited_by(name, email)
    `)
    .eq('id', invitation_id)
    .single()

  if (invError || !invitation) return jsonResponse({ error: 'Invitation not found' }, 404)

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('team_members')
    .select('id')
    .eq('team_id', (invitation as any).team_id)
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .eq('status', 'active')
    .maybeSingle()
  if (membershipError) {
    console.error('send-invitation membership lookup error:', membershipError)
    return jsonResponse({ error: 'Failed to verify admin status' }, 500)
  }
  if (!membership) return jsonResponse({ error: 'Only team admins can send invitations' }, 403)

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

async function handleElexessSearch(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const body = await req.json()
  const searchTerm = body?.searchTerm
  if (!searchTerm || typeof searchTerm !== 'string') {
    return jsonResponse({ error: 'Missing searchTerm' }, 400)
  }

  let access: TeamAccess
  try {
    access = await verifyTeamAccess(req, body?.teamId)
  } catch (err: any) {
    const message = err?.message ?? 'Not authorized'
    const status = message.includes('Missing authorization') || message.includes('Invalid token')
      ? 401
      : message.includes('Missing teamId')
        ? 400
        : message.includes('Not a member')
          ? 403
          : message.includes('Team not found')
            ? 404
            : 403
    return jsonResponse({ error: message }, status)
  }

  const client = getSupabaseAdmin()
  const { data: team } = await client
    .from('teams')
    .select('elexess_enabled')
    .eq('id', access.teamId)
    .single()
  if (team?.elexess_enabled === false) {
    return jsonResponse({ error: 'Elexess is disabled for this team' }, 403)
  }

  let credentials: ElexessCredentials
  try {
    credentials = await resolveElexessCredentials(access.teamId)
  } catch (err: any) {
    return jsonResponse({ error: err?.message ?? 'Missing Elexess credentials' }, 503)
  }

  const encoded = btoa(`${credentials.username}:${credentials.password}`)
  try {
    const url = `${ELEXESS_URL}/search?searchterm=${encodeURIComponent(searchTerm)}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${encoded}`,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      const status = response.status
      const mapped = status === 401 || status === 403 ? status : 502
      return jsonResponse({ error: mapped === 502 ? 'Elexess search failed' : 'Invalid Elexess credentials' }, mapped)
    }

    const payload = await response.json()
    return jsonResponse(stripBlockedSuppliers(payload), 200)
  } catch (err: any) {
    return jsonResponse({ error: err?.message ?? 'Elexess search failed' }, 502)
  }
}

async function handleAiValidateKey(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  const body = await req.json()
  const apiKey = body?.apiKey
  if (!apiKey || typeof apiKey !== 'string') return jsonResponse({ error: 'Missing apiKey' }, 400)

  try {
    const response = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    })
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) return jsonResponse({ valid: false, models: [], error: 'Invalid API key' }, 200)
      return jsonResponse({ valid: false, models: [], error: 'Connection failed' }, 200)
    }

    const data = await response.json()
    const allModels = data?.data ?? []
    const chatModels = allModels
      .filter((m: any) => {
        if (!/^claude-/i.test(m.id)) return false
        if (/embed|legacy/i.test(m.id)) return false
        if (/\d{8}$/.test(m.id)) return false
        return true
      })
      .map((m: any) => ({ id: m.id, name: m.display_name }))
      .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)))

    return jsonResponse({ valid: true, models: chatModels }, 200)
  } catch (err: any) {
    return jsonResponse({ valid: false, models: [], error: err?.message ?? 'Connection failed' }, 200)
  }
}

async function handleElexessValidateCredentials(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  const body = await req.json()
  const username = body?.username
  const password = body?.password
  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    return jsonResponse({ error: 'Missing username or password' }, 400)
  }

  const encoded = btoa(`${username}:${password}`)
  try {
    const response = await fetch(`${ELEXESS_URL}/search?searchterm=test`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${encoded}`,
        Accept: 'application/json',
      },
    })
    if (response.ok) return jsonResponse({ valid: true }, 200)
    if (response.status === 401 || response.status === 403) return jsonResponse({ valid: false, error: 'Invalid credentials' }, 200)
    return jsonResponse({ valid: false, error: 'Connection failed' }, 200)
  } catch (err: any) {
    return jsonResponse({ valid: false, error: err?.message ?? 'Connection failed' }, 200)
  }
}

async function handleAiEnrichBom(req: Request): Promise<Response> {
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)
  const body = await req.json()
  const { bomLines, smdPnpComponents, thtPnpComponents, existingGroups } = body ?? {}

  if (!Array.isArray(bomLines) || bomLines.length === 0) return jsonResponse({ error: 'Missing or empty bomLines' }, 400)
  if (bomLines.length > MAX_BOM_LINES) return jsonResponse({ error: `BOM exceeds ${MAX_BOM_LINES} line limit` }, 400)

  let access: TeamAccess
  try {
    access = await verifyTeamAccess(req, body?.teamId)
  } catch (err: any) {
    const message = err?.message ?? 'Not authorized'
    const status = message.includes('Missing authorization') || message.includes('Invalid token')
      ? 401
      : message.includes('Missing teamId')
        ? 400
        : message.includes('Not a member')
          ? 403
          : message.includes('Team not found')
            ? 404
            : 403
    return jsonResponse({ error: message }, status)
  }

  if (access.plan === 'free') return jsonResponse({ error: 'Spark AI requires a Pro plan or higher' }, 403)

  const client = getSupabaseAdmin()
  const { data: team } = await client
    .from('teams')
    .select('ai_enabled')
    .eq('id', access.teamId)
    .single()
  if (team?.ai_enabled === false) return jsonResponse({ error: 'Spark AI is disabled for this team' }, 403)

  let credentials: SparkCredentials
  try {
    credentials = await resolveSparkCredentials(access.teamId)
  } catch (err: any) {
    return jsonResponse({ error: err?.message ?? 'Spark AI is not configured' }, 503)
  }

  const systemPrompt = `You are Spark, an expert electronics manufacturing AI assistant specializing in BOM (Bill of Materials) enrichment for PCB assembly.

Your task is to analyze BOM lines and improve them. You receive BOM data along with SMD and THT Pick & Place component lists for cross-referencing.

For each BOM line, suggest improvements where applicable:

1. **Description**: Improve the description to be professional and standardized. Follow these naming conventions strictly:

   **MLCC / Ceramic Capacitors** — format: "Capacitor MLCC {value} {voltage} {dielectric} ±{tolerance} {package}"
   - "Capacitor MLCC 4.7µF 16V X5R ±10% 0603" instead of "Cap 4u7"
   - "Capacitor MLCC 100nF 50V X7R ±10% 0402" instead of "Cap 100n"
   - "Capacitor MLCC 10µF 25V X5R ±20% 0805" instead of "CAP 10UF"

   **Electrolytic Capacitors** — format: "Capacitor Electrolytic {value} {voltage} ±{tolerance} {dimensions/package}"
   - "Capacitor Electrolytic 100µF 25V ±20% 6.3x7.7mm" instead of "ECAP 100u"

   **Thick Film Resistors** — format: "Resistor Thick Film {value} {tolerance} {power} {TCR} {package}"
   - "Resistor Thick Film 27kΩ 1% 0.063W 100ppm 0402" instead of "RES 27K"
   - "Resistor Thick Film 10kΩ 1% 0.1W 100ppm 0603" instead of "R 10K 1%"
   - "Resistor Thick Film 0Ω (Jumper) 0.063W 0402" instead of "0R"

   **Thin Film Resistors** — format: "Resistor Thin Film {value} {tolerance} {power} {TCR} {package}"
   - "Resistor Thin Film 4.99kΩ 0.1% 0.1W 25ppm 0603"

   **ICs / Semiconductors** — format: "{Part Number} {brief function} {package}"
   - "STM32F407VGT6 ARM Cortex-M4 Microcontroller LQFP-100" instead of "MCU"
   - "LM1117-3.3 3.3V LDO Regulator SOT-223" instead of "REG 3V3"

   **Other components** — use a clear, descriptive format: "{Type} {key specs} {package}"
   - "LED Green 520nm 20mA 0603" instead of "LED GRN"
   - "Inductor 10µH 1.5A ±20% 4x4mm" instead of "IND 10u"

   Use µ (micro sign U+00B5) for micro, Ω (U+03A9) for ohm. Omit fields you cannot infer — never guess voltage, tolerance, TCR, or power ratings.

2. **Type**: Suggest SMD, THT, Mounting, or Other based on the component data and PnP cross-reference.

3. **Pin Count** (THT only): Suggest the pin count for through-hole components based on the package and description.

4. **SMD Classification** (SMD only): Classify SMD components into exactly one of:
   - "Fast" — chip packages like 0201, 0402, 0603, 0805, 1206, SOT-23, SOT-363, and similar small 2-6 terminal packages suitable for high-speed pick and place
   - "Slow" — larger packages (body >5mm on any side) like SO-8, SOIC-16, SSOP, TSSOP, QFP with standard pitch (≥0.5mm), connectors, electrolytic caps
   - "Finepitch" — packages with very fine pin pitch (<0.5mm) requiring microscope inspection, such as QFN with 0.4mm pitch, fine-pitch QFP, CSP
   - "BGA" — Ball Grid Array packages of any kind (BGA, µBGA, WLCSP, LGA with ball attach)

5. **Manufacturers** (standard passives): For resistors and capacitors, suggest manufacturers and manufacturer part numbers. This includes suggesting **alternative second-source options** when the line already has a manufacturer — the goal is to give users safe 1-to-1 drop-in replacements from different vendors.
   - If a line has NO manufacturers, suggest 2 options from different vendors.
   - If a line already HAS a manufacturer, suggest 1–2 ALTERNATIVE manufacturers (different vendor, same specs) as second sources.
   - Do NOT repeat a manufacturer+part that already exists on the line.
   Use well-known manufacturers:
   - Resistors: Yageo, Samsung Electro-Mechanics, Vishay, Panasonic, KOA Speer, TE Connectivity
   - Ceramic Capacitors: Samsung Electro-Mechanics, Murata, Yageo, TDK, Kemet
   - Electrolytic Capacitors: Panasonic, Nichicon, Murata, TDK
   Only suggest manufacturer part numbers you are confident are real, valid, currently-available part numbers. The part number must exactly match the component's value, tolerance, voltage rating, and package size. For example, if the line is "Capacitor MLCC 4.7µF 16V X5R ±10% 0603" with Samsung Electro-Mechanics CL10A475K08NNNC, suggest Murata GRM188R61C475KE15D as an alternative.

6. **Group**: Suggest a group name to organize the BOM. Use these standard group names consistently:
   - "Standard Resistors" — generic thick/thin film resistors (non-precision, non-specialty)
   - "Standard MLCC" — generic MLCC ceramic capacitors (non-precision, non-specialty)
   - "Electrolytic Capacitors" — electrolytic and tantalum capacitors
   - "ICs" — integrated circuits, microcontrollers, regulators, op-amps, etc.
   - "Connectors" — connectors, headers, sockets
   - "THT Components" — through-hole components that don't fit other groups
   - "LEDs & Indicators" — LEDs, displays, indicator components
   - "Inductors & Ferrites" — inductors, ferrite beads, transformers
   - "Diodes & Transistors" — discrete semiconductors
   - "Mechanical" — mounting hardware, heatsinks, spacers
   Use these exact names when applicable. Only create a new group name if a component truly doesn't fit any of the above categories.

IMPORTANT: Only include fields where you have a meaningful suggestion that differs from the existing data. Do not echo back the same values. If a description is already good, omit it. If you cannot determine a field, omit it entirely.
For manufacturers: DO include the manufacturers array even if the line already has manufacturers — suggest NEW alternative manufacturers only (do not repeat existing ones). The system will automatically deduplicate.

Respond with a JSON object where keys are the BOM line IDs and values are objects with optional fields: description, type, pinCount, smdClassification, manufacturers (array of {manufacturer, manufacturerPart}), group (string).

Only output the JSON object, nothing else.`

  const userPayload: Record<string, unknown> = {
    bomLines: bomLines.map((line: any) => ({
      id: line.id,
      description: line.description,
      type: line.type,
      package: line.package,
      references: line.references,
      quantity: line.quantity,
      comment: line.comment,
      manufacturers: line.manufacturers,
      extra: line.extra,
    })),
  }
  if (Array.isArray(existingGroups) && existingGroups.length > 0) {
    userPayload.existingGroups = existingGroups.map((g: any) => g?.name).filter(Boolean)
  }
  if (Array.isArray(smdPnpComponents) && smdPnpComponents.length > 0) {
    userPayload.smdPnpComponents = smdPnpComponents.slice(0, MAX_PNP_COMPONENTS).map((c: any) => ({
      designator: c.designator,
      value: c.value,
      package: c.package ?? c.cadPackage ?? c.matchedPackage,
      ...(c.description ? { description: c.description } : {}),
    }))
  }
  if (Array.isArray(thtPnpComponents) && thtPnpComponents.length > 0) {
    userPayload.thtPnpComponents = thtPnpComponents.slice(0, MAX_PNP_COMPONENTS).map((c: any) => ({
      designator: c.designator,
      value: c.value,
      package: c.package ?? c.cadPackage ?? c.matchedPackage,
      ...(c.description ? { description: c.description } : {}),
    }))
  }

  const userContent = `Analyze and enrich this BOM data:\n\n${JSON.stringify(userPayload)}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': credentials.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: credentials.model,
        max_tokens: 16384,
        temperature: 0,
        system: [{ type: 'text', text: systemPrompt }],
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    if (!response.ok) {
      const status = response.status
      const payload = await response.json().catch(() => ({}))
      const providerError = payload?.error?.message ?? payload?.message ?? null
      const mapped = status === 401 || status === 403 ? status : 502
      return jsonResponse(
        { error: mapped === 502 ? 'AI enrichment failed' : 'Spark AI configuration error', details: providerError },
        mapped,
      )
    }

    const payload = await response.json()
    const textBlock = payload?.content?.find((b: any) => b.type === 'text')
    if (!textBlock?.text) return jsonResponse({ error: 'No text response from AI' }, 502)

    const raw = textBlock.text.trim()
    const jsonStart = raw.indexOf('{')
    const jsonEnd = raw.lastIndexOf('}')
    if (jsonStart < 0 || jsonEnd <= jsonStart) return jsonResponse({ error: 'AI response is not valid JSON' }, 502)

    const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1))
    const suggestions = sanitizeSuggestions(parsed)
    return jsonResponse({ suggestions }, 200)
  } catch (err: any) {
    return jsonResponse({ error: err?.message ?? 'AI enrichment failed' }, 502)
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const segments = new URL(req.url).pathname
      .replace(/^\/+/, '')
      .replace(/^functions\/v1\//, '')
      .split('/')
      .filter(Boolean)
    const fn = segments[0] === 'main' ? segments[1] : segments[0]

    if (fn === 'admin-password-reset') return await handleAdminPasswordReset(req)
    if (fn === 'handle-team-join') return await handleTeamJoin(req)
    if (fn === 'send-invitation') return await handleSendInvitation(req)
    if (fn === 'elexess-search') return await handleElexessSearch(req)
    if (fn === 'ai-enrich-bom') return await handleAiEnrichBom(req)
    if (fn === 'ai-validate-key') return await handleAiValidateKey(req)
    if (fn === 'elexess-validate-credentials') return await handleElexessValidateCredentials(req)

    return jsonResponse({ error: `Function not found: ${fn}` }, 404)
  } catch (err) {
    console.error('main edge router error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
