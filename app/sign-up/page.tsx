'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !firstName) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName }),
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

      router.push('/home')
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

      <div className="w-full max-w-sm bg-white text-black p-10">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Save your answers.</h1>
        <p className="text-gray-400 text-sm mb-8">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-black underline underline-offset-2 hover:opacity-70">
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
          <button
            type="submit"
            disabled={loading || !email || !password || !firstName}
            className="w-full bg-black text-white py-3 text-sm font-semibold tracking-tight hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Create account →'}
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
