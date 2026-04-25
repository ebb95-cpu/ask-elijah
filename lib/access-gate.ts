import { getSupabase } from '@/lib/supabase-server'

export const ACCESS_REQUIRED_MESSAGE =
  "Access isn't open for this email yet. Join the list and Elijah will let you in when your number gets called."

export function isAccessGateEnabled(): boolean {
  return process.env.ACCESS_GATE_ENABLED !== 'false'
}

export async function hasPlayerAccess(email: string): Promise<boolean> {
  if (!isAccessGateEnabled()) return true

  const cleanEmail = email.trim().toLowerCase()
  if (!cleanEmail) return false

  const supabase = getSupabase()

  // Existing accounts should not get locked out when the launch gate turns on.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', cleanEmail)
    .maybeSingle()

  if (profile?.id) return true

  const { data: waitlistEntry } = await supabase
    .from('waitlist')
    .select('approved')
    .eq('email', cleanEmail)
    .maybeSingle()

  return waitlistEntry?.approved === true
}
