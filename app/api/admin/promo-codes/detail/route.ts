import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabase } from '@/lib/supabase-server'
import { normalizePromoCode } from '@/lib/promo-codes'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const code = normalizePromoCode(req.nextUrl.searchParams.get('code'))
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  const supabase = getSupabase()

  // Fetch the promo code itself
  const { data: promoData, error: promoError } = await supabase
    .from('trial_promo_codes')
    .select('id, code, label, trial_days, max_redemptions, redeemed_count, active, created_at')
    .eq('code', code)
    .single()

  if (promoError || !promoData) {
    return NextResponse.json({ error: 'Promo code not found' }, { status: 404 })
  }

  // Fetch all redemptions for this code
  const { data: redemptions } = await supabase
    .from('trial_promo_redemptions')
    .select('email, created_at')
    .eq('code', code)
    .order('created_at', { ascending: false })

  const emails = (redemptions || []).map((r: { email: string }) => r.email.toLowerCase())

  if (emails.length === 0) {
    return NextResponse.json({ ...promoData, users: [] })
  }

  // Fetch profiles for those emails
  const { data: profiles } = await supabase
    .from('profiles')
    .select('email, first_name, name, position, level, country')
    .in('email', emails)

  type Profile = { email: string; first_name: string | null; name: string | null; position: string | null; level: string | null; country: string | null }
  const profileMap = new Map<string, Profile>()
  for (const p of (profiles || []) as Profile[]) {
    if (p.email) profileMap.set(p.email.toLowerCase(), p)
  }

  // Fetch question counts per email
  const { data: questions } = await supabase
    .from('questions')
    .select('email')
    .in('email', emails)
    .not('status', 'eq', 'deleted')

  const questionCounts = new Map<string, number>()
  for (const q of (questions || []) as { email: string }[]) {
    const e = q.email?.toLowerCase()
    if (e) questionCounts.set(e, (questionCounts.get(e) || 0) + 1)
  }

  // Build user list
  const users = (redemptions || []).map((r: { email: string; created_at: string }) => {
    const email = r.email.toLowerCase()
    const prof = profileMap.get(email)
    return {
      email,
      name: prof?.first_name || prof?.name || '',
      position: prof?.position || null,
      level: prof?.level || null,
      country: prof?.country || null,
      redeemed_at: r.created_at,
      question_count: questionCounts.get(email) || 0,
    }
  })

  return NextResponse.json({ ...promoData, users })
}
