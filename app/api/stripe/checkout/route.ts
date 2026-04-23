import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabase } from '@/lib/supabase-server'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-03-25.dahlia' })
}

export async function POST(req: NextRequest) {
  try {
    const { email, priceId, isFoundingMember } = await req.json()
    const stripe = getStripe()

    if (!email || !priceId) {
      return NextResponse.json({ error: 'Email and priceId required' }, { status: 400 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elijahbryant.pro'

    // Check if customer already exists in Stripe
    const supabase = getSupabase()
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('email', email.toLowerCase())
      .single()

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { is_founding_member: isFoundingMember ? 'true' : 'false' },
      })
      customerId = customer.id
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/ask?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/ask`,
      metadata: {
        email,
        is_founding_member: isFoundingMember ? 'true' : 'false',
      },
      subscription_data: {
        metadata: {
          email,
          is_founding_member: isFoundingMember ? 'true' : 'false',
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
