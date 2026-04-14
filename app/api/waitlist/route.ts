import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  const { email, name, challenge } = await req.json()

  if (!email?.trim() || !name?.trim()) {
    return NextResponse.json({ error: 'Email and name are required' }, { status: 400 })
  }

  const cleanEmail = email.trim().toLowerCase()

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
  const confirmUrl = `${siteUrl}/api/waitlist/confirm?token=${data.confirm_token}`

  await resend.emails.send({
    from: 'Elijah Bryant <elijah@elijahbryant.pro>',
    to: cleanEmail,
    subject: 'Confirm your spot.',
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

          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">One click,</p>
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">${name.trim().split(' ')[0]}.</p>

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">
            Confirm your spot on the waitlist. When access opens, you'll be first.
          </p>

          <p style="font-size:13px;margin:0 0 56px;font-family:-apple-system,sans-serif;">
            <a href="${confirmUrl}" style="color:#555555;text-decoration:none;">Confirm my spot →</a>
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

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const { data, error } = await supabase
    .from('waitlist')
    .select('id, email, name, challenge, confirmed, approved, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch waitlist' }, { status: 500 })
  }

  return NextResponse.json({ waitlist: data || [] })
}
