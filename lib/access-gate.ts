import { getSupabase } from '@/lib/supabase-server'

export const ACCESS_REQUIRED_MESSAGE =
  "Access isn't open for this email yet. Join the list and Elijah will let you in when your number gets called."

export const ACCESS_EXPIRED_MESSAGE =
  "Your invite expired because no question was asked in time. Join the list again and Elijah can open another spot when one is available."

export function isAccessGateEnabled(): boolean {
  return process.env.ACCESS_GATE_ENABLED !== 'false'
}

function isTrialStillValid(trialEndsAt?: string | null): boolean {
  if (!trialEndsAt) return true
  return new Date(trialEndsAt) > new Date()
}

function isGraceStillValid(graceEndsAt?: string | null): boolean {
  return Boolean(graceEndsAt && new Date(graceEndsAt) > new Date())
}

export function profileHasEntitlement(profile: {
  is_founding_member?: boolean | null
  subscription_status?: string | null
  trial_ends_at?: string | null
  payment_grace_ends_at?: string | null
} | null): boolean {
  if (!profile) return false
  if (profile.is_founding_member === true) return true

  const status = (profile.subscription_status || '').toLowerCase()
  if (status === 'trialing') return isTrialStillValid(profile.trial_ends_at)
  if (status === 'past_due') return isGraceStillValid(profile.payment_grace_ends_at)
  return status === 'active'
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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_founding_member, subscription_status, trial_ends_at, payment_grace_ends_at')
    .eq('email', cleanEmail)
    .maybeSingle()

  if (!profileError) return profileHasEntitlement(profile)

  // Emergency escape hatch only. Keeping this opt-in prevents "profile exists"
  // from becoming the same thing as "has paid/trial access."
  if (process.env.LEGACY_PROFILE_ACCESS_ENABLED === 'true') {
    const { data: legacyProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle()
    return !!legacyProfile?.id
  }

  return false
}
