import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase-server'
import { logError } from '@/lib/log-error'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * One-time (or occasional) backfill of kb_sources from existing Pinecone
 * vectors. Scans the whole index, groups vectors by the prefix convention
 * used by the ingest-knowledge cron (nl_*, yt_*, gdrive_*, lead-magnet_*),
 * and writes one kb_sources row per unique prefix with chunk_count.
 *
 * Safe to re-run: uses id_prefix as a dedupe key and updates chunk_count
 * on re-runs rather than duplicating.
 */
export async function POST(_req: NextRequest) {
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pineconeHost = process.env.PINECONE_HOST!
  const pineconeKey = process.env.PINECONE_API_KEY!

  try {
    // 1. List all vector IDs (paginated)
    const allIds: string[] = []
    let paginationToken: string | undefined
    do {
      const url = new URL(`${pineconeHost}/vectors/list`)
      if (paginationToken) url.searchParams.set('paginationToken', paginationToken)
      const res = await fetch(url.toString(), { headers: { 'Api-Key': pineconeKey } })
      if (!res.ok) throw new Error(`Pinecone list failed: ${res.status}`)
      const data = await res.json()
      const ids: string[] = (data.vectors || []).map((v: { id: string }) => v.id)
      allIds.push(...ids)
      paginationToken = data.pagination?.next
    } while (paginationToken)

    // 2. Group by prefix. We use the id convention the cron uses:
    //    nl_<issueId>_<chunkIdx>
    //    yt_<videoId>_<chunkIdx>
    //    gdrive_<fileId>_<chunkIdx>
    //    lead-magnet_<productId>_chunk_<chunkIdx>
    //    upload_<ts>_<rand>_<chunkIdx>  (uploads — already in kb_sources)
    //    approved_<questionId>           (approved answers — not a "source")
    const prefixCounts = new Map<string, { count: number; type: string | null; sampleId: string }>()

    for (const id of allIds) {
      // Skip approved answers and one-off uploads (already tracked)
      if (id.startsWith('approved_')) continue

      let prefix: string | null = null
      let type: string | null = null

      if (id.startsWith('nl_')) {
        // nl_<issueId>_<n>
        const m = id.match(/^(nl_[^_]+_)\d+$/)
        if (m) { prefix = m[1]; type = 'newsletter' }
      } else if (id.startsWith('yt_')) {
        const m = id.match(/^(yt_[^_]+_)\d+$/)
        if (m) { prefix = m[1]; type = 'youtube' }
      } else if (id.startsWith('gdrive_')) {
        const m = id.match(/^(gdrive_[^_]+_)\d+$/)
        if (m) { prefix = m[1]; type = 'drive_pdf' }
      } else if (id.startsWith('lead-magnet_')) {
        const m = id.match(/^(lead-magnet_[^_]+_)chunk_\d+$/)
        if (m) { prefix = m[1]; type = 'lead-magnet' }
      } else if (id.startsWith('upload_')) {
        // Already tracked by the upload endpoint
        continue
      } else {
        continue
      }

      if (!prefix || !type) continue
      const existing = prefixCounts.get(prefix)
      if (existing) existing.count += 1
      else prefixCounts.set(prefix, { count: 1, type, sampleId: id })
    }

    // 3. For each unique prefix, fetch one vector to get metadata (title/url)
    const supabase = getSupabase()
    const BATCH = 100
    const prefixEntries = Array.from(prefixCounts.entries())
    const results: { prefix: string; action: 'inserted' | 'updated' | 'skipped'; reason?: string }[] = []

    for (let i = 0; i < prefixEntries.length; i += BATCH) {
      const batch = prefixEntries.slice(i, i + BATCH)
      const idsToFetch = batch.map(([, v]) => v.sampleId)
      const params = idsToFetch.map((id) => `ids=${encodeURIComponent(id)}`).join('&')
      const fetchRes = await fetch(`${pineconeHost}/vectors/fetch?${params}`, {
        headers: { 'Api-Key': pineconeKey },
      })
      if (!fetchRes.ok) throw new Error(`Pinecone fetch failed: ${fetchRes.status}`)
      const fetchData = await fetchRes.json()
      const vectorMap = fetchData.vectors || {}

      for (const [prefix, info] of batch) {
        const vec = vectorMap[info.sampleId]
        const meta = vec?.metadata || {}
        const title = meta.source_title || prefix
        const url = meta.source_url || null

        // Check if already in kb_sources
        const { data: existing } = await supabase
          .from('kb_sources')
          .select('id')
          .eq('id_prefix', prefix)
          .maybeSingle()

        if (existing) {
          await supabase
            .from('kb_sources')
            .update({ chunk_count: info.count, source_title: title, source_url: url })
            .eq('id', existing.id)
          results.push({ prefix, action: 'updated' })
        } else {
          const { error: insertErr } = await supabase.from('kb_sources').insert({
            source_title: title,
            source_type: info.type,
            source_url: url,
            chunk_count: info.count,
            id_prefix: prefix,
          })
          if (insertErr) {
            results.push({ prefix, action: 'skipped', reason: insertErr.message })
          } else {
            results.push({ prefix, action: 'inserted' })
          }
        }
      }
    }

    return NextResponse.json({
      totalVectors: allIds.length,
      uniquePrefixes: prefixCounts.size,
      inserted: results.filter((r) => r.action === 'inserted').length,
      updated: results.filter((r) => r.action === 'updated').length,
      skipped: results.filter((r) => r.action === 'skipped').length,
    })
  } catch (err) {
    await logError('admin:kb-backfill', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Backfill failed' },
      { status: 500 }
    )
  }
}
