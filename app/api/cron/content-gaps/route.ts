import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { Resend } from 'resend'
import { logError } from '@/lib/log-error'
import Anthropic from '@anthropic-ai/sdk'
import { escapeHtml } from '@/lib/escape-html'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Weekly "topics you should record" email.
 * Pulls the past 7 days of questions where Elijah's knowledge base had no
 * good match (either fallback-answered, or topic=null, or topic_confidence
 * low). Groups them with Claude into themes, emails a prioritized list.
 * This turns user questions into your content calendar.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  try {
    // Signals of "no good content match":
    // 1. Answer equals the FALLBACK string  → RAG returned nothing above 0.35
    // 2. topic_confidence < 0.6             → classifier was unsure
    // 3. topic is null                      → not even a weak classification
    const { data, error } = await supabase
      .from('questions')
      .select('question, email, topic, topic_confidence, answer, created_at, mode, level_snapshot')
      .gte('created_at', sevenDaysAgo)
      .is('deleted_at', null)
      .or(
        'topic.is.null,topic_confidence.lt.0.6,answer.eq.I want to make sure I give you something real on this one. Try asking me again with a bit more detail about your situation and I\'ll find the right angle.'
      )
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      await logError('cron:content-gaps:fetch', error)
      return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
    }

    const gaps = data || []
    if (gaps.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No content gaps this week' })
    }

    // Use Claude to cluster the questions into themes. Give Elijah themes not
    // a flat list — makes it obvious what videos/newsletters to make.
    let clustering = ''
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const list = gaps.map((g, i) => `${i + 1}. [${g.mode || 'general'}${g.level_snapshot ? ` / ${g.level_snapshot}` : ''}] ${g.question}`).join('\n')
      const res = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Here are basketball player questions that Elijah's knowledge base didn't have good content for. Cluster them into 3-6 CONTENT THEMES he should record this week. For each theme:
- A specific title for a video or newsletter (not generic — e.g. "What to do the 48 hours after a bad game" not "handling bad games")
- 1-sentence hook
- How many of these questions that theme would cover

Questions:
${list}

Format each as:
## Theme title
Hook. (covers N questions)

Return plain text, no preamble.`,
        }],
      })
      clustering = res.content[0].type === 'text' ? res.content[0].text : ''
    } catch (err) {
      await logError('cron:content-gaps:cluster', err)
      clustering = gaps.slice(0, 20).map((g, i) => `${i + 1}. ${g.question}`).join('\n')
    }

    // Email Elijah
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'Ask Elijah <elijah@elijahbryant.pro>',
      to: process.env.ADMIN_EMAIL!,
      subject: `Content to record this week — ${gaps.length} questions with no good answer in your KB`,
      html: `
<div style="font-family: -apple-system, sans-serif; max-width: 640px; margin: 0 auto; padding: 40px 32px; color: #111;">
  <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #999; margin-bottom: 24px;">Ask Elijah · Weekly content gap report</p>

  <h1 style="font-size: 28px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 8px;">${gaps.length} questions your KB couldn't answer.</h1>
  <p style="font-size: 14px; color: #666; margin: 0 0 32px;">Past 7 days. These had no strong RAG match or were classified uncertainly. If you record the themes below, next week's similar questions land better.</p>

  <div style="background: #f9f9f9; border-left: 3px solid #000; padding: 24px; margin-bottom: 32px; font-size: 14px; line-height: 1.7; white-space: pre-wrap;">${escapeHtml(clustering)}</div>

  <details style="margin-bottom: 32px;">
    <summary style="cursor: pointer; font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 16px;">Raw questions (${gaps.length})</summary>
    <ol style="font-size: 13px; color: #555; line-height: 1.8; padding-left: 20px; margin-top: 12px;">
      ${gaps.map((g) => `<li><strong>[${g.mode || 'general'}${g.level_snapshot ? ` / ${g.level_snapshot}` : ''}]</strong> ${escapeHtml(g.question)}</li>`).join('')}
    </ol>
  </details>

  <p style="font-size: 12px; color: #999;">This runs every Monday. Adjust the schedule in <code>vercel.json</code>.</p>
</div>
      `,
    })

    return NextResponse.json({ processed: gaps.length })
  } catch (err) {
    await logError('cron:content-gaps:unexpected', err)
    return NextResponse.json({ error: 'Content gap report failed' }, { status: 500 })
  }
}
