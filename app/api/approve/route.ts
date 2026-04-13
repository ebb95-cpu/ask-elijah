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
    .select('question, email')
    .eq('id', questionId)
    .single()

  if (fetchError || !record) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

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
    to: record.email,
    subject: 'Elijah wrote back.',
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

          <div style="border-left: 3px solid #333; padding-left: 20px; margin-bottom: 32px;">
            <p style="font-size: 12px; color: #555; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.08em;">You asked</p>
            <p style="font-size: 16px; font-weight: 600; margin: 0; color: #fff; line-height: 1.5;">${record.question}</p>
          </div>

          <div style="font-size: 16px; line-height: 1.8; color: #ccc; white-space: pre-wrap; margin-bottom: 40px;">${finalAnswer}</div>

          ${actionSteps ? `
          <div style="border-left: 3px solid #fff; padding-left: 20px; margin-bottom: 40px;">
            <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #555; margin: 0 0 12px;">Your action steps</p>
            <div style="font-size: 15px; line-height: 1.8; color: #ccc; white-space: pre-wrap;">${actionSteps}</div>
          </div>` : ''}

          <p style="font-size: 17px; font-weight: 800; color: #fff; margin: 0 0 10px;">Now go use it.</p>
          <p style="font-size: 14px; color: #aaa; line-height: 1.6; margin: 0 0 32px;">
            Read it twice. Do the steps. I'll check in with you soon.
          </p>

          <a href="${siteUrl}/ask" style="display: inline-block; background: #fff; color: #000; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: 700; margin-bottom: 48px;">
            Ask your next question →
          </a>

          <p style="font-size: 13px; color: #555; margin: 0;">Elijah</p>

        </div>
      </div>
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
