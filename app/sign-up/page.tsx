'use client'
export const dynamic = 'force-dynamic'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import LoadingDots from '@/components/ui/LoadingDots'
import { getSupabaseClient } from '@/lib/supabase-client'

function Logo() {
  return (
    <svg width="52" height="8" viewBox="0 0 52 8" fill="none">
      <circle cx="4" cy="4" r="4" fill="#fff" />
      <line x1="8" y1="4" x2="20" y2="4" stroke="#fff" strokeWidth="1.5" />
      <circle cx="24" cy="4" r="4" fill="#fff" />
      <line x1="28" y1="4" x2="40" y2="4" stroke="#fff" strokeWidth="1.5" />
      <circle cx="44" cy="4" r="4" fill="#fff" />
    </svg>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <SignUpInner />
    </Suspense>
  )
}

function SignUpInner() {
  const searchParams = useSearchParams()
  const prefillEmail = searchParams?.get('email') ?? ''
  const intent = searchParams?.get('intent') || ''
  const painQuestion = searchParams?.get('q') || ''
  const rawNextUrl = searchParams?.get('next') || ''
  const prefillPromoCode = searchParams?.get('promo') || searchParams?.get('code') || ''
  const nextUrl = rawNextUrl.startsWith('/') && !rawNextUrl.startsWith('//') ? rawNextUrl : ''
  const isMeTooIntent = intent === 'me-too' && !!painQuestion
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState(prefillEmail)
  const [password, setPassword] = useState('')
  const [promoCode, setPromoCode] = useState(prefillPromoCode)
  const [promoStatus, setPromoStatus] = useState<{ state: 'idle' | 'checking' | 'applied' | 'error'; message: string }>({ state: 'idle', message: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const browserLanguage = typeof navigator !== 'undefined' ? navigator.language || 'en' : 'en'

  const updatePromoCode = (value: string) => {
    setPromoCode(value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    setPromoStatus({ state: 'idle', message: '' })
  }

  const applyPromoCode = async () => {
    const code = promoCode.trim()
    if (!code || promoStatus.state === 'checking') return
    setPromoStatus({ state: 'checking', message: 'Checking...' })

    try {
      const res = await fetch('/api/promo-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.ok !== true) {
        setPromoStatus({ state: 'error', message: data?.error || 'That promo code is not active.' })
        return
      }
      setPromoCode(data.code || code)
      setPromoStatus({ state: 'applied', message: `Applied: ${Number(data.trialDays) || 30} days free` })
    } catch {
      setPromoStatus({ state: 'error', message: 'Could not check that code. Try again.' })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !firstName) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, promoCode, language: browserLanguage }),
      })
      const result = await res.json()

      if (!res.ok) {
        setError(result.error || 'Something went wrong. Try again.')
        setLoading(false)
        return
      }

      const supabase = getSupabaseClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      router.push(nextUrl || '/home')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <Link href="/" className="mb-12">
        <Logo />
      </Link>

      <div className="w-full max-w-sm rounded-[2rem] bg-[#F7F5F0] text-black p-10">
        <p className="mb-4 text-[10px] font-black uppercase tracking-[0.24em] text-black/40">
          {isMeTooIntent ? 'Your version matters' : 'Locker room'}
        </p>
        <h1 className="text-2xl font-bold tracking-tight mb-3">
          {isMeTooIntent ? 'Get the answer for what you are actually dealing with.' : 'Save your answers.'}
        </h1>
        {isMeTooIntent && (
          <div className="mb-6 rounded-[1.25rem] border border-black/10 bg-white/60 p-4">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-black/40">You related to</p>
            <p className="text-sm font-semibold leading-relaxed text-black">&ldquo;{painQuestion}&rdquo;</p>
            <p className="mt-3 text-xs leading-relaxed text-black/50">
              Reading it is the signal. Asking your version is the move. Elijah can give you the next step for your situation.
            </p>
          </div>
        )}
        <p className="text-gray-500 text-sm mb-8">
          Already have an account?{' '}
          <Link
            href={`/sign-in${isMeTooIntent ? `?intent=me-too&q=${encodeURIComponent(painQuestion)}${nextUrl ? `&next=${encodeURIComponent(nextUrl)}` : ''}` : ''}`}
            className="text-black underline underline-offset-2 hover:opacity-70"
          >
            Sign in
          </Link>
        </p>

        {error && (
          <p className="text-sm text-gray-600 mb-4 border border-gray-200 px-4 py-2">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="First name"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            className="w-full border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black transition-colors"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black transition-colors"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black transition-colors"
            required
          />
          <div>
            <div className="flex border border-gray-200 focus-within:border-black transition-colors">
              <input
                type="text"
                placeholder="Promo code"
                value={promoCode}
                onChange={e => updatePromoCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyPromoCode()
                  }
                }}
                className="min-w-0 flex-1 px-4 py-3 text-sm uppercase outline-none"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={applyPromoCode}
                disabled={!promoCode.trim() || promoStatus.state === 'checking' || promoStatus.state === 'applied'}
                className="px-4 text-xs font-black disabled:text-black/25"
              >
                {promoStatus.state === 'checking' ? 'Checking' : promoStatus.state === 'applied' ? 'Applied' : 'Apply'}
              </button>
            </div>
            {promoStatus.message && (
              <p className={`mt-2 text-xs ${promoStatus.state === 'applied' ? 'text-emerald-700' : promoStatus.state === 'error' ? 'text-red-600' : 'text-black/50'}`}>
                {promoStatus.message}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !email || !password || !firstName}
            className="w-full bg-black text-white py-3 text-sm font-semibold tracking-tight hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? <LoadingDots label="Creating account" /> : 'Create account →'}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-6 text-center">No card required.</p>

        <div className="mt-4 text-center">
          <Link href="/ask" className="text-xs text-gray-400 hover:text-black transition-colors">
            Continue without account →
          </Link>
        </div>
      </div>
    </div>
  )
}
