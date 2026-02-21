import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
const STRIPE_PRICE_ID_PRO = Deno.env.get('STRIPE_PRICE_ID_PRO') ?? ''
const STRIPE_PRICE_ID_TEAM = Deno.env.get('STRIPE_PRICE_ID_TEAM') ?? ''

function priceToplan(priceId: string): 'pro' | 'team' | null {
  if (priceId === STRIPE_PRICE_ID_PRO) return 'pro'
  if (priceId === STRIPE_PRICE_ID_TEAM) return 'team'
  return null
}

async function stripeGet(path: string): Promise<any> {
  const resp = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
  })
  return resp.json()
}

/**
 * Minimal Stripe webhook signature verification.
 * Stripe signs webhooks with HMAC-SHA256 using the webhook secret.
 */
async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const parts = signature.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=')
    if (k && v) acc[k] = v
    return acc
  }, {} as Record<string, string>)

  const timestamp = parts['t']
  const sig = parts['v1']
  if (!timestamp || !sig) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`))
  const expected = Array.from(new Uint8Array(signed)).map(b => b.toString(16).padStart(2, '0')).join('')
  return expected === sig
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''

  if (STRIPE_WEBHOOK_SECRET) {
    const valid = await verifySignature(body, signature, STRIPE_WEBHOOK_SECRET)
    if (!valid) {
      console.error('Invalid Stripe webhook signature')
      return new Response('Invalid signature', { status: 400 })
    }
  }

  const event = JSON.parse(body)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const teamId = session.metadata?.team_id
        const customerId = session.customer
        if (!teamId || !customerId) break

        // Fetch the subscription to get the price ID
        const subscription = session.subscription
          ? await stripeGet(`/subscriptions/${session.subscription}`)
          : null

        if (subscription) {
          const priceId = subscription.items?.data?.[0]?.price?.id ?? ''
          const plan = priceToplan(priceId)

          if (plan) {
            await supabase.from('teams').update({ plan }).eq('id', teamId)
          }

          // Upsert subscription record
          await supabase.from('subscriptions').upsert({
            team_id: teamId,
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            price_id: priceId,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end ?? false,
          }, { onConflict: 'stripe_subscription_id' })
        }

        // Sync billing info from customer
        const customer = await stripeGet(`/customers/${customerId}`)
        if (customer && !customer.deleted) {
          await syncBillingInfo(supabase, teamId, customer)
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const priceId = sub.items?.data?.[0]?.price?.id ?? ''
        const plan = priceToplan(priceId)

        // Find team by Stripe subscription
        const { data: existing } = await supabase
          .from('subscriptions')
          .select('team_id')
          .eq('stripe_subscription_id', sub.id)
          .single()

        if (existing) {
          if (plan) {
            await supabase.from('teams').update({ plan }).eq('id', existing.team_id)
          }

          await supabase.from('subscriptions').update({
            status: sub.status,
            price_id: priceId,
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end ?? false,
          }).eq('stripe_subscription_id', sub.id)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const { data: existing } = await supabase
          .from('subscriptions')
          .select('team_id')
          .eq('stripe_subscription_id', sub.id)
          .single()

        if (existing) {
          await supabase.from('teams').update({ plan: 'free' }).eq('id', existing.team_id)
          await supabase.from('subscriptions').update({ status: 'canceled' }).eq('stripe_subscription_id', sub.id)
        }
        break
      }

      case 'customer.updated': {
        const customer = event.data.object
        // Find team by stripe_customer_id
        const { data: team } = await supabase
          .from('teams')
          .select('id')
          .eq('stripe_customer_id', customer.id)
          .single()

        if (team) {
          await syncBillingInfo(supabase, team.id, customer)
        }
        break
      }

      case 'customer.tax_id.created':
      case 'customer.tax_id.updated':
      case 'customer.tax_id.deleted': {
        const taxId = event.data.object
        const customerId = taxId.customer
        if (!customerId) break

        const { data: team } = await supabase
          .from('teams')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (team) {
          const customer = await stripeGet(`/customers/${customerId}`)
          if (customer && !customer.deleted) {
            await syncBillingInfo(supabase, team.id, customer)
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subId = invoice.subscription
        if (subId) {
          await supabase.from('subscriptions').update({ status: 'past_due' }).eq('stripe_subscription_id', subId)
        }
        break
      }
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err)
  }

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
})

async function syncBillingInfo(supabase: any, teamId: string, customer: any) {
  const vatTaxId = customer.tax_ids?.data?.find((t: any) => t.type === 'eu_vat')
  const updates: Record<string, any> = {
    billing_name: customer.name ?? null,
    billing_email: customer.email ?? null,
    billing_address: customer.address ?? null,
    billing_tax_exempt: customer.tax_exempt ?? 'none',
    billing_vat_id: vatTaxId
      ? `${vatTaxId.value}${vatTaxId.verification?.status === 'verified' ? '' : ' (pending)'}`
      : null,
  }
  await supabase.from('teams').update(updates).eq('id', teamId)
}
