import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ask-the-pro.vercel.app'
  const resend = new Resend(process.env.RESEND_API_KEY)

  // Find approved questions with action steps that haven't had accountability sent yet
  // and were approved at least 48 hours ago
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, question, email, action_steps, answer')
    .eq('status', 'approved')
    .not('action_steps', 'is', null)
    .is('accountability_sent_at', null)
    .lt('updated_at', cutoff)
    .limit(50)

  if (error) {
    console.error('Accountability cron error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!questions?.length) {
    return NextResponse.json({ sent: 0, message: 'No accountability emails to send' })
  }

  let sent = 0

  for (const q of questions) {
    try {
      await resend.emails.send({
        from: 'Elijah Bryant <elijah@elijahbryant.pro>',
        to: q.email,
        subject: '48 hours ago I gave you steps. Did you do them?',
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

          <p style="text-align:center;margin:0 0 16px;line-height:0;"><img src="https://elijahbryant.pro/logo-email.png" width="120" height="20" alt="" style="display:inline-block;border:0;width:120px;height:20px;" /></p>

          <!-- Credential line -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:48px;">
            <tr><td align="center" bgcolor="#000000" style="background-color:#000000;">
              <p style="font-size:10px;color:#555555;margin:0;text-transform:uppercase;letter-spacing:0.15em;font-family:-apple-system,sans-serif;">&#8226; Elijah Bryant &middot; NBA &middot; EuroLeague Champion &#8226;</p>
            </td></tr>
          </table>

          <!-- Big two-tone headline -->
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">48 hours.</p>
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">Did you do the steps?</p>

          <div style="border-left:3px solid #333333;padding-left:20px;margin-bottom:28px;">
            <p style="font-size:12px;color:#ffffff !important;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.08em;font-family:-apple-system,sans-serif;">You asked</p>
            <p style="font-size:15px;font-weight:600;margin:0;color:#ffffff !important;font-family:-apple-system,sans-serif;">${q.question}</p>
          </div>

          <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:32px;">
            <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#ffffff !important;margin:0 0 12px;font-family:-apple-system,sans-serif;">Your action steps</p>
            <div style="font-size:15px;line-height:1.8;color:#ffffff !important;white-space:pre-wrap;font-family:-apple-system,sans-serif;">${q.action_steps}</div>
          </div>

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 16px;font-family:-apple-system,sans-serif;">
            Most players read the answer and move on. The ones who actually get better do the steps.
          </p>
          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 40px;font-family:-apple-system,sans-serif;">
            Hit reply. Tell me what happened.
          </p>

          <table cellpadding="0" cellspacing="0" style="margin-bottom:48px;">
            <tr>
              <td bgcolor="#ffffff" style="background-color:#ffffff !important;">
                <a href="${siteUrl}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#000000 !important;text-decoration:none;font-family:-apple-system,sans-serif;">Tell me what happened →</a>
              </td>
            </tr>
          </table>

          <p style="font-size:14px;color:#ffffff !important;margin:0 0 16px;font-family:-apple-system,sans-serif;">Elijah</p>
          <p style="font-size:11px;color:#444444;margin:0;letter-spacing:0.08em;text-transform:uppercase;font-family:-apple-system,sans-serif;">Your body is trained. Your mind isn't.</p>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
        `,
      })

      // Mark accountability as sent
      await supabase
        .from('questions')
        .update({ accountability_sent_at: new Date().toISOString() })
        .eq('id', q.id)

      sent++
    } catch (err) {
      console.error(`Failed to send accountability for question ${q.id}:`, err)
    }
  }

  return NextResponse.json({ sent, total: questions.length })
}
