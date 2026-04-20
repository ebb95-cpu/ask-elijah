import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY!
const BEEHIIV_PUB_ID =
  process.env.BEEHIIV_PUBLICATION_ID || 'pub_9471ed24-57d1-43c6-be5b-ee779941c348'

/**
 * Backfill the published_at column for existing kb_sources rows.
 *
 * Newsletters: refetch from Beehiiv by post id (which we have as id_prefix).
 * YouTube: scrape the public watch page for its <meta itemprop="datePublished">
 *   or "uploadDate" JSON-LD — works for any video, not just the 15 most
 *   recent from the RSS feed, and doesn't require a YouTube API key.
 *
 * Time-budgeted at 270s with a cursor so bigger KBs can resume.
 */
export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()

  if (unauthorized) return unauthorized

  const startedAt = Date.now()
  const BUDGET_MS = 270000
  const after = req.nextUrl.searchParams.get('after')

  const supabase = getSupabase()
  let query = supabase
    .from('kb_sources')
    .select('id, source_type, source_url, id_prefix, created_at')
    .is('published_at', null)
    .order('created_at', { ascending: true })
    .limit(500)
  if (after) query = query.gt('created_at', after)
  const { data: rows, error } = await query

  if (error) return NextResponse.json({ error: 'fetch failed' }, { status: 500 })
  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, partial: false, updated: 0, failed: 0, total: 0 })
  }

  let updated = 0
  let failed = 0
  let lastCreatedAt: string | null = null

  for (const row of rows) {
    if (Date.now() - startedAt > BUDGET_MS) {
      return NextResponse.json({
        ok: true,
        partial: true,
        updated,
        failed,
        total: rows.length,
        nextAfter: lastCreatedAt,
      })
    }

    let publishedIso: string | null = null
    try {
      if (row.source_type === 'newsletter') {
        publishedIso = await newsletterPublishedAt(row.id_prefix)
      } else if (row.source_type === 'youtube') {
        publishedIso = await youtubePublishedAt(row.source_url, row.id_prefix)
      }
    } catch {
      publishedIso = null
    }

    if (publishedIso) {
      const { error: upErr } = await supabase
        .from('kb_sources')
        .update({ published_at: publishedIso })
        .eq('id', row.id)
      if (upErr) failed++
      else updated++
    } else {
      failed++
    }

    lastCreatedAt = row.created_at
  }

  return NextResponse.json({
    ok: true,
    partial: false,
    updated,
    failed,
    total: rows.length,
  })
}

async function newsletterPublishedAt(idPrefix: string | null): Promise<string | null> {
  if (!idPrefix) return null
  const match = idPrefix.match(/^nl_([^_]+)_/)
  if (!match) return null
  const postId = match[1]
  const res = await fetch(
    `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/posts/${postId}`,
    { headers: { Authorization: `Bearer ${BEEHIIV_API_KEY}` } },
  )
  if (!res.ok) return null
  const json = (await res.json()) as { data?: { publish_date?: number | string } }
  const pd = json.data?.publish_date
  if (pd === null || pd === undefined) return null
  if (typeof pd === 'number') {
    const ms = pd > 1e12 ? pd : pd * 1000
    return new Date(ms).toISOString()
  }
  const d = new Date(pd)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

async function youtubePublishedAt(sourceUrl: string | null, idPrefix: string | null): Promise<string | null> {
  const videoId = extractVideoId(sourceUrl, idPrefix)
  if (!videoId) return null
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      signal: controller.signal,
      headers: {
        // YouTube serves a lighter page to a non-bot UA; the upload date is
        // still present in the JSON-LD either way.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const html = await res.text()
    // Try JSON-LD first — most reliable.
    const ldMatch = html.match(/"uploadDate":"([^"]+)"/)
    if (ldMatch) {
      const d = new Date(ldMatch[1])
      if (!Number.isNaN(d.getTime())) return d.toISOString()
    }
    // Fallback: itemprop meta tag
    const metaMatch = html.match(/<meta itemprop="datePublished" content="([^"]+)"/)
    if (metaMatch) {
      const d = new Date(metaMatch[1])
      if (!Number.isNaN(d.getTime())) return d.toISOString()
    }
    return null
  } catch {
    return null
  }
}

function extractVideoId(url: string | null, idPrefix: string | null): string | null {
  if (url) {
    const patterns = [
      /[?&]v=([^&]{11})/,
      /youtu\.be\/([^?&/]{11})/,
      /youtube\.com\/(?:embed|shorts|v)\/([^?&/]{11})/,
    ]
    for (const re of patterns) {
      const m = url.match(re)
      if (m) return m[1]
    }
  }
  if (idPrefix) {
    const m = idPrefix.match(/^yt_([A-Za-z0-9_-]{11})_?$/)
    if (m) return m[1]
  }
  return null
}
