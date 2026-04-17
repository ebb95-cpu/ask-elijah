import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Returning-user dashboard variable reward: a Craig Manning quote pulled
 * from the KB that's semantically close to the student's most recent
 * question.
 *
 * GET /api/kb-quote?topic=<last question text>
 *
 * Flow: embed the topic via Voyage → query Pinecone with a metadata filter
 * pinning the result to Craig Manning's Fearless Mind corpus → extract a
 * short quotable sentence from the top-matching chunk. If anything fails
 * we return a generic fallback so the UI never renders empty.
 */

const FALLBACK = {
  text: "Pressure isn't the moment. Pressure is the story you tell yourself about the moment.",
  source_title: 'Fearless Mind',
  source_url: null as string | null,
}

// Trim a longer chunk down to a tight quotable passage — first sentence
// that clears MIN_LEN and stays under MAX_LEN. Falls back to a length slice.
function extractQuote(chunk: string, minLen = 40, maxLen = 200): string {
  const clean = chunk.replace(/\s+/g, ' ').trim()
  const sentences = clean.split(/(?<=[.!?])\s+/)
  for (const s of sentences) {
    const t = s.trim()
    if (t.length >= minLen && t.length <= maxLen) return t
  }
  return clean.slice(0, maxLen).replace(/\s\S*$/, '') + '…'
}

export async function GET(req: NextRequest) {
  const topic = req.nextUrl.searchParams.get('topic')
  if (!topic) return NextResponse.json(FALLBACK)

  const voyageKey = process.env.VOYAGE_API_KEY
  const pineconeHost = process.env.PINECONE_HOST
  const pineconeKey = process.env.PINECONE_API_KEY
  if (!voyageKey || !pineconeHost || !pineconeKey) return NextResponse.json(FALLBACK)

  try {
    // 1. Embed the topic
    const embedRes = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${voyageKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: [topic], model: 'voyage-3-lite' }),
    })
    if (!embedRes.ok) return NextResponse.json(FALLBACK)
    const embedData = await embedRes.json()
    const vec = embedData.data?.[0]?.embedding
    if (!Array.isArray(vec)) return NextResponse.json(FALLBACK)

    // 2. Query Pinecone filtered to Craig Manning's chunks
    const qRes = await fetch(`${pineconeHost}/query`, {
      method: 'POST',
      headers: { 'Api-Key': pineconeKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vector: vec,
        topK: 3,
        includeMetadata: true,
        filter: { speaker: 'Craig Manning' },
      }),
    })
    if (!qRes.ok) return NextResponse.json(FALLBACK)
    const qData = await qRes.json()
    const match = qData.matches?.[0]
    if (!match?.metadata?.text) return NextResponse.json(FALLBACK)

    return NextResponse.json({
      text: extractQuote(String(match.metadata.text)),
      source_title: String(match.metadata.source_title || 'Fearless Mind'),
      source_url: match.metadata.source_url ? String(match.metadata.source_url) : null,
    })
  } catch {
    return NextResponse.json(FALLBACK)
  }
}
