import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const unauthorized = await requireAdmin()

  if (unauthorized) return unauthorized

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('kb_sources')
    .select('id, source_title, source_type, source_url, topic, level, chunk_count, created_at, thumbnail_url, id_prefix, published_at')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: 'Fetch failed' }, { status: 500 })

  // Roll up totals by type so the admin can see the KB composition at a glance
  const rows = data || []
  const totals: Record<string, { sources: number; chunks: number }> = {}
  let totalChunks = 0
  for (const r of rows) {
    const t = r.source_type
    totals[t] = totals[t] || { sources: 0, chunks: 0 }
    totals[t].sources += 1
    totals[t].chunks += r.chunk_count || 0
    totalChunks += r.chunk_count || 0
  }

  return NextResponse.json({
    sources: rows,
    totals,
    totalSources: rows.length,
    totalChunks,
  })
}
