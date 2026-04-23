import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { email, name, challenge } = await req.json()

  if (!email?.trim() || !name?.trim()) {
    return NextResponse.json({ error: 'Email and name are required' }, { status: 400 })
  }

  const cleanEmail = email.trim().toLowerCase()
  const isSignupClosed = process.env.SIGNUP_CLOSES_AT && new Date() > new Date(process.env.SIGNUP_CLOSES_AT)
  const supabase = getSupabase()
  const resend = new Resend(process.env.RESEND_API_KEY)

  // Upsert — if they already signed up, just return ok (don't send another confirmation)
  const { data: existing } = await supabase
    .from('waitlist')
    .select('id, confirmed, confirm_token')
    .eq('email', cleanEmail)
    .single()

  if (existing?.confirmed) {
    return NextResponse.json({ ok: true, alreadyConfirmed: true })
  }

  const { data, error } = await supabase
    .from('waitlist')
    .upsert(
      { email: cleanEmail, name: name.trim(), challenge: challenge?.trim() || null },
      { onConflict: 'email' }
    )
    .select('confirm_token')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to join waitlist' }, { status: 500 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elijahbryant.pro'
  const firstName = name.trim().split(' ')[0]

  if (isSignupClosed) {
    // Signups closed — collect email and notify when reopening
    await resend.emails.send({
      from: 'Elijah Bryant <elijah@elijahbryant.pro>',
      to: cleanEmail,
      subject: 'You are on the list.',
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background-color:#000000;" bgcolor="#000000">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000" style="background-color:#000000;">
    <tr><td align="center" bgcolor="#000000" style="background-color:#000000;">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td bgcolor="#000000" style="padding:48px 32px 32px;background-color:#000000;">

          <p style="text-align:center;margin:0 0 48px;line-height:0;">
            <img src="https://elijahbryant.pro/logo-email.png" width="52" height="8" alt="" style="display:inline-block;border:0;width:52px;height:8px;" />
          </p>

          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">Got it,</p>
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">${firstName}.</p>

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">
            First round is full. Faith + Consistency aren't built fast. You're in the locker room. Your number gets called when we tip off the next game.
          </p>

          <p style="font-size:14px;color:#ffffff !important;margin:0 0 16px;font-family:-apple-system,sans-serif;">Elijah</p>
          <p style="font-size:11px;color:#444444;margin:0;letter-spacing:0.08em;text-transform:uppercase;font-family:-apple-system,sans-serif;">Your body is trained. Your mind isn't.</p>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    }).catch(console.error)
  } else {
    // Signups open — standard confirmation email
    const confirmUrl = `${siteUrl}/api/waitlist/confirm?token=${data.confirm_token}`

    await resend.emails.send({
      from: 'Elijah Bryant <elijah@elijahbryant.pro>',
      to: cleanEmail,
      subject: 'One click and you are locked in.',
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background-color:#000000;" bgcolor="#000000">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000" style="background-color:#000000;">
    <tr><td align="center" bgcolor="#000000" style="background-color:#000000;">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td bgcolor="#000000" style="padding:48px 32px 32px;background-color:#000000;">

          <p style="text-align:center;margin:0 0 48px;line-height:0;">
            <img src="https://elijahbryant.pro/logo-email.png" width="52" height="8" alt="" style="display:inline-block;border:0;width:52px;height:8px;" />
          </p>

          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">Good. You showed up,</p>
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">${firstName}.</p>

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">
            Most players never ask for help. You did. Click below to lock in your place. When Elijah opens access back up, you go first.
          </p>

          <p style="font-size:13px;margin:0 0 56px;font-family:-apple-system,sans-serif;">
            <a href="${confirmUrl}" style="color:#555555;text-decoration:none;">Lock in my place →</a>
          </p>

          <p style="font-size:14px;color:#ffffff !important;margin:0 0 16px;font-family:-apple-system,sans-serif;">Elijah</p>
          <p style="font-size:11px;color:#444444;margin:0;letter-spacing:0.08em;text-transform:uppercase;font-family:-apple-system,sans-serif;">Your body is trained. Your mind isn't.</p>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    }).catch(console.error)
  }

  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const { data, error } = await getSupabase()
    .from('waitlist')
    .select('id, email, name, challenge, confirmed, approved, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch waitlist' }, { status: 500 })
  }

  return NextResponse.json({ waitlist: data || [] })
}
