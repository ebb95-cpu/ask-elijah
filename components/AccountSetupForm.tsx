'use client'

import { useState } from 'react'
import { getSupabaseClient } from '@/lib/supabase-client'
import { setLocal } from '@/lib/safe-storage'

/**
 * Endel-style onboarding flow — launched at peak-investment moment, right
 * after the player has seen the first part of their answer and wants the
 * rest. One question per screen, tap-forward, fade-in transitions.
 *
 * Step order is intentional: easiest taps first, hardest typing last.
 * This builds yes-commitment momentum before asking for friction-heavy
 * inputs (email, password). Per Nir Eyal, each "yes" lowers the bar for
 * the next one; per Hormozi Value Equation, effort rises only after
 * they're already invested.
 *
 *   1. Age           — tap
 *   2. Position      — tap
 *   3. Struggle      — tap + optional free-type
 *   4. Name          — type
 *   5. Email + age   — type + Kickbox verify + save question
 *   6. Save          — Apple / Google OAuth or password
 *
 * Data flow:
 *   - Steps 1-4 are pure UI state.
 *   - Step 5 (email) calls /api/verify-email (sets ae_track cookie) and
 *     /api/ask to persist the question under the verified email. If they
 *     bounce after this step, question still lives on /track.
 *   - Step 6 email/password → POST /api/sign-up with all fields, then
 *     signInWithPassword → redirect /track.
 *   - Step 6 OAuth → POST /api/profile with fields (keyed by email) so
 *     the callback has them, then signInWithOAuth → /auth/callback →
 *     /track.
 */

const AGE_CHIPS = ['13', '14', '15', '16', '17', '18+']

const POSITION_CHIPS = [
  { value: 'PG', label: 'PG' },
  { value: 'SG', label: 'SG' },
  { value: 'SF', label: 'SF' },
  { value: 'PF', label: 'PF' },
  { value: 'C', label: 'C' },
  { value: 'Combo', label: 'Combo' },
]

const STRUGGLE_CHIPS = [
  'Confidence',
  'Clutch moments',
  'Consistency',
  'Playing time',
  'Overthinking',
  'Coach trust',
]

type Step = 1 | 2 | 3 | 4 | 5 | 6

export default function AccountSetupForm({
  question,
  onDone,
}: {
  /** The just-asked question, saved to /api/ask at the email step. */
  question: string
  /** Called after email+password signup + session is set. */
  onDone: () => void
}) {
  const [step, setStep] = useState<Step>(1)
  const [age, setAge] = useState('')
  const [position, setPosition] = useState('')
  const [struggle, setStruggle] = useState('')
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState<null | 'next' | 'password' | 'google' | 'apple'>(null)
  const [error, setError] = useState('')

  const goBack = () => {
    if (step === 1) return
    setError('')
    setStep((s) => Math.max(s - 1, 1) as Step)
  }

  const advance = () => {
    setError('')
    setStep((s) => Math.min(s + 1, 6) as Step)
  }

  // Step 5 — verify email + save the question + advance to save step.
  const submitEmailStep = async () => {
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) return setError('Enter your email')
    if (!ageConfirmed) return setError('Confirm you are 13 or older')
    setLoading('next')
    setError('')
    try {
      const verifyRes = await fetch('/api/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      })
      const verifyData = await verifyRes.json().catch(() => ({ ok: false, reason: 'Could not verify email. Try again.' }))
      if (!verifyRes.ok || !verifyData?.ok) {
        setError(verifyData?.reason || "That email doesn't look right. Double-check it.")
        setLoading(null)
        return
      }

      // Question gets saved under the verified email so it persists if
      // they bounce before the final save step.
      try {
        await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, email: cleanEmail, newsletterOptIn: true }),
        })
      } catch {
        /* non-fatal */
      }
      setLocal('ask_elijah_email', cleanEmail)
      setLoading(null)
      advance()
    } catch {
      setError('Could not verify email. Try again.')
      setLoading(null)
    }
  }

  const handlePasswordSubmit = async () => {
    if (loading) return
    if (!password || password.length < 8) return setError('Pick a password (8+ characters)')
    setError('')
    setLoading('password')
    try {
      const cleanEmail = email.trim().toLowerCase()
      const res = await fetch('/api/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          firstName: firstName.trim(),
          // Map onboarding inputs to existing profile columns.
          age: age.trim(),
          position: position.trim(),
          challenge: struggle.trim(),
          skipEmailVerify: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Could not set up your court. Try again.')
        setLoading(null)
        return
      }
      const supabase = getSupabaseClient()
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
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
      const cleanEmail = email.trim().toLowerCase()
      // Persist profile data before the OAuth redirect — the /auth/callback
      // runs server-side and can't see local state. /api/profile upserts by
      // email so it's safe to call even before the Supabase Auth user exists.
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          first_name: firstName.trim(),
          age: age.trim(),
          position: position.trim(),
          challenge: struggle.trim(),
        }),
      }).catch(() => {})

      const supabase = getSupabaseClient()
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/track` },
      })
      if (oauthErr) {
        setError("Couldn't start sign in. Try email instead.")
        setLoading(null)
      }
    } catch {
      setError("Couldn't start sign in. Try email instead.")
      setLoading(null)
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto px-5 py-10 flex flex-col min-h-[560px]">
      <ProgressDots step={step} total={6} />

      <div key={step} className="step-in flex-1 flex flex-col mt-10">
        {step === 1 && (
          <StepTapChoice
            title="How old are you?"
            subtitle="So I can talk to you the right way."
            chips={AGE_CHIPS.map((c) => ({ value: c, label: c }))}
            value={age}
            setValue={setAge}
            onAdvance={advance}
            showBack={false}
          />
        )}
        {step === 2 && (
          <StepTapChoice
            title="What position do you play?"
            subtitle="Answers hit different for guards vs bigs."
            chips={POSITION_CHIPS}
            value={position}
            setValue={setPosition}
            onAdvance={advance}
            onBack={goBack}
          />
        )}
        {step === 3 && (
          <StepChipOrType
            title="What do you struggle with?"
            subtitle="The thing you wish you could fix tomorrow."
            chips={STRUGGLE_CHIPS}
            value={struggle}
            setValue={setStruggle}
            onAdvance={advance}
            onBack={goBack}
          />
        )}
        {step === 4 && (
          <StepName
            firstName={firstName}
            setFirstName={(v) => { setFirstName(v); if (error) setError('') }}
            onAdvance={advance}
            onBack={goBack}
          />
        )}
        {step === 5 && (
          <StepEmail
            email={email}
            setEmail={(v) => { setEmail(v); if (error) setError('') }}
            ageConfirmed={ageConfirmed}
            setAgeConfirmed={setAgeConfirmed}
            onAdvance={submitEmailStep}
            onBack={goBack}
            loading={loading === 'next'}
            error={error}
          />
        )}
        {step === 6 && (
          <StepAuth
            email={email}
            password={password}
            setPassword={(v) => { setPassword(v); if (error) setError('') }}
            onPasswordSubmit={handlePasswordSubmit}
            onOAuth={handleOAuth}
            onBack={goBack}
            loading={loading === 'password' ? 'password' : loading === 'google' ? 'google' : loading === 'apple' ? 'apple' : null}
            error={error}
          />
        )}
      </div>
    </div>
  )
}

// ── Progress dots ────────────────────────────────────────────────────────
function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => {
        const n = i + 1
        return (
          <span
            key={n}
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: n === step ? 20 : 5,
              background: n === step ? '#ffffff' : n < step ? '#555' : '#1f1f1f',
            }}
          />
        )
      })}
    </div>
  )
}

// ── Pure tap-chip step (age, position) ──────────────────────────────────
// Single-select, advances on tap when that's the whole answer — no "Next"
// wait. Used for age + position because there's literally nothing else to
// say once they've picked.
function StepTapChoice({
  title,
  subtitle,
  chips,
  value,
  setValue,
  onAdvance,
  onBack,
  showBack = true,
}: {
  title: string
  subtitle: string
  chips: { value: string; label: string }[]
  value: string
  setValue: (v: string) => void
  onAdvance: () => void
  onBack?: () => void
  showBack?: boolean
}) {
  const canAdvance = value.trim().length > 0
  return (
    <>
      {showBack && onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-gray-600 hover:text-white text-xs mb-6 self-start transition-colors"
        >
          ← Back
        </button>
      )}

      <h1 className="text-3xl font-bold tracking-tight leading-tight mb-3">{title}</h1>
      <p className="text-gray-500 text-sm mb-10">{subtitle}</p>

      <div className="flex flex-wrap gap-2.5">
        {chips.map((chip) => {
          const active = value === chip.value
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => setValue(chip.value)}
              className={`text-base px-5 py-3 rounded-full border transition-colors ${
                active
                  ? 'bg-white text-black border-white'
                  : 'bg-transparent text-gray-300 border-gray-800 hover:border-gray-600'
              }`}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      <div className="mt-auto pt-8">
        <button
          type="button"
          onClick={onAdvance}
          disabled={!canAdvance}
          className="w-full bg-white text-black py-4 text-sm font-bold rounded-full disabled:opacity-20 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
        >
          Next →
        </button>
      </div>
    </>
  )
}

// ── Chip-or-type step (struggle) ────────────────────────────────────────
// Chips for common answers + free-text fallback for anything not listed.
function StepChipOrType({
  title,
  subtitle,
  chips,
  value,
  setValue,
  onAdvance,
  onBack,
}: {
  title: string
  subtitle: string
  chips: string[]
  value: string
  setValue: (v: string) => void
  onAdvance: () => void
  onBack: () => void
}) {
  const canAdvance = value.trim().length > 0
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="text-gray-600 hover:text-white text-xs mb-6 self-start transition-colors"
      >
        ← Back
      </button>

      <h1 className="text-3xl font-bold tracking-tight leading-tight mb-3">{title}</h1>
      <p className="text-gray-500 text-sm mb-8">{subtitle}</p>

      <div className="flex flex-wrap gap-2 mb-5">
        {chips.map((chip) => {
          const active = value === chip
          return (
            <button
              key={chip}
              type="button"
              onClick={() => setValue(chip)}
              className={`text-sm px-4 py-2.5 rounded-full border transition-colors ${
                active
                  ? 'bg-white text-black border-white'
                  : 'bg-transparent text-gray-300 border-gray-800 hover:border-gray-600'
              }`}
            >
              {chip}
            </button>
          )
        })}
      </div>

      <input
        type="text"
        value={chips.includes(value) ? '' : value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Or type your own..."
        className="w-full px-0 py-3 bg-transparent border-0 border-b border-gray-800 focus:border-white text-white placeholder-gray-600 outline-none transition-colors text-sm"
      />

      <div className="mt-auto pt-8">
        <button
          type="button"
          onClick={onAdvance}
          disabled={!canAdvance}
          className="w-full bg-white text-black py-4 text-sm font-bold rounded-full disabled:opacity-20 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
        >
          Next →
        </button>
      </div>
    </>
  )
}

// ── Name step ────────────────────────────────────────────────────────────
function StepName({
  firstName,
  setFirstName,
  onAdvance,
  onBack,
}: {
  firstName: string
  setFirstName: (v: string) => void
  onAdvance: () => void
  onBack: () => void
}) {
  const canAdvance = firstName.trim().length > 0
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && canAdvance) onAdvance()
  }
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="text-gray-600 hover:text-white text-xs mb-6 self-start transition-colors"
      >
        ← Back
      </button>

      <h1 className="text-3xl font-bold tracking-tight leading-tight mb-3">
        What do I call you?
      </h1>
      <p className="text-gray-500 text-sm mb-10">First name is fine.</p>

      <input
        type="text"
        autoFocus
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        onKeyDown={onKey}
        autoComplete="given-name"
        className="w-full px-0 py-3 bg-transparent border-0 border-b border-gray-700 focus:border-white text-white text-2xl outline-none transition-colors"
      />

      <div className="mt-auto pt-8">
        <button
          type="button"
          onClick={onAdvance}
          disabled={!canAdvance}
          className="w-full bg-white text-black py-4 text-sm font-bold rounded-full disabled:opacity-20 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
        >
          Next →
        </button>
      </div>
    </>
  )
}

// ── Email step ───────────────────────────────────────────────────────────
function StepEmail({
  email,
  setEmail,
  ageConfirmed,
  setAgeConfirmed,
  onAdvance,
  onBack,
  loading,
  error,
}: {
  email: string
  setEmail: (v: string) => void
  ageConfirmed: boolean
  setAgeConfirmed: (v: boolean) => void
  onAdvance: () => void
  onBack: () => void
  loading: boolean
  error: string
}) {
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) onAdvance()
  }
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        disabled={loading}
        className="text-gray-600 hover:text-white text-xs mb-6 self-start transition-colors disabled:opacity-40"
      >
        ← Back
      </button>

      <h1 className="text-3xl font-bold tracking-tight leading-tight mb-3">
        Where do I send it?
      </h1>
      <p className="text-gray-500 text-sm mb-10">So my full answer lands in your inbox.</p>

      <input
        type="email"
        autoFocus
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={onKey}
        autoComplete="email"
        className="w-full px-0 py-3 bg-transparent border-0 border-b border-gray-700 focus:border-white text-white text-xl placeholder-gray-700 outline-none transition-colors mb-6"
      />

      <label className="flex items-start gap-2 text-xs text-gray-500 cursor-pointer">
        <input
          type="checkbox"
          checked={ageConfirmed}
          onChange={(e) => setAgeConfirmed(e.target.checked)}
          className="mt-0.5 accent-white"
        />
        I confirm I am 13 years of age or older
      </label>

      {error && <p className="text-red-400 text-xs mt-4">{error}</p>}

      <div className="mt-auto pt-8">
        <button
          type="button"
          onClick={onAdvance}
          disabled={!email.trim() || !ageConfirmed || loading}
          className="w-full bg-white text-black py-4 text-sm font-bold rounded-full disabled:opacity-20 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
        >
          {loading ? 'Checking...' : 'Next →'}
        </button>
      </div>
    </>
  )
}

// ── Save step (auth) ────────────────────────────────────────────────────
function StepAuth({
  email,
  password,
  setPassword,
  onPasswordSubmit,
  onOAuth,
  onBack,
  loading,
  error,
}: {
  email: string
  password: string
  setPassword: (v: string) => void
  onPasswordSubmit: () => void
  onOAuth: (provider: 'google' | 'apple') => void
  onBack: () => void
  loading: null | 'password' | 'google' | 'apple'
  error: string
}) {
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && password.length >= 8 && !loading) onPasswordSubmit()
  }
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        disabled={loading !== null}
        className="text-gray-600 hover:text-white text-xs mb-6 self-start transition-colors disabled:opacity-40"
      >
        ← Back
      </button>

      <h1 className="text-3xl font-bold tracking-tight leading-tight mb-3">
        Save your court.
      </h1>
      <p className="text-gray-500 text-sm mb-8 break-all">{email}</p>

      <button
        type="button"
        onClick={() => onOAuth('apple')}
        disabled={loading !== null}
        className="w-full border border-gray-700 hover:border-white text-white py-3 text-sm font-semibold rounded-full disabled:opacity-30 transition-colors flex items-center justify-center gap-2 mb-3"
      >
        <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor" aria-hidden="true">
          <path d="M11.16 8.47c0-1.73 1.41-2.55 1.47-2.6-.8-1.17-2.05-1.33-2.5-1.35-1.06-.11-2.07.62-2.6.62-.55 0-1.38-.61-2.27-.59-1.17.02-2.25.68-2.85 1.73-1.22 2.11-.31 5.23.88 6.94.58.84 1.27 1.78 2.17 1.75.87-.04 1.2-.56 2.25-.56 1.05 0 1.35.56 2.27.55.94-.02 1.54-.86 2.11-1.7.67-.97.95-1.93.96-1.98-.02-.01-1.84-.7-1.86-2.78zM9.67 3.52c.48-.58.8-1.39.71-2.19-.69.03-1.52.46-2.02 1.04-.44.51-.84 1.33-.73 2.12.77.06 1.56-.39 2.04-.97z" />
        </svg>
        {loading === 'apple' ? 'Opening Apple...' : 'Continue with Apple'}
      </button>

      <button
        type="button"
        onClick={() => onOAuth('google')}
        disabled={loading !== null}
        className="w-full border border-gray-700 hover:border-white text-white py-3 text-sm font-semibold rounded-full disabled:opacity-30 transition-colors flex items-center justify-center gap-2 mb-6"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        {loading === 'google' ? 'Opening Google...' : 'Continue with Google'}
      </button>

      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-gray-900" />
        <span className="text-[10px] text-gray-600 uppercase tracking-widest">or create a password</span>
        <div className="flex-1 h-px bg-gray-900" />
      </div>

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={onKey}
        placeholder="8+ characters"
        autoComplete="new-password"
        className="w-full px-4 py-3 bg-transparent border border-gray-700 focus:border-white text-white placeholder-gray-600 outline-none transition-colors text-sm rounded-full mb-4"
      />

      {error && <p className="text-red-400 text-xs mb-3 text-center">{error}</p>}

      <button
        type="button"
        onClick={onPasswordSubmit}
        disabled={!password.trim() || loading !== null}
        className="w-full bg-white text-black py-3 text-sm font-bold rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
      >
        {loading === 'password' ? 'Setting up...' : 'Save my court →'}
      </button>
    </>
  )
}
