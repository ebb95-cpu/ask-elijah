import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabase } from '@/lib/supabase-server'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key, { apiVersion: '2026-03-25.dahlia' })
}

const PLANS = {
  locker_monthly: {
    tier: 'locker_room',
    mode: 'subscription' as const,
    name: 'Ask Elijah Locker Room',
    description: 'Ask up to 5 questions a month. Every answer Elijah-reviewed.',
    amount: 1499,
    recurring: { interval: 'month' as const },
  },
  locker_annual: {
    tier: 'locker_room_annual',
    mode: 'subscription' as const,
    name: 'Ask Elijah Locker Room Annual',
    description: 'A full year in the locker room.',
    amount: 12900,
    recurring: { interval: 'year' as const },
  },
  priority: {
    tier: 'priority',
    mode: 'payment' as const,
    name: 'Ask Elijah Priority Answer',
    description: 'Skip the line for one question.',
    amount: 2900,
  },
}

type PlanKey = keyof typeof PLANS

export async function POST(req: NextRequest) {
  try {
    const { email, priceId, isFoundingMember, tier, mode: rawMode, plan: rawPlan } = await req.json()
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe is not configured yet.' }, { status: 503 })
    }

    const stripe = getStripe()
    const planKey = typeof rawPlan === 'string' && rawPlan in PLANS ? rawPlan as PlanKey : null
    const plan = planKey ? PLANS[planKey] : null
    const mode: 'subscription' | 'payment' = plan?.mode || (rawMode === 'payment' ? 'payment' : 'subscription')
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    if (!plan && !priceId) {
      return NextResponse.json({ error: 'Plan required' }, { status: 400 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elijahbryant.pro'

    // Check if customer already exists in Stripe
    const supabase = getSupabase()
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('email', normalizedEmail)
      .single()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: normalizedEmail,
        metadata: { is_founding_member: isFoundingMember ? 'true' : 'false' },
      })
      customerId = customer.id

      await supabase
        .from('profiles')
        .upsert({
          email: normalizedEmail,
          stripe_customer_id: customerId,
        }, { onConflict: 'email' })
    }

    const metadata = {
      email: normalizedEmail,
      tier: tier || plan?.tier || (mode === 'payment' ? 'priority' : 'locker_room'),
      plan: planKey || '',
      is_founding_member: isFoundingMember ? 'true' : 'false',
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode,
      automatic_tax: { enabled: true },
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      line_items: [{
        ...(plan
          ? {
              price_data: {
                currency: 'usd',
                unit_amount: plan.amount,
                tax_behavior: 'exclusive',
                recurring: 'recurring' in plan ? plan.recurring : undefined,
                product_data: {
                  name: plan.name,
                  description: plan.description,
                },
              },
            }
          : { price: priceId }),
        quantity: 1,
      }],
      success_url: `${siteUrl}/track?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/pricing`,
      metadata,
      subscription_data: mode === 'subscription' ? {
        metadata,
      } : undefined,
      payment_intent_data: mode === 'payment' ? { metadata } : undefined,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
