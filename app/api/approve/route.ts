import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { Resend } from 'resend'

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

async function saveToPinecone(questionId: string, question: string, answer: string) {
  // Save the Q+A together so future searches surface this real answer
  const combined = `Q: ${question}\n\nA: ${answer}`
  const embedding = await embedText(combined)

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
        metadata: {
          text: combined,
          source_type: 'approved_answer',
          source_title: 'Elijah Bryant — Approved Answer',
          question,
        },
      }],
    }),
  })
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

  // Fetch question record
  const { data: record, error: fetchError } = await supabase
    .from('questions')
    .select('question, email, sources')
    .eq('id', questionId)
    .single()

  if (fetchError || !record) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  // Fetch name for personalization
  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name')
    .eq('email', record.email.toLowerCase())
    .single()
  const firstName = profile?.first_name || null

  // Update in Supabase
  await supabase
    .from('questions')
    .update({ answer: finalAnswer, status: 'approved', action_steps: actionSteps || null })
    .eq('id', questionId)

  // Send email to user
  const resend = new Resend(process.env.RESEND_API_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ask-the-pro.vercel.app'
  await resend.emails.send({
    from: 'Elijah Bryant <elijah@elijahbryant.pro>',
      reply_to: 'ebb95@mac.com',
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
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">Elijah wrote back.</p>
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">Read it twice.</p>

          ${firstName ? `<p style="font-size:15px;color:#ffffff !important;margin:0 0 24px;font-family:-apple-system,sans-serif;">Hey ${firstName}.</p>` : ''}

          <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:32px;">
            <p style="font-size:12px;color:#ffffff !important;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.08em;font-family:-apple-system,sans-serif;">You asked</p>
            <p style="font-size:16px;font-weight:600;margin:0;color:#ffffff !important;line-height:1.5;font-family:-apple-system,sans-serif;">${record.question}</p>
          </div>

          <div style="font-size:16px;line-height:1.8;color:#ffffff !important;white-space:pre-wrap;margin-bottom:40px;font-family:-apple-system,sans-serif;">${finalAnswer}</div>

          ${actionSteps ? `
          <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:40px;">
            <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#ffffff !important;margin:0 0 12px;font-family:-apple-system,sans-serif;">Your action steps</p>
            ${actionSteps.split('\n').filter((s: string) => s.trim()).map((step: string) => `<p style="font-size:15px;line-height:1.6;color:#ffffff !important;margin:0 0 12px;font-family:-apple-system,sans-serif;">${step.trim()}</p>`).join('')}
          </div>` : ''}

          <p style="font-size:17px;font-weight:800;color:#ffffff !important;margin:0 0 10px;font-family:-apple-system,sans-serif;">Now go use it.</p>
          <p style="font-size:14px;color:#ffffff !important;line-height:1.6;margin:0 0 32px;font-family:-apple-system,sans-serif;">
            Read it twice. Do the steps. I'll check in with you soon.
          </p>

          ${(() => {
            const sources: { title: string; url: string; type: string }[] = Array.isArray(record.sources) ? record.sources.filter((s: { url: string }) => s.url) : []
            if (!sources.length) return ''
            return `
          <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:40px;">
            <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#ffffff !important;margin:0 0 12px;font-family:-apple-system,sans-serif;">More from Elijah on this</p>
            ${sources.map(s => `
            <p style="margin:0 0 10px;font-family:-apple-system,sans-serif;">
              <a href="${s.url}" style="font-size:13px;color:#555555;text-decoration:none;">
                ${s.type === 'newsletter' ? 'Read the full guide' : 'Watch on YouTube'}: ${s.title} →
              </a>
            </p>`).join('')}
          </div>`
          })()}

          <p style="font-size:13px;margin:0 0 56px;font-family:-apple-system,sans-serif;"><a href="${siteUrl}/ask" style="color:#555555;text-decoration:none;">Ask your next question →</a></p>

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

  // Save to Pinecone knowledge base
  try {
    await saveToPinecone(questionId, record.question, finalAnswer)
  } catch (err) {
    console.warn('Pinecone save failed (non-fatal):', err)
  }

  return NextResponse.json({ success: true })
}
