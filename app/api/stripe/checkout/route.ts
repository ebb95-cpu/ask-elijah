import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabase } from '@/lib/supabase-server'
import { normalizePromoCode, validateTrialPromoCode } from '@/lib/promo-codes'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  return new Stripe(key, { apiVersion: '2026-03-25.dahlia' })
}

const PLANS = {
  founders_monthly: {
    tier: 'founders',
    mode: 'subscription' as const,
    name: 'Ask Elijah Founders 200',
    description: 'Founders 200 lifetime-rate access while active.',
    amount: 999,
    recurring: { interval: 'month' as const },
    foundersOnly: true,
  },
  locker_monthly: {
    tier: 'locker_room',
    mode: 'subscription' as const,
    name: 'Ask Elijah Locker Room',
    description: 'Locker Room access. Reviewed answers from Elijah.',
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
}

type PlanKey = keyof typeof PLANS

async function isApprovedFounder(email: string) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('waitlist')
    .select('id')
    .eq('email', email)
    .eq('approved', true)
    .is('archived_at', null)
    .maybeSingle()

  if (error && /archived_at/.test(error.message || '')) {
    const fallback = await supabase
      .from('waitlist')
      .select('id')
      .eq('email', email)
      .eq('approved', true)
      .maybeSingle()
    return Boolean(fallback.data)
  }

  return Boolean(data)
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
    const foundersOnly = Boolean(plan && 'foundersOnly' in plan && plan.foundersOnly)
    const mode: 'subscription' | 'payment' = plan?.mode || (rawMode === 'payment' ? 'payment' : 'subscription')
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const promoCode = normalizePromoCode(rawPromoCode)
    const promoValidation = promoCode && mode === 'subscription'
      ? await validateTrialPromoCode(promoCode)
      : null
    const trialPromo = promoValidation?.ok === true
    const trialDays = trialPromo ? promoValidation.trialDays : 0

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    if (promoCode && !trialPromo) {
      return NextResponse.json({ error: promoValidation?.ok === false ? promoValidation.error : 'That promo code only works on monthly access.' }, { status: 400 })
    }

    if (!plan && !priceId) {
      return NextResponse.json({ error: 'Plan required' }, { status: 400 })
    }

    if (foundersOnly && !(await isApprovedFounder(normalizedEmail))) {
      return NextResponse.json({ error: 'This checkout is only for accepted Founders.' }, { status: 403 })
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
        metadata: { is_founding_member: foundersOnly || isFoundingMember ? 'true' : 'false' },
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
      tier: tier || plan?.tier || 'locker_room',
      plan: planKey || '',
      is_founding_member: foundersOnly || isFoundingMember ? 'true' : 'false',
      trial_source: trialPromo ? 'promo_code' : '',
      trial_promo_code: trialPromo ? promoCode : '',
      trial_days: trialPromo ? String(trialDays) : '',
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
        trial_period_days: trialPromo ? trialDays : undefined,
      } : undefined,
      payment_intent_data: mode === 'payment' ? { metadata } : undefined,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
