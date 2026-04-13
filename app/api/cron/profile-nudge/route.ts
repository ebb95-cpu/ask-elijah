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

          <p style="text-align:center;margin:0 0 16px;line-height:0;"><img src="https://elijahbryant.pro/logo-email.png" width="120" height="20" alt="" style="display:inline-block;border:0;width:120px;height:20px;" /></p>

          <!-- Credential line -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:48px;">
            <tr><td align="center" bgcolor="#000000" style="background-color:#000000;">
              <p style="font-size:10px;color:#555555;margin:0;text-transform:uppercase;letter-spacing:0.15em;font-family:-apple-system,sans-serif;">&#8226; Elijah Bryant &middot; NBA &middot; EuroLeague Champion &#8226;</p>
            </td></tr>
          </table>

          <!-- Big two-tone headline -->
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">Your answer is with me.</p>
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">But I'm missing something.</p>

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">
            I'm writing back without knowing your position, your level, or what you're actually dealing with. Tell me so I can give you something worth reading.
          </p>

          <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:40px;">
            <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0;font-family:-apple-system,sans-serif;">
              Takes less than a minute.
            </p>
          </div>

          <table cellpadding="0" cellspacing="0" style="margin-bottom:48px;">
            <tr>
              <td bgcolor="#ffffff" style="background-color:#ffffff !important;">
                <a href="${siteUrl}/profile" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:700;color:#000000 !important;text-decoration:none;font-family:-apple-system,sans-serif;">Tell me who you are →</a>
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

      sent++
    } catch (err) {
      console.error(`Failed profile nudge for ${email}:`, err)
    }
  }

  return NextResponse.json({ sent, checked: uniqueEmails.length })
}
