import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { logError } from '@/lib/log-error'
import { emailAdmin, esc } from '@/lib/email-admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/feedback
 *
 * Student's thumbs-up/down on an approved answer. One vote per
 * (question_id, email) — re-tapping swaps the rating.
 *
 * Body:
 *   { question_id: string, email: string, rating: 'up'|'down', comment?: string }
 *
 * 👎 with a written comment auto-emails the admin because that's the
 * highest-signal feedback and he should see it immediately.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { question_id, email, rating, comment } = body as {
      question_id?: string
      email?: string
      rating?: 'up' | 'down'
      comment?: string
    }

    if (!question_id || !rating || (rating !== 'up' && rating !== 'down')) {
      return NextResponse.json({ error: 'question_id and rating (up|down) required' }, { status: 400 })
    }

    const userAgent = req.headers.get('user-agent') || null
    const normalizedEmail = email?.trim().toLowerCase() || null

    const supabase = getSupabase()
    const { error } = await supabase
      .from('answer_feedback')
      .upsert(
        {
          question_id,
          email: normalizedEmail,
          rating,
          comment: comment?.trim() || null,
          user_agent: userAgent,
        },
        { onConflict: 'question_id,email' }
      )

    if (error) {
      await logError('feedback:upsert', error, { question_id })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Auto-notify Elijah when the feedback is negative AND has a comment —
    // that's the stuff he needs to see before next week's dashboard review.
    // A bare 👎 with no explanation is still useful in aggregate but not
    // worth an interrupt.
    if (rating === 'down' && comment && comment.trim().length > 0) {
      // Pull the question so the email has context — fire-and-forget.
      supabase
        .from('questions')
        .select('question, answer')
        .eq('id', question_id)
        .single()
        .then(({ data }) => {
          if (!data) return
          emailAdmin(
            `👎 Answer feedback from ${normalizedEmail || 'anon'}`,
            `
<div style="font-family:-apple-system,sans-serif;max-width:600px;">
  <p style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.08em;">They didn't like this answer</p>
  <p style="font-size:14px;color:#555;">Question:</p>
  <p style="font-size:15px;padding:10px;background:#f5f5f5;border-radius:4px;">${esc(data.question || '')}</p>
  <p style="font-size:14px;color:#555;margin-top:16px;">Their comment:</p>
  <p style="font-size:15px;padding:10px;background:#fff5f5;border-left:3px solid #ef4444;">${esc(comment)}</p>
  <p style="font-size:12px;color:#888;margin-top:20px;">From: ${esc(normalizedEmail || 'anonymous')}</p>
</div>
            `.trim()
          )
        })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    await logError('feedback:exception', err)
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 })
  }
}
