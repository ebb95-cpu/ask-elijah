import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ subscribed: false, questionsThisWeek: 0 })

  const supabase = getSupabase()
  const clean = email.trim().toLowerCase()

  // Check subscription status
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, is_founding_member')
    .eq('email', clean)
    .single()

  const subscribed = profile?.subscription_status === 'active' || profile?.subscription_status === 'past_due'

  // Count questions in the last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('email', clean)
    .gte('created_at', weekAgo)

  return NextResponse.json({
    subscribed,
    isFoundingMember: profile?.is_founding_member ?? false,
    questionsThisWeek: count ?? 0,
    freeLimit: 1,
    canAsk: subscribed || (count ?? 0) < 1,
  })
}
