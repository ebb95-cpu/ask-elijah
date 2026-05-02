import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const FOUNDING_SEAT_LIMIT = 200

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as {
    email?: string
    basketballCost?: string
    waitlistOnly?: boolean
  } | null

  const email = body?.email?.trim().toLowerCase() || ''
  const basketballCost = body?.basketballCost?.trim() || ''
  const waitlistOnly = body?.waitlistOnly === true

  if (!validEmail(email)) {
    return NextResponse.json({ error: 'Enter a real email.' }, { status: 400 })
  }

  const supabase = getSupabase()
  const activeCount = await supabase
    .from('waitlist')
    .select('id', { count: 'exact', head: true })
    .eq('approved', true)
    .is('archived_at', null)

  const { count, error: countError } = activeCount.error && /archived_at/.test(activeCount.error.message || '')
    ? await supabase
      .from('waitlist')
      .select('id', { count: 'exact', head: true })
      .eq('approved', true)
    : activeCount

  if (countError) {
    return NextResponse.json({ error: 'Could not check seat count yet.' }, { status: 500 })
  }

  const isFull = (count || 0) >= FOUNDING_SEAT_LIMIT
  if (!isFull && !waitlistOnly && basketballCost.length < 30) {
    return NextResponse.json({ error: 'Tell Elijah what is actually costing you. Minimum 30 characters.' }, { status: 400 })
  }

  const payload: { email: string; confirmed: boolean; approved: boolean; challenge?: string; archived_at?: null } = {
    email,
    confirmed: true,
    approved: false,
    archived_at: null,
  }

  if (!isFull && !waitlistOnly) {
    payload.challenge = basketballCost
  }

  let result = await supabase
    .from('waitlist')
    .upsert(payload, { onConflict: 'email' })

  if (result.error && /archived_at/.test(result.error.message || '')) {
    const fallbackPayload = { ...payload }
    delete fallbackPayload.archived_at
    result = await supabase
      .from('waitlist')
      .upsert(fallbackPayload, { onConflict: 'email' })
  }

  const { error } = result

  if (error) {
    return NextResponse.json({ error: 'Could not save this application yet.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, full: isFull, waitlisted: isFull || waitlistOnly, seatsTaken: count || 0 })
}
