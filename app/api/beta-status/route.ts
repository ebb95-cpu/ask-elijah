import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export async function GET() {
  const cap = parseInt(process.env.BETA_CAP || '0', 10)

  // 0 means no cap — open to everyone
  if (cap === 0) {
    return NextResponse.json({ isCapped: false, spotsLeft: null, cap: 0 })
  }

  // Count unique users who have submitted questions
  const { data, error } = await getSupabase()
    .from('questions')
    .select('email')

  if (error) {
    return NextResponse.json({ isCapped: false, spotsLeft: null, cap })
  }

  const uniqueUsers = new Set((data || []).map((r: { email: string }) => r.email?.toLowerCase()).filter(Boolean))
  const used = uniqueUsers.size
  const spotsLeft = Math.max(0, cap - used)
  const isCapped = used >= cap

  return NextResponse.json({ isCapped, spotsLeft, cap, used })
}
