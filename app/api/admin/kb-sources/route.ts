import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

interface KbRow {
  id: string
  source_title: string
  source_type: string
  source_url: string | null
  topic: string | null
  level: string | null
  chunk_count: number
  created_at: string
  thumbnail_url: string | null
  id_prefix: string | null
  published_at: string | null
}

export async function GET(_req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const supabase = getSupabase()

  // Fetch all rows in pages of 1000 (Supabase hard max per request)
  const allRows: KbRow[] = []
  let from = 0
  const PAGE = 1000
  while (true) {
    const { data: page, error: pageError } = await supabase
      .from('kb_sources')
      .select('id, source_title, source_type, source_url, topic, level, chunk_count, created_at, thumbnail_url, id_prefix, published_at')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (pageError) return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })
    if (!page || page.length === 0) break
    allRows.push(...(page as KbRow[]))
    if (page.length < PAGE) break
    from += PAGE
  }

  // Roll up totals by type
  const totals: Record<string, { sources: number; chunks: number }> = {}
  let totalChunks = 0
  for (const r of allRows) {
    const t = r.source_type
    totals[t] = totals[t] || { sources: 0, chunks: 0 }
    totals[t].sources += 1
    totals[t].chunks += r.chunk_count || 0
    totalChunks += r.chunk_count || 0
  }

  return NextResponse.json({
    sources: allRows,
    totals,
    totalSources: allRows.length,
    totalChunks,
  })
}
