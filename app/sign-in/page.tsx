'use client'
export const dynamic = 'force-dynamic'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import LoadingDots from '@/components/ui/LoadingDots'
import { getSupabaseClient } from '@/lib/supabase-client'
import { setLocal } from '@/lib/safe-storage'

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

type Step = 'email' | 'password' | 'reset-sent'
type Role = 'admin' | 'user'

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <SignInInner />
    </Suspense>
  )
}

function SignInInner() {
  const [step, setStep] = useState<Step>('email')
  const [role, setRole] = useState<Role>('user')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const intent = searchParams?.get('intent') || ''
  const painQuestion = searchParams?.get('q') || ''
  const questionId = searchParams?.get('questionId') || ''
  const rawNextUrl = searchParams?.get('next') || ''
  const nextUrl = rawNextUrl.startsWith('/') && !rawNextUrl.startsWith('//') ? rawNextUrl : ''
  const isMeTooIntent = intent === 'me-too' && !!painQuestion
  const [simulated, setSimulated] = useState<boolean>(
    () => searchParams?.get('simulated') === '1'
  )

  // Pre-fill email + skip straight to password step when arriving from the
  // onboarding "You're already in the locker room" returning-user prompt.
  useEffect(() => {
    const emailParam = searchParams?.get('email')
    if (emailParam) {
      setEmail(emailParam)
      setAgeConfirmed(true)
      setStep('password')
    }
  }, [searchParams])

  useEffect(() => {
    if (simulated) return
    if (typeof window === 'undefined') return
    if (window.self === window.top) return
    try {
      const parentPath = window.parent.location.pathname
      if (parentPath.startsWith('/admin/simulate')) setSimulated(true)
    } catch {
      /* cross-origin iframe */
    }
  }, [simulated])

  useEffect(() => {
    if (!simulated) return
    setEmail((prev) => prev || 'ebb95@mac.com')
    setAgeConfirmed(true)
  }, [simulated])

  const handleEmailNext = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError('')

    if (simulated) {
      try {
        setLocal('ask_elijah_email', email.trim().toLowerCase())
      } catch {
        /* localStorage blocked */
      }
      router.push(nextUrl || '/ask?simulated=1')
      return
    }

    try {
      const adminRes = await fetch('/api/admin/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const { isAdmin } = await adminRes.json()
      if (isAdmin) {
        setRole('admin')
        setStep('password')
        setLoading(false)
        return
      }

      const checkRes = await fetch('/api/check-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const { exists } = await checkRes.json()

      if (!exists) {
        const params = new URLSearchParams({ email: email.trim().toLowerCase() })
        if (nextUrl) params.set('next', nextUrl)
        if (isMeTooIntent) {
          params.set('intent', 'me-too')
          params.set('q', painQuestion)
          if (questionId) params.set('questionId', questionId)
        }
        router.push(`/sign-up?${params.toString()}`)
        return
      }

      setRole('user')
      setStep('password')
      setLoading(false)
    } catch {
      setError('Something went wrong. Try again.')
      setLoading(false)
    }
  }

  const handleUserLogin = async () => {
    if (!password.trim()) return
    setLoading(true)
    setError('')
    try {
      const supabase = getSupabaseClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (signInError) throw signInError
      router.push(nextUrl || '/home')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Wrong password.')
      setLoading(false)
    }
  }

  const handleAdminLogin = async () => {
    if (!password.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) throw new Error('Wrong password')
      window.location.href = '/admin/questions'
    } catch {
      setError('Wrong password.')
      setLoading(false)
    }
  }

  const handlePasswordSubmit = () => {
    if (role === 'admin') return handleAdminLogin()
    return handleUserLogin()
  }

  const handleForgotPassword = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      if (!res.ok) {
        const { error: apiError } = await res.json().catch(() => ({ error: 'Could not send reset link.' }))
        throw new Error(apiError || 'Could not send reset link.')
      }
      setStep('reset-sent')
      setLoading(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not send reset link.')
      setLoading(false)
    }
  }

  const handleOAuth = async (provider: 'google') => {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const supabase = getSupabaseClient()
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextUrl || '/track')}`,
        },
      })
      if (oauthErr) {
        setError("Couldn't start sign in. Try email instead.")
        setLoading(false)
      }
      // On success the browser is already redirecting to the provider.
    } catch {
      setError("Couldn't start sign in. Try email instead.")
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (step === 'email') handleEmailNext()
      if (step === 'password') handlePasswordSubmit()
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <nav className="flex items-center justify-between px-6 py-5">
        <Link href="/" className="text-gray-400 hover:text-white transition-colors text-sm">← Back</Link>
        <Logo />
        <div className="w-12" />
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="w-full max-w-sm">

          {step === 'email' && (
            <>
              {simulated && (
                <div className="mb-6 rounded-md border border-amber-900/70 bg-amber-950/30 px-3 py-2 text-center">
                  <p className="text-[11px] text-amber-300 uppercase tracking-widest mb-1">
                    Simulator mode · no real email sent
                  </p>
                  <p className="text-[10px] text-amber-200/60">
                    Pre-filled with a returning student. Use any other email to preview the new-user flow.
                  </p>
                </div>
              )}
              <p className="text-xs text-gray-600 tracking-widest uppercase mb-6 text-center">
                {isMeTooIntent ? 'This one hit you' : 'Connect the dots'}
              </p>
              <h1 className="text-3xl font-bold text-center mb-4 leading-tight">
                {isMeTooIntent ? 'Do not just relate to it. Fix your version.' : "Something's been on your mind."}
              </h1>
              {isMeTooIntent ? (
                <div className="mb-10 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-600 mb-3">You clicked Me too on</p>
                  <p className="text-sm font-semibold leading-relaxed text-white mb-4">&ldquo;{painQuestion}&rdquo;</p>
                  <p className="text-sm leading-relaxed text-gray-500">
                    That usually means this is already costing you confidence, minutes, or peace. Get Elijah to answer your version so you know the next rep to take.
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center mb-10 leading-relaxed">
                  That&apos;s why you came back. Enter your email and Elijah will pick up where you left off.
                </p>
              )}

              <input
                type="email"
                autoFocus
                placeholder="your@email.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                onKeyDown={handleKey}
                className="w-full bg-transparent border-b border-gray-700 focus:border-white pb-3 text-xl text-center text-white placeholder-gray-700 outline-none transition-colors mb-8 block"
              />

              {error && <p className="text-red-400 text-xs text-center mb-4">{error}</p>}

              <label className="flex items-start gap-3 mb-6 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                  className="mt-0.5 accent-white w-4 h-4 flex-shrink-0"
                />
                <span className="text-xs text-gray-500 leading-relaxed group-hover:text-gray-300 transition-colors">
                  I confirm I am 13 years of age or older. If you are under 13, please ask a parent or guardian to create an account.
                </span>
              </label>

              <button
                onClick={handleEmailNext}
                disabled={!email.trim() || loading || !ageConfirmed}
                className="w-full bg-white text-black py-3 text-sm font-semibold tracking-tight disabled:opacity-30 hover:opacity-80 transition-opacity"
              >
                {loading ? <LoadingDots label="Continuing" /> : simulated ? 'Simulated sign in →' : 'Continue →'}
              </button>

              {!simulated && (
                <>
                  <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-gray-900" />
                    <span className="text-[10px] text-gray-600 uppercase tracking-widest">or</span>
                    <div className="flex-1 h-px bg-gray-900" />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOAuth('google')}
                    disabled={loading || !ageConfirmed}
                    className="w-full border border-gray-700 hover:border-white text-white py-3 text-sm font-semibold rounded-full disabled:opacity-30 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {loading ? <LoadingDots label="Opening Google" /> : 'Continue with Google'}
                  </button>
                </>
              )}

              <div className="mt-8 pt-6 border-t border-gray-900 text-center">
                <Link
                  href="/admin/login"
                  className="text-xs text-gray-500 hover:text-white transition-colors"
                >
                  Admin? Sign in here →
                </Link>
              </div>
            </>
          )}

          {step === 'password' && (
            <>
              <p className="text-xs text-gray-600 tracking-widest uppercase mb-6 text-center">
                {role === 'admin' ? 'Admin' : 'Welcome back'}
              </p>
              <h1 className="text-3xl font-bold text-center mb-4 leading-tight">Enter your password.</h1>
              <p className="text-gray-500 text-sm text-center mb-8 break-words">{email}</p>

              <input
                type="password"
                autoFocus
                placeholder="Password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                onKeyDown={handleKey}
                className="w-full bg-transparent border-b border-gray-700 focus:border-white pb-3 text-xl text-center text-white placeholder-gray-700 outline-none transition-colors mb-8 block"
              />

              {error && <p className="text-red-400 text-xs text-center mb-4">{error}</p>}

              <button
                onClick={handlePasswordSubmit}
                disabled={!password.trim() || loading}
                className="w-full bg-white text-black py-3 text-sm font-semibold tracking-tight disabled:opacity-30 hover:opacity-80 transition-opacity"
              >
                {loading ? <LoadingDots label="Signing in" /> : 'Sign in →'}
              </button>

              {role === 'user' && (
                <button
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="w-full text-xs text-gray-500 hover:text-white transition-colors mt-6 text-center disabled:opacity-40"
                >
                  Can&apos;t find your password? Send reset link →
                </button>
              )}

              <button
                onClick={() => { setStep('email'); setPassword(''); setError('') }}
                className="w-full text-xs text-gray-600 hover:text-white transition-colors mt-4 text-center"
              >
                ← Use a different email
              </button>
            </>
          )}

          {step === 'reset-sent' && (
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-4">Check your inbox.</h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-2">We sent it to</p>
              <p className="text-white font-semibold mb-6">{email}</p>
              <p className="text-gray-600 text-sm leading-relaxed mb-10">
                Click the link in the email to set a new password. It expires in one hour.
              </p>
              {error && <p className="text-red-400 text-xs text-center mb-4">{error}</p>}
              <button
                onClick={handleForgotPassword}
                disabled={loading}
                className="w-full rounded-full bg-white py-3 text-sm font-semibold text-black hover:opacity-80 disabled:opacity-40 transition-opacity mb-5"
              >
                {loading ? <LoadingDots label="Sending" /> : 'Send it again →'}
              </button>
              <button
                onClick={() => { setStep('email'); setError(''); setPassword('') }}
                className="text-xs text-gray-600 hover:text-white transition-colors"
              >
                Use a different email
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
