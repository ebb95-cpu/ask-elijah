/**
 * Shared knowledge-base ingestion utilities.
 * Turns raw text into Pinecone vectors with source metadata.
 */

export type IngestMetadata = {
  source_title: string
  source_type: 'upload_text' | 'upload_pdf' | 'upload_url' | 'youtube' | 'newsletter' | 'drive_pdf'
  source_url?: string
  topic?: string | null
  level?: string | null
  // Any extra fields will be passed through to Pinecone metadata
  [key: string]: string | number | null | undefined
}

/**
 * Split text into overlapping chunks by sentence where possible.
 * ~600 words per chunk with ~80 word overlap — tuned for Voyage 3 lite
 * and Claude retrieval quality.
 */
export function chunkText(text: string, opts?: { targetWords?: number; overlapWords?: number }): string[] {
  const target = opts?.targetWords ?? 600
  const overlap = opts?.overlapWords ?? 80

  // Normalize whitespace
  const clean = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim()
  if (!clean) return []

  // Split into sentences (rough — good enough for transcripts + articles)
  const sentences = clean.split(/(?<=[.!?])\s+(?=[A-Z"'])/)

  const chunks: string[] = []
  let current: string[] = []
  let currentCount = 0

  for (const sentence of sentences) {
    const wordCount = sentence.split(/\s+/).length
    if (currentCount + wordCount > target && current.length > 0) {
      chunks.push(current.join(' '))
      // Start next chunk with the last ~overlap words for continuity
      const joined = current.join(' ')
      const words = joined.split(/\s+/)
      const tail = words.slice(-overlap)
      current = tail.length ? [tail.join(' ')] : []
      currentCount = tail.length
    }
    current.push(sentence)
    currentCount += wordCount
  }
  if (current.length > 0) chunks.push(current.join(' '))

  return chunks
}

/**
 * Embed a batch of texts via Voyage. Batched for throughput.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: texts, model: 'voyage-3-lite' }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Voyage embed failed: ${res.status} ${body}`)
  }
  const data = await res.json()
  return (data.data || []).map((d: { embedding: number[] }) => d.embedding)
}

/**
 * Upsert a batch of chunk→embedding pairs to Pinecone with metadata.
 * Returns number of vectors upserted.
 */
export async function upsertToPinecone(
  chunks: string[],
  embeddings: number[][],
  metadata: IngestMetadata,
  idPrefix: string
): Promise<number> {
  if (chunks.length !== embeddings.length) {
    throw new Error(`chunk/embedding count mismatch: ${chunks.length} vs ${embeddings.length}`)
  }
  if (chunks.length === 0) return 0

  const vectors = chunks.map((text, i) => {
    const flatMetadata: Record<string, string | number> = {
      text,
      source_title: metadata.source_title,
      source_type: metadata.source_type,
      chunk_index: i,
    }
    if (metadata.source_url) flatMetadata.source_url = metadata.source_url
    if (metadata.topic) flatMetadata.topic = metadata.topic
    if (metadata.level) flatMetadata.level = metadata.level
    // Passthrough any other string/number metadata
    for (const [k, v] of Object.entries(metadata)) {
      if (k in flatMetadata) continue
      if (typeof v === 'string' || typeof v === 'number') flatMetadata[k] = v
    }
    return {
      id: `${idPrefix}_${i}`,
      values: embeddings[i],
      metadata: flatMetadata,
    }
  })

  // Pinecone upsert supports batches up to 100 vectors or 2MB payload.
  for (let i = 0; i < vectors.length; i += 100) {
    const batch = vectors.slice(i, i + 100)
    const res = await fetch(`${process.env.PINECONE_HOST}/vectors/upsert`, {
      method: 'POST',
      headers: {
        'Api-Key': process.env.PINECONE_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ vectors: batch }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Pinecone upsert failed: ${res.status} ${body}`)
    }
  }

  return vectors.length
}

/**
 * Full pipeline: chunk → embed → upsert. Returns chunk count.
 */
export async function ingestText(
  text: string,
  metadata: IngestMetadata,
  idPrefix: string
): Promise<number> {
  const chunks = chunkText(text)
  if (chunks.length === 0) return 0
  const embeddings = await embedBatch(chunks)
  return upsertToPinecone(chunks, embeddings, metadata, idPrefix)
}

/**
 * Fetch a URL and extract readable text. Minimal HTML-to-text that's good
 * enough for articles and blog posts. Strips scripts, styles, nav, footer.
 */
export async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      // Identify ourselves — some sites block headless UAs
      'User-Agent': 'Mozilla/5.0 (compatible; AskElijah/1.0; +https://elijahbryant.pro)',
    },
  })
  if (!res.ok) throw new Error(`URL fetch failed: ${res.status}`)
  const html = await res.text()

  // Strip scripts/styles/nav/footer/header
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')

  // Replace block elements with newlines for better paragraph breaks
  const blockBreaks = stripped
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')

  // Strip remaining tags
  const text = blockBreaks.replace(/<[^>]+>/g, ' ')

  // Decode common HTML entities
  const decoded = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")

  return decoded.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim()
}
