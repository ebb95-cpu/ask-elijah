import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabase } from '@/lib/supabase-server'
import { generatePromoCode, normalizePromoCode } from '@/lib/promo-codes'

export const dynamic = 'force-dynamic'

export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const { data, error } = await getSupabase()
    .from('trial_promo_codes')
    .select('id, code, label, trial_days, max_redemptions, redeemed_count, active, expires_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    const missing = /trial_promo_codes|relation|schema cache|42P01/i.test(error.message || '')
    return NextResponse.json(
      { codes: [], error: missing ? 'Promo code storage is missing. Apply supabase/migrations/add-trial-promo-codes.sql.' : error.message },
      { status: missing ? 200 : 500 }
    )
  }

  return NextResponse.json({ codes: data || [] })
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => ({}))
  const code = normalizePromoCode(body.code) || generatePromoCode(body.prefix)
  const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim() : 'Tester trial'
  const trialDays = Math.max(1, Math.min(90, Number(body.trialDays) || 30))
  const maxRedemptions = body.maxRedemptions === '' || body.maxRedemptions === null || body.maxRedemptions === undefined
    ? 1
    : Math.max(1, Math.min(1000, Number(body.maxRedemptions) || 1))
  const expiresAt = typeof body.expiresAt === 'string' && body.expiresAt ? new Date(body.expiresAt).toISOString() : null

  const { data, error } = await getSupabase()
    .from('trial_promo_codes')
    .insert({
      code,
      label,
      trial_days: trialDays,
      max_redemptions: maxRedemptions,
      expires_at: expiresAt,
      active: true,
    })
    .select('id, code, label, trial_days, max_redemptions, redeemed_count, active, expires_at, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ code: data })
}

export async function PATCH(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => ({}))
  const code = normalizePromoCode(body.code)
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (body.active !== undefined) update.active = body.active === true
  if (body.trial_days !== undefined) update.trial_days = Number(body.trial_days)
  if (body.max_redemptions !== undefined) update.max_redemptions = Number(body.max_redemptions)

  const { data, error } = await getSupabase()
    .from('trial_promo_codes')
    .update(update)
    .eq('code', code)
    .select('id, code, label, trial_days, max_redemptions, redeemed_count, active, expires_at, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ code: data })
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const code = normalizePromoCode(req.nextUrl.searchParams.get('code'))
  if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 })

  const supabase = getSupabase()
  const { data: existing, error: readError } = await supabase
    .from('trial_promo_codes')
    .select('code, redeemed_count')
    .eq('code', code)
    .maybeSingle()

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Code not found' }, { status: 404 })

  if (Number(existing.redeemed_count || 0) > 0) {
    return NextResponse.json({ error: 'This code has already been used. Pause it instead so redemption history stays intact.' }, { status: 409 })
  }

  const { error } = await supabase
    .from('trial_promo_codes')
    .delete()
    .eq('code', code)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true, code })
}
