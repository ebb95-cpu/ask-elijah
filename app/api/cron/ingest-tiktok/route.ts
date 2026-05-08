/**
 * Daily TikTok ingestion cron.
 *
 * Flow:
 *  1. Apify scrapes the configured TikTok account for videos posted in the
 *     last 48 hours (overlap window avoids missing videos near the daily boundary).
 *  2. Each video is checked against kb_sources — already-ingested IDs are skipped.
 *  3. The direct video URL is sent to AssemblyAI for transcription (no download needed).
 *  4. Transcript is chunked, embedded via Voyage AI, and upserted to Pinecone.
 *  5. A row is written to kb_sources so future runs skip the video.
 *
 * Required env vars:
 *   APIFY_API_TOKEN       — Apify API token
 *   TIKTOK_USERNAME       — TikTok handle to scrape (without @)
 *   ASSEMBLYAI_API_KEY    — For audio transcription
 *   VOYAGE_API_KEY        — For embeddings
 *   PINECONE_HOST         — e.g. https://your-index.svc.pinecone.io
 *   PINECONE_API_KEY      — Pinecone API key
 *   CRON_SECRET           — Bearer token auth
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — via getSupabase()
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyBearer } from '@/lib/admin-auth'
import { getSupabase } from '@/lib/supabase-server'
import { chunkText, embedBatch, upsertToPinecone, transcribeAudioUrl } from '@/lib/ingest'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApifyTikTokVideo {
  id: string
  desc: string           // caption / description
  createTime: number     // unix timestamp
  webVideoUrl: string    // public video page URL
  videoUrl?: string      // direct download URL (no watermark)
  author?: { uniqueId?: string }
  stats?: { playCount?: number; diggCount?: number; commentCount?: number }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run an Apify TikTok Profile Scraper actor synchronously and return results.
 * Actor: apify/tiktok-profile-scraper
 * Docs: https://apify.com/apify/tiktok-profile-scraper
 */
async function fetchTikTokVideos(username: string, maxVideos = 20): Promise<ApifyTikTokVideo[]> {
  const token = process.env.APIFY_API_TOKEN
  if (!token) throw new Error('APIFY_API_TOKEN is not set')

  // Start the actor run synchronously (waits up to 120s for results)
  const res = await fetch(
    `https://api.apify.com/v2/acts/clockworks~free-tiktok-scraper/run-sync-get-dataset-items?token=${token}&timeout=120&memory=1024`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profiles: [`https://www.tiktok.com/@${username}`],
        resultsPerPage: maxVideos,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
        shouldDownloadSubtitles: true,
      }),
    }
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Apify run failed: ${res.status} ${text}`)
  }

  const items = await res.json()
  return Array.isArray(items) ? (items as ApifyTikTokVideo[]) : []
}


/**
 * Check which video IDs have already been ingested (exist in kb_sources).
 */
async function getAlreadyIngestedIds(videoIds: string[]): Promise<Set<string>> {
  if (videoIds.length === 0) return new Set()
  const supabase = getSupabase()
  const idPrefixes = videoIds.map((id) => `tk_${id}`)

  const { data } = await supabase
    .from('kb_sources')
    .select('id_prefix')
    .in('id_prefix', idPrefixes)

  return new Set((data || []).map((r: { id_prefix: string }) => r.id_prefix))
}

/**
 * Record a successfully ingested TikTok in kb_sources.
 */
async function recordKbSource(params: {
  videoId: string
  title: string
  url: string
  chunkCount: number
  publishedAt: string
}) {
  const supabase = getSupabase()
  await supabase.from('kb_sources').insert({
    id_prefix: `tk_${params.videoId}`,
    source_title: params.title,
    source_type: 'tiktok',
    source_url: params.url,
    chunk_count: params.chunkCount,
    published_at: params.publishedAt,
  })
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!verifyBearer(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const username = process.env.TIKTOK_USERNAME
  if (!username) {
    return NextResponse.json({ error: 'TIKTOK_USERNAME is not set' }, { status: 500 })
  }

  const results: { id: string; status: 'ingested' | 'skipped' | 'error'; reason?: string }[] = []
  let totalChunks = 0

  try {
    // 1. Fetch recent videos from TikTok via Apify
    const videos = await fetchTikTokVideos(username, 30)

    // 2. Filter to last 48 hours
    const cutoff = Date.now() - 48 * 60 * 60 * 1000
    const recentVideos = videos.filter((v) => v.createTime * 1000 >= cutoff)

    if (recentVideos.length === 0) {
      return NextResponse.json({ ok: true, message: 'No new TikToks in the last 48 hours', ingested: 0 })
    }

    // 3. Skip already-ingested videos
    const alreadyIngested = await getAlreadyIngestedIds(recentVideos.map((v) => v.id))
    const toIngest = recentVideos.filter((v) => !alreadyIngested.has(`tk_${v.id}`))

    if (toIngest.length === 0) {
      return NextResponse.json({ ok: true, message: 'All recent TikToks already ingested', ingested: 0 })
    }

    // 4. Process each video
    for (const video of toIngest) {
      try {
        const videoUrl = video.videoUrl
        if (!videoUrl) {
          results.push({ id: video.id, status: 'skipped', reason: 'No direct download URL from Apify' })
          continue
        }

        // Transcribe via AssemblyAI (accepts direct URL, no download needed)
        const transcript = await transcribeAudioUrl(videoUrl)
        if (!transcript || transcript.length < 20) {
          results.push({ id: video.id, status: 'skipped', reason: 'Transcript too short or empty' })
          continue
        }

        // Combine caption + transcript for richer context
        const caption = video.desc?.trim() || ''
        const fullText = caption ? `${caption}\n\n${transcript}` : transcript

        // Chunk
        const chunks = chunkText(fullText, { targetWords: 400, overlapWords: 60 })
        if (chunks.length === 0) {
          results.push({ id: video.id, status: 'skipped', reason: 'No chunks after text processing' })
          continue
        }

        // Embed
        const embeddings = await embedBatch(chunks)

        // Upsert to Pinecone
        const videoPageUrl = video.webVideoUrl || `https://www.tiktok.com/@${username}/video/${video.id}`
        const sourceTitle = caption
          ? `TikTok — ${caption.slice(0, 80)}${caption.length > 80 ? '...' : ''}`
          : `TikTok — @${username} (${video.id})`

        const chunkCount = await upsertToPinecone(
          chunks,
          embeddings,
          {
            source_title: sourceTitle,
            source_type: 'tiktok',
            source_url: videoPageUrl,
          },
          `tk_${video.id}`
        )

        // Record in kb_sources
        await recordKbSource({
          videoId: video.id,
          title: sourceTitle,
          url: videoPageUrl,
          chunkCount,
          publishedAt: new Date(video.createTime * 1000).toISOString(),
        })

        totalChunks += chunkCount
        results.push({ id: video.id, status: 'ingested' })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`TikTok ingest error for ${video.id}:`, message)
        results.push({ id: video.id, status: 'error', reason: message })
      }
    }

    const ingested = results.filter((r) => r.status === 'ingested').length
    const skipped = results.filter((r) => r.status === 'skipped').length
    const errors = results.filter((r) => r.status === 'error').length

    console.log(`TikTok ingest complete: ${ingested} ingested, ${skipped} skipped, ${errors} errors, ${totalChunks} total chunks`)

    return NextResponse.json({
      ok: true,
      ingested,
      skipped,
      errors,
      totalChunks,
      results,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('TikTok ingest cron failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
