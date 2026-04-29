'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getLocal } from '@/lib/safe-storage'
import LoadingDots from '@/components/ui/LoadingDots'

const LOCKER_MONTHLY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_LOCKER_MONTHLY_PRICE_ID || ''
const LOCKER_ANNUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_LOCKER_ANNUAL_PRICE_ID || ''
const PRIORITY_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRIORITY_PRICE_ID || ''

function Logo() {
  return (
    <svg width="52" height="8" viewBox="0 0 52 8" fill="none">
      <circle cx="4" cy="4" r="4" fill="white" />
      <line x1="8" y1="4" x2="20" y2="4" stroke="white" strokeWidth="1.5" />
      <circle cx="24" cy="4" r="4" fill="white" />
      <line x1="28" y1="4" x2="40" y2="4" stroke="white" strokeWidth="1.5" />
      <circle cx="44" cy="4" r="4" fill="white" />
    </svg>
  )
}

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  const checkout = async (priceId: string, tier: string, mode: 'subscription' | 'payment') => {
    const email = getLocal('ask_elijah_email') || ''
    if (!priceId) {
      setError('This plan is not wired to Stripe yet. Add the Stripe price ID in Vercel first.')
      return
    }
    if (!email) {
      window.location.href = `/sign-in?next=${encodeURIComponent('/pricing')}`
      return
    }

    setLoading(tier)
    setError('')
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, priceId, tier, mode }),
    })
    const data = await res.json().catch(() => null)
    if (data?.url) window.location.href = data.url
    else {
      setError(data?.error || 'Could not start checkout. Try again.')
      setLoading(null)
    }
  }

  return (
    <main className="min-h-[100dvh] bg-black px-5 py-5 text-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <Link href="/browse" className="text-sm text-gray-500 transition-colors hover:text-white">
          Browse answers
        </Link>
      </nav>

      <section className="mx-auto max-w-5xl py-16 sm:py-24">
        <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.28em] text-gray-600">
          Locker room access
        </p>
        <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight sm:text-7xl">
          Ask better questions.
          <span className="block text-gray-500">Get real reps.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-gray-500">
          Read public answers for free. Join the locker room when you want Elijah to answer your situation.
        </p>
      </section>

      {error && (
        <p className="mx-auto mb-6 max-w-5xl rounded-2xl border border-red-900/60 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <section className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-3">
        <div className="rounded-[2rem] border border-gray-900 bg-[#050505] p-7">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-600">Free</p>
          <p className="mt-5 text-4xl font-black">$0</p>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">Read public answers. See what other players are working through.</p>
          <Link href="/browse" className="mt-8 block rounded-full border border-gray-800 px-5 py-4 text-center text-sm font-bold text-white hover:border-white">
            Browse free answers
          </Link>
        </div>

        <div className="rounded-[2rem] border border-white bg-[#F7F5F0] p-7 text-black shadow-[0_0_80px_rgba(255,255,255,0.12)]">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-gray-500">Locker Room</p>
          <p className="mt-5 text-4xl font-black">$14.99<span className="text-base text-gray-500">/mo</span></p>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">Ask up to 5 questions a month. Full archive. Every answer Elijah-reviewed.</p>
          <button
            onClick={() => checkout(LOCKER_MONTHLY_PRICE_ID, 'locker_room', 'subscription')}
            disabled={loading !== null}
            className="mt-8 block w-full rounded-full bg-black px-5 py-4 text-center text-sm font-bold text-white hover:opacity-80 disabled:opacity-50"
          >
            {loading === 'locker_room' ? <LoadingDots label="Opening checkout" /> : 'Join monthly'}
          </button>
          <button
            onClick={() => checkout(LOCKER_ANNUAL_PRICE_ID, 'locker_room_annual', 'subscription')}
            disabled={loading !== null}
            className="mt-3 block w-full rounded-full border border-black/20 px-5 py-4 text-center text-sm font-bold text-black hover:border-black disabled:opacity-50"
          >
            {loading === 'locker_room_annual' ? <LoadingDots label="Opening checkout" /> : 'Or $129/year'}
          </button>
        </div>

        <div className="rounded-[2rem] border border-gray-900 bg-[#050505] p-7">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-gray-600">Priority</p>
          <p className="mt-5 text-4xl font-black">$29</p>
          <p className="mt-3 text-sm leading-relaxed text-gray-500">Need the answer fast. Skip the line and get a 24 hour turnaround.</p>
          <button
            onClick={() => checkout(PRIORITY_PRICE_ID, 'priority', 'payment')}
            disabled={loading !== null}
            className="mt-8 block w-full rounded-full border border-gray-800 px-5 py-4 text-center text-sm font-bold text-white hover:border-white disabled:opacity-50"
          >
            {loading === 'priority' ? <LoadingDots label="Opening checkout" /> : 'Skip the line'}
          </button>
        </div>
      </section>
    </main>
  )
}
