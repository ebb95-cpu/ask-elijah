import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const PINECONE_HOST = process.env.PINECONE_HOST!
const PINECONE_API_KEY = process.env.PINECONE_API_KEY!
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY!
const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY!
const BEEHIIV_PUB_ID = process.env.BEEHIIV_PUBLICATION_ID || 'pub_9471ed24-57d1-43c6-be5b-ee779941c348'
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY!

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

// ── YouTube (AssemblyAI + RSS — no yt-dlp or ffmpeg needed) ──────────────────

async function getChannelIdFromHandle(handle: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/@${handle}`, { headers: HEADERS })
    if (!res.ok) return null
    const html = await res.text()
    const match = html.match(/"channelId":"(UC[^"]+)"/) || html.match(/"browseId":"(UC[^"]+)"/)
    return match?.[1] ?? null
  } catch { return null }
}

async function getRecentVideosFromRSS(channelId: string): Promise<{ videoId: string; title: string }[]> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`)
  if (!res.ok) throw new Error(`RSS ${res.status}`)
  const xml = await res.text()
  const videos: { videoId: string; title: string }[] = []
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || []
  for (const entry of entries) {
    const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)
    const titleMatch = entry.match(/<media:title[^>]*>([^<]+)<\/media:title>/) || entry.match(/<title>([^<]+)<\/title>/)
    if (idMatch) videos.push({ videoId: idMatch[1], title: titleMatch?.[1] || '' })
  }
  return videos
}

async function isAlreadyIngested(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(`${PINECONE_HOST}/vectors/fetch?ids=yt_${videoId}_0`, {
      headers: { 'Api-Key': PINECONE_API_KEY }
    })
    const data = await res.json()
    return Object.keys(data.vectors || {}).length > 0
  } catch { return false }
}

async function transcribeWithAssemblyAI(videoId: string): Promise<string> {
  // Submit YouTube URL directly — AssemblyAI handles the download
  const submitRes = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: { Authorization: ASSEMBLYAI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_url: `https://www.youtube.com/watch?v=${videoId}`, language_code: 'en' }),
  })
  if (!submitRes.ok) throw new Error(`AssemblyAI submit ${submitRes.status}`)
  const { id, error: submitError } = await submitRes.json()
  if (submitError) throw new Error(submitError)

  // Poll until complete (max 5 min)
  for (let i = 0; i < 60; i++) {
    await sleep(5000)
    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { Authorization: ASSEMBLYAI_API_KEY },
    })
    const data = await pollRes.json()
    if (data.status === 'completed') return data.text || ''
    if (data.status === 'error') throw new Error(`AssemblyAI: ${data.error}`)
  }
  throw new Error('AssemblyAI timeout')
}

async function ingestYouTube(): Promise<number> {
  let count = 0

  for (const channel of YOUTUBE_CHANNELS) {
    const channelId = await getChannelIdFromHandle(channel.handle)
    if (!channelId) { console.error(`Could not get channel ID for @${channel.handle}`); continue }

    let videos: { videoId: string; title: string }[]
    try {
      videos = await getRecentVideosFromRSS(channelId)
    } catch (e) { console.error(`RSS failed for @${channel.handle}:`, e); continue }

    for (const { videoId, title } of videos) {
      // Skip Shorts
      if (/shorts?/i.test(title) || title.startsWith('#')) continue

      // Skip already ingested
      if (await isAlreadyIngested(videoId)) continue

      console.log(`Transcribing new video: ${title || videoId}`)

      let transcript: string
      try {
        transcript = await transcribeWithAssemblyAI(videoId)
      } catch (e) { console.error(`Transcription failed for ${videoId}:`, e); continue }

      if (!transcript || transcript.length < 400) continue

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
              transcription: 'assemblyai',
            },
          })
          await sleep(80)
        } catch { /* skip chunk */ }
      }

      if (vectors.length) {
        try {
          for (let k = 0; k < vectors.length; k += 50) await upsertVectors(vectors.slice(k, k + 50))
          count++
          console.log(`✅ ${title || videoId} — ${vectors.length} chunks`)
        } catch (e) { console.error('YouTube upsert error:', e) }
      }
    }
  }

  return count
}

// ── Google Drive PDFs ─────────────────────────────────────────────────────────

const GDRIVE_FOLDER_ID = '1yWan7qgBSyAU19nundmdo9Bog9SJwEFs'

const PDF_TOPICS = [
  'confidence', 'pressure', 'consistency', 'focus', 'slump', 'coaching',
  'team', 'mindset', 'motivation', 'identity', 'nutrition', 'recovery',
  'workout', 'film', 'recruiting',
] as const

async function tagPdfWithClaude(text: string): Promise<string> {
  const snippet = text.slice(0, 2000)
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 20,
      messages: [{
        role: 'user',
        content: `Classify this athletic performance document into exactly one topic from this list:\n${PDF_TOPICS.join(', ')}\n\nRespond with only the single topic word.\n\nDocument excerpt:\n${snippet}`,
      }],
    }),
  })
  if (!res.ok) return 'mindset'
  const data = await res.json()
  const raw = (data.content?.[0]?.text || '').trim().toLowerCase()
  return PDF_TOPICS.find(t => raw.includes(t)) || 'mindset'
}

async function listDrivePdfsRecursive(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  folderName = ''
): Promise<{ fileId: string; fileName: string; category: string }[]> {
  const results: { fileId: string; fileName: string; category: string }[] = []
  let pageToken: string | undefined

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageToken,
    })
    const files = res.data.files || []
    pageToken = res.data.nextPageToken || undefined

    for (const file of files) {
      if (!file.id || !file.name) continue
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        const subResults = await listDrivePdfsRecursive(drive, file.id, file.name)
        results.push(...subResults)
      } else if (file.mimeType === 'application/pdf') {
        results.push({ fileId: file.id, fileName: file.name, category: folderName })
      }
    }
  } while (pageToken)

  return results
}

async function ingestGoogleDrivePdfs(): Promise<number> {
  const keyData = JSON.parse(process.env.GDRIVE_SERVICE_ACCOUNT || '{}')
  const auth = new google.auth.GoogleAuth({
    credentials: keyData,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
  const drive = google.drive({ version: 'v3', auth })

  const pdfFiles = await listDrivePdfsRecursive(drive, GDRIVE_FOLDER_ID)
  let count = 0

  for (const { fileId, fileName, category } of pdfFiles) {
    try {
      // Download PDF
      const dlRes = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      )
      const buffer = Buffer.from(dlRes.data as ArrayBuffer)

      // Parse PDF text (dynamic import avoids build-time file-system error)
      const { default: pdfParse } = await import('pdf-parse')
      const parsed = await pdfParse(buffer)
      const text: string = parsed.text || ''
      if (text.length < 200) continue

      // Tag with Claude Haiku
      const topic = await tagPdfWithClaude(text)

      // Chunk and embed
      const chunks = chunkText(text, 500, 80)
      const vectors: any[] = []

      for (let j = 0; j < chunks.length; j++) {
        try {
          const values = await embed(chunks[j])
          vectors.push({
            id: `gdrive_${fileId}_${j}`,
            values,
            metadata: {
              text: chunks[j],
              source_type: 'lead_magnet',
              source_title: fileName,
              category: category || 'uncategorized',
              topic,
              chunk_index: j,
            },
          })
          await sleep(80)
        } catch { /* skip chunk */ }
      }

      if (vectors.length) {
        for (let k = 0; k < vectors.length; k += 50) {
          await upsertVectors(vectors.slice(k, k + 50))
        }
        count++
      }
    } catch (e) {
      console.error(`PDF ingest error for ${fileName}:`, e)
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
  const pdfs = await ingestGoogleDrivePdfs().catch(e => { console.error(e); return 0 })

  console.log(`Knowledge ingest complete — newsletters: ${newsletters}, products: ${products}, videos: ${videos}, pdfs: ${pdfs}`)

  return NextResponse.json({ newsletters, products, videos, pdfs })
}
