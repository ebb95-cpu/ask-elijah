'use client'
export const dynamic = 'force-dynamic'

import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import LoadingDots from '@/components/ui/LoadingDots'
import { getSupabaseClient } from '@/lib/supabase-client'
import { getSession, removeSession } from '@/lib/safe-storage'

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
  const isAskIntent = intent === 'ask' && !!painQuestion
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState(prefillEmail)
  const [password, setPassword] = useState('')
  const [promoCode, setPromoCode] = useState(prefillPromoCode)
  const [promoStatus, setPromoStatus] = useState<{ state: 'idle' | 'checking' | 'applied' | 'error'; message: string }>({ state: 'idle', message: '' })
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [answerPreview, setAnswerPreview] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (isAskIntent) {
      const preview = getSession('pending_preview')
      if (preview) {
        setAnswerPreview(preview)
        removeSession('pending_preview')
      }
    }
  }, [])
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

  const passwordsMatch = !confirmPassword || password === confirmPassword

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !firstName) return
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
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

      router.push(nextUrl || '/track')
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
          {isAskIntent ? 'Your answer is ready' : isMeTooIntent ? 'Your version matters' : 'Locker room'}
        </p>
        <h1 className="text-2xl font-bold tracking-tight mb-3">
          {isAskIntent ? 'Create an account to get it.' : isMeTooIntent ? 'Get the answer for what you are actually dealing with.' : 'Save your answers.'}
        </h1>
        {isAskIntent && (
          <div className="mb-6 rounded-[1.25rem] border border-black/10 bg-white/60 overflow-hidden">
            <div className="p-4 pb-2">
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-black/30">Your question</p>
              <p className="text-xs font-semibold text-black/60 italic">&ldquo;{painQuestion}&rdquo;</p>
            </div>
            {answerPreview ? (
              <div className="relative px-4 pt-3 pb-6">
                <p className="text-sm leading-relaxed text-black font-medium">{answerPreview}</p>
                {/* Fade + blur mask */}
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#F0EDE7] to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 h-10 backdrop-blur-[2px]" style={{ WebkitMaskImage: 'linear-gradient(to top, black 40%, transparent 100%)', maskImage: 'linear-gradient(to top, black 40%, transparent 100%)' }} />
                <p className="absolute bottom-2 left-0 right-0 text-center text-[10px] font-black uppercase tracking-[0.18em] text-black/40">Create account to read more</p>
              </div>
            ) : (
              <div className="px-4 pb-4">
                <p className="text-xs leading-relaxed text-black/50">
                  The answer exists. One account stands between you and it.
                </p>
              </div>
            )}
          </div>
        )}
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
            href={`/sign-in${isAskIntent ? `?next=${encodeURIComponent('/ask')}` : isMeTooIntent ? `?intent=me-too&q=${encodeURIComponent(painQuestion)}${nextUrl ? `&next=${encodeURIComponent(nextUrl)}` : ''}` : ''}`}
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
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className={`w-full border px-4 py-3 text-sm outline-none transition-colors ${confirmPassword && !passwordsMatch ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-black'}`}
              required
            />
            {confirmPassword && !passwordsMatch && (
              <p className="mt-1 text-xs text-red-500">Passwords do not match.</p>
            )}
          </div>
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
            disabled={loading || !email || !password || !firstName || !confirmPassword || !passwordsMatch}
            className="w-full bg-black text-white py-3 text-sm font-semibold tracking-tight hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? <LoadingDots label="Creating account" /> : 'Create account →'}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-6 text-center">No card required.</p>

      </div>
    </div>
  )
}
