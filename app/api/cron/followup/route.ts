import { NextRequest, NextResponse } from 'next/server'
import { verifyBearer } from '@/lib/admin-auth'
import { getSupabase } from '@/lib/supabase-server'
import { Resend } from 'resend'
import { escapeHtml } from '@/lib/escape-html'
import { logError } from '@/lib/log-error'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * 7 days after Elijah approves an answer, email the user asking how it went.
 * This is the follow-through loop that no competitor closes — turns a one-shot
 * Q&A into a relationship.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!verifyBearer(auth, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ask-the-pro.vercel.app'
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Find approved answers from exactly ~7 days ago that haven't had a followup yet.
  // Cap at 50 per run so we don't hit Resend rate limits.
  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, email, question, approved_at')
    .eq('status', 'approved')
    .is('followup_sent_at', null)
    .is('deleted_at', null)
    .lte('approved_at', sevenDaysAgo)
    .not('approved_at', 'is', null)
    .order('approved_at', { ascending: true })
    .limit(50)

  if (error) {
    await logError('cron:followup:fetch', error)
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const results: { id: string; ok: boolean; error?: string }[] = []

  for (const q of questions || []) {
    try {
      // Pull first_name for personalization if we have it
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('email', q.email)
        .single()
      const firstName = profile?.first_name || null

      await resend.emails.send({
        from: 'Elijah Bryant <elijah@elijahbryant.pro>',
        replyTo: 'ebb95@mac.com',
        to: q.email,
        subject: 'How did it go?',
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

          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">Been a week.</p>
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">How'd it go?</p>

          ${firstName ? `<p style="font-size:15px;color:#ffffff !important;margin:0 0 24px;font-family:-apple-system,sans-serif;">Hey ${escapeHtml(firstName)}.</p>` : ''}

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 24px;font-family:-apple-system,sans-serif;">
            A week ago you asked me:
          </p>

          <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:32px;">
            <p style="font-size:16px;font-weight:600;color:#ffffff !important;line-height:1.5;font-style:italic;margin:0;font-family:-apple-system,sans-serif;">"${escapeHtml(q.question)}"</p>
          </div>

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">
            Did what we talked about help? What actually happened? Hit reply and tell me. Or send me a new question — whatever's on your mind now.
          </p>

          <p style="font-size:13px;margin:0 0 56px;font-family:-apple-system,sans-serif;">
            <a href="${siteUrl}/ask" style="color:#555555;text-decoration:none;">Ask me something new →</a>
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

      await supabase
        .from('questions')
        .update({ followup_sent_at: new Date().toISOString() })
        .eq('id', q.id)

      results.push({ id: q.id, ok: true })
    } catch (err) {
      await logError('cron:followup:send', err, { questionId: q.id })
      results.push({ id: q.id, ok: false, error: String(err) })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
