import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabase } from '@/lib/supabase-server'
import { recordPromoRedemption } from '@/lib/promo-codes'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key, { apiVersion: '2026-03-25.dahlia' })
}

export const dynamic = 'force-dynamic'

function mapSubscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === 'trialing') return 'trialing'
  if (status === 'active') return 'active'
  if (status === 'past_due') return 'past_due'
  if (status === 'canceled') return 'cancelled'
  if (status === 'paused') return 'cancelled'
  return status
}

function stripeTimestampToIso(value?: number | null) {
  return value ? new Date(value * 1000).toISOString() : null
}

function addDaysIso(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

async function updateProfileBilling(
  supabase: ReturnType<typeof getSupabase>,
  email: string,
  update: Record<string, unknown>,
) {
  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('email', email)

  if (error && /first_charge_at|guarantee_ends_at|payment_failed_at|payment_grace_ends_at|cancelled_at|last_refund_at/.test(error.message || '')) {
    const fallback = { ...update }
    delete fallback.first_charge_at
    delete fallback.guarantee_ends_at
    delete fallback.payment_failed_at
    delete fallback.payment_grace_ends_at
    delete fallback.cancelled_at
    delete fallback.last_refund_at
    await supabase.from('profiles').update(fallback).eq('email', email)
  }
}

async function findProfileEmail(params: {
  supabase: ReturnType<typeof getSupabase>
  subscriptionId?: string | null
  customerId?: string | null
  metadataEmail?: string | null
}) {
  const metadataEmail = params.metadataEmail?.toLowerCase()
  if (metadataEmail) return metadataEmail

  if (params.subscriptionId) {
    const { data } = await params.supabase
      .from('profiles')
      .select('email')
      .eq('stripe_subscription_id', params.subscriptionId)
      .maybeSingle()
    if (data?.email) return data.email.toLowerCase()
  }

  if (params.customerId) {
    const { data } = await params.supabase
      .from('profiles')
      .select('email')
      .eq('stripe_customer_id', params.customerId)
      .maybeSingle()
    if (data?.email) return data.email.toLowerCase()
  }

  return null
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe webhook not configured' }, { status: 503 })
  }
  if (!sig) {
    return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })
  }
  const stripe = getStripe()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    const supabase = getSupabase()
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const email = session.metadata?.email?.toLowerCase()
        const tier = session.metadata?.tier || 'locker_room'
        const isFoundingMember = session.metadata?.is_founding_member === 'true'
        const trialPromoCode = session.metadata?.trial_promo_code || null
        const trialSource = session.metadata?.trial_source || null
        const customerId = session.customer as string
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null
        const subscription = subscriptionId ? await stripe.subscriptions.retrieve(subscriptionId) : null
        const subscriptionStatus = subscription ? mapSubscriptionStatus(subscription.status) : 'active'
        const trialEndsAt = stripeTimestampToIso(subscription?.trial_end)

        if (!email) break

        const nowIso = new Date().toISOString()
        const hasTrial = subscriptionStatus === 'trialing' && Boolean(trialEndsAt)
        const upsert = await supabase
          .from('profiles')
          .upsert({
            email,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: subscriptionStatus,
            subscription_tier: tier,
            is_founding_member: isFoundingMember,
            subscription_started_at: nowIso,
            trial_started_at: hasTrial ? nowIso : null,
            trial_ends_at: trialEndsAt,
            trial_source: trialSource || null,
            trial_promo_code: trialPromoCode,
            first_charge_at: !hasTrial ? nowIso : null,
            guarantee_ends_at: !hasTrial ? addDaysIso(30) : null,
          }, { onConflict: 'email' })

        if (upsert.error && /first_charge_at|guarantee_ends_at/.test(upsert.error.message || '')) {
          await supabase
            .from('profiles')
            .upsert({
              email,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              subscription_status: subscriptionStatus,
              subscription_tier: tier,
              is_founding_member: isFoundingMember,
              subscription_started_at: nowIso,
              trial_started_at: hasTrial ? nowIso : null,
              trial_ends_at: trialEndsAt,
              trial_source: trialSource || null,
              trial_promo_code: trialPromoCode,
            }, { onConflict: 'email' })
        }

        if (trialPromoCode) {
          await recordPromoRedemption({
            code: trialPromoCode,
            email,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          }).catch((err) => console.error('Promo redemption log failed:', err))
        }

        console.log(`Subscription activated for ${email} (founding: ${isFoundingMember})`)
        break
      }

      case 'customer.subscription.deleted':
      case 'customer.subscription.paused': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
        const email = await findProfileEmail({
          supabase,
          subscriptionId: subscription.id,
          customerId,
          metadataEmail: subscription.metadata?.email,
        })

        if (!email) break

        await updateProfileBilling(supabase, email, {
          subscription_status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })

        console.log(`Subscription cancelled for ${email}`)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.resumed':
      case 'customer.subscription.updated':
      case 'invoice.payment_succeeded': {
        const obj = event.data.object as Stripe.Invoice | Stripe.Subscription
        const subscriptionId = obj.object === 'subscription'
          ? (obj as Stripe.Subscription).id
          : ((obj as unknown as { subscription?: string }).subscription ?? null)

        if (!subscriptionId) break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
        const email = await findProfileEmail({
          supabase,
          subscriptionId,
          customerId,
          metadataEmail: subscription.metadata?.email,
        })

        if (!email) break

        const status = mapSubscriptionStatus(subscription.status)
        const nowIso = new Date().toISOString()
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('first_charge_at')
          .eq('email', email)
          .maybeSingle()
        const isPaidNow = status === 'active' && (!subscription.trial_end || subscription.trial_end * 1000 <= Date.now())
        const firstChargePatch = isPaidNow && !currentProfile?.first_charge_at
          ? { first_charge_at: nowIso, guarantee_ends_at: addDaysIso(30) }
          : {}

        await updateProfileBilling(supabase, email, {
            subscription_status: status,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            trial_ends_at: stripeTimestampToIso(subscription.trial_end),
            payment_failed_at: null,
            payment_grace_ends_at: null,
            ...firstChargePatch,
          })

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice as unknown as { subscription?: string }).subscription ?? null
        if (!subscriptionId) break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
        const email = await findProfileEmail({
          supabase,
          subscriptionId,
          customerId,
          metadataEmail: subscription.metadata?.email,
        })
        if (!email) break

        await updateProfileBilling(supabase, email, {
          subscription_status: 'past_due',
          payment_failed_at: new Date().toISOString(),
          payment_grace_ends_at: addDaysIso(7),
        })

        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id
        const email = await findProfileEmail({
          supabase,
          customerId: customerId || null,
          metadataEmail: charge.metadata?.email,
        })
        if (!email) break

        await updateProfileBilling(supabase, email, {
          last_refund_at: new Date().toISOString(),
        })

        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
  }

  return NextResponse.json({ received: true })
}
