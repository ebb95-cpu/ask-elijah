'use client'

import { useEffect, useState } from 'react'

const DISMISS_KEY = 'ae_court_welcome_seen'

/**
 * First-visit payoff modal shown on /track after onboarding. Structured as
 * Hormozi's pain-agitate-diagnose-solve inside a Nir-Eyal fast-reward
 * pacing: the player just invested (age, position, struggle, name, email,
 * account) and needs an immediate dopamine hit validating "this is going
 * to fix the thing I told you about."
 *
 *   Card 1 — Pain acknowledgment. Mirrors the struggle they named in
 *            onboarding back at them so it feels heard.
 *   Card 2 — Agitate. Name what they've already tried that didn't work.
 *   Card 3 — Diagnose. Real neuroscience for WHY harder-reps-alone fails.
 *   Card 4 — Solve. Position Ask Elijah as the unique mechanism.
 *
 * Copy is brutally tight per the fast-reward rule: each card is a one-line
 * headline + one-line body. Full read time ~10-15 seconds. No em dashes,
 * no "AI" references, first-person Elijah voice throughout.
 *
 * The struggle prop comes from profiles.challenge (captured in onboarding
 * step 3). If it's missing (OAuth user, edge case) we fall back to
 * generic copy that still works.
 */
export default function CourtWelcomeBanner({ struggle }: { struggle?: string | null }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISMISS_KEY)) setVisible(true)
    } catch {
      /* localStorage blocked — skip */
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  if (!visible) return null

  // Personalize the pain card with the struggle they named. Fallback is
  // generic but still validating.
  const painHeadline = struggle?.trim()
    ? `You told me it\u2019s ${struggle.trim().toLowerCase()}.`
    : 'You came here for a reason.'

  return (
    <div
      className="fixed inset-0 z-50 bg-black overflow-y-auto"
      style={{
        animation: 'stepIn 400ms cubic-bezier(0.22, 1, 0.36, 1) both',
      }}
    >
      <div className="max-w-xl mx-auto px-5 py-10 flex flex-col min-h-[100dvh]">
        <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-4">Why this works</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-10">
          You&rsquo;re about to speed up.
        </h1>

        <div className="flex flex-col gap-7 mb-10">
          <Card
            headline={painHeadline}
            body="I hear you. That&rsquo;s why you&rsquo;re here."
          />
          <Card
            headline="Harder isn&rsquo;t the answer."
            body="If reps alone fixed it, you&rsquo;d be fixed by now."
          />
          <Card
            headline="It&rsquo;s your brain under pressure."
            body="Stress shuts down the part running your game. No drill reaches it."
          />
          <Card
            headline="That&rsquo;s what we train here."
            body="Every answer: neuroscience-backed. Specific to you. Not generic."
          />
        </div>

        <div className="mt-auto pt-4">
          <button
            onClick={dismiss}
            className="w-full bg-white text-black py-4 text-sm font-bold rounded-full hover:opacity-80 transition-opacity"
          >
            I&rsquo;m ready. →
          </button>
        </div>
      </div>
    </div>
  )
}

function Card({ headline, body }: { headline: string; body: string }) {
  return (
    <div className="border-l-2 border-white pl-5">
      <h2
        className="text-white font-bold text-lg sm:text-xl leading-tight mb-2"
        dangerouslySetInnerHTML={{ __html: headline }}
      />
      <p
        className="text-gray-400 text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: body }}
      />
    </div>
  )
}
