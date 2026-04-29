import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabase } from '@/lib/supabase-server'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })
}

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
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

        await supabase
          .from('profiles')
          .upsert({
            email,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: session.mode === 'payment' ? 'priority_paid' : 'active',
            subscription_tier: tier,
            priority_credits: session.mode === 'payment' ? 1 : 0,
            is_founding_member: isFoundingMember,
            subscription_started_at: new Date().toISOString(),
          }, { onConflict: 'email' })

        console.log(`Subscription activated for ${email} (founding: ${isFoundingMember})`)
        break
      }

      case 'customer.subscription.deleted':
      case 'customer.subscription.paused': {
        const subscription = event.data.object as Stripe.Subscription
        const email = subscription.metadata?.email?.toLowerCase()

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
        const email = subscription.metadata?.email?.toLowerCase()

        if (!email) break

        await supabase
          .from('profiles')
          .update({ subscription_status: 'active' })
          .eq('email', email)

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice as unknown as { subscription?: string }).subscription ?? null
        if (!subscriptionId) break

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const email = subscription.metadata?.email?.toLowerCase()
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
