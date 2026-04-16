import { escapeHtml } from './escape-html'
import { getSupabase } from './supabase-server'
import { Resend } from 'resend'
import { logError } from './log-error'

/**
 * Shared "approve an answer" pipeline. Called directly by both:
 *   - /api/approve (x-token gated; external callers)
 *   - /api/admin/approve-question (admin cookie gated; the admin UI)
 *
 * Previously the admin route proxied to /api/approve via HTTP fetch, which
 * caused double-timeout + URL-resolution issues (same anti-pattern that
 * broke run-research). Extracted here so admin can call in-process.
 */

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
      vectors: [
        {
          id: `approved_${questionId}`,
          values: embedding,
          metadata,
        },
      ],
    }),
  })
}

function extractCorrections(aiDraft: string): { hadCorrections: boolean; flaggedClaims: string[] } {
  if (!aiDraft) return { hadCorrections: false, flaggedClaims: [] }
  const re = /<<VERIFY:\s*([^>]+)>>/g
  const matches: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(aiDraft)) !== null) {
    matches.push(m[1].trim())
  }
  return { hadCorrections: matches.length > 0, flaggedClaims: matches }
}

export async function approveAnswer(args: {
  questionId: string
  finalAnswer: string
  actionSteps?: string | null
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { questionId, finalAnswer } = args
  const actionSteps = args.actionSteps ?? null

  if (!questionId || !finalAnswer) {
    return { ok: false, status: 400, error: 'Missing fields' }
  }

  const supabase = getSupabase()

  // Select * to be resilient to missing columns — some migrations may not
  // have been run on prod yet. Specific column selects broke approve when
  // `topic` didn't exist.
  const { data: record, error: fetchError } = await supabase
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .single()

  if (fetchError || !record) {
    return { ok: false, status: 404, error: 'Question not found' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, level, age_range')
    .eq('email', record.email.toLowerCase())
    .single()
  const firstName = profile?.first_name || null

  const draftChanged = (record.ai_draft || record.answer || '').trim() !== finalAnswer.trim()

  const { hadCorrections, flaggedClaims } = extractCorrections(record.ai_draft || '')
  const corrections = hadCorrections && draftChanged
    ? { flagged: flaggedClaims, corrected_at: new Date().toISOString() }
    : null

  const { error: updateError } = await supabase
    .from('questions')
    .update({
      answer: finalAnswer,
      status: 'approved',
      action_steps: actionSteps,
      approved_at: new Date().toISOString(),
      edit_count: draftChanged ? (record.edit_count || 0) + 1 : (record.edit_count || 0),
      corrections,
    })
    .eq('id', questionId)

  if (updateError) {
    await logError('approve:update', updateError, { questionId })
    return { ok: false, status: 500, error: updateError.message }
  }

  // Send email to user. Defensive .trim() on env vars since they've had
  // trailing newlines historically.
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://elijahbryant.pro').trim()
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
  } catch (err) {
    // Email failure shouldn't fail the approval — the DB is already updated.
    await logError('approve:email', err, { questionId })
  }

  // Pinecone save — best effort, not fatal.
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

  return { ok: true }
}
