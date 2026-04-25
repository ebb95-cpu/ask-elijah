import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabase } from '@/lib/supabase-server'
import { logError } from '@/lib/log-error'

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
  if (!questionText) {
    return NextResponse.json({ error: 'questionText required' }, { status: 400 })
  }

  try {
    const { data } = await getSupabase()
      .from('questions')
      .select('*')
      .in('status', ['approved', 'answered'])
      .neq('id', questionId || '00000000-0000-0000-0000-000000000000')
      .order('approved_at', { ascending: false })
      .limit(80)

    const answered = (data || []).filter((q) => q.question && q.answer)
    if (answered.length === 0) return NextResponse.json({ similar: [] })

    const embeddings = await embedBatch([questionText, ...answered.map((q) => q.question)])
    const queryEmbedding = embeddings[0]
    const similar = answered
      .map((q, i) => ({
        id: q.id,
        question: q.question,
        answer: q.answer,
        sources: Array.isArray(q.sources) ? q.sources : [],
        similarity: cosineSimilarity(queryEmbedding, embeddings[i + 1]),
        helpful_count: q.helpful_count || 0,
        is_gold_answer: q.is_gold_answer === true,
        approved_at: q.approved_at || q.created_at,
      }))
      .filter((q) => q.similarity >= 0.76)
      .sort((a, b) => {
        if (a.is_gold_answer !== b.is_gold_answer) return a.is_gold_answer ? -1 : 1
        if (b.similarity !== a.similarity) return b.similarity - a.similarity
        return (b.helpful_count || 0) - (a.helpful_count || 0)
      })
      .slice(0, 4)

    return NextResponse.json({ similar })
  } catch (err) {
    await logError('admin:similar-answered', err, { questionId, questionText: questionText.slice(0, 120) })
    return NextResponse.json({ similar: [] })
  }
}
