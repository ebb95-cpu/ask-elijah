'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useEffect } from 'react'
import Link from 'next/link'
import LoadingDots from '@/components/ui/LoadingDots'

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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('email')
    if (param) setEmail(param)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || loading) return

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Could not send reset link.')
      }
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <nav className="flex items-center justify-between px-6 py-5">
        <Link href="/sign-in" className="text-gray-400 hover:text-white transition-colors text-sm">← Sign in</Link>
        <Logo />
        <div className="w-14" />
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="w-full max-w-sm text-center">
          {sent ? (
            <>
              <p className="text-xs text-gray-600 tracking-widest uppercase mb-6">Reset sent</p>
              <h1 className="text-3xl font-bold mb-4">Check your inbox.</h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-2">We sent the reset link to</p>
              <p className="text-white font-semibold mb-8 break-words">{email}</p>
              <Link href="/sign-in" className="text-sm font-semibold text-white hover:opacity-60 transition-opacity">
                Back to sign in →
              </Link>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-600 tracking-widest uppercase mb-6">Password reset</p>
              <h1 className="text-3xl font-bold mb-4">Get back in.</h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-10">
                Enter your email and we&apos;ll send a link to set a new password.
              </p>

              <form onSubmit={handleSubmit}>
                <input
                  type="email"
                  autoFocus
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError('') }}
                  className="w-full bg-transparent border-b border-gray-700 focus:border-white pb-3 text-xl text-center text-white placeholder-gray-700 outline-none transition-colors mb-8 block"
                />

                {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

                <button
                  type="submit"
                  disabled={!email.trim() || loading}
                  className="w-full bg-white text-black py-3 text-sm font-semibold tracking-tight disabled:opacity-30 hover:opacity-80 transition-opacity"
                >
                  {loading ? <LoadingDots label="Sending" /> : 'Send reset link →'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
