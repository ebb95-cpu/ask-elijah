/**
 * Generic speaker-ingestion script.
 *
 * Takes a list of YouTube video URLs + a speaker tag, transcribes each via
 * AssemblyAI (after downloading audio with yt-dlp), chunks + embeds via
 * Voyage, and upserts to Pinecone with speaker metadata. Used for bringing
 * a new voice (Kobe, Jordan, Phil Jackson, etc.) into the KB so the
 * /api/kb-quote rotation can surface it.
 *
 * Usage:
 *   node scripts/ingest-speaker.mjs \
 *     --speaker "Kobe Bryant" \
 *     --channel "Kobe interviews" \
 *     --prefix kobe \
 *     --urls urls.txt
 *
 *   node scripts/ingest-speaker.mjs --speaker "Kobe Bryant" --prefix kobe \
 *     --url https://www.youtube.com/watch?v=ABC123
 *
 * Flags:
 *   --speaker  Pinecone metadata.speaker tag (required)
 *   --channel  Pinecone metadata.channel label (optional, defaults to speaker)
 *   --prefix   id prefix in Pinecone, e.g. "kobe" → kobe_<videoId>_<chunkIdx>
 *   --topic    Pinecone metadata.topic tag (default: 'mental-game')
 *   --urls     Path to a text file with one YouTube URL per line
 *   --url      Single YouTube URL (can be repeated)
 *   --dry-run  Print what would be ingested, don't transcribe
 *   --limit N  Process only the first N URLs
 *   --skip-existing  Skip video IDs already recorded in kb_sources
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { execSync } from 'node:child_process'
import { readFile, unlink, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'

config({ path: '.env.local', override: true })

const {
  PINECONE_HOST,
  PINECONE_API_KEY,
  VOYAGE_API_KEY,
  ASSEMBLYAI_API_KEY,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env

for (const [name, value] of Object.entries({
  PINECONE_HOST,
  PINECONE_API_KEY,
  VOYAGE_API_KEY,
  ASSEMBLYAI_API_KEY,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
})) {
  if (!value) {
    console.error(`❌ Missing env var: ${name}`)
    process.exit(1)
  }
}

// ── Arg parsing ────────────────────────────────────────────────────────────

function getArg(flag, { multi = false, fallback = null } = {}) {
  const results = []
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === flag && i + 1 < process.argv.length) {
      results.push(process.argv[i + 1])
      if (!multi) return process.argv[i + 1]
    }
  }
  return multi ? results : fallback
}

const hasFlag = (flag) => process.argv.includes(flag)

const SPEAKER = getArg('--speaker')
const CHANNEL = getArg('--channel') || SPEAKER
const PREFIX = getArg('--prefix')
const TOPIC = getArg('--topic', { fallback: 'mental-game' })
const URLS_FILE = getArg('--urls')
const SINGLE_URLS = getArg('--url', { multi: true })
const DRY_RUN = hasFlag('--dry-run')
const SKIP_EXISTING = hasFlag('--skip-existing')
const limitIdx = process.argv.indexOf('--limit')
const LIMIT = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1], 10) : null

if (!SPEAKER || !PREFIX) {
  console.error('❌ --speaker and --prefix are required')
  console.error('   Example: node scripts/ingest-speaker.mjs --speaker "Kobe Bryant" --prefix kobe --urls kobe-urls.txt')
  process.exit(1)
}

const MIN_TRANSCRIPT_CHARS = 400
const CONCURRENCY = 6

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── URL parsing ────────────────────────────────────────────────────────────

function extractVideoId(url) {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase().replace(/^www\./, '')
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
    if (host.endsWith('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const m = u.pathname.match(/^\/(shorts|embed|v)\/([^/]+)/)
      if (m) return m[2]
    }
    return null
  } catch {
    return null
  }
}

async function fetchVideoMeta(videoId) {
  const out = execSync(
    `yt-dlp --skip-download --print "%(id)s|%(title)s|%(duration)s" "https://www.youtube.com/watch?v=${videoId}"`,
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'ignore'] }
  )
  const [, title, duration] = out.trim().split('|')
  return { videoId, title: title || videoId, duration: parseInt(duration, 10) || 0 }
}

// ── Chunking / embedding / upsert ─────────────────────────────────────────

function chunkText(text, chunkWords = 600, overlap = 100) {
  const words = text.split(/\s+/)
  const chunks = []
  let i = 0
  while (i < words.length) {
    chunks.push(words.slice(i, i + chunkWords).join(' '))
    i += chunkWords - overlap
  }
  return chunks.filter((c) => c.length > 100)
}

async function embedBatch(texts) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${VOYAGE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: texts, model: 'voyage-3-lite' }),
  })
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${await res.text().catch(() => '')}`)
  const data = await res.json()
  return (data.data || []).map((d) => d.embedding)
}

async function upsertVectors(vectors) {
  for (let i = 0; i < vectors.length; i += 50) {
    const batch = vectors.slice(i, i + 50)
    const res = await fetch(`${PINECONE_HOST}/vectors/upsert`, {
      method: 'POST',
      headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ vectors: batch }),
    })
    if (!res.ok) throw new Error(`Pinecone ${res.status}: ${await res.text().catch(() => '')}`)
  }
}

// ── AssemblyAI transcription ──────────────────────────────────────────────

async function downloadAudio(videoId) {
  const dir = await mkdtemp(join(tmpdir(), `${PREFIX}-`))
  const path = join(dir, `${videoId}.m4a`)
  execSync(
    `yt-dlp -f 'bestaudio[ext=m4a]/bestaudio' -o "${path}" "https://www.youtube.com/watch?v=${videoId}" --quiet --no-warnings`,
    { stdio: 'pipe' }
  )
  return path
}

async function uploadToAssemblyAI(filePath) {
  const buf = await readFile(filePath)
  const res = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: { Authorization: ASSEMBLYAI_API_KEY, 'Content-Type': 'application/octet-stream' },
    body: buf,
  })
  if (!res.ok) throw new Error(`AssemblyAI upload ${res.status}: ${await res.text().catch(() => '')}`)
  const { upload_url } = await res.json()
  return upload_url
}

async function transcribe(videoId) {
  let audioPath
  try {
    audioPath = await downloadAudio(videoId)
    const uploadUrl = await uploadToAssemblyAI(audioPath)
    const submitRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: { Authorization: ASSEMBLYAI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audio_url: uploadUrl,
        language_code: 'en',
        speech_models: ['universal-2'],
      }),
    })
    if (!submitRes.ok) throw new Error(`AssemblyAI submit ${submitRes.status}`)
    const { id, error } = await submitRes.json()
    if (error) throw new Error(error)
    if (!id) throw new Error('No transcript id from AssemblyAI')
    for (let i = 0; i < 60; i++) {
      await sleep(5000)
      const poll = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { Authorization: ASSEMBLYAI_API_KEY },
      })
      if (!poll.ok) continue
      const data = await poll.json()
      if (data.status === 'completed') return data.text || ''
      if (data.status === 'error') throw new Error(`AssemblyAI error: ${data.error}`)
    }
    throw new Error('AssemblyAI timeout after 5 minutes')
  } finally {
    if (audioPath) {
      try { await unlink(audioPath) } catch { /* ignore */ }
    }
  }
}

// ── Per-video ingest ──────────────────────────────────────────────────────

async function ingestOne(video, index, total) {
  const { videoId, title } = video
  const label = (title || videoId).slice(0, 48).padEnd(50, '.')
  const prefix = `[${index + 1}/${total}]`

  let text
  try {
    text = await transcribe(videoId)
  } catch (err) {
    console.log(`  ${prefix} ${label} ❌ transcribe failed: ${err.message}`)
    return { ok: false }
  }
  if (!text || text.length < MIN_TRANSCRIPT_CHARS) {
    console.log(`  ${prefix} ${label} ⏭  transcript too short (${text?.length ?? 0} chars)`)
    return { ok: false }
  }

  const chunks = chunkText(text)
  let embeddings
  try {
    embeddings = await embedBatch(chunks)
  } catch (err) {
    console.log(`  ${prefix} ${label} ❌ embed failed: ${err.message}`)
    return { ok: false }
  }

  const idPrefix = `${PREFIX}_${videoId}`
  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`
  const vectors = chunks.map((chunk, i) => ({
    id: `${idPrefix}_${i}`,
    values: embeddings[i],
    metadata: {
      text: chunk,
      source_type: 'youtube',
      source_title: title,
      source_url: sourceUrl,
      channel: CHANNEL,
      speaker: SPEAKER,
      topic: TOPIC,
      chunk_index: i,
    },
  }))

  try {
    await upsertVectors(vectors)
  } catch (err) {
    console.log(`  ${prefix} ${label} ❌ upsert failed: ${err.message}`)
    return { ok: false }
  }

  try {
    const { error } = await supabase.from('kb_sources').insert({
      source_title: title,
      source_type: 'youtube',
      source_url: sourceUrl,
      topic: TOPIC,
      level: null,
      chunk_count: vectors.length,
      id_prefix: idPrefix,
    })
    if (error && !error.message.includes("Could not find the table")) {
      console.log(`  ${prefix} ${label} ⚠️  kb_sources: ${error.message}`)
    }
  } catch { /* ignore */ }

  console.log(`  ${prefix} ${label} ✅ ${vectors.length} chunks`)
  return { ok: true }
}

async function runInPool(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (true) {
      const i = next++
      if (i >= items.length) return
      results[i] = await fn(items[i], i, items.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎙  Ingesting "${SPEAKER}" — prefix: ${PREFIX}\n`)

  let urls = []
  if (URLS_FILE) {
    const contents = readFileSync(URLS_FILE, 'utf8')
    urls = contents.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  }
  urls = urls.concat(SINGLE_URLS)
  if (urls.length === 0) {
    console.error('❌ No URLs provided. Use --urls <file> or --url <url>')
    process.exit(1)
  }

  const ids = urls.map(extractVideoId).filter(Boolean)
  console.log(`  Parsed ${ids.length} video IDs from ${urls.length} URL(s)`)

  console.log('  Fetching titles...')
  const videos = []
  for (const id of ids) {
    try {
      videos.push(await fetchVideoMeta(id))
    } catch {
      videos.push({ videoId: id, title: id, duration: 0 })
    }
  }

  let filtered = videos
  if (SKIP_EXISTING) {
    const { data: existing } = await supabase
      .from('kb_sources')
      .select('id_prefix')
      .like('id_prefix', `${PREFIX}_%`)
    const seen = new Set((existing || []).map((r) => r.id_prefix))
    const before = filtered.length
    filtered = filtered.filter((v) => !seen.has(`${PREFIX}_${v.videoId}`))
    console.log(`  Skipping ${before - filtered.length} already-ingested`)
  }

  if (LIMIT) filtered = filtered.slice(0, LIMIT)

  if (DRY_RUN) {
    console.log('\n  DRY RUN — videos that would be ingested:')
    filtered.forEach((v, i) => console.log(`    ${i + 1}. ${v.title} (${v.videoId}, ${v.duration}s)`))
    return
  }

  console.log(`  Transcribing ${filtered.length} videos with AssemblyAI, concurrency=${CONCURRENCY}\n`)
  const results = await runInPool(filtered, CONCURRENCY, ingestOne)
  const ok = results.filter((r) => r?.ok).length
  console.log(`\n✅ Done. ${ok} ok, ${results.length - ok} failed.\n`)
}

main().catch((err) => {
  console.error('\n❌ Fatal:', err)
  process.exit(1)
})
