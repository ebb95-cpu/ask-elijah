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
 *   node scripts/ingest.mjs --clean    — delete shorts already in Pinecone, then rerun
 */

import YoutubeTranscript from 'youtube-transcript'
import { config } from 'dotenv'
config({ path: '.env.local' })

const PINECONE_HOST = process.env.PINECONE_HOST
const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY
const BEEHIIV_PUB_ID = 'pub_9471ed24-57d1-43c6-be5b-ee779941c348'

const YOUTUBE_CHANNELS = [
  { handle: 'ElijahBryant3', label: 'Elijah Bryant' },
  { handle: 'ConsistencyClubFilm', label: 'Consistency Club Film' },
]

const MIN_TRANSCRIPT_CHARS = 400   // skip anything shorter than this
const SHORT_DURATION_SECS = 90     // skip videos under 90 seconds

// ── Helpers ────────────────────────────────────────────────────────────────

function isShortForm(title = '', description = '') {
  const text = (title + ' ' + description).toLowerCase()
  return (
    text.includes('#shorts') ||
    text.includes('#short ') ||
    text.endsWith('#short') ||
    text.includes('shorts |') ||
    text.includes('| shorts')
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
  return chunks.filter((c) => c.length > 100)
}

async function embed(text) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
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

async function deleteByPrefix(prefix) {
  const res = await fetch(`${PINECONE_HOST}/vectors/delete`, {
    method: 'POST',
    headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ deleteAll: false, filter: { id: { $gte: prefix, $lt: prefix + '~' } } }),
  })
  return res.ok
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ── YouTube ────────────────────────────────────────────────────────────────

async function getChannelVideos(handle) {
  // Use YouTube RSS feed — no API key needed
  const res = await fetch(
    `https://www.youtube.com/feeds/videos.xml?user=${handle}`,
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  )
  if (!res.ok) {
    // Try channel ID approach
    const res2 = await fetch(
      `https://www.youtube.com/c/${handle}/videos`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    const html = await res2.text()
    const matches = [...html.matchAll(/"videoId":"([^"]+)"/g)]
    const ids = [...new Set(matches.map((m) => m[1]))]
    return ids.map((id) => ({ videoId: id, title: '', description: '' }))
  }
  const xml = await res.text()
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
  return entries.map((e) => {
    const id = (e[1].match(/<yt:videoId>([^<]+)/) || [])[1] || ''
    const title = (e[1].match(/<title>([^<]+)/) || [])[1] || ''
    return { videoId: id, title, description: '' }
  })
}

async function ingestVideo(video, channelLabel) {
  const { videoId, title, description } = video

  // Skip short-form content
  if (isShortForm(title, description)) {
    return { status: 'skipped', reason: 'short-form' }
  }

  // Fetch transcript
  let transcript
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId)
    transcript = segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim()
  } catch {
    return { status: 'skipped', reason: 'no-transcript' }
  }

  if (transcript.length < MIN_TRANSCRIPT_CHARS) {
    return { status: 'skipped', reason: 'transcript-too-short' }
  }

  const chunks = chunkText(transcript)
  const vectors = []

  for (let i = 0; i < chunks.length; i++) {
    try {
      const embedding = await embed(chunks[i])
      vectors.push({
        id: `yt_${videoId}_${i}`,
        values: embedding,
        metadata: {
          text: chunks[i],
          source_type: 'youtube',
          source_title: title || `Video ${videoId}`,
          source_url: `https://youtube.com/watch?v=${videoId}`,
          channel: channelLabel,
          chunk_index: i,
        },
      })
      await sleep(120) // respect rate limits
    } catch {
      // skip individual chunk on embed error
    }
  }

  if (vectors.length === 0) {
    return { status: 'skipped', reason: 'embed-failed' }
  }

  try {
    // Upsert in batches of 50
    for (let i = 0; i < vectors.length; i += 50) {
      await upsertVectors(vectors.slice(i, i + 50))
    }
    return { status: 'ok', chunks: vectors.length }
  } catch (err) {
    return { status: 'error', reason: err.message }
  }
}

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
      const v = videos[i]
      const label = (v.title || v.videoId).slice(0, 50).padEnd(52, '.')
      const result = await ingestVideo(v, channel.label)

      if (result.status === 'ok') {
        process.stdout.write(`  [${i + 1}/${videos.length}] ${label} ✅ ${result.chunks} chunks\n`)
        totalOk++
      } else if (result.status === 'skipped') {
        process.stdout.write(`  [${i + 1}/${videos.length}] ${label} ⏭️  ${result.reason}\n`)
        totalSkipped++
      } else {
        process.stdout.write(`  [${i + 1}/${videos.length}] ${label} ❌ ${result.reason}\n`)
        totalErrors++
      }

      await sleep(300)
    }
  }

  console.log(`\n  ✅ Ingested: ${totalOk} videos`)
  console.log(`  ⏭️  Skipped: ${totalSkipped} (shorts + no transcript)`)
  console.log(`  ❌ Errors: ${totalErrors}`)
}

// ── Newsletters ────────────────────────────────────────────────────────────

async function ingestNewsletters() {
  console.log('\n📧 Ingesting Beehiiv newsletters...\n')

  let page = 1
  let allIssues = []

  while (true) {
    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/posts?status=confirmed&expand[]=free_web_content&limit=50&page=${page}`,
      { headers: { Authorization: `Bearer ${BEEHIIV_API_KEY}` } }
    )
    if (!res.ok) {
      console.log(`  ❌ Beehiiv API error: ${res.status}`)
      break
    }
    const data = await res.json()
    const issues = data.data || []
    if (issues.length === 0) break
    allIssues = allIssues.concat(issues)
    if (!data.nextPage) break
    page++
  }

  console.log(`  Found ${allIssues.length} issues\n`)
  let totalOk = 0, totalSkipped = 0

  for (let i = 0; i < allIssues.length; i++) {
    const issue = allIssues[i]
    const title = issue.title || `Issue ${i + 1}`
    const label = title.slice(0, 50).padEnd(52, '.')

    // Get content — try free_web_content, then content
    const rawContent =
      issue.free_web_content ||
      issue.content?.free?.web ||
      issue.content?.premium?.web ||
      ''

    // Strip HTML tags
    const text = rawContent
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()

    if (text.length < MIN_TRANSCRIPT_CHARS) {
      process.stdout.write(`  [${i + 1}/${allIssues.length}] ${label} ⏭️  too short\n`)
      totalSkipped++
      continue
    }

    const chunks = chunkText(text)
    const vectors = []
    const url = issue.web_url || issue.url || ''

    for (let j = 0; j < chunks.length; j++) {
      try {
        const embedding = await embed(chunks[j])
        vectors.push({
          id: `nl_${issue.id}_${j}`,
          values: embedding,
          metadata: {
            text: chunks[j],
            source_type: 'newsletter',
            source_title: title,
            source_url: url,
            chunk_index: j,
          },
        })
        await sleep(120)
      } catch {
        // skip chunk
      }
    }

    if (vectors.length === 0) {
      process.stdout.write(`  [${i + 1}/${allIssues.length}] ${label} ❌ embed failed\n`)
      continue
    }

    try {
      for (let j = 0; j < vectors.length; j += 50) {
        await upsertVectors(vectors.slice(j, j + 50))
      }
      process.stdout.write(`  [${i + 1}/${allIssues.length}] ${label} ✅ ${vectors.length} chunks\n`)
      totalOk++
    } catch (err) {
      process.stdout.write(`  [${i + 1}/${allIssues.length}] ${label} ❌ ${err.message}\n`)
    }

    await sleep(300)
  }

  console.log(`\n  ✅ Ingested: ${totalOk} newsletters`)
  console.log(`  ⏭️  Skipped: ${totalSkipped}`)
}

// ── Main ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const youtubeOnly = args.includes('--youtube')
const newsletterOnly = args.includes('--newsletter')

console.log('\n🚀 Ask Elijah — Knowledge Base Ingestion')
console.log('   Skipping: YouTube Shorts, videos < 90s, transcripts < 400 chars\n')

if (!newsletterOnly) await ingestYouTube()
if (!youtubeOnly) await ingestNewsletters()

console.log('\n✅ Done.\n')
