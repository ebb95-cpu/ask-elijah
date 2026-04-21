import { NextRequest, NextResponse } from 'next/server'
import { verifyEmail } from '@/lib/email-verify'
import { checkLimit } from '@/lib/rate-limit'

// Thin wrapper around lib/email-verify so the homepage email-gate can check
// deliverability (syntax + disposable blocklist + MX lookup + Kickbox) before
// we commit the question to the DB and email Elijah. Fails open on Kickbox
// service issues so a verification outage never blocks the funnel.
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'

  // Throttle anonymous abuse — 30/hour is plenty for real users typing an
  // email once or twice, but stops a bot from hammering Kickbox credits.
  const limit = await checkLimit('rl:verify-email', ip, 30, '1 h')
  if (!limit.success) {
    return NextResponse.json({ ok: false, reason: 'Too many attempts. Try again in a minute.' }, { status: 429 })
  }

  let email: string | undefined
  try {
    const body = await req.json()
    email = body?.email
  } catch {
    return NextResponse.json({ ok: false, reason: 'Invalid request' }, { status: 400 })
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    return NextResponse.json({ ok: false, reason: 'Email required' }, { status: 400 })
  }

  const result = await verifyEmail(email)
  return NextResponse.json(result)
}
