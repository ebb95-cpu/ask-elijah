'use client'

import { useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase-client'

const PENDING_KEY = 'ae_pending_profile'

/**
 * Runs once on /track after an OAuth sign-in. If localStorage has
 * ae_pending_profile (written by AccountSetupForm before the Google redirect),
 * it reads the session email and POSTs the onboarding fields to /api/profile.
 * Clears the key whether it succeeds or not so it never runs twice.
 */
export default function ProfileSyncer() {
  useEffect(() => {
    let raw: string | null = null
    try {
      raw = localStorage.getItem(PENDING_KEY)
    } catch { return }
    if (!raw) return

    // Clear immediately so a page refresh doesn't re-fire.
    try { localStorage.removeItem(PENDING_KEY) } catch { /* ignore */ }

    let pending: Record<string, string | null>
    try {
      pending = JSON.parse(raw)
    } catch { return }

    // Only proceed if there's at least one non-null value worth saving.
    const hasData = Object.values(pending).some((v) => v && v.trim())
    if (!hasData) return

    getSupabaseClient().auth.getSession().then(({ data }) => {
      const email = data?.session?.user?.email
      if (!email) return
      fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ...pending }),
      }).catch(() => { /* fire-and-forget */ })
    })
  }, [])

  return null
}
