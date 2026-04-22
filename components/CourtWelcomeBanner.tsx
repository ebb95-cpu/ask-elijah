'use client'

import { useEffect, useState } from 'react'

const DISMISS_KEY = 'ae_court_welcome_seen'

/**
 * First-visit full-screen modal shown on /track after a player completes
 * onboarding. Replaces the earlier one-line welcome banner with a
 * neuroscience-grounded "why this works" payoff — the Hooked investment
 * pays off moment. The player just committed (name, age, position,
 * struggle, email, account) and this validates "I did the right thing."
 *
 * Content is written in Elijah's first-person voice. No specific
 * citations (to keep it feeling like him, not a research paper) but
 * every claim maps to real well-established findings:
 *   - Motor imagery activates motor cortex: Jeannerod 1994, Pascual-Leone
 *     1995, Ranganathan 2004 et al.
 *   - Acute stress cortisol impairs prefrontal cortex function:
 *     Arnsten 2009.
 *   - Mental training transfers to general executive function:
 *     Diamond 2013 review on executive function training.
 *
 * Dismisses once per browser (localStorage). Returning users never see
 * it again.
 */
export default function CourtWelcomeBanner() {
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black overflow-y-auto"
      style={{
        animation: 'stepIn 400ms cubic-bezier(0.22, 1, 0.36, 1) both',
      }}
    >
      <div className="max-w-xl mx-auto px-5 py-10 flex flex-col min-h-[100dvh]">
        <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-4">Why this works</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-2">
          You&apos;re about to get better faster than everyone you play with.
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-10">
          Real neuroscience. Not hype. Here&apos;s what happens when you train the mind.
        </p>

        <div className="flex flex-col gap-6 mb-10">
          <Card
            headline="Your brain can&rsquo;t tell the difference."
            body="When you rehearse a play in your head, your motor cortex fires the same neurons as when you physically do it. Mental reps build the same neural pathways as physical reps. I got better at free throws lying in bed the night before a game. That&rsquo;s not a metaphor. That&rsquo;s neuroscience."
          />
          <Card
            headline="Pressure is a chemistry problem."
            body="Under stress, cortisol spikes. Your prefrontal cortex, the part running your game, starts shutting down. The routines I&rsquo;m going to teach you don&rsquo;t calm you down. They keep your brain online when it matters most."
          />
          <Card
            headline="The gains don&rsquo;t stay on the court."
            body="Working memory. Decision-making. Emotional control. The mental training you&rsquo;re starting right now transfers to class, relationships, anything hard. Players who train the mind get better at life, not just basketball."
          />
          <Card
            headline="The gap is the opportunity."
            body="The game is 90% mental. Your training has been 90% physical. Most players never close that gap. You&rsquo;re 60 seconds in and you already started."
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
