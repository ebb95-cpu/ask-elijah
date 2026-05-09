'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const t = searchParams?.get('token')
    if (!t) {
      setError('No reset token found. Request a new link.')
    } else {
      setToken(t)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (!token) {
      setError('No reset token. Request a new link.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not update password.')
        setLoading(false)
        return
      }
      setDone(true)
      setTimeout(() => router.push('/sign-in'), 2000)
    } catch {
      setError('Something went wrong.')
      setLoading(false)
    }
  }

  // Success state
  if (done) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
        <Link href="/" className="mb-12"><Logo /></Link>
        <div className="w-full max-w-sm text-center">
          <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold mb-4">Password updated</p>
          <h1 className="text-3xl font-bold tracking-tight mb-3">You&apos;re back in.</h1>
          <p className="text-gray-500 text-sm">Taking you to sign in...</p>
        </div>
      </div>
    )
  }

  // No token state
  if (!token && error) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
        <Link href="/" className="mb-12"><Logo /></Link>
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold mb-4">Link expired.</h1>
          <p className="text-gray-500 text-sm mb-8">
            That link is no longer valid. Request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block bg-white text-black py-3 px-8 text-sm font-bold rounded-full hover:opacity-80 transition-opacity"
          >
            Get a new link →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <Link href="/" className="mb-12"><Logo /></Link>

      <div className="w-full max-w-sm bg-white text-black p-10 rounded-3xl">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Set a new password.</h1>
        <p className="text-gray-400 text-sm mb-8">
          Keep it simple. Keep it yours. You&apos;ll be signed in straight after.
        </p>

        {error && (
          <p className="text-sm text-red-500 mb-4 border border-red-200 px-4 py-2 rounded-xl">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }}
            autoFocus
            className="w-full border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black transition-colors rounded-xl"
            required
          />
          <input
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError('') }}
            className="w-full border border-gray-200 px-4 py-3 text-sm outline-none focus:border-black transition-colors rounded-xl"
            required
          />
          <button
            type="submit"
            disabled={loading || !password || !confirm}
            className="w-full bg-black text-white py-3 text-sm font-bold rounded-full hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? <LoadingDots label="Saving" /> : 'Save password →'}
          </button>
        </form>
      </div>
    </div>
  )
}
