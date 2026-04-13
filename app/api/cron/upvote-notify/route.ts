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
            <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; background: #000;">
              <div style="padding: 48px 32px;">

                <div style="text-align: center; margin-bottom: 48px;">
                  <div style="display: inline-flex; gap: 6px; align-items: center;">
                    <div style="width: 8px; height: 8px; background: #fff; border-radius: 50%;"></div>
                    <div style="width: 24px; height: 1.5px; background: #fff;"></div>
                    <div style="width: 8px; height: 8px; background: #fff; border-radius: 50%;"></div>
                    <div style="width: 24px; height: 1.5px; background: #fff;"></div>
                    <div style="width: 8px; height: 8px; background: #fff; border-radius: 50%;"></div>
                  </div>
                </div>

                <p style="font-size: 26px; font-weight: 800; line-height: 1.2; margin: 0 0 24px; color: #fff;">
                  You're not the only one.
                </p>

                <div style="border-left: 3px solid #333; padding-left: 20px; margin-bottom: 28px;">
                  <p style="font-size: 12px; color: #555; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.08em;">You asked</p>
                  <p style="font-size: 17px; font-weight: 600; margin: 0; color: #fff; line-height: 1.4;">${q.question}</p>
                </div>

                <p style="font-size: 40px; font-weight: 900; color: #fff; margin: 0 0 8px;">${count} players</p>
                <p style="font-size: 15px; color: #aaa; line-height: 1.7; margin: 0 0 24px;">
                  said they've got the same thing going on. That number keeps climbing.
                </p>

                <p style="font-size: 15px; color: #aaa; line-height: 1.7; margin: 0 0 40px;">
                  Most players think it's just them. It's not. You asked the right question. Now make sure you're actually using the answer.
                </p>

                <a href="${siteUrl}" style="display: inline-block; background: #fff; color: #000; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: 700; margin-bottom: 48px;">
                  Ask your next question →
                </a>

                <p style="font-size: 13px; color: #555; margin: 0;">Elijah</p>

              </div>
            </div>
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
                <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; background: #000;">
                  <div style="padding: 48px 32px;">

                    <div style="text-align: center; margin-bottom: 48px;">
                      <div style="display: inline-flex; gap: 6px; align-items: center;">
                        <div style="width: 8px; height: 8px; background: #fff; border-radius: 50%;"></div>
                        <div style="width: 24px; height: 1.5px; background: #fff;"></div>
                        <div style="width: 8px; height: 8px; background: #fff; border-radius: 50%;"></div>
                        <div style="width: 24px; height: 1.5px; background: #fff;"></div>
                        <div style="width: 8px; height: 8px; background: #fff; border-radius: 50%;"></div>
                      </div>
                    </div>

                    <p style="font-size: 26px; font-weight: 800; line-height: 1.2; margin: 0 0 24px; color: #fff;">
                      ${count} players are dealing with the same thing right now.
                    </p>

                    <p style="font-size: 15px; color: #aaa; line-height: 1.7; margin: 0 0 28px;">
                      One player asked. Then another said they had the same thing. Then another. It kept going.
                    </p>

                    <div style="border-left: 3px solid #fff; padding-left: 20px; margin-bottom: 32px;">
                      <p style="font-size: 12px; color: #555; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.08em;">The question</p>
                      <p style="font-size: 19px; font-weight: 700; margin: 0 0 16px; color: #fff; line-height: 1.4;">${q.question}</p>
                      <p style="font-size: 14px; color: #888; line-height: 1.7; margin: 0; font-style: italic;">"${teaser}"</p>
                    </div>

                    <p style="font-size: 15px; color: #aaa; line-height: 1.7; margin: 0 0 40px;">
                      Players who get better aren't the ones with fewer problems. They're the ones who actually ask about them.
                    </p>

                    <a href="${siteUrl}" style="display: inline-block; background: #fff; color: #000; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: 700; margin-bottom: 48px;">
                      Ask Elijah your version of this →
                    </a>

                    <p style="font-size: 13px; color: #555; margin: 0;">Elijah</p>

                  </div>
                </div>
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
