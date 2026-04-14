import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const cap = parseInt(process.env.BETA_CAP || '0', 10)

  // 0 means no cap — open to everyone
  if (cap === 0) {
    return NextResponse.json({ isCapped: false, spotsLeft: null, cap: 0 })
  }

  // Count unique users who have submitted questions
  const { data, error } = await supabase
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
