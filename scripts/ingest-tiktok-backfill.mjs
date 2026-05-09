/**
 * One-time TikTok backfill script.
 *
 * Uses yt-dlp to pull subtitles (VTT) from every video on @elijah.bryant3,
 * embeds each transcript via Voyage AI, and upserts to Pinecone.
 * Records each ingested video in kb_sources so the daily cron skips them.
 *
 * Run: node scripts/ingest-tiktok-backfill.mjs
 *
 * Requires env vars in .env.production.local (auto-loaded below).
 */

import { execSync, spawnSync } from 'child_process'
import { existsSync, readFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// ---------------------------------------------------------------------------
// Load env from .env.production.local
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.production.local')
const envLines = readFileSync(envPath, 'utf8').split('\n')
for (const line of envLines) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const PINECONE_HOST = process.env.PINECONE_HOST
const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const TIKTOK_USER = 'elijah.bryant3'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip VTT formatting, dedupe repeated lines, return clean text. */
function parseVtt(vtt) {
  const lines = vtt.split('\n')
  const seen = new Set()
  const words = []
  for (const line of lines) {
    const t = line.trim()
    if (!t || t === 'WEBVTT' || /^\d+$/.test(t) || /-->/.test(t) || t.startsWith('NOTE')) continue
    // Strip <...> tags
    const clean = t.replace(/<[^>]+>/g, '').trim()
    if (clean && !seen.has(clean)) {
      seen.add(clean)
      words.push(clean)
    }
  }
  return words.join(' ')
}

/** Chunk text into ~400-word pieces with 60-word overlap. */
function chunkText(text, targetWords = 400, overlapWords = 60) {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const chunks = []
  let start = 0
  while (start < words.length) {
    const end = Math.min(start + targetWords, words.length)
    chunks.push(words.slice(start, end).join(' '))
    if (end === words.length) break
    start = end - overlapWords
  }
  return chunks
}

/** Embed a batch of texts via Voyage AI. */
async function embedBatch(texts) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOYAGE_API_KEY}` },
    body: JSON.stringify({ model: 'voyage-3-lite', input: texts }),
  })
  if (!res.ok) throw new Error(`Voyage error: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.data.map((d) => d.embedding)
}

/** Upsert vectors to Pinecone. */
async function upsertToPinecone(chunks, embeddings, meta, idPrefix) {
  const vectors = chunks.map((text, i) => ({
    id: `${idPrefix}_${i}`,
    values: embeddings[i],
    metadata: { ...meta, text, chunk_index: i, chunk_total: chunks.length },
  }))
  // Batch in groups of 100
  for (let i = 0; i < vectors.length; i += 100) {
    const batch = vectors.slice(i, i + 100)
    const res = await fetch(`${PINECONE_HOST}/vectors/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Key': PINECONE_API_KEY },
      body: JSON.stringify({ vectors: batch }),
    })
    if (!res.ok) throw new Error(`Pinecone error: ${res.status} ${await res.text()}`)
  }
  return vectors.length
}

/** Get already-ingested TikTok id_prefixes from Supabase. */
async function getIngestedIds() {
  const { data } = await supabase
    .from('kb_sources')
    .select('id_prefix')
    .like('id_prefix', 'tk_%')
  return new Set((data || []).map((r) => r.id_prefix))
}

/** Record a successfully ingested video in kb_sources. */
async function recordKbSource({ videoId, title, url, chunkCount, publishedAt, thumbnailUrl }) {
  const { error } = await supabase.from('kb_sources').insert({
    id_prefix: `tk_${videoId}`,
    source_title: title,
    source_type: 'tiktok',
    source_url: url,
    chunk_count: chunkCount,
    published_at: publishedAt,
    thumbnail_url: thumbnailUrl || null,
  })
  if (error) console.error(`  kb_sources insert error: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('Fetching TikTok video list...')
const listResult = spawnSync(
  'yt-dlp',
  ['--flat-playlist', '--dump-json', `https://www.tiktok.com/@${TIKTOK_USER}`],
  { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
)
if (listResult.status !== 0) {
  console.error('yt-dlp failed:', listResult.stderr)
  process.exit(1)
}

const videos = listResult.stdout
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    try { return JSON.parse(line) } catch { return null }
  })
  .filter(Boolean)

console.log(`Found ${videos.length} videos.`)

const alreadyIngested = await getIngestedIds()
console.log(`Already ingested: ${alreadyIngested.size}`)

const toIngest = videos.filter((v) => !alreadyIngested.has(`tk_${v.id}`))
console.log(`To ingest: ${toIngest.length}\n`)

if (toIngest.length === 0) {
  console.log('All TikToks already ingested.')
  process.exit(0)
}

// Temp dir for subtitle files
const tmpDir = join(__dirname, '..', '.tiktok-tmp')
mkdirSync(tmpDir, { recursive: true })

let ingested = 0
let skipped = 0
let errors = 0

for (let i = 0; i < toIngest.length; i++) {
  const video = toIngest[i]
  const videoUrl = `https://www.tiktok.com/@${TIKTOK_USER}/video/${video.id}`
  const prefix = `[${i + 1}/${toIngest.length}]`

  process.stdout.write(`${prefix} ${video.title?.slice(0, 60) || video.id}... `)

  try {
    // Download subtitle only
    const dlResult = spawnSync(
      'yt-dlp',
      [
        '--write-subs',
        '--write-auto-subs',
        '--sub-lang', 'en,eng,eng-US',
        '--sub-format', 'vtt',
        '--skip-download',
        '--output', join(tmpDir, `${video.id}.%(ext)s`),
        videoUrl,
      ],
      { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024, timeout: 30000 }
    )

    // Find the vtt file
    const vttFile = [
      join(tmpDir, `${video.id}.en.vtt`),
      join(tmpDir, `${video.id}.eng.vtt`),
      join(tmpDir, `${video.id}.eng-US.vtt`),
    ].find(existsSync)

    let transcript = ''
    if (vttFile) {
      transcript = parseVtt(readFileSync(vttFile, 'utf8'))
      rmSync(vttFile, { force: true })
    }

    const caption = (video.description || video.title || '').trim()
    const fullText = [caption, transcript].filter(Boolean).join('\n\n')

    if (fullText.length < 30) {
      console.log('skipped (no text)')
      skipped++
      continue
    }

    const chunks = chunkText(fullText)
    const embeddings = await embedBatch(chunks)
    const sourceTitle = caption
      ? `TikTok — ${caption.slice(0, 80)}${caption.length > 80 ? '...' : ''}`
      : `TikTok — @${TIKTOK_USER} (${video.id})`

    const chunkCount = await upsertToPinecone(chunks, embeddings, {
      source_title: sourceTitle,
      source_type: 'tiktok',
      source_url: videoUrl,
    }, `tk_${video.id}`)

    const publishedAt = video.timestamp
      ? new Date(video.timestamp * 1000).toISOString()
      : new Date().toISOString()

    // Pick best thumbnail from yt-dlp metadata
    const thumbnailUrl = (video.thumbnails && video.thumbnails.length > 0)
      ? (video.thumbnails.find(t => t.preference === -1) || video.thumbnails[0])?.url || null
      : null

    await recordKbSource({
      videoId: video.id,
      title: sourceTitle,
      url: videoUrl,
      chunkCount,
      publishedAt,
      thumbnailUrl,
    })

    ingested++
    console.log(`✓ (${chunkCount} chunks)`)
  } catch (err) {
    errors++
    console.log(`✗ ${err.message?.slice(0, 80)}`)
  }
}

// Clean up temp dir
rmSync(tmpDir, { recursive: true, force: true })

console.log(`\nDone. Ingested: ${ingested} | Skipped: ${skipped} | Errors: ${errors}`)
