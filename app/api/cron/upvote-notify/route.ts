import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { Resend } from 'resend'

export const dynamic = 'force-dynamic'

const ASKER_THRESHOLD = 5    // notify the original asker
const BROADCAST_THRESHOLD = 20  // broadcast to everyone

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const resend = new Resend(process.env.RESEND_API_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ask-the-pro.vercel.app'

  // Get upvote counts for all approved questions
  const { data: upvoteCounts } = await supabase
    .from('upvotes')
    .select('question_id')

  if (!upvoteCounts?.length) return NextResponse.json({ askerSent: 0, broadcastSent: 0 })

  // Count upvotes per question
  const countMap: Record<string, number> = {}
  for (const uv of upvoteCounts) {
    countMap[uv.question_id] = (countMap[uv.question_id] || 0) + 1
  }

  // Fetch approved questions that haven't been notified yet
  const { data: questions } = await supabase
    .from('questions')
    .select('id, question, answer, email, asker_notified_at, broadcast_sent_at')
    .eq('status', 'approved')

  if (!questions?.length) return NextResponse.json({ askerSent: 0, broadcastSent: 0 })

  let askerSent = 0
  let broadcastSent = 0

  for (const q of questions) {
    const count = countMap[q.id] || 0

    // ── Personal notification to the asker ─────────────────────────────────
    if (count >= ASKER_THRESHOLD && !q.asker_notified_at) {
      try {
        await resend.emails.send({
          from: 'Elijah Bryant <elijah@elijahbryant.pro>',
          to: q.email,
          subject: `${count} players have the exact same question as you.`,
          html: `
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;">
              <tr><td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
                  <tr><td style="padding:48px 32px 32px;">

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

                    <p style="font-size:26px;font-weight:800;line-height:1.2;margin:0 0 24px;color:#ffffff;font-family:-apple-system,sans-serif;">
                      You're not the only one.
                    </p>

                    <div style="border-left:3px solid #333333;padding-left:20px;margin-bottom:28px;">
                      <p style="font-size:12px;color:#ffffff;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.08em;font-family:-apple-system,sans-serif;">You asked</p>
                      <p style="font-size:17px;font-weight:600;margin:0;color:#ffffff;line-height:1.4;font-family:-apple-system,sans-serif;">${q.question}</p>
                    </div>

                    <p style="font-size:40px;font-weight:900;color:#ffffff;margin:0 0 8px;font-family:-apple-system,sans-serif;">${count} players</p>
                    <p style="font-size:15px;color:#ffffff;line-height:1.7;margin:0 0 24px;font-family:-apple-system,sans-serif;">
                      said they've got the same thing going on. That number keeps climbing.
                    </p>

                    <p style="font-size:15px;color:#ffffff;line-height:1.7;margin:0 0 40px;font-family:-apple-system,sans-serif;">
                      Most players think it's just them. It's not. You asked the right question. Now make sure you're actually using the answer.
                    </p>

                    <a href="${siteUrl}" style="display:inline-block;background:#ffffff;color:#000000;text-decoration:none;padding:14px 28px;font-size:14px;font-weight:700;margin-bottom:48px;font-family:-apple-system,sans-serif;">
                      Ask your next question →
                    </a>

                    <p style="font-size:14px;color:#ffffff;margin:0 0 16px;font-family:-apple-system,sans-serif;">Elijah</p>
                    <p style="font-size:11px;color:#444444;margin:0;letter-spacing:0.08em;text-transform:uppercase;font-family:-apple-system,sans-serif;">Your body is trained. Your mind isn't.</p>

                  </td></tr>
                </table>
              </td></tr>
            </table>
          `,
        })

        await supabase
          .from('questions')
          .update({ asker_notified_at: new Date().toISOString() })
          .eq('id', q.id)

        askerSent++
      } catch (err) {
        console.error(`Failed asker notify for ${q.id}:`, err)
      }
    }

    // ── Broadcast to everyone ───────────────────────────────────────────────
    if (count >= BROADCAST_THRESHOLD && !q.broadcast_sent_at) {
      try {
        // Get all unique emails from the questions table (everyone who's ever asked)
        const { data: allEmails } = await supabase
          .from('questions')
          .select('email')
          .not('email', 'is', null)

        const seen = new Set<string>()
        const uniqueEmails = (allEmails || []).map(r => r.email).filter((e): e is string => !!e && !seen.has(e) && !!seen.add(e))
        // Don't send to the original asker (they already got the personal email)
        const recipients = uniqueEmails.filter(e => e !== q.email)

        // Teaser — first 160 chars of answer
        const teaser = q.answer.slice(0, 160) + (q.answer.length > 160 ? '...' : '')

        // Send in batches of 50 to respect rate limits
        const BATCH = 50
        for (let i = 0; i < recipients.length; i += BATCH) {
          const batch = recipients.slice(i, i + BATCH)
          await Promise.allSettled(batch.map(email =>
            resend.emails.send({
              from: 'Elijah Bryant <elijah@elijahbryant.pro>',
              to: email,
              subject: `${count} players are dealing with the same thing right now.`,
              html: `
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;">
                  <tr><td align="center">
                    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
                      <tr><td style="padding:48px 32px 32px;">

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

                        <p style="font-size:26px;font-weight:800;line-height:1.2;margin:0 0 24px;color:#ffffff;font-family:-apple-system,sans-serif;">
                          ${count} players are dealing with the same thing right now.
                        </p>

                        <p style="font-size:15px;color:#ffffff;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">
                          One player asked. Then another said they had the same thing. Then another. It kept going.
                        </p>

                        <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:32px;">
                          <p style="font-size:12px;color:#ffffff;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.08em;font-family:-apple-system,sans-serif;">The question</p>
                          <p style="font-size:19px;font-weight:700;margin:0 0 16px;color:#ffffff;line-height:1.4;font-family:-apple-system,sans-serif;">${q.question}</p>
                          <p style="font-size:14px;color:#ffffff;line-height:1.7;margin:0;font-style:italic;font-family:-apple-system,sans-serif;">"${teaser}"</p>
                        </div>

                        <p style="font-size:15px;color:#ffffff;line-height:1.7;margin:0 0 40px;font-family:-apple-system,sans-serif;">
                          Players who get better aren't the ones with fewer problems. They're the ones who actually ask about them.
                        </p>

                        <a href="${siteUrl}" style="display:inline-block;background:#ffffff;color:#000000;text-decoration:none;padding:14px 28px;font-size:14px;font-weight:700;margin-bottom:48px;font-family:-apple-system,sans-serif;">
                          Ask Elijah your version of this →
                        </a>

                        <p style="font-size:14px;color:#ffffff;margin:0 0 16px;font-family:-apple-system,sans-serif;">Elijah</p>
                        <p style="font-size:11px;color:#444444;margin:0;letter-spacing:0.08em;text-transform:uppercase;font-family:-apple-system,sans-serif;">Your body is trained. Your mind isn't.</p>

                      </td></tr>
                    </table>
                  </td></tr>
                </table>
              `,
            })
          ))
        }

        await supabase
          .from('questions')
          .update({ broadcast_sent_at: new Date().toISOString() })
          .eq('id', q.id)

        broadcastSent++
      } catch (err) {
        console.error(`Failed broadcast for ${q.id}:`, err)
      }
    }
  }

  return NextResponse.json({ askerSent, broadcastSent })
}
