import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { logError } from '@/lib/log-error'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { email?: string; magnet?: string } | null
  const email = body?.email?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 })
  }

  const supabase = getSupabase()
  const magnet = body?.magnet || 'consistency-club'
  const { error } = await supabase
    .from('parent_leads')
    .upsert({
      email,
      magnet,
      source: 'parents',
    }, { onConflict: 'email,magnet' })

  if (error) return NextResponse.json({ error: 'Could not save this email yet.' }, { status: 500 })

  const beehiivSubscribed = await addParentLeadToBeehiiv(email, magnet)

  return NextResponse.json({ ok: true, beehiivSubscribed })
}

async function addParentLeadToBeehiiv(email: string, magnet: string): Promise<boolean> {
  const apiKey = process.env.BEEHIIV_API_KEY
  const pubId = process.env.BEEHIIV_PUBLICATION_ID
  if (!apiKey || !pubId) return false

  try {
    const res = await fetch(`https://api.beehiiv.com/v2/publications/${pubId}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email,
        reactivate_existing: true,
        send_welcome_email: true,
        utm_source: 'ask-elijah',
        utm_medium: 'parents-page',
        utm_campaign: magnet,
        referring_site: 'elijahbryant.pro/parents',
        tags: ['acq:parents', 'newsletter:consistency-club', `magnet:${magnet}`],
      }),
    })

    if (!res.ok) {
      await logError('parents:beehiiv', `Beehiiv subscribe failed: ${res.status}`, { email, magnet })
      return false
    }

    return true
  } catch (err) {
    await logError('parents:beehiiv', err, { email, magnet })
    return false
  }
}
