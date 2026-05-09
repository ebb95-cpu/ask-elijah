/**
 * Patches thumbnail_url on existing TikTok kb_sources rows.
 * Uses yt-dlp --flat-playlist to get thumbnail URLs for all videos,
 * then updates any row that is missing a thumbnail.
 *
 * Run: node scripts/patch-tiktok-thumbnails.mjs
 */

import { spawnSync } from 'child_process'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.production.local')
const envLines = readFileSync(envPath, 'utf8').split('\n')
for (const line of envLines) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/)
  if (m) process.env[m[1]] = m[2].trim()
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('Fetching TikTok video list from yt-dlp...')
const result = spawnSync(
  'yt-dlp',
  ['--flat-playlist', '--dump-json', 'https://www.tiktok.com/@elijah.bryant3'],
  { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
)

const videos = result.stdout.trim().split('\n').filter(Boolean).map(line => {
  try { return JSON.parse(line) } catch { return null }
}).filter(Boolean)

console.log(`Got ${videos.length} videos. Building thumbnail map...`)

// Build id → thumbnail map
const thumbMap = {}
for (const v of videos) {
  const thumbs = v.thumbnails || []
  const url = (thumbs.find(t => t.preference === -1) || thumbs[0])?.url || null
  if (url) thumbMap[v.id] = url
}

// Fetch all TikTok rows missing thumbnails
const { data: rows } = await supabase
  .from('kb_sources')
  .select('id, id_prefix')
  .eq('source_type', 'tiktok')
  .is('thumbnail_url', null)

console.log(`${rows?.length || 0} rows missing thumbnails. Patching...`)

let patched = 0
for (const row of rows || []) {
  const videoId = row.id_prefix?.replace('tk_', '')
  const url = thumbMap[videoId]
  if (!url) continue

  await supabase.from('kb_sources').update({ thumbnail_url: url }).eq('id', row.id)
  patched++
  if (patched % 50 === 0) process.stdout.write(`  ${patched}/${rows.length}\n`)
}

console.log(`Done. Patched ${patched} thumbnails.`)
