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
      <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #111; background: #fff;">

        <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 40px;">
          <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
          <div style="width: 24px; height: 1.5px; background: #000;"></div>
          <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
          <div style="width: 24px; height: 1.5px; background: #000;"></div>
          <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
        </div>

        <div style="border-left: 3px solid #eee; padding-left: 16px; margin-bottom: 32px;">
          <p style="font-size: 13px; color: #999; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 0.06em;">You asked</p>
          <p style="font-size: 16px; font-weight: 600; margin: 0; color: #111;">${record.question}</p>
        </div>

        <div style="font-size: 16px; line-height: 1.8; color: #222; white-space: pre-wrap;">${finalAnswer}</div>

        ${actionSteps ? `
        <div style="margin-top: 40px; background: #f7f7f7; border-left: 3px solid #000; padding: 20px 24px;">
          <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #999; margin: 0 0 12px;">Your action steps</p>
          <div style="font-size: 15px; line-height: 1.8; color: #111; white-space: pre-wrap;">${actionSteps}</div>
        </div>` : ''}

        <div style="margin-top: 40px; border-top: 2px solid #000; padding-top: 28px;">
          <p style="font-size: 17px; font-weight: 800; color: #000; margin: 0 0 10px;">Now go use it.</p>
          <p style="font-size: 14px; color: #555; line-height: 1.6; margin: 0 0 24px;">
            Read it twice. Do the steps. I'll check in with you soon.
          </p>
          <a href="${siteUrl}" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: 700;">
            Ask your next question →
          </a>
        </div>

        <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #f0f0f0;">
          <p style="font-size: 13px; color: #999; margin: 0;">— Elijah Bryant</p>
          <p style="font-size: 11px; color: #bbb; margin: 4px 0 0;">NBA Champion. Ask Elijah.</p>
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
