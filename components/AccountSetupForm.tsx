'use client'

import { useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase-client'

/**
 * Post-verify account setup. Shown on the homepage right after the player's
 * email has been Kickbox-verified and their first question has been saved.
 * Per the Hooked playbook: reward has already been delivered (first-take on
 * screen + saved to their account), now we ask for the Investment.
 *
 * Three paths:
 *   1. First name + challenge + password — classic email/password signup via
 *      /api/sign-up, then signInWithPassword to set the Supabase session.
 *   2. Continue with Apple — Supabase OAuth, returns through /auth/callback.
 *   3. Continue with Google — same, different provider.
 *
 * Apple + Google require the corresponding providers to be enabled in the
 * Supabase dashboard with the right client IDs / keys. The buttons render
 * regardless; if a provider isn't configured, Supabase returns an error
 * which we surface as "Couldn't start sign-in, try email instead."
 */

const CHALLENGE_CHIPS = [
  'Shot confidence',
  'Not enough minutes',
  'Coach yelling at me',
  'Bad game last night',
  'Overthinking',
  'Pre-game nerves',
]

export default function AccountSetupForm({
  email,
  onDone,
}: {
  email: string
  /**
   * Called after successful email+password signup. Parent is responsible
   * for redirecting to /track. (OAuth paths redirect via /auth/callback
   * server-side instead of invoking this callback.)
   */
  onDone: () => void
}) {
  const [firstName, setFirstName] = useState('')
  const [challenge, setChallenge] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState<null | 'password' | 'google' | 'apple'>(null)
  const [error, setError] = useState('')

  const handlePasswordSubmit = async () => {
    if (loading) return
    const cleanFirstName = firstName.trim()
    const cleanChallenge = challenge.trim()
    if (!cleanFirstName) return setError('Add your first name')
    if (!password || password.length < 8) return setError('Pick a password (8+ characters)')

    setError('')
    setLoading('password')
    try {
      const res = await fetch('/api/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          firstName: cleanFirstName,
          challenge: cleanChallenge,
          // The email was just Kickbox-verified in /api/verify-email; no
          // need to spend a second credit checking it again.
          skipEmailVerify: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Could not set up your court. Try again.')
        setLoading(null)
        return
      }

      // Sign in immediately so /track can load with a proper Supabase session.
      const supabase = getSupabaseClient()
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) {
        setError(signInErr.message || 'Signed up but could not sign in. Try signing in manually.')
        setLoading(null)
        return
      }
      onDone()
    } catch {
      setError('Could not set up your court. Try again.')
      setLoading(null)
    }
  }

  const handleOAuth = async (provider: 'google' | 'apple') => {
    if (loading) return
    setError('')
    setLoading(provider)
    try {
      const supabase = getSupabaseClient()
      // redirectTo: after the provider authenticates, Supabase sends the user
      // back here with a ?code= param. /auth/callback handles the exchange
      // and session set, then forwards to /track.
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/track`,
        },
      })
      if (oauthErr) {
        setError("Couldn't start sign in. Try email and password instead.")
        setLoading(null)
      }
      // On success the browser is already redirecting to the provider.
    } catch {
      setError("Couldn't start sign in. Try email and password instead.")
      setLoading(null)
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto px-5 py-10">
      <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">Set up your court</p>
      <h1 className="text-3xl font-bold tracking-tight mb-2 leading-tight">
        So I can write back to you.
      </h1>
      <p className="text-gray-500 text-sm leading-relaxed mb-8">
        {email}
      </p>

      <div className="flex flex-col gap-4">
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 block">First name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => { setFirstName(e.target.value); if (error) setError('') }}
            autoComplete="given-name"
            className="w-full px-4 py-3 bg-transparent border border-gray-700 focus:border-white text-white placeholder-gray-600 outline-none transition-colors text-sm"
          />
        </div>

        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 block">Biggest challenge right now</label>
          <input
            type="text"
            placeholder="what's really getting you"
            value={challenge}
            onChange={(e) => setChallenge(e.target.value)}
            className="w-full px-4 py-3 bg-transparent border border-gray-700 focus:border-white text-white placeholder-gray-600 outline-none transition-colors text-sm mb-3"
          />
          <div className="flex flex-wrap gap-2">
            {CHALLENGE_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setChallenge(chip)}
                className="text-xs text-gray-400 border border-gray-800 hover:border-white hover:text-white px-3 py-1 transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 block">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (error) setError('') }}
            autoComplete="new-password"
            placeholder="8+ characters"
            className="w-full px-4 py-3 bg-transparent border border-gray-700 focus:border-white text-white placeholder-gray-600 outline-none transition-colors text-sm"
          />
        </div>

        {error && (
          <p className="text-red-400 text-xs">{error}</p>
        )}

        <button
          onClick={handlePasswordSubmit}
          disabled={loading !== null}
          className="w-full bg-white text-black py-3 text-sm font-bold rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 transition-opacity mt-2"
        >
          {loading === 'password' ? 'Setting up...' : 'Set up your court →'}
        </button>

        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-gray-900" />
          <span className="text-[10px] text-gray-600 uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-gray-900" />
        </div>

        <button
          onClick={() => handleOAuth('apple')}
          disabled={loading !== null}
          className="w-full border border-gray-700 hover:border-white text-white py-3 text-sm font-semibold rounded-full disabled:opacity-30 transition-colors flex items-center justify-center gap-2"
        >
          <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor" aria-hidden="true">
            <path d="M11.16 8.47c0-1.73 1.41-2.55 1.47-2.6-.8-1.17-2.05-1.33-2.5-1.35-1.06-.11-2.07.62-2.6.62-.55 0-1.38-.61-2.27-.59-1.17.02-2.25.68-2.85 1.73-1.22 2.11-.31 5.23.88 6.94.58.84 1.27 1.78 2.17 1.75.87-.04 1.2-.56 2.25-.56 1.05 0 1.35.56 2.27.55.94-.02 1.54-.86 2.11-1.7.67-.97.95-1.93.96-1.98-.02-.01-1.84-.7-1.86-2.78zM9.67 3.52c.48-.58.8-1.39.71-2.19-.69.03-1.52.46-2.02 1.04-.44.51-.84 1.33-.73 2.12.77.06 1.56-.39 2.04-.97z" />
          </svg>
          {loading === 'apple' ? 'Opening Apple...' : 'Continue with Apple'}
        </button>

        <button
          onClick={() => handleOAuth('google')}
          disabled={loading !== null}
          className="w-full border border-gray-700 hover:border-white text-white py-3 text-sm font-semibold rounded-full disabled:opacity-30 transition-colors flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {loading === 'google' ? 'Opening Google...' : 'Continue with Google'}
        </button>
      </div>
    </div>
  )
}
