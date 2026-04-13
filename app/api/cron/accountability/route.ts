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
    .lt('created_at', cutoff)
    .limit(50)

  if (error) {
    console.error('Accountability cron error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!questions?.length) {
    return NextResponse.json({ sent: 0, message: 'No accountability emails to send' })
  }

  // Batch-fetch names for personalization
  const emails = questions.map(q => q.email).filter(Boolean)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('email, first_name')
    .in('email', emails)
  const nameMap: Record<string, string> = {}
  for (const p of profiles || []) {
    if (p.email && p.first_name) nameMap[p.email] = p.first_name
  }

  let sent = 0

  for (const q of questions) {
    const firstName = nameMap[q.email] || null
    try {
      await resend.emails.send({
        from: 'Elijah Bryant <elijah@elijahbryant.pro>',
      replyTo: 'ebb95@mac.com',
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

          <p style="text-align:center;margin:0 0 48px;line-height:0;"><img src="https://elijahbryant.pro/logo-email.png" width="52" height="8" alt="" style="display:inline-block;border:0;width:52px;height:8px;" /></p>

          <!-- Big two-tone headline -->
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">48 hours.</p>
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">Did you do the steps?</p>

          ${firstName ? `<p style="font-size:15px;color:#ffffff !important;margin:0 0 24px;font-family:-apple-system,sans-serif;">Hey ${firstName}.</p>` : ''}

          <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:28px;">
            <p style="font-size:12px;color:#ffffff !important;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.08em;font-family:-apple-system,sans-serif;">You asked</p>
            <p style="font-size:15px;font-weight:600;margin:0;color:#ffffff !important;font-family:-apple-system,sans-serif;">${q.question}</p>
          </div>

          <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:32px;">
            <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#ffffff !important;margin:0 0 12px;font-family:-apple-system,sans-serif;">Your action steps</p>
            ${q.action_steps.split('\n').filter((s: string) => s.trim()).map((step: string) => `<p style="font-size:15px;line-height:1.6;color:#ffffff !important;margin:0 0 12px;font-family:-apple-system,sans-serif;">${step.trim()}</p>`).join('')}
          </div>

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 48px;font-family:-apple-system,sans-serif;">
            Most players read the answer and move on. The ones who actually get better do the steps.
          </p>

          <p style="font-size:18px;font-weight:700;margin:0 0 56px;font-family:-apple-system,sans-serif;">
            <a href="${siteUrl}/history" style="color:#ffffff !important;text-decoration:none;">Review your answer →</a>
          </p>

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
