import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Preview which KB chunks Elijah's AI would retrieve for a given query.
 * Mirrors the unfiltered Pinecone query in /api/ask (no topic/level filters)
 * so admins can audit whether the KB is surfacing the right sources.
 */
export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { question } = await req.json()
  if (!question?.trim()) {
    return NextResponse.json({ error: 'question required' }, { status: 400 })
  }

  const voyageKey = process.env.VOYAGE_API_KEY
  const pineconeHost = process.env.PINECONE_HOST
  const pineconeKey = process.env.PINECONE_API_KEY
  if (!voyageKey || !pineconeHost || !pineconeKey) {
    return NextResponse.json({ error: 'Missing embedding or Pinecone config' }, { status: 500 })
  }

  try {
    // Embed the question with Voyage (same model as ingestion).
    const embRes = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${voyageKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: [question.trim()], model: 'voyage-3-lite' }),
    })
    if (!embRes.ok) {
      return NextResponse.json({ error: `Voyage failed: ${embRes.status}` }, { status: 500 })
    }
    const embData = await embRes.json()
    const vector = embData.data?.[0]?.embedding
    if (!vector) return NextResponse.json({ error: 'No embedding returned' }, { status: 500 })

    // Query Pinecone, unfiltered, topK=10 so admin sees a broader picture
    // than the ask endpoint's 5.
    const queryRes = await fetch(`${pineconeHost}/query`, {
      method: 'POST',
      headers: { 'Api-Key': pineconeKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ vector, topK: 10, includeMetadata: true }),
    })
    if (!queryRes.ok) {
      return NextResponse.json({ error: `Pinecone failed: ${queryRes.status}` }, { status: 500 })
    }
    const queryData = await queryRes.json()
    type PineconeMatch = {
      id: string
      score: number
      metadata?: {
        text?: string
        source_title?: string
        source_type?: string
        source_url?: string
        topic?: string
        level?: string
      }
    }
    const matches: PineconeMatch[] = queryData.matches || []

    const MIN_SCORE = 0.35
    const results = matches.map((m) => ({
      id: m.id,
      score: m.score,
      wouldUse: m.score >= MIN_SCORE,
      title: m.metadata?.source_title || '(no title)',
      type: m.metadata?.source_type || 'unknown',
      url: m.metadata?.source_url || null,
      topic: m.metadata?.topic || null,
      level: m.metadata?.level || null,
      text: (m.metadata?.text || '').slice(0, 300),
    }))

    return NextResponse.json({ results, minScore: MIN_SCORE })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Query failed' },
      { status: 500 },
    )
  }
}
