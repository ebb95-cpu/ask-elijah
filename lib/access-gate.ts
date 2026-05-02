import { getSupabase } from '@/lib/supabase-server'

export const ACCESS_REQUIRED_MESSAGE =
  "Access isn't open for this email yet. Join the list and Elijah will let you in when your number gets called."

export const ACCESS_EXPIRED_MESSAGE =
  "Your invite expired because no question was asked in time. Join the list again and Elijah can open another spot when one is available."

export function isAccessGateEnabled(): boolean {
  return process.env.ACCESS_GATE_ENABLED !== 'false'
}

export async function hasPlayerAccess(email: string): Promise<boolean> {
  if (!isAccessGateEnabled()) return true

  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail) return false

  const supabase = getSupabase()

  const { data: waitlistEntry, error: waitlistError } = await supabase
    .from('waitlist')
    .select('approved, invite_sent_at, access_expires_at, archived_at')
    .eq('email', cleanEmail)
    .maybeSingle()

  if (waitlistError) {
    // Backward-compatible fallback for environments that have not run the
    // access-expiry migration yet.
    const { data: fallbackEntry } = await supabase
      .from('waitlist')
      .select('approved')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (fallbackEntry) return fallbackEntry.approved === true
  }

  if (waitlistEntry) {
    if (waitlistEntry.archived_at) return false
    if (waitlistEntry.approved !== true) return false

    if (waitlistEntry.access_expires_at && new Date(waitlistEntry.access_expires_at) < new Date()) {
      let query = supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('email', cleanEmail)
        .lte('created_at', waitlistEntry.access_expires_at)
        .limit(1)

      if (waitlistEntry.invite_sent_at) {
        query = query.gte('created_at', waitlistEntry.invite_sent_at)
      }

      const { count } = await query
      return (count || 0) > 0
    }

    return true
  }

  // Existing accounts that predate the launch gate should not get locked out
  // just because there is no waitlist row for them.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', cleanEmail)
    .maybeSingle()

  return !!profile?.id
}
