import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSupabase } from '@/lib/supabase-server'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

// Pain-point follow-up questions to drive them back
const FOLLOW_UPS = [
  "What's the last situation where you let your emotions cost you playing time?",
  "When was the last time you performed your best under pressure — what was different?",
  "What's the one thing your coach keeps telling you that you haven't actually fixed yet?",
  "When you lose confidence mid-game, what's the first thing that goes wrong?",
  "What does your body feel like the night before a game you're scared to play?",
  "Who on your team has the mental edge you want — and what do they do differently?",
  "What would your game look like if you stopped worrying about what coaches think?",
  "What's the habit you know is holding your game back but haven't changed?",
]

function buildEmail(
  email: string,
  questions: { question: string; answer: string; sources: { title: string; url: string; type: string }[] }[]
): string {
  const followUp = FOLLOW_UPS[Math.floor(Math.random() * FOLLOW_UPS.length)]

  const qaBlocks = questions
    .map(
      (q, i) => `
    <div style="margin-bottom:32px;padding-bottom:32px;border-bottom:1px solid #1a1a1a;">
      <p style="font-size:11px;color:#ffffff;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px;font-family:-apple-system,sans-serif;">
        Question ${i + 1}
      </p>
      <p style="font-size:16px;color:#ffffff;margin:0 0 16px;font-style:italic;font-family:-apple-system,sans-serif;">"${q.question}"</p>
      <p style="font-size:16px;color:#ffffff;line-height:1.7;margin:0 0 16px;font-family:-apple-system,sans-serif;">${q.answer}</p>
      ${
        q.sources && q.sources.length > 0
          ? `<p style="font-size:12px;color:#ffffff;margin:0 0 6px;font-family:-apple-system,sans-serif;">More from Elijah on this:</p>
             ${q.sources
               .map(
                 (s) =>
                   `<a href="${s.url}" style="display:block;font-size:13px;color:#ffffff;margin-bottom:4px;text-decoration:underline;font-family:-apple-system,sans-serif;">
                     ${s.type === 'newsletter' ? '📧' : '▶️'} ${s.title}
                   </a>`
               )
               .join('')}`
          : ''
      }
    </div>
  `
    )
    .join('')

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="padding:48px 32px 32px;">

          <!-- Logo centered -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:48px;">
            <tr><td align="center">
              <table cellpadding="0" cellspacing="0">
                <tr valign="middle">
                  <td style="width:8px;height:8px;background:#ffffff;border-radius:4px;font-size:0;line-height:0;">&nbsp;</td>
                  <td style="width:24px;height:2px;background:#ffffff;font-size:0;line-height:0;">&nbsp;</td>
                  <td style="width:8px;height:8px;background:#ffffff;border-radius:4px;font-size:0;line-height:0;">&nbsp;</td>
                  <td style="width:24px;height:2px;background:#ffffff;font-size:0;line-height:0;">&nbsp;</td>
                  <td style="width:8px;height:8px;background:#ffffff;border-radius:4px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- Headline -->
          <h1 style="font-size:24px;font-weight:700;color:#ffffff;margin:0 0 8px;line-height:1.3;font-family:-apple-system,sans-serif;">
            Yesterday you asked. Here's what came back.
          </h1>
          <p style="font-size:15px;color:#ffffff;margin:0 0 40px;font-family:-apple-system,sans-serif;">
            Your answers — plus something to think about today.
          </p>

          <!-- Q&A blocks -->
          ${qaBlocks}

          <!-- Follow-up hook -->
          <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:48px;">
            <p style="font-size:11px;color:#ffffff;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px;font-family:-apple-system,sans-serif;">
              Something to think about
            </p>
            <p style="font-size:18px;color:#ffffff;font-weight:600;margin:0 0 24px;line-height:1.4;font-family:-apple-system,sans-serif;">
              ${followUp}
            </p>
            <a href="https://elijahbryant.pro/ask"
               style="display:inline-block;background:#ffffff;color:#000000;padding:14px 28px;font-size:14px;font-weight:700;text-decoration:none;font-family:-apple-system,sans-serif;">
              Ask Elijah →
            </a>
          </div>

          <!-- Signature -->
          <p style="font-size:14px;color:#ffffff;margin:0 0 16px;font-family:-apple-system,sans-serif;">Elijah</p>
          <p style="font-size:11px;color:#444444;margin:0 0 24px;letter-spacing:0.08em;text-transform:uppercase;font-family:-apple-system,sans-serif;">Your body is trained. Your mind isn't.</p>

          <!-- Unsubscribe -->
          <p style="font-size:12px;color:#333333;margin:0;font-family:-apple-system,sans-serif;">
            <a href="https://elijahbryant.pro/unsubscribe?email=${encodeURIComponent(email)}" style="color:#333333;">Unsubscribe</a>
          </p>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`
}

export async function GET(req: NextRequest) {
  // Protect the cron endpoint
  const secret = req.headers.get('x-cron-secret') || req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const resend = getResend()

  // Find all questions from yesterday that have an email and haven't been recapped
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dayStart = new Date(yesterday)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(yesterday)
  dayEnd.setHours(23, 59, 59, 999)

  const { data: rows, error } = await supabase
    .from('questions')
    .select('*')
    .not('email', 'is', null)
    .eq('recap_sent', false)
    .gte('created_at', dayStart.toISOString())
    .lte('created_at', dayEnd.toISOString())
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Supabase fetch error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No emails to send' })
  }

  // Group by email
  const byEmail: Record<string, typeof rows> = {}
  for (const row of rows) {
    if (!byEmail[row.email]) byEmail[row.email] = []
    byEmail[row.email].push(row)
  }

  let sent = 0
  const ids: string[] = []

  for (const [email, qs] of Object.entries(byEmail)) {
    try {
      const html = buildEmail(email, qs)
      const toAddress = process.env.RESEND_TO_OVERRIDE || email // sandbox: always send to yourself

      await resend.emails.send({
        from: process.env.RESEND_FROM || 'elijah@elijahbryant.pro',
        to: toAddress,
        subject: `You asked. Here's what came back.`,
        html,
      })

      ids.push(...qs.map((q) => q.id))
      sent++
    } catch (err) {
      console.error(`Failed to send recap to ${email}:`, err)
    }
  }

  // Mark all as sent
  if (ids.length > 0) {
    await supabase.from('questions').update({ recap_sent: true }).in('id', ids)
  }

  return NextResponse.json({ sent, emails: Object.keys(byEmail).length })
}
