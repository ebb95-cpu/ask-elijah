/**
 * Ingests YouTube videos missing from kb_sources using yt-dlp subtitles.
 * Run: node scripts/ingest-youtube-missing.mjs
 */

import { spawnSync, execSync } from 'child_process'
import { existsSync, readFileSync, mkdirSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envLines = readFileSync(join(__dirname, '..', '.env.production.local'), 'utf8').split('\n')
for (const line of envLines) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY
const PINECONE_HOST = process.env.PINECONE_HOST
const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const CHANNELS = ['ElijahBryant3', 'ConsistencyClubFilm']

function parseVtt(vtt) {
  const seen = new Set()
  const words = []
  for (const line of vtt.split('\n')) {
    const t = line.trim()
    if (!t || t === 'WEBVTT' || /^\d+$/.test(t) || /-->/.test(t)) continue
    const clean = t.replace(/<[^>]+>/g, '').trim()
    if (clean && !seen.has(clean)) { seen.add(clean); words.push(clean) }
  }
  return words.join(' ')
}

function chunkText(text, size = 500, overlap = 80) {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks = []
  let i = 0
  while (i < words.length) {
    const chunk = words.slice(i, i + size).join(' ')
    if (chunk.length > 50) chunks.push(chunk)
    i += size - overlap
  }
  return chunks
}

async function embedBatch(texts) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VOYAGE_API_KEY}` },
    body: JSON.stringify({ model: 'voyage-3-lite', input: texts }),
  })
  if (!res.ok) throw new Error(`Voyage ${res.status}`)
  return (await res.json()).data.map(d => d.embedding)
}

async function upsertToPinecone(chunks, embeddings, meta, idPrefix) {
  const vectors = chunks.map((text, i) => ({
    id: `${idPrefix}${i}`,
    values: embeddings[i],
    metadata: { ...meta, text, chunk_index: i, chunk_total: chunks.length },
  }))
  for (let i = 0; i < vectors.length; i += 100) {
    const res = await fetch(`${PINECONE_HOST}/vectors/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Api-Key': PINECONE_API_KEY },
      body: JSON.stringify({ vectors: vectors.slice(i, i + 100) }),
    })
    if (!res.ok) throw new Error(`Pinecone ${res.status}`)
  }
  return vectors.length
}

// Get channel ID from handle
async function getChannelId(handle) {
  const res = await fetch(`https://www.youtube.com/@${handle}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const html = await res.text()
  const m = html.match(/"channelId":"(UC[^"]+)"/) || html.match(/"browseId":"(UC[^"]+)"/)
  return m?.[1] ?? null
}

// Get all videos from RSS
async function getRssVideos(channelId) {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`)
  const xml = await res.text()
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || []
  return entries.map(entry => {
    const id = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
    const title = entry.match(/<media:title[^>]*>([^<]+)<\/media:title>/)?.[1] || entry.match(/<title>([^<]+)<\/title>/)?.[1] || ''
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1] || null
    const thumb = entry.match(/<media:thumbnail[^>]+url="([^"]+)"/)?.[1] || null
    return { id, title, published, thumb }
  }).filter(v => v.id)
}

// Get already ingested video IDs
async function getIngestedIds() {
  const { data } = await supabase.from('kb_sources').select('id_prefix').eq('source_type', 'youtube')
  return new Set((data || []).map(r => r.id_prefix))
}

const tmpDir = join(__dirname, '..', '.youtube-tmp')
mkdirSync(tmpDir, { recursive: true })

const ingested = await getIngestedIds()
let added = 0, skipped = 0, errors = 0

for (const handle of CHANNELS) {
  console.log(`\nChannel: @${handle}`)
  const channelId = await getChannelId(handle)
  if (!channelId) { console.log('  Could not get channel ID'); continue }

  const videos = await getRssVideos(channelId)
  console.log(`  ${videos.length} videos in RSS`)

  for (const video of videos) {
    const idPrefix = `yt_${video.id}_`
    if (ingested.has(idPrefix)) { skipped++; continue }

    process.stdout.write(`  [new] ${video.title.slice(0, 60)}... `)

    try {
      // Download subtitles via yt-dlp
      const dl = spawnSync('yt-dlp', [
        '--write-subs', '--write-auto-subs',
        '--sub-lang', 'en,en-US',
        '--sub-format', 'vtt',
        '--skip-download',
        '--output', join(tmpDir, `${video.id}.%(ext)s`),
        `https://www.youtube.com/watch?v=${video.id}`,
      ], { encoding: 'utf8', timeout: 30000 })

      const vttFile = [`${video.id}.en.vtt`, `${video.id}.en-US.vtt`]
        .map(f => join(tmpDir, f)).find(existsSync)

      let transcript = ''
      if (vttFile) {
        transcript = parseVtt(readFileSync(vttFile, 'utf8'))
        rmSync(vttFile, { force: true })
      }

      const fullText = [video.title, transcript].filter(Boolean).join('\n\n')
      if (fullText.length < 50) { console.log('skipped (no text)'); skipped++; continue }

      const chunks = chunkText(fullText)
      const embeddings = await embedBatch(chunks)
      const chunkCount = await upsertToPinecone(chunks, embeddings, {
        source_title: video.title,
        source_type: 'youtube',
        source_url: `https://youtube.com/watch?v=${video.id}`,
        channel: handle,
      }, idPrefix)

      await supabase.from('kb_sources').insert({
        id_prefix: idPrefix,
        source_title: video.title,
        source_type: 'youtube',
        source_url: `https://youtube.com/watch?v=${video.id}`,
        chunk_count: chunkCount,
        published_at: video.published ? new Date(video.published).toISOString() : null,
        thumbnail_url: video.thumb || null,
      })

      added++
      console.log(`✓ (${chunkCount} chunks)`)
    } catch (err) {
      errors++
      console.log(`✗ ${err.message?.slice(0, 60)}`)
    }
  }
}

rmSync(tmpDir, { recursive: true, force: true })
console.log(`\nDone. Added: ${added} | Skipped: ${skipped} | Errors: ${errors}`)
