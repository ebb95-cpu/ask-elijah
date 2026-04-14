import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { cookies } from 'next/headers'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  // Auth check
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get approved + confirmed + un-notified waitlist entries
  const { data: waitlist, error } = await supabase
    .from('waitlist')
    .select('id, email, name')
    .eq('notified', false)
    .eq('confirmed', true)
    .eq('approved', true)
    .order('created_at', { ascending: true })

  if (error || !waitlist?.length) {
    return NextResponse.json({ sent: 0, message: 'No pending waitlist emails' })
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elijahbryant.pro'
  let sent = 0
  const ids: string[] = []

  for (const entry of waitlist) {
    try {
      await resend.emails.send({
        from: 'Elijah Bryant <elijah@elijahbryant.pro>',
        to: entry.email,
        subject: "Elijah opened it back up.",
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

          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">Elijah opened it back up.</p>
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">You go first.</p>

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">
            You waited. Most people would have moved on. You didn't.
          </p>

          <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:32px;">
            <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0;font-family:-apple-system,sans-serif;">
              Ask the question you've been sitting on. Every question goes to Elijah. He reads it, shapes the answer, sends it back.
            </p>
          </div>

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 40px;font-family:-apple-system,sans-serif;">
            This won't stay open long.
          </p>

          <p style="font-size:13px;margin:0 0 56px;font-family:-apple-system,sans-serif;">
            <a href="${siteUrl}/ask" style="color:#555555;text-decoration:none;">Ask my question →</a>
          </p>

          <p style="font-size:14px;color:#ffffff !important;margin:0 0 16px;font-family:-apple-system,sans-serif;">Elijah</p>
          <p style="font-size:11px;color:#444444;margin:0;letter-spacing:0.08em;text-transform:uppercase;font-family:-apple-system,sans-serif;">Your body is trained. Your mind isn't.</p>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      })
      ids.push(entry.id)
      sent++
    } catch {
      // continue to next
    }
  }

  // Mark as notified
  if (ids.length > 0) {
    await supabase.from('waitlist').update({ notified: true }).in('id', ids)
  }

  return NextResponse.json({ sent, total: waitlist.length })
}
