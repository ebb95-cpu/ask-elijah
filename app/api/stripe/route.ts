import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

function getStripe() {
  // Lazy init so build doesn't fail without STRIPE_SECRET_KEY
  return new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: '2026-03-25.dahlia' as any,
  })
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  try {
    const { type, successUrl, cancelUrl } = await req.json()

    const priceMap: Record<string, number> = {
      voice: 2500,
      video: 5000,
    }

    if (!priceMap[type]) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: priceMap[type],
          product_data: {
            name: type === 'voice' ? 'Voice Review by Elijah Bryant' : 'Film Review by Elijah Bryant',
            description: type === 'voice'
              ? 'Record a voice note. Elijah personally responds within 48 hours.'
              : 'Upload your film. Elijah breaks it down with timestamps within 48 hours.',
          },
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: successUrl || `${req.nextUrl.origin}/ask-directly?success=true`,
      cancel_url: cancelUrl || `${req.nextUrl.origin}/ask-directly`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe error:', err)
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 })
  }
}
