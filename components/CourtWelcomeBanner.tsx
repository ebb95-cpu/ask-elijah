'use client'

import { useEffect, useState } from 'react'

const DISMISS_KEY = 'ae_court_welcome_seen'

/**
 * First-visit welcome banner on /track (a.k.a. "your court"). One sentence,
 * one dismiss. Replaces a modal walkthrough because both the Hooked and
 * Hormozi playbooks penalize onboarding friction — the best orientation is
 * a one-line narrator, not a click-through tour.
 *
 * Persistence: a localStorage flag scoped to this browser. If the user
 * clears storage, they'll see it again — that's fine.
 */
export default function CourtWelcomeBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISMISS_KEY)) setVisible(true)
    } catch {
      // localStorage blocked — just don't show the banner.
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
    <div className="mb-6 rounded-xl border border-gray-800 bg-[#0a0a0a] p-4 flex items-start gap-3">
      <p className="flex-1 text-xs text-gray-400 leading-relaxed">
        Welcome to your court. Your answers land at the top when I reply (24 to 48 hours). Scroll down to see what other players are asking while you wait.
      </p>
      <button
        onClick={dismiss}
        className="text-gray-600 hover:text-white transition-colors text-lg leading-none -mt-0.5 shrink-0"
        aria-label="Dismiss welcome banner"
      >
        ×
      </button>
    </div>
  )
}
