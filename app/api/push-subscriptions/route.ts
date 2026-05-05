import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { requireAuthorizedEmail } from '@/lib/session-email'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null,
  })
}

export async function POST(req: NextRequest) {
  const authorized = await requireAuthorizedEmail(req)
  if (authorized instanceof NextResponse) return authorized

  const body = await req.json().catch(() => null) as {
    subscription?: {
      endpoint?: string
      keys?: { p256dh?: string; auth?: string }
    }
  } | null

  const endpoint = body?.subscription?.endpoint?.trim()
  const p256dh = body?.subscription?.keys?.p256dh?.trim()
  const auth = body?.subscription?.keys?.auth?.trim()

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Missing push subscription.' }, { status: 400 })
  }

  const { error } = await getSupabase()
    .from('push_subscriptions')
    .upsert({
      email: authorized,
      endpoint,
      p256dh,
      auth,
      enabled: true,
      user_agent: req.headers.get('user-agent') || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })

  if (error) {
    if (/push_subscriptions|relation/i.test(error.message || '')) {
      return NextResponse.json({ error: 'Push storage is missing. Apply the P0 Founders migration.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Could not save push subscription.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
