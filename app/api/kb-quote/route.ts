import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Returning-user dashboard variable reward: a short quote from one of a
 * rotating set of "voices" that feel curated but unpredictable — Nir Eyal's
 * Hooked variability principle applied to the reward slot.
 *
 * GET /api/kb-quote?topic=<last question text>
 *
 * Flow:
 *   1. Pick a voice by weighted random (Kobe 40 / Elijah 30 / Craig 20 / any 10)
 *   2. Embed topic via Voyage
 *   3. Query Pinecone with a metadata filter matching the chosen voice
 *   4. Fall back to the next voice if the chosen one has no matches yet
 *      (e.g. Kobe hasn't been ingested on first ship)
 *   5. Pull the tightest quotable sentence from the top chunk
 */

type Voice = {
  key: string
  label: string
  weight: number
  // Pinecone metadata filter used to constrain results to this voice's corpus.
  filter: Record<string, unknown>
}

// Weights do not need to sum to 100 — we normalise before sampling.
const VOICES: Voice[] = [
  { key: 'kobe',   label: 'Kobe Bryant',    weight: 40, filter: { speaker: 'Kobe Bryant' } },
  { key: 'elijah', label: 'Elijah Bryant',  weight: 30, filter: { channel: { $in: ['Elijah Bryant', 'Consistency Club Film'] } } },
  { key: 'craig',  label: 'Dr. Craig Manning', weight: 20, filter: { speaker: 'Craig Manning' } },
  // "Any" lets the highest-scoring chunk across the full KB win. Covers
  // newsletters, Drive PDFs, lead magnets — anything not already voiced.
  { key: 'any',    label: 'Ask Elijah',     weight: 10, filter: {} },
]

const FALLBACK = {
  text: "Pressure isn't the moment. Pressure is the story you tell yourself about the moment.",
  source_title: 'Fearless Mind',
  source_url: null as string | null,
  voice: 'Dr. Craig Manning',
}

function pickVoiceOrder(): Voice[] {
  // Weighted random first, then fall back through remaining voices in weight order
  const shuffled = [...VOICES]
  const weighted = [...VOICES]
  const totalWeight = weighted.reduce((sum, v) => sum + v.weight, 0)
  let r = Math.random() * totalWeight
  let first: Voice = weighted[0]
  for (const v of weighted) {
    r -= v.weight
    if (r <= 0) { first = v; break }
  }
  // Put the weighted-chosen voice at the front, then the rest by weight desc
  // so we fall back to the most-represented corpus next.
  const rest = shuffled.filter((v) => v.key !== first.key).sort((a, b) => b.weight - a.weight)
  return [first, ...rest]
}

function extractQuote(chunk: string, minLen = 40, maxLen = 200): string {
  const clean = chunk.replace(/\s+/g, ' ').trim()
  const sentences = clean.split(/(?<=[.!?])\s+/)
  for (const s of sentences) {
    const t = s.trim()
    if (t.length >= minLen && t.length <= maxLen) return t
  }
  return clean.slice(0, maxLen).replace(/\s\S*$/, '') + '…'
}

async function queryVoice(
  voice: Voice,
  vec: number[],
  pineconeHost: string,
  pineconeKey: string
): Promise<null | { text: string; metadata: Record<string, unknown> }> {
  const body: Record<string, unknown> = {
    vector: vec,
    topK: 3,
    includeMetadata: true,
  }
  if (Object.keys(voice.filter).length > 0) body.filter = voice.filter

  const res = await fetch(`${pineconeHost}/query`, {
    method: 'POST',
    headers: { 'Api-Key': pineconeKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return null
  const data = await res.json()
  const match = data.matches?.[0]
  if (!match?.metadata?.text) return null
  return { text: String(match.metadata.text), metadata: match.metadata }
}

export async function GET(req: NextRequest) {
  const topic = req.nextUrl.searchParams.get('topic')
  if (!topic) return NextResponse.json(FALLBACK)

  const voyageKey = process.env.VOYAGE_API_KEY
  const pineconeHost = process.env.PINECONE_HOST
  const pineconeKey = process.env.PINECONE_API_KEY
  if (!voyageKey || !pineconeHost || !pineconeKey) return NextResponse.json(FALLBACK)

  try {
    // Embed the topic once; reuse for every voice-fallback query.
    const embedRes = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${voyageKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: [topic], model: 'voyage-3-lite' }),
    })
    if (!embedRes.ok) return NextResponse.json(FALLBACK)
    const embedData = await embedRes.json()
    const vec = embedData.data?.[0]?.embedding
    if (!Array.isArray(vec)) return NextResponse.json(FALLBACK)

    const order = pickVoiceOrder()
    for (const voice of order) {
      const result = await queryVoice(voice, vec, pineconeHost, pineconeKey)
      if (!result) continue
      const meta = result.metadata as {
        source_title?: string
        source_url?: string
        speaker?: string
        channel?: string
      }
      const speakerLabel =
        meta.speaker || meta.channel || voice.label
      return NextResponse.json({
        text: extractQuote(result.text),
        source_title: String(meta.source_title || voice.label),
        source_url: meta.source_url ? String(meta.source_url) : null,
        voice: speakerLabel,
      })
    }

    return NextResponse.json(FALLBACK)
  } catch {
    return NextResponse.json(FALLBACK)
  }
}
