import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiVersion: '2026-03-25.dahlia' as any,
})

export const PLANS = {
  solo: {
    name: 'Solo',
    price: 29,
    priceId: process.env.STRIPE_SOLO_PRICE_ID || '',
  },
  voice: {
    name: 'Voice Review',
    price: 25,
    priceId: process.env.STRIPE_VOICE_PRICE_ID || '',
  },
  video: {
    name: 'Video Review',
    price: 50,
    priceId: process.env.STRIPE_VIDEO_PRICE_ID || '',
  },
}
