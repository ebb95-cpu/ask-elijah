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

  // Paid locker-room limit is monthly. This endpoint is advisory for the UI;
  // the server ask route remains the source of truth.
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('email', clean)
    .gte('created_at', monthStart.toISOString())

  return NextResponse.json({
    subscribed,
    isFoundingMember: profile?.is_founding_member ?? false,
    questionsThisMonth: count ?? 0,
    monthlyLimit: 5,
    canAsk: subscribed ? (count ?? 0) < 5 : false,
  })
}
