/**
 * Ask Elijah — Knowledge Base Ingestion
 * Ingests YouTube videos + Beehiiv newsletters into Pinecone
 *
 * Filters out:
 * - YouTube Shorts (#shorts in title, or duration < 90 seconds)
 * - Videos with no captions or transcripts under 400 chars
 *
 * Usage:
 *   node scripts/ingest.mjs            — full run
 *   node scripts/ingest.mjs --youtube  — YouTube only
 *   node scripts/ingest.mjs --newsletter — newsletters only
 */

import { Innertube } from 'youtubei.js'
import { config } from 'dotenv'
config({ path: '.env.local', override: true })

const PINECONE_HOST = process.env.PINECONE_HOST
const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY
const BEEHIIV_PUB_ID = 'pub_9471ed24-57d1-43c6-be5b-ee779941c348'

const YOUTUBE_CHANNELS = [
  { handle: 'ElijahBryant3', label: 'Elijah Bryant' },
  { handle: 'ConsistencyClubFilm', label: 'Consistency Club Film' },
]

const MIN_TRANSCRIPT_CHARS = 400
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }

// ── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function isShortForm(title = '') {
  const t = title.toLowerCase()
  return (
    t.includes('#shorts') ||
    t.includes('#short') ||
    t.includes('shorts |') ||
    t.includes('| shorts') ||
    t.startsWith('#')
  )
}

function chunkText(text, chunkSize = 600, overlap = 100) {
  const words = text.split(/\s+/)
  const chunks = []
  let i = 0
  while (i < words.length) {
    chunks.push(words.slice(i, i + chunkSize).join(' '))
    i += chunkSize - overlap
  }
  return chunks.filter(c => c.length > 100)
}

// ── YouTube Transcript via youtubei.js ────────────────────────────────────

let _yt = null
async function getYT() {
  if (!_yt) {
    _yt = await Innertube.create({
      generate_session_locally: true,
      on_behalf_of_user: undefined,
    })
    // Suppress youtubei.js debug logs
    _yt.session.on('auth-pending', () => {})
  }
  return _yt
}

// Suppress verbose youtubei.js warnings
const _warn = console.warn
console.warn = (...args) => {
  const msg = String(args[0] || '')
  if (msg.includes('YOUTUBEJS') || msg.includes('Unable to find')) return
  _warn(...args)
}

async function fetchTranscript(videoId) {
  const yt = await getYT()
  const info = await yt.getInfo(videoId)
  const tracks = info.captions?.caption_tracks || []
  if (!tracks.length) throw new Error('No caption tracks available')

  // Prefer English manual, then auto-generated, then first available
  const track =
    tracks.find(t => t.language_code === 'en' && t.kind !== 'asr') ||
    tracks.find(t => t.language_code === 'en') ||
    tracks[0]

  if (!track?.base_url) throw new Error('No usable caption track')

  // Fetch using the signed URL with native fetch
  const res = await fetch(track.base_url + '&fmt=json3', { headers: HEADERS })
  if (!res.ok) throw new Error(`Caption fetch failed: ${res.status}`)
  const data = await res.json()

  const text = (data.events || [])
    .filter(e => e.segs)
    .map(e => e.segs.map(s => s.utf8 || '').join(''))
    .join(' ')
    .replace(/\[.*?\]/g, '') // remove [Music], [Applause] etc
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) throw new Error('Empty transcript')
  return text
}

// ── YouTube Channel Videos ─────────────────────────────────────────────────

async function getChannelVideos(handle) {
  // Scrape the channel videos page
  const pageRes = await fetch(`https://www.youtube.com/@${handle}/videos`, { headers: HEADERS })
  if (!pageRes.ok) throw new Error(`Channel fetch failed: ${pageRes.status}`)
  const html = await pageRes.text()

  // Try to extract from ytInitialData for titles
  const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/)
  if (match) {
    try {
      const data = JSON.parse(match[1])
      const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || []
      const videosTab = tabs.find(t => t?.tabRenderer?.title === 'Videos')
      const items = videosTab?.tabRenderer?.content?.richGridRenderer?.contents || []
      const videos = items
        .map(item => {
          const video = item?.richItemRenderer?.content?.videoRenderer
          if (!video?.videoId) return null
          return {
            videoId: video.videoId,
            title: video.title?.runs?.[0]?.text || '',
          }
        })
        .filter(Boolean)
      if (videos.length > 0) return videos
    } catch { /* fall through */ }
  }

  // Fallback: extract all unique video IDs from page HTML
  const ids = [...new Set([...html.matchAll(/"videoId":"([^"]{11})"/g)].map(m => m[1]))]

  // Try to get titles from videoRenderer snippets
  const titleMap = {}
  for (const m of html.matchAll(/"videoId":"([^"]{11})"[^}]*?"text":"([^"]+)"/g)) {
    if (!titleMap[m[1]]) titleMap[m[1]] = m[2]
  }

  return ids.map(id => ({ videoId: id, title: titleMap[id] || '' }))
}

// ── Embed + Upsert ─────────────────────────────────────────────────────────

async function embed(text) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${VOYAGE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: [text], model: 'voyage-3-lite' }),
  })
  if (!res.ok) throw new Error(`Voyage error ${res.status}`)
  const data = await res.json()
  return data.data[0].embedding
}

async function upsertVectors(vectors) {
  const res = await fetch(`${PINECONE_HOST}/vectors/upsert`, {
    method: 'POST',
    headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vectors }),
  })
  if (!res.ok) throw new Error(`Pinecone upsert error ${res.status}: ${await res.text()}`)
}

// ── Ingest YouTube ─────────────────────────────────────────────────────────

async function ingestYouTube() {
  console.log('\n📺 Ingesting YouTube videos...\n')
  let totalOk = 0, totalSkipped = 0, totalErrors = 0

  for (const channel of YOUTUBE_CHANNELS) {
    console.log(`\n  Channel: ${channel.label} (@${channel.handle})`)
    let videos = []
    try {
      videos = await getChannelVideos(channel.handle)
    } catch (err) {
      console.log(`  ❌ Could not fetch channel: ${err.message}`)
      continue
    }
    console.log(`  Found ${videos.length} videos`)

    for (let i = 0; i < videos.length; i++) {
      const { videoId, title } = videos[i]
      const label = (title || videoId).slice(0, 50).padEnd(52, '.')

      // Skip short-form
      if (isShortForm(title)) {
        process.stdout.write(`  [${i + 1}/${videos.length}] ${label} ⏭️  short-form\n`)
        totalSkipped++
        continue
      }

      // Fetch transcript
      let transcript
      try {
        transcript = await fetchTranscript(videoId)
      } catch {
        process.stdout.write(`  [${i + 1}/${videos.length}] ${label} ⏭️  no-transcript\n`)
        totalSkipped++
        await sleep(500)
        continue
      }

      if (transcript.length < MIN_TRANSCRIPT_CHARS) {
        process.stdout.write(`  [${i + 1}/${videos.length}] ${label} ⏭️  too-short (${transcript.length})\n`)
        totalSkipped++
        continue
      }

      const chunks = chunkText(transcript)
      const vectors = []

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
          await sleep(120)
        } catch {
          // skip chunk
        }
      }

      if (vectors.length === 0) {
        process.stdout.write(`  [${i + 1}/${videos.length}] ${label} ❌ embed failed\n`)
        totalErrors++
        continue
      }

      try {
        for (let j = 0; j < vectors.length; j += 50) {
          await upsertVectors(vectors.slice(j, j + 50))
        }
        process.stdout.write(`  [${i + 1}/${videos.length}] ${label} ✅ ${vectors.length} chunks\n`)
        totalOk++
      } catch (err) {
        process.stdout.write(`  [${i + 1}/${videos.length}] ${label} ❌ ${err.message}\n`)
        totalErrors++
      }

      await sleep(400)
    }
  }

  console.log(`\n  ✅ Ingested: ${totalOk} videos`)
  console.log(`  ⏭️  Skipped:  ${totalSkipped}`)
  console.log(`  ❌ Errors:   ${totalErrors}`)
}

// ── Ingest Newsletters ─────────────────────────────────────────────────────

async function ingestNewsletters() {
  console.log('\n📧 Ingesting Beehiiv newsletters...\n')

  let page = 1, allIssues = []
  while (true) {
    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/posts?status=confirmed&expand[]=free_web_content&limit=50&page=${page}`,
      { headers: { Authorization: `Bearer ${BEEHIIV_API_KEY}` } }
    )
    if (!res.ok) { console.log(`  ❌ Beehiiv API error: ${res.status}`); break }
    const data = await res.json()
    const issues = data.data || []
    if (issues.length === 0) break
    allIssues = allIssues.concat(issues)
    if (!data.next_page) break
    page++
    await sleep(500)
  }

  console.log(`  Found ${allIssues.length} issues\n`)
  let totalOk = 0, totalSkipped = 0

  for (let i = 0; i < allIssues.length; i++) {
    const issue = allIssues[i]
    const title = issue.title || `Issue ${i + 1}`
    const label = title.slice(0, 50).padEnd(52, '.')
    const url = issue.web_url || ''

    const rawContent = issue.free_web_content || issue.content?.free?.web || ''
    const text = rawContent
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()

    if (text.length < MIN_TRANSCRIPT_CHARS) {
      process.stdout.write(`  [${i + 1}/${allIssues.length}] ${label} ⏭️  too short\n`)
      totalSkipped++
      continue
    }

    const chunks = chunkText(text, 500, 80)
    const vectors = []

    for (let j = 0; j < chunks.length; j++) {
      try {
        const values = await embed(chunks[j])
        vectors.push({
          id: `nl_${issue.id}_${j}`,
          values,
          metadata: {
            text: chunks[j],
            source_type: 'newsletter',
            source_title: title,
            source_url: url,
            chunk_index: j,
          },
        })
        await sleep(120)
      } catch { /* skip chunk */ }
    }

    if (vectors.length === 0) {
      process.stdout.write(`  [${i + 1}/${allIssues.length}] ${label} ❌ embed failed\n`)
      continue
    }

    try {
      for (let j = 0; j < vectors.length; j += 50) await upsertVectors(vectors.slice(j, j + 50))
      process.stdout.write(`  [${i + 1}/${allIssues.length}] ${label} ✅ ${vectors.length} chunks\n`)
      totalOk++
    } catch (err) {
      process.stdout.write(`  [${i + 1}/${allIssues.length}] ${label} ❌ ${err.message}\n`)
    }

    await sleep(300)
  }

  console.log(`\n  ✅ Ingested: ${totalOk} newsletters`)
  console.log(`  ⏭️  Skipped:  ${totalSkipped}`)
}

// ── Main ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const youtubeOnly = args.includes('--youtube')
const newsletterOnly = args.includes('--newsletter')

console.log('\n🚀 Ask Elijah — Knowledge Base Ingestion')

if (!newsletterOnly) await ingestYouTube()
if (!youtubeOnly) await ingestNewsletters()

console.log('\n✅ Done.\n')
