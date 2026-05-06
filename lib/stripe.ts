import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiVersion: '2026-03-25.dahlia' as any,
})

export const PLANS = {
  founders: {
    name: 'Founders 200',
    price: 9.99,
    priceId: process.env.STRIPE_FOUNDERS_PRICE_ID || '',
  },
  lockerMonthly: {
    name: 'Locker Room Monthly',
    price: 14.99,
    priceId: process.env.STRIPE_LOCKER_MONTHLY_PRICE_ID || '',
  },
  lockerAnnual: {
    name: 'Locker Room Annual',
    price: 129,
    priceId: process.env.STRIPE_LOCKER_ANNUAL_PRICE_ID || '',
  },
}
