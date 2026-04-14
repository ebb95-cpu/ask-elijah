import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY!

async function sbFetch(path: string) {
  const res = await fetch(`${SB_URL()}${path}`, {
    headers: {
      apikey: SB_KEY(),
      Authorization: `Bearer ${SB_KEY()}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elijahbryant.pro'

  // Find questions submitted between 24 and 48 hours ago
  // This window ensures each user is only caught once per daily cron run
  const now = Date.now()
  const windowStart = new Date(now - 48 * 60 * 60 * 1000).toISOString()
  const windowEnd = new Date(now - 24 * 60 * 60 * 1000).toISOString()

  // Get all questions in the window
  const questions: { email: string; created_at: string }[] | null = await sbFetch(
    `/rest/v1/questions?select=email,created_at&created_at=gte.${windowStart}&created_at=lte.${windowEnd}&limit=200`
  )

  if (!questions?.length) {
    return NextResponse.json({ sent: 0, message: 'No questions in window' })
  }

  // Get distinct first-time emails in this window
  // (only nudge if this was their FIRST question — count total questions per email)
  const seen = new Set<string>()
  const uniqueEmails = questions.map(q => q.email).filter((e): e is string => !!e && !seen.has(e) && !!seen.add(e))

  let sent = 0

  for (const email of uniqueEmails) {
    try {
      // Check if they have a complete profile (position is set)
      const profiles: { position: string | null }[] | null = await sbFetch(
        `/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=position&limit=1`
      )

      const hasProfile = profiles && profiles.length > 0 && profiles[0].position

      if (hasProfile) continue // profile is complete, skip

      // Check this is their first question (don't nudge repeat users)
      const allQs: { id: string }[] | null = await sbFetch(
        `/rest/v1/questions?email=eq.${encodeURIComponent(email)}&select=id&limit=5`
      )
      const isFirstQuestion = !allQs || allQs.length <= 1

      if (!isFirstQuestion) continue

      // Send the nudge
      await resend.emails.send({
        from: 'Elijah Bryant <elijah@elijahbryant.pro>',
      replyTo: 'ebb95@mac.com',
        to: email,
        subject: "Elijah doesn't know enough about you yet.",
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
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">Your answer is with me.</p>
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">But I'm missing something.</p>

          <p style="font-size:16px;color:#ffffff !important;line-height:1.7;margin:0 0 48px;font-family:-apple-system,sans-serif;">
            I need your position and level before I write back. Two questions. Takes 30 seconds.
          </p>

          <p style="font-size:13px;margin:0 0 56px;font-family:-apple-system,sans-serif;">
            <a href="${siteUrl}/profile" style="color:#555555;text-decoration:none;">Tell me who you are →</a>
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

      sent++
    } catch (err) {
      console.error(`Failed profile nudge for ${email}:`, err)
    }
  }

  return NextResponse.json({ sent, checked: uniqueEmails.length })
}
