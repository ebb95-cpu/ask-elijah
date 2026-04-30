import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabase } from '@/lib/supabase-server'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key, { apiVersion: '2026-03-25.dahlia' })
}

export const dynamic = 'force-dynamic'

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
        const tier = session.metadata?.tier || (session.mode === 'payment' ? 'priority' : 'locker_room')
        const isFoundingMember = session.metadata?.is_founding_member === 'true'
        const customerId = session.customer as string
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null

        if (!email) break

        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('priority_credits')
          .eq('email', email)
          .maybeSingle()

        await supabase
          .from('profiles')
          .upsert({
            email,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: session.mode === 'payment' ? 'priority_paid' : 'active',
            subscription_tier: tier,
            priority_credits: session.mode === 'payment'
              ? (Number(existingProfile?.priority_credits) || 0) + 1
              : (Number(existingProfile?.priority_credits) || 0),
            is_founding_member: isFoundingMember,
            subscription_started_at: new Date().toISOString(),
          }, { onConflict: 'email' })

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

        await supabase
          .from('profiles')
          .update({ subscription_status: 'cancelled' })
          .eq('email', email)

        console.log(`Subscription cancelled for ${email}`)
        break
      }

      case 'customer.subscription.resumed':
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

        await supabase
          .from('profiles')
          .update({
            subscription_status: 'active',
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
          })
          .eq('email', email)

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

        await supabase
          .from('profiles')
          .update({ subscription_status: 'past_due' })
          .eq('email', email)

        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
  }

  return NextResponse.json({ received: true })
}
