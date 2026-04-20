import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Fetch the og:image from a source_url and cache it in kb_sources.thumbnail_url.
 * Used for newsletters and other non-YouTube sources where we can't derive
 * the thumbnail from the URL pattern alone.
 */
export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()

  if (unauthorized) return unauthorized

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = getSupabase()
  const { data: source, error } = await supabase
    .from('kb_sources')
    .select('id, source_url')
    .eq('id', id)
    .single()

  if (error || !source?.source_url) {
    return NextResponse.json({ error: 'No source URL to fetch' }, { status: 404 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(source.source_url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (AskElijahBot/1.0)' },
    })
    clearTimeout(timeout)
    if (!res.ok) {
      return NextResponse.json({ error: `Fetch failed: ${res.status}` }, { status: 500 })
    }
    const html = await res.text()
    const thumbnail = extractOgImage(html)

    if (!thumbnail) {
      return NextResponse.json({ error: 'No og:image found' }, { status: 404 })
    }

    await supabase.from('kb_sources').update({ thumbnail_url: thumbnail }).eq('id', id)
    return NextResponse.json({ ok: true, thumbnail_url: thumbnail })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Fetch error' },
      { status: 500 },
    )
  }
}

function extractOgImage(html: string): string | null {
  // og:image or twitter:image, content attribute in either order
  const patterns = [
    /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i,
    /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+name=["']twitter:image["']/i,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m) return m[1]
  }
  return null
}
