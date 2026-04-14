'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabase-client'

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || ''

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

type Step = 'email' | 'password' | 'sent'

export default function SignInPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const router = useRouter()

  const isAdmin = email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()

  const handleEmailNext = () => {
    if (!email.trim()) return
    if (isAdmin) {
      setStep('password')
    } else {
      handleSendLink()
    }
  }

  const handleSendLink = async () => {
    setLoading(true)
    setError('')
    try {
      const supabase = getSupabaseClient()
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/ask`,
          shouldCreateUser: true,
        },
      })
      if (authError) throw authError
      setStep('sent')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleAdminLogin = async () => {
    if (!password.trim()) return
    setLoading(true)
    setError('')
    try {
      const supabase = getSupabaseClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (authError) throw authError
      router.push('/admin/questions')
    } catch (err: unknown) {
      setError('Wrong password.')
      setLoading(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (step === 'email') handleEmailNext()
      if (step === 'password') handleAdminLogin()
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

          {/* Step 1: Email */}
          {step === 'email' && (
            <>
              <p className="text-xs text-gray-600 tracking-widest uppercase mb-6 text-center">Connect the dots</p>
              <h1 className="text-3xl font-bold text-center mb-4 leading-tight">Something&apos;s been on your mind.</h1>
              <p className="text-gray-500 text-sm text-center mb-10 leading-relaxed">
                That&apos;s why you came back. Enter your email and Elijah will pick up where you left off.
              </p>

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

              {!isAdmin && (
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
              )}

              <button
                onClick={handleEmailNext}
                disabled={!email.trim() || loading || (!isAdmin && !ageConfirmed)}
                className="w-full bg-white text-black py-3 text-sm font-semibold tracking-tight disabled:opacity-30 hover:opacity-80 transition-opacity"
              >
                {loading ? 'Sending...' : isAdmin ? 'Continue →' : 'Send my link →'}
              </button>

              {!isAdmin && (
                <p className="text-xs text-gray-700 text-center mt-6">No password. Just your email.</p>
              )}
            </>
          )}

          {/* Step 2: Admin password */}
          {step === 'password' && (
            <>
              <p className="text-xs text-gray-600 tracking-widest uppercase mb-6 text-center">Admin</p>
              <h1 className="text-3xl font-bold text-center mb-10 leading-tight">Enter your password.</h1>

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
                onClick={handleAdminLogin}
                disabled={!password.trim() || loading}
                className="w-full bg-white text-black py-3 text-sm font-semibold tracking-tight disabled:opacity-30 hover:opacity-80 transition-opacity"
              >
                {loading ? 'Signing in...' : 'Sign in →'}
              </button>

              <button
                onClick={() => { setStep('email'); setPassword(''); setError('') }}
                className="w-full text-xs text-gray-600 hover:text-white transition-colors mt-4 text-center"
              >
                ← Back
              </button>
            </>
          )}

          {/* Step 3: Magic link sent */}
          {step === 'sent' && (
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-4">Your link is on the way.</h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-2">We sent it to</p>
              <p className="text-white font-semibold mb-6">{email}</p>
              <p className="text-gray-600 text-sm leading-relaxed mb-10">
                Click it and you&apos;re straight back in. Ask the question you&apos;ve been sitting on.
              </p>
              <button
                onClick={() => { setStep('email'); setError('') }}
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
