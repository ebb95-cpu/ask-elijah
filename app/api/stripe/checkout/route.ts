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
  inner_circle_monthly: {
    tier: 'inner_circle',
    mode: 'subscription' as const,
    name: 'Ask Elijah Inner Circle',
    description: 'Priority routing, deeper answer mode, and profile-aware answers.',
    amount: 2900,
    recurring: { interval: 'month' as const },
  },
  inner_circle_annual: {
    tier: 'inner_circle_annual',
    mode: 'subscription' as const,
    name: 'Ask Elijah Inner Circle Annual',
    description: 'A full year in the Inner Circle.',
    amount: 29000,
    recurring: { interval: 'year' as const },
  },
  gift_card_annual: {
    tier: 'gift_card_annual',
    mode: 'payment' as const,
    name: 'Ask Elijah Gift Year',
    description: 'One year of Locker Room access as a giftable code.',
    amount: 14900,
  },
}

type PlanKey = keyof typeof PLANS
const DEFAULT_TRIAL_PROMO_CODES = ['ELIJAH30']

function normalizePromoCode(input: unknown) {
  return typeof input === 'string' ? input.trim().toUpperCase().replace(/\s+/g, '') : ''
}

function trialPromoCodes() {
  const configured = process.env.TRIAL_PROMO_CODES
    ?.split(',')
    .map((code) => normalizePromoCode(code))
    .filter(Boolean)

  return configured && configured.length > 0 ? configured : DEFAULT_TRIAL_PROMO_CODES
}

export async function POST(req: NextRequest) {
  try {
    const { email, priceId, isFoundingMember, tier, mode: rawMode, plan: rawPlan, promoCode: rawPromoCode } = await req.json()
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe is not configured yet.' }, { status: 503 })
    }

    const stripe = getStripe()
    const planKey = typeof rawPlan === 'string' && rawPlan in PLANS ? rawPlan as PlanKey : null
    const plan = planKey ? PLANS[planKey] : null
    const mode: 'subscription' | 'payment' = plan?.mode || (rawMode === 'payment' ? 'payment' : 'subscription')
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const promoCode = normalizePromoCode(rawPromoCode)
    const trialPromo = promoCode && mode === 'subscription' && trialPromoCodes().includes(promoCode)

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    if (promoCode && !trialPromo) {
      return NextResponse.json({ error: 'That promo code is not active.' }, { status: 400 })
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
      trial_source: trialPromo ? 'promo_code' : '',
      trial_promo_code: trialPromo ? promoCode : '',
      trial_days: trialPromo ? '30' : '',
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode,
      automatic_tax: { enabled: true },
      allow_promotion_codes: mode === 'subscription',
      billing_address_collection: 'auto',
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      payment_method_collection: trialPromo ? 'always' : undefined,
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
        trial_period_days: trialPromo ? 30 : undefined,
      } : undefined,
      payment_intent_data: mode === 'payment' ? { metadata } : undefined,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
