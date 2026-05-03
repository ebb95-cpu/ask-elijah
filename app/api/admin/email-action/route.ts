import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabase } from '@/lib/supabase-server'

type EmailAction =
  | 'player_invite'
  | 'player_check_in'
  | 'parent_sequence'
  | 'consistency_club'

const ACTIONS: Record<EmailAction, {
  provider: 'beehiiv' | 'resend'
  label: string
  subject?: string
  tags?: string[]
}> = {
  player_invite: {
    provider: 'resend',
    label: 'Player invite',
    subject: "You're in.",
  },
  player_check_in: {
    provider: 'resend',
    label: 'Player check-in',
    subject: 'What happened after the answer?',
  },
  parent_sequence: {
    provider: 'beehiiv',
    label: 'Parent sequence',
    tags: ['acq:parents', 'sequence:parent-education', 'source:ask-elijah-admin'],
  },
  consistency_club: {
    provider: 'beehiiv',
    label: 'Consistency Club',
    tags: ['newsletter:consistency-club', 'source:ask-elijah-admin'],
  },
}

function cleanEmail(input: unknown): string {
  return typeof input === 'string' ? input.trim().toLowerCase() : ''
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

async function logEmailEvent(args: {
  email: string
  provider: 'beehiiv' | 'resend'
  action: string
  status: 'sent' | 'failed'
  subject?: string | null
  tags?: string[]
  metadata?: Record<string, unknown>
  error?: string | null
}) {
  await getSupabase()
    .from('crm_email_events')
    .insert({
      email: args.email,
      provider: args.provider,
      action: args.action,
      status: args.status,
      subject: args.subject || null,
      tags: args.tags || [],
      metadata: args.metadata || {},
      error: args.error || null,
    })
}

async function sendWithBeehiiv(email: string, tags: string[], metadata: Record<string, unknown>) {
  const apiKey = process.env.BEEHIIV_API_KEY
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID
  if (!apiKey || !publicationId) {
    throw new Error('Beehiiv is not configured.')
  }

  const res = await fetch(`https://api.beehiiv.com/v2/publications/${publicationId}/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      reactivate_existing: true,
      send_welcome_email: true,
      utm_source: 'ask_elijah_admin',
      referring_site: process.env.NEXT_PUBLIC_SITE_URL || 'https://elijahbryant.pro',
      custom_fields: [
        { name: 'ask_elijah_last_admin_action', value: String(metadata.action || '') },
        { name: 'ask_elijah_pain_point', value: String(metadata.challenge || '') },
      ].filter((field) => field.value),
      tags,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Beehiiv failed with ${res.status}${text ? `: ${text.slice(0, 180)}` : ''}`)
  }
}

async function sendPlayerInvite(email: string, name?: string | null) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elijahbryant.pro'
  const firstName = name?.trim().split(' ')[0] || 'You'
  const signUpUrl = `${siteUrl}/sign-up?email=${encodeURIComponent(email)}`

  await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: 'Elijah Bryant <elijah@elijahbryant.pro>',
    to: email,
    subject: "You're in.",
    html: `
<div style="background:#000;color:#fff;padding:48px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;">
    <p style="text-align:center;margin:0 0 48px;line-height:0;"><img src="https://elijahbryant.pro/logo-email.png" width="52" height="8" alt="" style="display:inline-block;border:0;width:52px;height:8px;" /></p>
    <h1 style="font-size:44px;line-height:1.02;letter-spacing:-0.04em;margin:0 0 8px;">You're in,</h1>
    <h2 style="font-size:44px;line-height:1.02;letter-spacing:-0.04em;color:#666;margin:0 0 48px;">${escapeHtml(firstName)}.</h2>
    <p style="font-size:17px;line-height:1.7;margin:0 0 24px;">Ask the question you've been sitting on. I'll send back one answer you can actually use.</p>
    <p style="font-size:15px;line-height:1.7;color:#aaa;margin:0 0 36px;">Your founder seat is held for 24 hours. If you want it, set up your locker room today. If not, I'll give the spot to another player who's ready to work.</p>
    <p style="border-left:3px solid #fff;padding-left:18px;font-size:17px;font-weight:700;margin:0 0 40px;">Ask. Elijah answers. Apply it.</p>
    <a href="${signUpUrl}" style="display:inline-block;color:#999;text-decoration:none;font-weight:700;">Set up my locker room →</a>
    <p style="font-size:15px;margin:56px 0 12px;">Elijah</p>
    <p style="font-size:11px;color:#444;letter-spacing:.14em;text-transform:uppercase;margin:0;">Your body is trained. Your mind isn't.</p>
  </div>
</div>`,
  })
}

async function sendPlayerCheckIn(email: string, name?: string | null) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elijahbryant.pro'
  const firstName = name?.trim().split(' ')[0]

  await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: 'Elijah Bryant <elijah@elijahbryant.pro>',
    to: email,
    subject: 'What happened after the answer?',
    html: `
<div style="background:#000;color:#fff;padding:48px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;">
    <p style="text-align:center;margin:0 0 48px;line-height:0;"><img src="https://elijahbryant.pro/logo-email.png" width="52" height="8" alt="" style="display:inline-block;border:0;width:52px;height:8px;" /></p>
    <h1 style="font-size:40px;line-height:1.05;letter-spacing:-0.04em;margin:0 0 32px;">${firstName ? `${escapeHtml(firstName)}, ` : ''}did you try the rep?</h1>
    <p style="font-size:17px;line-height:1.7;margin:0 0 24px;">Do not just collect answers. Use one. Then come back and tell me what happened.</p>
    <p style="font-size:15px;line-height:1.7;color:#aaa;margin:0 0 36px;">The next answer gets better when I know what you tried, what worked, and where it broke down.</p>
    <a href="${siteUrl}/track" style="display:inline-block;color:#000;background:#fff;border-radius:999px;padding:16px 28px;text-decoration:none;font-weight:800;">Open your locker room →</a>
    <p style="font-size:15px;margin:56px 0 0;">Elijah</p>
  </div>
</div>`,
  })
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null) as {
    email?: string
    name?: string | null
    challenge?: string | null
    action?: EmailAction
  } | null

  const email = cleanEmail(body?.email)
  const action = body?.action && body.action in ACTIONS ? body.action : null
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }
  if (!action) {
    return NextResponse.json({ error: 'Email action required' }, { status: 400 })
  }

  const config = ACTIONS[action]
  const metadata = {
    action,
    label: config.label,
    name: body?.name || null,
    challenge: body?.challenge || null,
  }

  try {
    if (config.provider === 'beehiiv') {
      await sendWithBeehiiv(email, config.tags || [], metadata)
    } else if (action === 'player_invite') {
      await sendPlayerInvite(email, body?.name)
    } else {
      await sendPlayerCheckIn(email, body?.name)
    }

    await logEmailEvent({
      email,
      provider: config.provider,
      action,
      status: 'sent',
      subject: config.subject || null,
      tags: config.tags || [],
      metadata,
    }).catch(() => {})

    return NextResponse.json({
      ok: true,
      provider: config.provider,
      action,
      label: config.label,
      subject: config.subject || null,
      sent_at: new Date().toISOString(),
      message: `${config.label} sent with ${config.provider === 'beehiiv' ? 'Beehiiv' : 'Resend'}.`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email action failed.'
    await logEmailEvent({
      email,
      provider: config.provider,
      action,
      status: 'failed',
      subject: config.subject || null,
      tags: config.tags || [],
      metadata,
      error: message,
    }).catch(() => {})

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
