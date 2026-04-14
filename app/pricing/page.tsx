'use client'

import Link from 'next/link'
import { useState } from 'react'

function Logo({ dark = false }: { dark?: boolean }) {
  const c = dark ? '#fff' : '#000'
  return (
    <svg width="52" height="8" viewBox="0 0 52 8" fill="none">
      <circle cx="4" cy="4" r="4" fill={c} />
      <line x1="8" y1="4" x2="20" y2="4" stroke={c} strokeWidth="1.5" />
      <circle cx="24" cy="4" r="4" fill={c} />
      <line x1="28" y1="4" x2="40" y2="4" stroke={c} strokeWidth="1.5" />
      <circle cx="44" cy="4" r="4" fill={c} />
    </svg>
  )
}

const VALUE_STACK = [
  { label: 'Sports psychologist (1 session)', value: '$150' },
  { label: 'Private mental skills coach (1 session)', value: '$100' },
  { label: 'Elite training camp — mental component', value: '$300' },
  { label: 'IMG Academy mental performance coaching', value: '$200' },
  { label: 'College recruiting consultant', value: '$200' },
]

const TOTAL_RETAIL = '$950/mo'

export default function PricingPage() {
  const [checkoutLoading, setCheckoutLoading] = useState<'founding' | 'regular' | null>(null)
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [showEmailFor, setShowEmailFor] = useState<'founding' | 'regular' | null>(null)

  const handleCheckout = async (tier: 'founding' | 'regular') => {
    if (!email.trim() || !email.includes('@')) {
      setEmailError('Enter a valid email to continue.')
      return
    }
    setEmailError('')
    const priceId = tier === 'founding'
      ? process.env.NEXT_PUBLIC_STRIPE_FOUNDING_PRICE_ID
      : process.env.NEXT_PUBLIC_STRIPE_REGULAR_PRICE_ID
    if (!priceId) return
    setCheckoutLoading(tier)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), priceId, isFoundingMember: tier === 'founding' }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { /* fail silently */ }
    setCheckoutLoading(null)
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <nav className="flex items-center justify-between px-6 py-5">
        <Link href="/"><Logo dark /></Link>
        <Link href="/ask" className="text-sm text-gray-400 hover:text-white transition-colors">
          Try free →
        </Link>
      </nav>

      <main className="flex-1 px-6 py-16 max-w-2xl mx-auto w-full">

        {/* Header */}
        <div className="mb-16">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-5">Ask Elijah</p>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight mb-6">
            Most players never ask for help.<br />
            <span className="text-gray-400">This is for the ones who do.</span>
          </h1>
          <p className="text-gray-500 text-base leading-relaxed max-w-lg">
            One hour with a mental performance coach runs $150–$300. One answer from Elijah that actually sticks could change how you train for the next six months.
          </p>
        </div>

        {/* Value stack — what it would cost elsewhere */}
        <div className="mb-4">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-6">What this costs everywhere else</p>
          <div className="border border-gray-800 divide-y divide-gray-900">
            {VALUE_STACK.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="text-gray-700 text-xs">✕</span>
                  <span className="text-gray-500 text-sm">{label}</span>
                </div>
                <span className="text-gray-600 text-xs tabular-nums shrink-0 ml-4 line-through">{value}</span>
              </div>
            ))}
            {/* Total row */}
            <div className="flex items-center justify-between px-6 py-5 bg-gray-950">
              <span className="text-gray-400 text-sm font-semibold">Total if you did it all</span>
              <span className="text-gray-400 text-sm font-semibold tabular-nums line-through">{TOTAL_RETAIL}</span>
            </div>
          </div>
        </div>

        {/* What you actually get */}
        <div className="mb-12">
          <div className="border border-white divide-y divide-gray-900">
            <div className="px-6 py-4">
              <p className="text-xs text-white uppercase tracking-widest">What you get with Ask Elijah</p>
            </div>
            {[
              'Unlimited personal questions — answered in 24hrs',
              'Answers reviewed personally by Elijah before they send',
              'Tailored to your position, level, and specific situation',
              'Action steps you can use at your next practice',
              'Your private question history — a playbook you keep',
              '48-hour accountability follow-up after every answer',
            ].map(item => (
              <div key={item} className="flex items-center gap-3 px-6 py-4">
                <span className="text-white text-xs">✓</span>
                <span className="text-gray-300 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Email input — shared between both plans */}
        <div className="mb-8">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-4">Your email</p>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
            className="w-full bg-transparent border-b border-gray-700 focus:border-white pb-3 text-lg text-white placeholder-gray-700 outline-none transition-colors"
          />
          {emailError && <p className="text-red-400 text-xs mt-2">{emailError}</p>}
        </div>

        {/* Pricing — two options */}
        <div className="mb-10">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-6">Choose your plan</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Founding Member — featured */}
            <div className="border border-white p-8 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-white text-black text-xs font-bold px-3 py-1 tracking-widest uppercase whitespace-nowrap">Founding Member</span>
              </div>
              <p className="text-xs text-gray-400 tracking-widest uppercase mb-4 mt-1">Locked forever</p>
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-5xl font-bold">$49</p>
                <p className="text-gray-500 text-sm">/mo</p>
              </div>
              <p className="text-gray-600 text-xs mb-2">After founding closes, new members pay $79/mo.</p>
              <p className="text-white text-xs font-semibold mb-8">Your price never goes up.</p>
              <p className="text-gray-300 text-sm leading-relaxed mb-10 flex-1">
                Lock in founding pricing before it closes. Unlimited access, forever at this rate.
              </p>
              <button
                onClick={() => handleCheckout('founding')}
                disabled={checkoutLoading !== null}
                className="bg-white text-black px-6 py-3 text-sm font-bold text-center hover:opacity-80 transition-opacity disabled:opacity-50 w-full"
              >
                {checkoutLoading === 'founding' ? 'Redirecting...' : 'Lock in $49/mo →'}
              </button>
            </div>

            {/* Monthly */}
            <div className="border border-gray-800 p-8 flex flex-col">
              <p className="text-xs text-gray-500 tracking-widest uppercase mb-4">Monthly</p>
              <p className="text-5xl font-bold mb-1">$79</p>
              <p className="text-gray-500 text-sm mb-8">per month, cancel anytime</p>
              <p className="text-gray-400 text-sm leading-relaxed mb-10 flex-1">
                Full access. Cancel whenever. Standard rate after founding closes.
              </p>
              <button
                onClick={() => handleCheckout('regular')}
                disabled={checkoutLoading !== null}
                className="border border-gray-600 text-white px-6 py-3 text-sm font-semibold text-center hover:border-white transition-colors disabled:opacity-50 w-full"
              >
                {checkoutLoading === 'regular' ? 'Redirecting...' : 'Get monthly →'}
              </button>
            </div>
          </div>
        </div>

        {/* Guarantee */}
        <div className="border border-gray-800 px-6 py-6 mb-12">
          <p className="text-white font-bold mb-2">7-day guarantee.</p>
          <p className="text-gray-500 text-sm leading-relaxed">
            If you don&apos;t get value in your first 7 days, reply to any email and I&apos;ll refund you. No questions asked. I only want players in here who are going to use it.
          </p>
        </div>

        {/* Who it's not for */}
        <div className="mb-16">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-5">Who this is not for</p>
          <ul className="space-y-3">
            {[
              "Players looking for hype, not honesty",
              "Players who want the answer but won't do the work",
              "Players who already have everything figured out",
            ].map(line => (
              <li key={line} className="flex items-start gap-3 text-gray-600 text-sm">
                <span className="text-gray-700 mt-0.5">✕</span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        {/* Free CTA at bottom */}
        <div className="text-center">
          <p className="text-gray-600 text-sm mb-4">Not ready to commit? Get 1 free question per week.</p>
          <Link href="/ask" className="text-white text-sm underline underline-offset-4 hover:text-gray-300 transition-colors">
            Try it free →
          </Link>
        </div>

      </main>
    </div>
  )
}
