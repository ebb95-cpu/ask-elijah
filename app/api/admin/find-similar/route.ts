import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: texts, model: 'voyage-3-lite' }),
  })
  if (!res.ok) throw new Error(`Voyage embed failed: ${res.status}`)
  const data = await res.json()
  return data.data.map((d: { embedding: number[] }) => d.embedding)
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()

  if (unauthorized) return unauthorized

  const { questionId, questionText } = await req.json()
  if (!questionId || !questionText) {
    return NextResponse.json({ error: 'questionId and questionText required' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Fetch all other pending questions
  const { data: pending } = await supabase
    .from('questions')
    .select('id, question, email')
    .eq('status', 'pending')
    .neq('id', questionId)
    .limit(100)

  if (!pending || pending.length === 0) {
    return NextResponse.json({ similar: [] })
  }

  try {
    // Embed the approved question + all pending questions in one batch
    const allTexts = [questionText, ...pending.map((p) => p.question)]
    const embeddings = await embedBatch(allTexts)

    const approvedEmbedding = embeddings[0]
    const THRESHOLD = 0.82

    const similar = pending
      .map((p, i) => ({
        id: p.id,
        question: p.question,
        email: p.email,
        similarity: cosineSimilarity(approvedEmbedding, embeddings[i + 1]),
      }))
      .filter((p) => p.similarity >= THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5) // max 5 matches shown

    return NextResponse.json({ similar })
  } catch (err) {
    console.error('find-similar error:', err)
    return NextResponse.json({ similar: [] })
  }
}
