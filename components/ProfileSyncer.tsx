'use client'

import { useEffect } from 'react'
import { getSupabaseClient } from '@/lib/supabase-client'

const PENDING_KEY = 'ae_pending_profile'

/**
 * Runs once on /track after auth or same-browser email verification. If
 * localStorage has ae_pending_profile, it saves those onboarding fields using
 * either the Supabase session or the signed track cookie.
 */
export default function ProfileSyncer() {
  useEffect(() => {
    let raw: string | null = null
    try {
      raw = localStorage.getItem(PENDING_KEY)
    } catch { return }
    if (!raw) return

    let pending: Record<string, string | null>
    try {
      pending = JSON.parse(raw)
    } catch { return }

    // Only proceed if there's at least one non-null value worth saving.
    const hasData = Object.values(pending).some((v) => v && v.trim())
    if (!hasData) return

    getSupabaseClient().auth.getSession().then(({ data }) => {
      const email = data?.session?.user?.email
      const endpoint = email ? '/api/profile' : '/api/track-profile'
      const body = email ? { email, ...pending } : pending

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then((res) => {
          if (res.ok) {
            try { localStorage.removeItem(PENDING_KEY) } catch { /* ignore */ }
          }
        })
        .catch(() => { /* retry on next /track visit */ })
    })
  }, [])

  return null
}
