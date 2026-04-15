import { escapeHtml } from '@/lib/escape-html'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { Resend } from 'resend'
import { logError } from '@/lib/log-error'

async function embedText(text: string): Promise<number[]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: [text], model: 'voyage-3-lite' }),
  })
  if (!res.ok) throw new Error(`Voyage embed failed: ${res.status}`)
  const data = await res.json()
  return data.data[0].embedding
}

async function saveToPinecone(
  questionId: string,
  question: string,
  answer: string,
  opts?: {
    topic?: string | null
    trigger?: string | null
    level?: string | null
    age_range?: string | null
    helpful_count?: number
    has_corrections?: boolean
  }
) {
  const combined = `Q: ${question}\n\nA: ${answer}`
  const embedding = await embedText(combined)

  const metadata: Record<string, string | number> = {
    text: combined,
    source_type: 'approved_answer',
    source_title: 'Elijah Bryant — Approved Answer',
    question,
    helpful_count: opts?.helpful_count ?? 0,
    // Corrections are high-signal: Elijah personally fixed an AI claim.
    // Flagging them lets retrieval boost these in the future.
    has_corrections: opts?.has_corrections ? 1 : 0,
  }
  if (opts?.topic) metadata.topic = opts.topic
  if (opts?.trigger) metadata.trigger = opts.trigger
  if (opts?.level) metadata.level = opts.level
  if (opts?.age_range) metadata.age_range = opts.age_range

  await fetch(`${process.env.PINECONE_HOST}/vectors/upsert`, {
    method: 'POST',
    headers: {
      'Api-Key': process.env.PINECONE_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      vectors: [{
        id: `approved_${questionId}`,
        values: embedding,
        metadata,
      }],
    }),
  })
}

/**
 * Extract the <<VERIFY: ...>> claims from the AI draft so we can record
 * what Elijah was asked to verify. We pair each flag with what likely
 * replaced it in the final answer (best-effort — the exact mapping is
 * usually lost during edit, so we store the flagged claims alongside the
 * final answer and let future analysis correlate).
 */
function extractCorrections(aiDraft: string, finalAnswer: string): {
  hadCorrections: boolean
  flaggedClaims: string[]
  finalAnswer: string
} {
  if (!aiDraft) return { hadCorrections: false, flaggedClaims: [], finalAnswer }
  const re = /<<VERIFY:\s*([^>]+)>>/g
  const matches: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(aiDraft)) !== null) {
    matches.push(m[1].trim())
  }
  return {
    hadCorrections: matches.length > 0,
    flaggedClaims: matches,
    finalAnswer,
  }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-token')
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { questionId, finalAnswer, actionSteps } = await req.json()
  if (!questionId || !finalAnswer) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Fetch question record — include ai_draft + edit_count for audit tracking
  const { data: record, error: fetchError } = await supabase
    .from('questions')
    .select('question, email, sources, topic, trigger, ai_draft, answer, edit_count')
    .eq('id', questionId)
    .single()

  if (fetchError || !record) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  // Fetch name + level/age_range for personalization and Pinecone metadata
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, level, age_range')
    .eq('email', record.email.toLowerCase())
    .single()
  const firstName = profile?.first_name || null

  // Track edit distance: if Elijah changed the draft, bump edit_count so we can
  // see later how much the model drifts from his voice
  const draftChanged = (record.ai_draft || record.answer || '').trim() !== finalAnswer.trim()

  // Detect VERIFY-flag corrections: if the AI draft flagged any claims and
  // Elijah edited the answer, the flagged claims were reviewed. Store them
  // so we have a record of what the model got wrong, and flag the Pinecone
  // vector so future retrievals can prefer reviewed answers.
  const { hadCorrections, flaggedClaims } = extractCorrections(record.ai_draft || '', finalAnswer)
  const corrections = hadCorrections && draftChanged
    ? { flagged: flaggedClaims, corrected_at: new Date().toISOString() }
    : null

  // Update in Supabase
  await supabase
    .from('questions')
    .update({
      answer: finalAnswer,
      status: 'approved',
      action_steps: actionSteps || null,
      approved_at: new Date().toISOString(),
      edit_count: draftChanged ? (record.edit_count || 0) + 1 : (record.edit_count || 0),
      corrections,
    })
    .eq('id', questionId)

  // Send email to user
  const resend = new Resend(process.env.RESEND_API_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ask-the-pro.vercel.app'
  await resend.emails.send({
    from: 'Elijah Bryant <elijah@elijahbryant.pro>',
      replyTo: 'ebb95@mac.com',
    to: record.email,
    subject: 'Elijah wrote back.',
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
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">Elijah reviewed it.</p>
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">Here's his answer.</p>

          ${firstName ? `<p style="font-size:15px;color:#ffffff !important;margin:0 0 24px;font-family:-apple-system,sans-serif;">Hey ${escapeHtml(firstName)}.</p>` : ''}

          <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:32px;">
            <p style="font-size:12px;color:#ffffff !important;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.08em;font-family:-apple-system,sans-serif;">You asked</p>
            <p style="font-size:16px;font-weight:600;margin:0;color:#ffffff !important;line-height:1.5;font-family:-apple-system,sans-serif;">${record.question}</p>
          </div>

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 8px;font-family:-apple-system,sans-serif;">He read it, shaped it, and this is what he wants you to know.</p>

          <div style="font-size:16px;line-height:1.8;color:#ffffff !important;white-space:pre-wrap;margin-bottom:32px;font-family:-apple-system,sans-serif;">${finalAnswer.split(' ').slice(0, 40).join(' ')}...</div>

          <p style="font-size:13px;margin:0 0 32px;font-family:-apple-system,sans-serif;">
            <a href="${siteUrl}/history" style="color:#555555;text-decoration:none;">Read his full answer →</a>
          </p>

          ${(() => {
            const srcs = Array.isArray(record.sources) ? record.sources as { title: string; url: string; type: string }[] : []
            if (srcs.length === 0) return ''
            const items = srcs.slice(0, 3).map((s) => {
              const icon = s.type === 'newsletter' ? '✉' : '▶'
              return `<a href="${escapeHtml(s.url)}" style="display:block;font-size:13px;color:#777;text-decoration:none;padding:4px 0;font-family:-apple-system,sans-serif;">${icon}&nbsp;&nbsp;${escapeHtml(s.title)}</a>`
            }).join('')
            return `
          <div style="border-top:1px solid #222;padding-top:20px;margin-bottom:32px;">
            <p style="font-size:10px;color:#444;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.08em;font-family:-apple-system,sans-serif;">This answer drew from</p>
            ${items}
          </div>`
          })()}

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

  // Save to Pinecone knowledge base, flagging corrections so they get
  // priority in future retrieval (Elijah personally reviewed these).
  try {
    await saveToPinecone(questionId, record.question, finalAnswer, {
      topic: record.topic,
      trigger: record.trigger,
      level: profile?.level ?? null,
      age_range: profile?.age_range ?? null,
      has_corrections: !!corrections,
    })
  } catch (err) {
    await logError('approve:pinecone-save', err, { questionId })
  }

  // Note: Pinecone backup is now a nightly cron job (app/api/cron/backup-pinecone)
  // instead of firing on every approval — the old behavior meant a full-index
  // export per question approval.

  return NextResponse.json({ success: true })
}
