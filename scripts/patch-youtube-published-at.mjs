/**
 * Patches published_at on YouTube kb_sources rows using YouTube RSS feeds.
 * Falls back to yt-dlp for videos not found in RSS.
 *
 * Run: node scripts/patch-youtube-published-at.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envLines = readFileSync(join(__dirname, '..', '.env.production.local'), 'utf8').split('\n')
for (const line of envLines) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Build a map of videoId → publishedAt from a YouTube RSS feed
async function getPublishDatesFromRSS(channelId) {
  const map = {}
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`)
    if (!res.ok) return map
    const xml = await res.text()
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || []
    for (const entry of entries) {
      const idMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)
      const pubMatch = entry.match(/<published>([^<]+)<\/published>/)
      if (idMatch && pubMatch) map[idMatch[1]] = new Date(pubMatch[1]).toISOString()
    }
  } catch {}
  return map
}

// Get channelId from handle
async function getChannelId(handle) {
  try {
    const res = await fetch(`https://www.youtube.com/@${handle}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const html = await res.text()
    const m = html.match(/"channelId":"(UC[^"]+)"/) || html.match(/"browseId":"(UC[^"]+)"/)
    return m?.[1] ?? null
  } catch { return null }
}

// Use yt-dlp to get publish date for a single video
function getDateFromYtDlp(videoId) {
  const result = spawnSync('yt-dlp', [
    '--dump-json', '--skip-download',
    `https://www.youtube.com/watch?v=${videoId}`
  ], { encoding: 'utf8', timeout: 20000 })
  if (result.status !== 0) return null
  try {
    const data = JSON.parse(result.stdout)
    if (data.upload_date) {
      // upload_date is YYYYMMDD
      const d = data.upload_date
      return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}T00:00:00.000Z`
    }
  } catch {}
  return null
}

// Load all YouTube rows missing published_at
const { data: rows } = await supabase
  .from('kb_sources')
  .select('id, id_prefix')
  .eq('source_type', 'youtube')
  .is('published_at', null)

console.log(`${rows?.length || 0} rows still missing published_at`)
if (!rows?.length) { console.log('Nothing to patch.'); process.exit(0) }

// Build RSS maps for both channels
console.log('Fetching RSS feeds...')
const channels = ['ElijahBryant3', 'ConsistencyClubFilm']
const rssMap = {}
for (const handle of channels) {
  const channelId = await getChannelId(handle)
  if (channelId) {
    const dates = await getPublishDatesFromRSS(channelId)
    Object.assign(rssMap, dates)
    console.log(`  @${handle}: ${Object.keys(dates).length} dates from RSS`)
  }
}

let patched = 0
let ytdlp = 0
let failed = 0

for (const row of rows) {
  // Extract clean video ID — strip prefix and trailing underscore
  const rawId = row.id_prefix?.replace(/^(yt_|craigmanning_)/, '').replace(/_$/, '')
  if (!rawId) continue

  let publishedAt = rssMap[rawId] || null

  // RSS only has last 15 videos — fall back to yt-dlp for older ones
  if (!publishedAt) {
    publishedAt = getDateFromYtDlp(rawId)
    if (publishedAt) ytdlp++
  } else {
    patched++
  }

  if (publishedAt) {
    await supabase.from('kb_sources').update({ published_at: publishedAt }).eq('id', row.id)
    console.log(`  ${rawId} → ${publishedAt.slice(0,10)}`)
  } else {
    failed++
    console.log(`  ${rawId} — failed`)
  }
}

console.log(`\nDone. RSS: ${patched} | yt-dlp: ${ytdlp} | failed: ${failed}`)
