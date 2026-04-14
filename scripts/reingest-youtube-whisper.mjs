/**
 * Ask Elijah — Re-ingest YouTube with Whisper
 *
 * Replaces all existing YouTube vectors in Pinecone with accurate
 * Whisper transcriptions. Overwrites old auto-caption chunks by using
 * the same vector IDs (yt_VIDEOID_CHUNK).
 *
 * Usage:
 *   node scripts/reingest-youtube-whisper.mjs
 */

import { execSync } from 'child_process'
import { existsSync, unlinkSync, mkdirSync } from 'fs'
import { createReadStream } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import FormData from 'form-data'
import { config } from 'dotenv'
config({ path: '.env.local' })

const PINECONE_HOST = process.env.PINECONE_HOST
const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const YOUTUBE_CHANNELS = [
  { handle: 'ElijahBryant3', label: 'Elijah Bryant' },
  { handle: 'ConsistencyClubFilm', label: 'Consistency Club Film' },
]

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
const TMP_DIR = join(tmpdir(), 'ask-elijah-reingest')
const MIN_CHARS = 400

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function isShortForm(title = '') {
  const t = title.toLowerCase()
  return t.includes('#shorts') || t.includes('#short') || t.includes('shorts |') || t.includes('| shorts') || t.startsWith('#')
}

function chunkText(text, chunkSize = 600, overlap = 100) {
  const words = text.split(/\s+/)
  const chunks = []
  let i = 0
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ')
    if (chunk.length > 100) chunks.push(chunk)
    i += chunkSize - overlap
  }
  return chunks
}

// ── Whisper ─────────────────────────────────────────────────────────────────

async function downloadAudio(videoId) {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true })
  const audioPath = join(TMP_DIR, `${videoId}.mp3`)
  if (existsSync(audioPath)) unlinkSync(audioPath)

  execSync(
    `yt-dlp -x --audio-format mp3 --audio-quality 3 -o "${audioPath}" --max-filesize 25m "https://youtube.com/watch?v=${videoId}" --quiet`,
    { timeout: 120000 }
  )

  if (!existsSync(audioPath)) throw new Error('Audio file not created')
  return audioPath
}

async function transcribeWithWhisper(audioPath) {
  const form = new FormData()
  form.append('file', createReadStream(audioPath))
  form.append('model', 'whisper-1')
  form.append('language', 'en')
  form.append('response_format', 'text')

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      ...form.getHeaders(),
    },
    body: form,
  })

  if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`)
  return await res.text()
}

// ── Embed + Upsert ─────────────────────────────────────────────────────────

async function embed(text) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${VOYAGE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: [text], model: 'voyage-3-lite' }),
  })
  if (!res.ok) throw new Error(`Voyage ${res.status}`)
  const data = await res.json()
  return data.data[0].embedding
}

async function upsertVectors(vectors) {
  const res = await fetch(`${PINECONE_HOST}/vectors/upsert`, {
    method: 'POST',
    headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vectors }),
  })
  if (!res.ok) throw new Error(`Pinecone ${res.status}: ${await res.text()}`)
}

// ── Channel Videos ──────────────────────────────────────────────────────────

async function getChannelVideos(handle) {
  const pageRes = await fetch(`https://www.youtube.com/@${handle}/videos`, { headers: HEADERS })
  if (!pageRes.ok) throw new Error(`Channel fetch failed: ${pageRes.status}`)
  const html = await pageRes.text()
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
          return { videoId: video.videoId, title: video.title?.runs?.[0]?.text || '' }
        })
        .filter(Boolean)
      if (videos.length > 0) return videos
    } catch { /* fallthrough */ }
  }
  const ids = [...new Set([...html.matchAll(/"videoId":"([^"]{11})"/g)].map(m => m[1]))]
  const titleMap = {}
  for (const m of html.matchAll(/"videoId":"([^"]{11})"[^}]*?"text":"([^"]+)"/g)) {
    if (!titleMap[m[1]]) titleMap[m[1]] = m[2]
  }
  return ids.map(id => ({ videoId: id, title: titleMap[id] || '' }))
}

// ── Main ────────────────────────────────────────────────────────────────────

console.log('\n🚀 Ask Elijah — Re-ingest YouTube with Whisper\n')
console.log('  Downloads each video audio, transcribes word-for-word with Whisper,')
console.log('  and overwrites the existing Pinecone vectors with accurate text.\n')

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
  console.log(`  Found ${videos.length} videos\n`)

  for (let i = 0; i < videos.length; i++) {
    const { videoId, title } = videos[i]
    const label = (title || videoId).slice(0, 50).padEnd(52, '.')

    if (isShortForm(title)) {
      process.stdout.write(`  [${i + 1}/${videos.length}] ${label} ⏭️  short-form\n`)
      totalSkipped++
      continue
    }

    process.stdout.write(`  [${i + 1}/${videos.length}] ${label} downloading... `)

    let audioPath
    try {
      audioPath = await downloadAudio(videoId)
    } catch (err) {
      process.stdout.write(`⏭️  ${err.message.slice(0, 60)}\n`)
      totalSkipped++
      await sleep(500)
      continue
    }

    process.stdout.write(`transcribing... `)

    let transcript
    try {
      transcript = await transcribeWithWhisper(audioPath)
    } catch (err) {
      process.stdout.write(`❌ Whisper failed: ${err.message.slice(0, 60)}\n`)
      totalErrors++
      if (existsSync(audioPath)) unlinkSync(audioPath)
      await sleep(500)
      continue
    } finally {
      if (audioPath && existsSync(audioPath)) unlinkSync(audioPath)
    }

    if (!transcript || transcript.length < MIN_CHARS) {
      process.stdout.write(`⏭️  transcript too short (${transcript?.length || 0} chars)\n`)
      totalSkipped++
      continue
    }

    const chunks = chunkText(transcript)
    const vectors = []

    for (let j = 0; j < chunks.length; j++) {
      try {
        const values = await embed(chunks[j])
        vectors.push({
          id: `yt_${videoId}_${j}`,  // Same ID as original — overwrites old auto-caption vector
          values,
          metadata: {
            text: chunks[j],
            source_type: 'youtube',
            source_title: title || `Video ${videoId}`,
            source_url: `https://youtube.com/watch?v=${videoId}`,
            channel: channel.label,
            chunk_index: j,
            transcription: 'whisper',
          },
        })
        await sleep(100)
      } catch { /* skip chunk */ }
    }

    if (vectors.length === 0) {
      process.stdout.write(`❌ embed failed\n`)
      totalErrors++
      continue
    }

    try {
      for (let j = 0; j < vectors.length; j += 50) {
        await upsertVectors(vectors.slice(j, j + 50))
      }
      process.stdout.write(`✅ ${vectors.length} chunks (Whisper)\n`)
      totalOk++
    } catch (err) {
      process.stdout.write(`❌ ${err.message.slice(0, 60)}\n`)
      totalErrors++
    }

    await sleep(600)
  }
}

// Cleanup
try { execSync(`rm -rf "${TMP_DIR}"`) } catch {}

console.log(`\n  ✅ Re-ingested: ${totalOk} videos`)
console.log(`  ⏭️  Skipped:    ${totalSkipped}`)
console.log(`  ❌ Errors:      ${totalErrors}`)
console.log('\n✅ Done. All YouTube vectors now use Whisper transcriptions.\n')
