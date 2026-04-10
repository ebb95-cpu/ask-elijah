import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { Resend } from 'resend'

const CRON_SECRET = process.env.CRON_SECRET

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

async function trainPinecone(questionId: string, question: string, answer: string) {
  const embedding = await embedText(answer)
  const res = await fetch(`${process.env.PINECONE_HOST}/vectors/upsert`, {
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
          metadata: {
            text: answer,
            source_type: 'elijah_approved',
            source_title: 'Direct from Elijah',
            question,
            approved_at: new Date().toISOString(),
          },
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Pinecone upsert failed: ${res.status}`)
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('x-token') || new URL(req.url).searchParams.get('token')
    if (!token || token !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { questionId, finalAnswer } = await req.json()
    if (!questionId || !finalAnswer?.trim()) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Fetch the question record
    const { data: record, error } = await supabase
      .from('questions')
      .select('question, email, sources')
      .eq('id', questionId)
      .single()

    if (error || !record) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    // Update with approved answer
    await supabase
      .from('questions')
      .update({ answer: finalAnswer.trim(), status: 'approved', recap_sent: false })
      .eq('id', questionId)

    // Train Pinecone with approved answer
    try {
      await trainPinecone(questionId, record.question, finalAnswer.trim())
    } catch (pineconeErr) {
      console.error('Pinecone training failed (non-fatal):', pineconeErr)
    }

    // Send the answer to the user if we have their email
    if (record.email) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const to = process.env.RESEND_TO_OVERRIDE || record.email
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ask-the-pro.vercel.app'

      const sourceLinks = (record.sources as { title: string; url: string; type: string }[] || [])
        .map((s) => `<a href="${s.url}" style="color:#666;font-size:13px;">${s.type === 'newsletter' ? '📧' : '▶️'} ${s.title}</a>`)
        .join('<br>')

      await resend.emails.send({
        from: 'Elijah Bryant <onboarding@resend.dev>',
        to,
        subject: `Elijah answered your question`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; color: #111;">
            <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #999; margin-bottom: 24px;">From Elijah's Vault</p>

            <div style="border-left: 3px solid #000; padding-left: 16px; margin-bottom: 24px;">
              <p style="font-size: 16px; font-weight: 600; margin: 0; color: #333;">${record.question}</p>
            </div>

            <div style="font-size: 16px; line-height: 1.8; color: #111; margin-bottom: 32px;">
              ${finalAnswer.trim().replace(/\n/g, '<br>')}
            </div>

            ${sourceLinks ? `
            <div style="border-top: 1px solid #f0f0f0; padding-top: 20px; margin-bottom: 32px;">
              <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #bbb; margin-bottom: 12px;">From Elijah's content</p>
              ${sourceLinks}
            </div>` : ''}

            <a href="${siteUrl}/ask" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;font-size:13px;font-weight:600;">
              Ask your next question →
            </a>

            <p style="font-size: 12px; color: #bbb; margin-top: 32px;">
              You're receiving this because you asked a question on Ask Elijah.
              <a href="mailto:hello@consistencyclub.com?subject=Unsubscribe" style="color:#bbb;">Unsubscribe</a>
            </p>
          </div>
        `,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Approve error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
