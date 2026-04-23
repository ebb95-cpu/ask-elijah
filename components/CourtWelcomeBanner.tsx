'use client'

import { useEffect, useState } from 'react'

const DISMISS_KEY = 'ae_court_welcome_seen'

/**
 * First-visit payoff modal shown on /track after onboarding. Structured
 * as pain-mirror → mechanism → proof → transfer/solve. Each card anchors
 * to a real neuroscience study so the claims aren't vibes — Hormozi-style
 * proof stacking inside a Nir Eyal fast-reward pacing.
 *
 *   Card 1 — PAIN MIRROR. Reflects the struggle they named in onboarding
 *            back at them.
 *   Card 2 — MECHANISM (Harvard Medical School). Mental practice
 *            produces the same motor cortex reorganization as physical
 *            practice. Source: Pascual-Leone et al. 1995, "Modulation of
 *            muscle responses evoked by transcranial magnetic stimulation
 *            during the acquisition of new fine motor skills," Journal
 *            of Neurophysiology 74(3).
 *   Card 3 — PROOF (Cleveland Clinic). +35% finger abduction strength
 *            from imagined contractions alone, 0% from physical training
 *            in the control of no-imagery group. Source: Ranganathan,
 *            Siemionow, Liu, Sahgal, Yue 2004, "From mental power to
 *            muscle power — gaining strength by using the mind,"
 *            Neuropsychologia 42.
 *   Card 4 — TRANSFER + SOLUTION. Executive function training transfers
 *            across domains (Diamond 2013, Annual Review of Psychology).
 *            Brand close: "That's what we train here."
 *
 * Copy stays brutally tight per Nir Eyal fast-reward: ~10-15 second total
 * read. No em dashes, no "AI" references, first-person Elijah voice.
 *
 * The struggle prop comes from profiles.challenge (onboarding step 3).
 * If it's missing (OAuth edge case) we fall back to generic copy.
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
  const painBody = 'That\u2019s exactly what training the mind fixes.'

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
            body={painBody}
          />
          <Card
            headline="Your brain rewires when you train it."
            body="Harvard found mental practice builds the same motor cortex changes as physical practice."
          />
          <Card
            headline="Mental reps count. Literally."
            body="Cleveland Clinic measured +35% strength from imagined contractions alone. No movement required."
          />
          <Card
            headline="A stronger brain wins everywhere."
            body="Focus, composure, decisions. It carries to class, relationships, every hard thing. That&rsquo;s what we train here."
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
