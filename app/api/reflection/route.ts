import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

async function detectSentiment(text: string): Promise<'positive' | 'negative' | 'neutral'> {
  try {
    const res = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 10,
      messages: [{
        role: 'user',
        content: `Did this player find the advice helpful? Reply with exactly one word: positive, negative, or neutral.

Reflection: "${text.replace(/"/g, '\\"')}"`,
      }],
    })
    const word = res.content[0].type === 'text' ? res.content[0].text.trim().toLowerCase() : 'neutral'
    if (word === 'positive' || word === 'negative') return word
    return 'neutral'
  } catch {
    return 'neutral'
  }
}

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

async function boostInPinecone(questionId: string, question: string, answer: string, helpfulCount: number, existingMeta: Record<string, string | number>) {
  const combined = `Q: ${question}\n\nA: ${answer}`
  const embedding = await embedText(combined)

  const metadata: Record<string, string | number> = {
    ...existingMeta,
    text: combined,
    helpful_count: helpfulCount,
  }

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

export async function POST(req: NextRequest) {
  try {
    const { email, question_id, text } = await req.json()
    if (!email || !text?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const supabase = getSupabase()

    // Save reflection first (fast path)
    await supabase.from('reflections').insert({
      email: email.trim().toLowerCase(),
      question_id: question_id || null,
      text: text.trim(),
    })

    // Fire-and-forget: detect sentiment, then boost if positive
    ;(async () => {
      try {
        const sentiment = await detectSentiment(text)

        // Update reflection with sentiment
        await supabase
          .from('reflections')
          .update({ sentiment })
          .eq('email', email.trim().toLowerCase())
          .eq('text', text.trim())

        if (sentiment === 'positive' && question_id) {
          // Fetch question record + increment helpful_count
          const { data: q } = await supabase
            .from('questions')
            .select('question, answer, topic, trigger, helpful_count')
            .eq('id', question_id)
            .eq('status', 'approved')
            .single()

          if (q?.question && q?.answer) {
            const newCount = (q.helpful_count || 0) + 1

            // Increment in Supabase
            await supabase
              .from('questions')
              .update({ helpful_count: newCount })
              .eq('id', question_id)

            // Re-upsert to Pinecone with updated helpful_count
            const existingMeta: Record<string, string | number> = {
              source_type: 'approved_answer',
              source_title: 'Elijah Bryant — Approved Answer',
              question: q.question,
            }
            if (q.topic) existingMeta.topic = q.topic
            if (q.trigger) existingMeta.trigger = q.trigger

            await boostInPinecone(question_id, q.question, q.answer, newCount, existingMeta)
          }
        }
      } catch (err) {
        console.warn('Reflection sentiment/boost failed (non-fatal):', err)
      }
    })()

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Reflection error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
