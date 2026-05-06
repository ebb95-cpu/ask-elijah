import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSupabase } from '@/lib/supabase-server'
import { escapeHtml } from '@/lib/escape-html'

export const dynamic = 'force-dynamic'

const FOUNDING_SEAT_LIMIT = 200

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function sendApplicationReceivedEmail(args: {
  email: string
  firstName?: string
  question?: string
  waitlisted: boolean
}) {
  if (!process.env.RESEND_API_KEY) return

  const firstName = args.firstName?.trim() || 'there'
  const headline = args.waitlisted ? "You're on the waitlist." : "Got it. Elijah's reading it."
  const body = args.waitlisted
    ? "Founders may be full or you chose the Locker Room waitlist. Either way, your name is in."
    : "Your application is in. Elijah will read the question and decide if this is a fit for the Founders 200."

  await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: 'Elijah Bryant <elijah@elijahbryant.pro>',
    to: args.email,
    subject: args.waitlisted ? "You're on the Locker Room waitlist." : "Got it. Elijah's reading it.",
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000;color:#fff;">
  <div style="max-width:560px;margin:0 auto;padding:48px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <p style="margin:0 0 40px;line-height:0;"><img src="https://elijahbryant.pro/logo-email.png" width="52" height="8" alt="" style="display:block;border:0;" /></p>
    <h1 style="font-size:36px;line-height:1.05;margin:0 0 24px;color:#fff;">${escapeHtml(headline)}</h1>
    <p style="font-size:15px;line-height:1.7;margin:0 0 22px;color:#bbb;">Hey ${escapeHtml(firstName)}. ${escapeHtml(body)}</p>
    ${args.question ? `
      <div style="border-left:3px solid #fff;padding-left:18px;margin:28px 0;">
        <p style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#666;margin:0 0 8px;">Your question</p>
        <p style="font-size:16px;line-height:1.5;color:#fff;margin:0;">${escapeHtml(args.question)}</p>
      </div>
    ` : ''}
    <p style="font-size:14px;line-height:1.7;margin:0;color:#777;">If you get accepted, your first question is already in the system. Nothing gets lost.</p>
  </div>
</body>
</html>
    `,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as {
    email?: string
    firstName?: string
    city?: string
    age?: string
    level?: string
    position?: string
    showOnWall?: boolean
    basketballCost?: string
    waitlistOnly?: boolean
  } | null

  const email = body?.email?.trim().toLowerCase() || ''
  const firstName = body?.firstName?.trim() || ''
  const city = body?.city?.trim() || ''
  const age = body?.age?.trim() || ''
  const level = body?.level?.trim() || ''
  const position = body?.position?.trim() || ''
  const showOnWall = body?.showOnWall === true
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
  if (isFull || waitlistOnly) {
    if (!firstName || !city || !level) {
      return NextResponse.json({ error: 'First name, city, and level are required for the Locker Room waitlist.' }, { status: 400 })
    }
  } else if (!firstName || !city || !age || !level || !position) {
    return NextResponse.json({ error: 'First name, city, age, level, and position are required.' }, { status: 400 })
  }
  if (!isFull && !waitlistOnly && basketballCost.length < 30) {
    return NextResponse.json({ error: 'Tell Elijah what is actually costing you. Minimum 30 characters.' }, { status: 400 })
  }

  const payload: {
    email: string
    confirmed: boolean
    approved: boolean
    challenge?: string
    name?: string
    city?: string
    age?: string
    level?: string
    position?: string
    founders_wall_opt_in?: boolean
    application_status?: 'pending' | 'waitlisted'
    archived_at?: null
  } = {
    email,
    confirmed: true,
    approved: false,
    application_status: isFull || waitlistOnly ? 'waitlisted' : 'pending',
    archived_at: null,
  }

  if (firstName) payload.name = firstName
  if (city) payload.city = city
  if (age) payload.age = age
  if (level) payload.level = level
  if (position) payload.position = position
  payload.founders_wall_opt_in = showOnWall

  if (!isFull && !waitlistOnly) {
    payload.challenge = basketballCost
  }

  let result = await supabase
    .from('waitlist')
    .upsert(payload, { onConflict: 'email' })

  if (result.error && /archived_at|city|founders_wall_opt_in|age|level|position|application_status/.test(result.error.message || '')) {
    const fallbackPayload = { ...payload }
    delete fallbackPayload.archived_at
    delete fallbackPayload.city
    delete fallbackPayload.age
    delete fallbackPayload.level
    delete fallbackPayload.position
    delete fallbackPayload.founders_wall_opt_in
    delete fallbackPayload.application_status
    result = await supabase
      .from('waitlist')
      .upsert(fallbackPayload, { onConflict: 'email' })
  }

  const { error } = result

  if (error) {
    return NextResponse.json({ error: 'Could not save this application yet.' }, { status: 500 })
  }

  sendApplicationReceivedEmail({
    email,
    firstName,
    question: !isFull && !waitlistOnly ? basketballCost : undefined,
    waitlisted: isFull || waitlistOnly,
  }).catch((err) => console.error('founders application email failed', err))

  return NextResponse.json({ ok: true, full: isFull, waitlisted: isFull || waitlistOnly, seatsTaken: count || 0 })
}
