import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Fix YouTube sources whose source_title is the placeholder "Video <id>"
 * that the ingest fell back to when the RSS feed didn't surface a title.
 * Pulls the real title from YouTube's public oEmbed endpoint (no auth, no
 * key) and writes it back to kb_sources.source_title.
 *
 * Does NOT touch the Pinecone vector metadata — answers cite from kb_sources
 * titles in admin views, and rewriting vectors would require re-embedding.
 */
export async function POST(_req: NextRequest) {
  const unauthorized = await requireAdmin()

  if (unauthorized) return unauthorized

  const supabase = getSupabase()
  const { data: stuck, error } = await supabase
    .from('kb_sources')
    .select('id, source_title, source_url, id_prefix')
    .eq('source_type', 'youtube')
    .like('source_title', 'Video %')

  if (error) {
    return NextResponse.json({ error: 'query failed' }, { status: 500 })
  }
  if (!stuck || stuck.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, checked: 0 })
  }

  let updated = 0
  let failed = 0
  const failures: { id: string; reason: string }[] = []

  for (const row of stuck) {
    const videoId = extractVideoId(row.source_url, row.id_prefix)
    if (!videoId) {
      failed++
      failures.push({ id: row.id, reason: 'no video id' })
      continue
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 6000)
      const res = await fetch(
        `https://www.youtube.com/oembed?url=https://youtu.be/${videoId}&format=json`,
        { signal: controller.signal },
      )
      clearTimeout(timeout)

      if (!res.ok) {
        failed++
        failures.push({ id: row.id, reason: `oembed ${res.status}` })
        continue
      }
      const data = (await res.json()) as { title?: string }
      if (!data.title) {
        failed++
        failures.push({ id: row.id, reason: 'no title returned' })
        continue
      }

      const { error: upErr } = await supabase
        .from('kb_sources')
        .update({ source_title: data.title })
        .eq('id', row.id)
      if (upErr) {
        failed++
        failures.push({ id: row.id, reason: `db update ${upErr.message}` })
      } else {
        updated++
      }
    } catch (err) {
      failed++
      failures.push({ id: row.id, reason: err instanceof Error ? err.message : 'fetch error' })
    }
  }

  return NextResponse.json({
    ok: true,
    checked: stuck.length,
    updated,
    failed,
    failures: failures.slice(0, 10),
  })
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
  // Fall back to parsing id_prefix like "yt_VIDEOID_"
  if (idPrefix) {
    const m = idPrefix.match(/^yt_([A-Za-z0-9_-]{11})_?$/)
    if (m) return m[1]
  }
  return null
}
