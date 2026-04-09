'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

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

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Invalid email or password.')
      setLoading(false)
    } else {
      router.push('/home')
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <Link href="/" className="mb-12">
        <Logo />
      </Link>

      <div className="w-full max-w-sm bg-white text-black p-10">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Welcome back.</h1>
        <p className="text-gray-400 text-sm mb-8">
          No account?{' '}
          <Link href="/sign-up" className="text-black underline underline-offset-2 hover:opacity-70">
            Sign up
          </Link>
        </p>

        {error && (
          <p className="text-sm text-gray-600 mb-4 border border-gray-200 px-4 py-2">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            disabled={loading || !email || !password}
            className="w-full bg-black text-white py-3 text-sm font-semibold tracking-tight hover:opacity-80 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign in →'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/ask" className="text-xs text-gray-400 hover:text-black transition-colors">
            Continue without account →
          </Link>
        </div>
      </div>

      <p className="text-xs text-gray-700 mt-8">No card required to try free.</p>
    </div>
  )
}
