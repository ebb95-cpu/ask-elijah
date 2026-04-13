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
          <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 48px 24px; color: #111; background: #fff;">

            <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 40px;">
              <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
              <div style="width: 24px; height: 1.5px; background: #000;"></div>
              <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
              <div style="width: 24px; height: 1.5px; background: #000;"></div>
              <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
            </div>

            <p style="font-size: 26px; font-weight: 800; line-height: 1.2; margin: 0 0 24px; color: #000;">
              Your answer is with him. But he's missing something.
            </p>

            <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0 0 16px;">
              Right now Elijah is reading your question without knowing much about you. Your position. Your level. What's been holding you back.
            </p>

            <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0 0 28px;">
              That information changes everything. It's the difference between a general answer and one written specifically for your situation.
            </p>

            <div style="background: #f7f7f7; border-left: 3px solid #000; padding: 20px 24px; margin-bottom: 32px;">
              <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0;">
                Two minutes. Three questions. Then Elijah knows exactly who he's talking to.
              </p>
            </div>

            <a href="${siteUrl}/profile" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: 700; margin-bottom: 40px;">
              Tell Elijah who you are →
            </a>

            <hr style="border: none; border-top: 1px solid #eee; margin-bottom: 24px;" />
            <p style="font-size: 12px; color: #bbb; line-height: 1.6; margin: 0;">
              This is the only time I'll ask. Fill it out or don't — either way your answer is coming.
            </p>

          </div>
        `,
      })

      sent++
    } catch (err) {
      console.error(`Failed profile nudge for ${email}:`, err)
    }
  }

  return NextResponse.json({ sent, checked: uniqueEmails.length })
}
