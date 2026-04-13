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
    <div style="margin-bottom:32px;padding-bottom:32px;border-bottom:1px solid #f0f0f0;">
      <p style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px;">
        Question ${i + 1}
      </p>
      <p style="font-size:16px;color:#666;margin:0 0 16px;font-style:italic;">"${q.question}"</p>
      <p style="font-size:16px;color:#111;line-height:1.7;margin:0 0 16px;">${q.answer}</p>
      ${
        q.sources && q.sources.length > 0
          ? `<p style="font-size:12px;color:#999;margin:0 0 6px;">Elijah talked more about this in:</p>
             ${q.sources
               .map(
                 (s) =>
                   `<a href="${s.url}" style="display:block;font-size:13px;color:#111;margin-bottom:4px;text-decoration:underline;">
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
<body style="margin:0;padding:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:40px 24px;">

    <!-- Logo -->
    <div style="margin-bottom:40px;">
      <svg width="52" height="8" viewBox="0 0 52 8" fill="none">
        <circle cx="4" cy="4" r="4" fill="#000"/>
        <line x1="8" y1="4" x2="20" y2="4" stroke="#000" stroke-width="1.5"/>
        <circle cx="24" cy="4" r="4" fill="#000"/>
        <line x1="28" y1="4" x2="40" y2="4" stroke="#000" stroke-width="1.5"/>
        <circle cx="44" cy="4" r="4" fill="#000"/>
      </svg>
    </div>

    <!-- Headline -->
    <h1 style="font-size:24px;font-weight:700;color:#111;margin:0 0 8px;line-height:1.3;">
      Yesterday you asked. Here's what Elijah said.
    </h1>
    <p style="font-size:15px;color:#999;margin:0 0 40px;">
      Your answers from yesterday — plus something to think about today.
    </p>

    <!-- Q&A blocks -->
    ${qaBlocks}

    <!-- Follow-up hook -->
    <div style="background:#000;padding:28px;margin-bottom:32px;">
      <p style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px;">
        Something to think about
      </p>
      <p style="font-size:18px;color:#fff;font-weight:600;margin:0 0 20px;line-height:1.4;">
        ${followUp}
      </p>
      <a href="https://elijahbryant.pro/ask"
         style="display:inline-block;background:#fff;color:#000;padding:12px 24px;font-size:13px;font-weight:700;text-decoration:none;letter-spacing:0.05em;">
        Ask Elijah →
      </a>
    </div>

    <!-- Footer -->
    <p style="font-size:12px;color:#ccc;margin:0;">
      Ask Elijah ·
      <a href="https://elijahbryant.pro/unsubscribe?email=${encodeURIComponent(email)}" style="color:#ccc;">Unsubscribe</a>
    </p>

  </div>
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
