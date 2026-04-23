'use client'

import { useEffect, useState } from 'react'

const DISMISS_KEY = 'ae_locker_welcome_seen'

/**
 * First-visit bridge shown on /track after onboarding.
 *
 * Placement in the Hooked loop: the player just finished Investment
 * (onboarding). The Variable Reward (their answer) is one tap away.
 * This screen is a 5-second bridge — not a lecture. Its only job is to
 * prime them so the answer lands harder.
 *
 * Structure (Hormozi pain-mirror → reframe → proof → reward):
 *   1. Pain mirror   — their exact struggle reflected back (personalised).
 *   2. Reframe       — "that's a brain problem, not a skill problem."
 *                      Shifts blame from them to something trainable.
 *   3. Proof line    — one Harvard sentence. Enough. No stacking.
 *   4. CTA           — "Read my answer →" delivers the reward immediately.
 *
 * Fallback (no struggle captured — OAuth path): acknowledges the action
 * they took and creates positive tribe distinction ("most players never").
 */
export default function LockerRoomWelcomeBanner({ struggle }: { struggle?: string | null }) {
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
    } catch { /* ignore */ }
    setVisible(false)
  }

  if (!visible) return null

  const hasStruggle = !!struggle?.trim()
  const struggleText = struggle?.trim().toLowerCase() ?? ''

  // Pain mirror — reflects their exact onboarding answer back.
  // Fallback validates the act of asking when struggle isn't known.
  const headline = hasStruggle
    ? `You told me it\u2019s ${struggleText}.`
    : 'You asked. That already puts you ahead.'

  // Reframe — shifts the problem from a character flaw to something trainable.
  const reframe = hasStruggle
    ? `That\u2019s a brain problem, not a skill problem.`
    : 'Most players never address the mental side.'

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      style={{ animation: 'stepIn 400ms cubic-bezier(0.22, 1, 0.36, 1) both' }}
    >
      <div className="max-w-xl mx-auto w-full px-6 flex flex-col justify-center min-h-[100dvh]">

        <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-12">
          Before you read
        </p>

        {/* Pain mirror */}
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight text-white mb-5">
          {headline}
        </h1>

        {/* Reframe */}
        <p className="text-xl sm:text-2xl font-semibold text-gray-400 leading-snug mb-10">
          {reframe}
        </p>

        {/* One proof line — enough to make them believe, not enough to bore them */}
        <p className="text-sm text-gray-500 leading-relaxed">
          Harvard found mental reps build the same motor pathways as physical
          practice. Your mind trains like your body does.
        </p>

        <div className="mt-auto pt-16">
          <button
            onClick={dismiss}
            className="w-full bg-white text-black py-4 text-sm font-bold rounded-full hover:opacity-80 transition-opacity"
          >
            Read my answer &rarr;
          </button>
        </div>

      </div>
    </div>
  )
}
