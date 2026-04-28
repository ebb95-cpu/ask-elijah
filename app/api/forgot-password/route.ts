import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const cleanEmail = email.trim().toLowerCase()
  const supabase = getSupabase()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elijahbryant.pro'

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: cleanEmail,
    options: {
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    },
  })

  if (error || !data?.properties?.action_link) {
    // Don't leak whether the email exists — always say "sent".
    return NextResponse.json({ ok: true })
  }

  const resetLink = data.properties.action_link
  const firstName =
    (data.user?.user_metadata as { first_name?: string } | null)?.first_name || 'there'

  await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: 'Elijah Bryant <elijah@elijahbryant.pro>',
    to: cleanEmail,
    subject: 'Reset your password.',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <style>
    @media screen and (max-width: 600px) {
      .email-shell { width: 100% !important; }
      .email-pad { padding: 40px 24px 32px !important; }
      .email-title { font-size: 38px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#000000;" bgcolor="#000000">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000" style="background-color:#000000;">
    <tr><td align="center" bgcolor="#000000" style="background-color:#000000;">
      <table class="email-shell" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td class="email-pad" bgcolor="#000000" style="padding:48px 32px 32px;background-color:#000000;">

          <p style="text-align:center;margin:0 0 48px;line-height:0;"><img src="https://elijahbryant.pro/logo-email.png" width="52" height="8" alt="" style="display:inline-block;border:0;width:52px;height:8px;" /></p>

          <p class="email-title" style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">Reset your</p>
          <p class="email-title" style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 40px;color:#777777;font-family:-apple-system,sans-serif;">password, ${firstName}.</p>

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">Click the link below to set a new password. It expires in an hour.</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 56px;">
            <tr>
              <td>
                <a href="${resetLink}" style="display:block;width:100%;box-sizing:border-box;background-color:#ffffff;color:#000000 !important;text-decoration:none;text-align:center;border-radius:999px;padding:16px 20px;font-size:15px;font-weight:800;font-family:-apple-system,sans-serif;">Set a new password →</a>
              </td>
            </tr>
          </table>

          <p style="font-size:13px;color:#666666;line-height:1.7;margin:0 0 32px;font-family:-apple-system,sans-serif;">If you didn't ask for this, ignore this email and your password stays the same.</p>

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
