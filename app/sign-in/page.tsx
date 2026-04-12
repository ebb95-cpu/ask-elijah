'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M14.974 9.552c-.016-1.93 1.578-2.868 1.65-2.914-1.8-2.63-4.593-2.99-5.583-3.024-2.37-.243-4.644 1.397-5.846 1.397-1.196 0-3.022-1.367-4.974-1.329C-1.87 3.728-4.09 5.7-5.297 8.46c-2.453 5.602-.625 13.882 1.762 18.424 1.18 1.738 2.584 3.68 4.425 3.613 1.783-.073 2.454-1.15 4.606-1.15 2.151 0 2.763 1.15 4.642 1.115 1.914-.031 3.124-1.77 4.294-3.513 1.358-2.005 1.914-3.956 1.942-4.057-.043-.016-3.718-1.423-3.752-5.647l-.648.307z" fill="currentColor"/>
      <path d="M10.671 2.45C11.647 1.27 12.297-.31 12.115-1.9c-1.358.057-3.003.906-3.979 2.086-.873 1.015-1.638 2.64-1.432 4.193 1.516.116 3.062-.77 3.967-1.929z" fill="currentColor"/>
    </svg>
  )
}

type Step = 'email' | 'sent'

export default function SignInPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null)
  const [error, setError] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setOauthLoading(provider)
    setError('')
    try {
      const supabase = getSupabaseClient()
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/ask`,
        },
      })
      if (authError) throw authError
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
      setOauthLoading(null)
    }
  }

  const handleSendLink = async () => {
    if (!email.trim()) return
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

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSendLink()
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
              <p className="text-xs text-gray-600 tracking-widest uppercase mb-6 text-center">Connect the dots</p>
              <h1 className="text-3xl font-bold text-center mb-4 leading-tight">Something&apos;s been on your mind.</h1>
              <p className="text-gray-500 text-sm text-center mb-10 leading-relaxed">
                That&apos;s why you came back. Sign in and Elijah will pick up where you left off.
              </p>

              {/* OAuth buttons */}
              <div className="flex flex-col gap-3 mb-8">
                <button
                  onClick={() => handleOAuth('google')}
                  disabled={!!oauthLoading || loading}
                  className="w-full flex items-center justify-center gap-3 bg-white text-black py-3 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  <GoogleIcon />
                  {oauthLoading === 'google' ? 'Redirecting...' : 'Continue with Google'}
                </button>

                <button
                  onClick={() => handleOAuth('apple')}
                  disabled={!!oauthLoading || loading}
                  className="w-full flex items-center justify-center gap-3 bg-white text-black py-3 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  <AppleIcon />
                  {oauthLoading === 'apple' ? 'Redirecting...' : 'Continue with Apple'}
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4 mb-8">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-xs text-gray-600 uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>

              {/* Magic link */}
              <input
                type="email"
                autoFocus
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKey}
                className="w-full bg-transparent border-b border-gray-700 focus:border-white pb-3 text-xl text-center text-white placeholder-gray-700 outline-none transition-colors mb-8 block"
              />

              {error && (
                <p className="text-red-400 text-xs text-center mb-4">{error}</p>
              )}

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
                onClick={handleSendLink}
                disabled={!email.trim() || loading || !ageConfirmed}
                className="w-full bg-white text-black py-3 text-sm font-semibold tracking-tight disabled:opacity-30 hover:opacity-80 transition-opacity"
              >
                {loading ? 'Sending...' : 'Send my link →'}
              </button>

              <p className="text-xs text-gray-700 text-center mt-6">
                No password. Just your email.
              </p>
            </>
          )}

          {step === 'sent' && (
            <div className="text-center">
              <div className="mb-4">
                <h1 className="text-3xl font-bold mb-4">Your link is on the way.</h1>
                <p className="text-gray-500 text-sm leading-relaxed mb-2">We sent it to</p>
                <p className="text-white font-semibold mb-6">{email}</p>
                <p className="text-gray-600 text-sm leading-relaxed mb-10">
                  Click it and you&apos;re straight back in. Ask the question you&apos;ve been sitting on.
                </p>
              </div>
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
