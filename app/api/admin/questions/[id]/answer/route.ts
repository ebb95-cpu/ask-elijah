import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-auth'

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

async function upsertToPinecone(id: string, embedding: number[], text: string, question: string) {
  const res = await fetch(`${process.env.PINECONE_HOST}/vectors/upsert`, {
    method: 'POST',
    headers: {
      'Api-Key': process.env.PINECONE_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      vectors: [
        {
          id: `pain_${id}`,
          values: embedding,
          metadata: {
            text,
            source_type: 'admin_answer',
            question,
            topic: 'general',
          },
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Pinecone upsert failed: ${res.status}`)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const unauthorized = await requireAdmin()
    if (unauthorized) return unauthorized

    const { finalAnswer, sources } = await req.json()
    if (!finalAnswer?.trim()) {
      return NextResponse.json({ error: 'finalAnswer is required' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Fetch the pain_point record
    const { data: record, error: fetchError } = await supabase
      .from('pain_points')
      .select('cleaned_question')
      .eq('id', id)
      .single()

    if (fetchError || !record) {
      return NextResponse.json({ error: 'Pain point not found' }, { status: 404 })
    }

    // Embed the Q+A pair
    const combinedText = `Q: ${record.cleaned_question}\nA: ${finalAnswer}`
    const embedding = await embedText(combinedText)

    // Upsert to Pinecone
    await upsertToPinecone(id, embedding, combinedText, record.cleaned_question)

    const update: Record<string, unknown> = {
      status: 'answered',
      final_answer: finalAnswer,
      pinecone_ingested: true,
      answered_at: new Date().toISOString(),
    }
    if (Array.isArray(sources)) update.kb_sources = sources

    // Update Supabase
    await supabase
      .from('pain_points')
      .update(update)
      .eq('id', id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Answer route error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
