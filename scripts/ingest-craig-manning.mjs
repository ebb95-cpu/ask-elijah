/**
 * Ask Elijah — Craig Manning (Fearless Mind) Channel Ingestion
 *
 * One-off ingestion of Dr. Craig Manning's @FearlessMindGH YouTube channel
 * into the Pinecone KB so Elijah can cite his sports-psychology work.
 *
 * Strategy (accuracy-first):
 *   1. Transcribe every video via AssemblyAI (~$0.015/min, ~95% accuracy)
 *      — skips YouTube auto-captions entirely for consistent quality.
 *   2. Submit transcription jobs in parallel (CONCURRENCY) to save wall clock.
 *   3. Chunk → embed via Voyage → upsert to Pinecone.
 *   4. Record each video as a row in kb_sources for the admin inventory.
 *
 * Usage:
 *   node scripts/ingest-craig-manning.mjs
 *   node scripts/ingest-craig-manning.mjs --dry-run      # list videos, no ingest
 *   node scripts/ingest-craig-manning.mjs --limit 3      # first N videos only
 *   node scripts/ingest-craig-manning.mjs --skip-existing  # skip video IDs already in kb_sources
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { execSync } from 'node:child_process'
import { readFile, unlink, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

const CHANNEL_URL = 'https://www.youtube.com/@FearlessMindGH/videos'
const CHANNEL_LABEL = 'Fearless Mind'
const SPEAKER = 'Craig Manning'
const TOPIC = 'mental-game'

const MIN_TRANSCRIPT_CHARS = 400
const CONCURRENCY = 6  // how many AssemblyAI jobs to run in parallel

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const SKIP_EXISTING = args.includes('--skip-existing')
const limitIdx = args.indexOf('--limit')
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : null

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ── Helpers ────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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

// ── Channel video listing (via yt-dlp) ─────────────────────────────────────

function listChannelVideos() {
  const out = execSync(
    `yt-dlp --flat-playlist --print "%(id)s|%(title)s|%(duration)s" "${CHANNEL_URL}"`,
    { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
  )
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [videoId, title, duration] = line.split('|')
      return { videoId, title: title || '', duration: parseInt(duration, 10) || 0 }
    })
}

// ── AssemblyAI transcription ──────────────────────────────────────────────

async function downloadAudio(videoId) {
  const dir = await mkdtemp(join(tmpdir(), 'craig-'))
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
    headers: {
      Authorization: ASSEMBLYAI_API_KEY,
      'Content-Type': 'application/octet-stream',
    },
    body: buf,
  })
  if (!res.ok) {
    throw new Error(`AssemblyAI upload ${res.status}: ${await res.text().catch(() => '')}`)
  }
  const { upload_url } = await res.json()
  return upload_url
}

async function transcribeWithAssemblyAI(videoId) {
  let audioPath
  try {
    audioPath = await downloadAudio(videoId)
    const uploadUrl = await uploadToAssemblyAI(audioPath)

    const submitRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        Authorization: ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: uploadUrl,
        language_code: 'en',
        speech_models: ['universal-2'],
      }),
    })
    if (!submitRes.ok) {
      throw new Error(`AssemblyAI submit ${submitRes.status}: ${await submitRes.text().catch(() => '')}`)
    }
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

// ── Embed + upsert ─────────────────────────────────────────────────────────

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

// ── Per-video ingest ───────────────────────────────────────────────────────

async function ingestOne(video, index, total) {
  const { videoId, title } = video
  const label = (title || videoId).slice(0, 48).padEnd(50, '.')
  const prefix = `[${index + 1}/${total}]`

  let text
  try {
    text = await transcribeWithAssemblyAI(videoId)
  } catch (err) {
    console.log(`  ${prefix} ${label} ❌ transcribe failed: ${err.message}`)
    return { ok: false, reason: 'transcript_failed' }
  }
  if (!text || text.length < MIN_TRANSCRIPT_CHARS) {
    console.log(`  ${prefix} ${label} ⏭  transcript too short (${text?.length ?? 0} chars)`)
    return { ok: false, reason: 'too_short' }
  }

  const chunks = chunkText(text)
  let embeddings
  try {
    embeddings = await embedBatch(chunks)
  } catch (err) {
    console.log(`  ${prefix} ${label} ❌ embed failed: ${err.message}`)
    return { ok: false, reason: 'embed_failed' }
  }

  const idPrefix = `craigmanning_${videoId}`
  const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`
  const vectors = chunks.map((chunk, i) => ({
    id: `${idPrefix}_${i}`,
    values: embeddings[i],
    metadata: {
      text: chunk,
      source_type: 'youtube',
      source_title: title || `Video ${videoId}`,
      source_url: sourceUrl,
      channel: CHANNEL_LABEL,
      speaker: SPEAKER,
      topic: TOPIC,
      chunk_index: i,
    },
  }))

  try {
    await upsertVectors(vectors)
  } catch (err) {
    console.log(`  ${prefix} ${label} ❌ upsert failed: ${err.message}`)
    return { ok: false, reason: 'upsert_failed' }
  }

  try {
    const { error: sbErr } = await supabase.from('kb_sources').insert({
      source_title: title || `Video ${videoId}`,
      source_type: 'youtube',
      source_url: sourceUrl,
      topic: TOPIC,
      level: null,
      chunk_count: vectors.length,
      id_prefix: idPrefix,
    })
    // Silent if table doesn't exist (migration not applied); noisy otherwise.
    if (sbErr && !sbErr.message.includes("Could not find the table")) {
      console.log(`  ${prefix} ${label} ⚠️  kb_sources: ${sbErr.message}`)
    }
  } catch { /* ignore inventory write failures */ }

  console.log(`  ${prefix} ${label} ✅ ${vectors.length} chunks`)
  return { ok: true, chunks: vectors.length }
}

// Simple parallel pool — runs up to `limit` tasks concurrently.
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

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🧠 Ingesting @FearlessMindGH (Dr. Craig Manning)\n`)

  let videos = listChannelVideos()
  console.log(`  Found ${videos.length} videos on channel`)

  if (SKIP_EXISTING) {
    const { data: existing } = await supabase
      .from('kb_sources')
      .select('id_prefix')
      .like('id_prefix', 'craigmanning_%')
    const seen = new Set((existing || []).map((r) => r.id_prefix))
    const before = videos.length
    videos = videos.filter((v) => !seen.has(`craigmanning_${v.videoId}`))
    console.log(`  Skipping ${before - videos.length} already-ingested`)
  }

  if (LIMIT) videos = videos.slice(0, LIMIT)

  if (DRY_RUN) {
    console.log('\n  DRY RUN — videos that would be ingested:')
    videos.forEach((v, i) => console.log(`    ${i + 1}. ${v.title} (${v.videoId}, ${v.duration}s)`))
    return
  }

  console.log(`  Transcribing with AssemblyAI, concurrency=${CONCURRENCY}\n`)
  const results = await runInPool(videos, CONCURRENCY, ingestOne)

  const ok = results.filter((r) => r?.ok).length
  const fail = results.length - ok
  console.log(`\n✅ Done. ${ok} ok, ${fail} failed.\n`)
}

main().catch((err) => {
  console.error('\n❌ Fatal:', err)
  process.exit(1)
})
