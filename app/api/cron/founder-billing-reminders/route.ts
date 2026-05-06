import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { verifyBearer } from '@/lib/admin-auth'
import { escapeHtml } from '@/lib/escape-html'
import { logError } from '@/lib/log-error'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!verifyBearer(auth, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elijahbryant.pro'
  const now = new Date()
  const inFourteenDays = new Date(now)
  inFourteenDays.setDate(inFourteenDays.getDate() + 14)

  const { data, error } = await supabase
    .from('waitlist')
    .select('id, email, name, beta_ends_at')
    .eq('approved', true)
    .is('billing_reminder_sent_at', null)
    .not('beta_ends_at', 'is', null)
    .lte('beta_ends_at', inFourteenDays.toISOString())
    .gte('beta_ends_at', now.toISOString())
    .limit(50)

  if (error) {
    await logError('cron:founder-billing-reminders:fetch', error)
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const results: { id: string; ok: boolean; error?: string }[] = []

  for (const row of data || []) {
    try {
      const firstName = row.name?.trim().split(' ')[0] || 'there'
      await resend.emails.send({
        from: 'Elijah Bryant <elijah@elijahbryant.pro>',
        to: row.email,
        subject: 'Your founding rate locks in 14 days.',
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000;color:#fff;">
  <div style="max-width:560px;margin:0 auto;padding:48px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <p style="margin:0 0 40px;line-height:0;"><img src="https://elijahbryant.pro/logo-email.png" width="52" height="8" alt="" style="display:block;border:0;" /></p>
    <h1 style="font-size:36px;line-height:1.05;margin:0 0 24px;color:#fff;">Your founding rate locks in 14 days.</h1>
    <p style="font-size:15px;line-height:1.7;margin:0 0 22px;color:#bbb;">Hey ${escapeHtml(firstName)}. Your Founder beta is almost done. $9.99/mo is yours for life as long as your membership stays active.</p>
    <p style="font-size:15px;line-height:1.7;margin:0 0 32px;color:#fff;">Make sure your card is ready so the room does not pause.</p>
    <p style="font-size:13px;margin:0;"><a href="${siteUrl}/pricing" style="color:#777;text-decoration:none;">Manage my Founder checkout →</a></p>
  </div>
</body>
</html>
        `,
      })

      await supabase
        .from('waitlist')
        .update({ billing_reminder_sent_at: new Date().toISOString() })
        .eq('id', row.id)

      try {
        await supabase.from('crm_email_events').insert({
          email: row.email,
          provider: 'resend',
          action: 'founder_beta_14_day_warning',
          status: 'sent',
          subject: 'Your founding rate locks in 14 days.',
          tags: ['transactional', 'billing'],
          metadata: { waitlist_id: row.id },
        })
      } catch {}

      results.push({ id: row.id, ok: true })
    } catch (err) {
      await logError('cron:founder-billing-reminders:send', err, { waitlistId: row.id })
      results.push({ id: row.id, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}
