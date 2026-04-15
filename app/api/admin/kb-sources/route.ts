import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('kb_sources')
    .select('id, source_title, source_type, source_url, topic, level, chunk_count, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

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
