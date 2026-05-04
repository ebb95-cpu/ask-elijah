import { unstable_cache } from 'next/cache'
import { getSupabase } from '@/lib/supabase-server'

export const FOUNDING_SEAT_LIMIT = 200

export const getFoundingSeatCount = unstable_cache(async () => {
  try {
    const withArchive = await getSupabase()
      .from('waitlist')
      .select('id', { count: 'exact', head: true })
      .eq('approved', true)
      .is('archived_at', null)

    const { count, error } = withArchive.error && /archived_at/.test(withArchive.error.message || '')
      ? await getSupabase()
        .from('waitlist')
        .select('id', { count: 'exact', head: true })
        .eq('approved', true)
      : withArchive

    if (error) return null
    return count || 0
  } catch {
    return null
  }
}, ['founding-seat-count'], { revalidate: 60 })

export function getFoundingSeatsLeft(count: number | null, limit = FOUNDING_SEAT_LIMIT) {
  if (count === null) return null
  return Math.max(limit - count, 0)
}
