import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cap = parseInt(process.env.BETA_CAP || '200', 10)

  // 0 means no cap — open to everyone
  if (cap === 0) {
    return NextResponse.json({ isCapped: false, spotsLeft: null, cap: 0 })
  }

  // Founding seats are approved access rows, not random first-time visitors.
  const { count, error } = await getSupabase()
    .from('waitlist')
    .select('id', { count: 'exact', head: true })
    .eq('approved', true)

  if (error) {
    return NextResponse.json({ isCapped: false, spotsLeft: null, cap })
  }

  const used = count || 0
  const spotsLeft = Math.max(0, cap - used)
  const isCapped = used >= cap

  return NextResponse.json({ isCapped, spotsLeft, cap, used })
}
