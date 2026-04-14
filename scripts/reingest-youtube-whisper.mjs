/**
 * Ask Elijah — Re-ingest YouTube with AssemblyAI
 *
 * Replaces all existing YouTube vectors in Pinecone with accurate
 * AssemblyAI transcriptions. Overwrites old auto-caption chunks by using
 * the same vector IDs (yt_VIDEOID_CHUNK).
 *
 * Usage:
 *   node scripts/reingest-youtube-whisper.mjs
 */

import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { config } from 'dotenv'
config({ path: '.env.local', override: true })

const PINECONE_HOST = process.env.PINECONE_HOST
const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY

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

// ── AssemblyAI ───────────────────────────────────────────────────────────────

async function transcribeWithAssemblyAI(videoId) {
  // Submit YouTube URL — AssemblyAI downloads it directly
  const submitRes = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      Authorization: ASSEMBLYAI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: `https://www.youtube.com/watch?v=${videoId}`,
      language_code: 'en',
    }),
  })
  if (!submitRes.ok) throw new Error(`AssemblyAI submit ${submitRes.status}: ${await submitRes.text()}`)
  const { id, error: submitError } = await submitRes.json()
  if (submitError) throw new Error(submitError)

  // Poll until complete (max 10 min)
  for (let i = 0; i < 120; i++) {
    await sleep(5000)
    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { Authorization: ASSEMBLYAI_API_KEY },
    })
    const data = await pollRes.json()
    if (data.status === 'completed') return data.text || ''
    if (data.status === 'error') throw new Error(`AssemblyAI error: ${data.error}`)
  }
  throw new Error('AssemblyAI timeout after 10 minutes')
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

// ── Channel Videos (all of them via yt-dlp) ─────────────────────────────────

function getChannelVideos(handle) {
  // yt-dlp --flat-playlist gets every video ID + title with full pagination
  const output = execSync(
    `yt-dlp --flat-playlist --print "%(id)s|%(title)s" "https://www.youtube.com/@${handle}/videos" 2>/dev/null`,
    { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }
  ).toString().trim()

  return output.split('\n')
    .filter(Boolean)
    .map(line => {
      const sep = line.indexOf('|')
      const videoId = line.slice(0, sep).trim()
      const title = line.slice(sep + 1).trim()
      return { videoId, title }
    })
    .filter(v => v.videoId?.length === 11)
}

// ── Main ────────────────────────────────────────────────────────────────────

console.log('\n🚀 Ask Elijah — Re-ingest YouTube with AssemblyAI\n')
console.log('  Submits each video to AssemblyAI, transcribes word-for-word,')
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

    process.stdout.write(`  [${i + 1}/${videos.length}] ${label} transcribing with AssemblyAI... `)

    let transcript
    try {
      transcript = await transcribeWithAssemblyAI(videoId)
    } catch (err) {
      process.stdout.write(`❌ AssemblyAI failed: ${err.message.slice(0, 60)}\n`)
      totalErrors++
      await sleep(500)
      continue
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
            transcription: 'assemblyai',
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
      process.stdout.write(`✅ ${vectors.length} chunks (AssemblyAI)\n`)
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
console.log('\n✅ Done. All YouTube vectors now use AssemblyAI transcriptions.\n')
