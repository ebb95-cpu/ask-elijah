import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const PINECONE_HOST = process.env.PINECONE_HOST!
const PINECONE_API_KEY = process.env.PINECONE_API_KEY!
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY!
const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY!
const BEEHIIV_PUB_ID = process.env.BEEHIIV_PUBLICATION_ID || 'pub_9471ed24-57d1-43c6-be5b-ee779941c348'

const YOUTUBE_CHANNELS = [
  { handle: 'ElijahBryant3', label: 'Elijah Bryant' },
  { handle: 'ConsistencyClubFilm', label: 'Consistency Club Film' },
]

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function chunkText(text: string, size = 500, overlap = 80): string[] {
  const words = text.split(/\s+/)
  const chunks: string[] = []
  let i = 0
  while (i < words.length) {
    const chunk = words.slice(i, i + size).join(' ')
    if (chunk.length > 100) chunks.push(chunk)
    i += size - overlap
  }
  return chunks
}

async function embed(text: string): Promise<number[]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${VOYAGE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: [text], model: 'voyage-3-lite' }),
  })
  if (!res.ok) throw new Error(`Voyage ${res.status}`)
  const d = await res.json()
  return d.data[0].embedding
}

async function upsertVectors(vectors: { id: string; values: number[]; metadata: Record<string, string | number> }[]) {
  const res = await fetch(`${PINECONE_HOST}/vectors/upsert`, {
    method: 'POST',
    headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vectors }),
  })
  if (!res.ok) throw new Error(`Pinecone ${res.status}`)
}

// ── Newsletters ───────────────────────────────────────────────────────────────

async function ingestNewsletters(): Promise<number> {
  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/posts?status=confirmed&expand[]=free_web_content&limit=15&order_by=publish_date&direction=desc`,
    { headers: { Authorization: `Bearer ${BEEHIIV_API_KEY}` } }
  )
  if (!res.ok) { console.error('Newsletter fetch failed:', res.status); return 0 }

  const data = await res.json()
  const issues: any[] = data.data || []
  let count = 0

  for (const issue of issues) {
    const rawHtml = issue.free_web_content || issue.content?.free?.web || ''
    const text = stripHtml(rawHtml)
    if (text.length < 200) continue

    const chunks = chunkText(text)
    const vectors: any[] = []

    for (let j = 0; j < chunks.length; j++) {
      try {
        const values = await embed(chunks[j])
        vectors.push({
          id: `nl_${issue.id}_${j}`,
          values,
          metadata: {
            text: chunks[j],
            source_type: 'newsletter',
            source_title: issue.title || 'Newsletter',
            source_url: issue.web_url || '',
            chunk_index: j,
          },
        })
        await sleep(80)
      } catch { /* skip chunk */ }
    }

    if (vectors.length) {
      try {
        for (let k = 0; k < vectors.length; k += 50) await upsertVectors(vectors.slice(k, k + 50))
        count++
      } catch (e) { console.error('Newsletter upsert error:', e) }
    }
  }

  return count
}

// ── Lead Magnets (Beehiiv Products) ──────────────────────────────────────────

async function ingestLeadMagnets(): Promise<number> {
  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/products`,
    { headers: { Authorization: `Bearer ${BEEHIIV_API_KEY}` } }
  )
  if (!res.ok) { console.error('Products fetch failed:', res.status); return 0 }

  const data = await res.json()
  const products: any[] = (data.data || []).filter((p: any) => p.status === 'live' || p.status === 'active')
  let count = 0

  for (const product of products) {
    const title = product.name || product.title || ''
    const description = product.description || ''
    if (!description || description.length < 50) continue

    // Try all known URL fields
    const url = product.url || product.checkout_url || product.page_url || product.web_url || ''

    const chunks = chunkText(description, 400, 60)
    const vectors: any[] = []

    for (let j = 0; j < chunks.length; j++) {
      try {
        const values = await embed(chunks[j])
        vectors.push({
          id: `lead-magnet_${product.id}_chunk_${j}`,
          values,
          metadata: {
            text: chunks[j],
            source_type: 'lead-magnet',
            source_title: title,
            source_url: url,
            chunk_index: j,
          },
        })
        await sleep(80)
      } catch { /* skip chunk */ }
    }

    if (vectors.length) {
      try {
        await upsertVectors(vectors)
        count++
      } catch (e) { console.error('Product upsert error:', e) }
    }
  }

  return count
}

// ── YouTube ───────────────────────────────────────────────────────────────────

async function getChannelVideos(handle: string): Promise<{ videoId: string; title: string }[]> {
  const res = await fetch(`https://www.youtube.com/@${handle}/videos`, { headers: HEADERS })
  if (!res.ok) return []
  const html = await res.text()

  const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/)
  if (match) {
    try {
      const ytData = JSON.parse(match[1])
      const tabs = ytData?.contents?.twoColumnBrowseResultsRenderer?.tabs || []
      const videosTab = tabs.find((t: any) => t?.tabRenderer?.title === 'Videos')
      const items = videosTab?.tabRenderer?.content?.richGridRenderer?.contents || []
      const videos = items
        .map((item: any) => {
          const v = item?.richItemRenderer?.content?.videoRenderer
          if (!v?.videoId) return null
          return { videoId: v.videoId, title: v.title?.runs?.[0]?.text || '' }
        })
        .filter(Boolean)
      if (videos.length > 0) return videos.slice(0, 10)
    } catch { /* fall through */ }
  }

  // Fallback: extract IDs from HTML
  const rawIds = Array.from(html.matchAll(/"videoId":"([^"]{11})"/g)).map(m => m[1])
  const ids = Array.from(new Set(rawIds))
  return ids.slice(0, 10).map(id => ({ videoId: id, title: '' }))
}

async function fetchTranscript(videoId: string): Promise<string> {
  // Try YouTube timedtext API (works for public videos with English captions)
  const res = await fetch(
    `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`,
    { headers: HEADERS }
  )
  if (!res.ok) throw new Error(`Timedtext ${res.status}`)
  const data = await res.json()
  const text = (data.events || [])
    .filter((e: any) => e.segs)
    .map((e: any) => e.segs.map((s: any) => s.utf8 || '').join(''))
    .join(' ')
    .replace(/\[.*?\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text || text.length < 400) throw new Error('Transcript too short')
  return text
}

async function ingestYouTube(): Promise<number> {
  let count = 0

  for (const channel of YOUTUBE_CHANNELS) {
    let videos: { videoId: string; title: string }[]
    try {
      videos = await getChannelVideos(channel.handle)
    } catch { continue }

    for (const { videoId, title } of videos) {
      if (title.toLowerCase().includes('#short')) continue

      let transcript: string
      try {
        transcript = await fetchTranscript(videoId)
      } catch { continue }

      const chunks = chunkText(transcript, 600, 100)
      const vectors: any[] = []

      for (let j = 0; j < chunks.length; j++) {
        try {
          const values = await embed(chunks[j])
          vectors.push({
            id: `yt_${videoId}_${j}`,
            values,
            metadata: {
              text: chunks[j],
              source_type: 'youtube',
              source_title: title || `Video ${videoId}`,
              source_url: `https://youtube.com/watch?v=${videoId}`,
              channel: channel.label,
              chunk_index: j,
            },
          })
          await sleep(80)
        } catch { /* skip */ }
      }

      if (vectors.length) {
        try {
          for (let k = 0; k < vectors.length; k += 50) await upsertVectors(vectors.slice(k, k + 50))
          count++
        } catch (e) { console.error('YouTube upsert error:', e) }
      }
    }
  }

  return count
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log('Knowledge ingest started')

  const newsletters = await ingestNewsletters().catch(e => { console.error(e); return 0 })
  const products = await ingestLeadMagnets().catch(e => { console.error(e); return 0 })
  const videos = await ingestYouTube().catch(e => { console.error(e); return 0 })

  console.log(`Knowledge ingest complete — newsletters: ${newsletters}, products: ${products}, videos: ${videos}`)

  return NextResponse.json({ newsletters, products, videos })
}
