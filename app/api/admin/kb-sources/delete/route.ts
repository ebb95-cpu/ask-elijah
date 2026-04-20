import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Delete a kb_sources row AND all its Pinecone vectors.
 *
 * Order matters: Pinecone first, then the Supabase row. If we deleted the
 * Supabase row first and the Pinecone call failed, a subsequent Backfill
 * would resurrect the row since Pinecone still holds the vectors.
 *
 * Pinecone has no "delete by metadata kb_source_id" because vectors weren't
 * written with that field. Instead we use the id_prefix — all vectors for
 * a source share the prefix (e.g. `upload_1738_abc_0`, `upload_1738_abc_1`).
 * The /vectors/list endpoint supports prefix filtering; we paginate to get
 * every matching id, then batch-delete in chunks of 1000 (Pinecone's limit).
 */
export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()

  if (unauthorized) return unauthorized

  const { id } = await req.json()
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const supabase = getSupabase()
  const { data: source, error: fetchErr } = await supabase
    .from('kb_sources')
    .select('id, id_prefix, source_title')
    .eq('id', id)
    .single()

  if (fetchErr || !source) {
    return NextResponse.json({ error: 'Source not found' }, { status: 404 })
  }

  const pineconeHost = process.env.PINECONE_HOST
  const pineconeKey = process.env.PINECONE_API_KEY
  let vectorsDeleted = 0

  if (source.id_prefix && pineconeHost && pineconeKey) {
    try {
      const ids: string[] = []
      let paginationToken: string | undefined
      do {
        const url = new URL(`${pineconeHost}/vectors/list`)
        url.searchParams.set('prefix', source.id_prefix)
        url.searchParams.set('limit', '100')
        if (paginationToken) url.searchParams.set('paginationToken', paginationToken)
        const res = await fetch(url.toString(), { headers: { 'Api-Key': pineconeKey } })
        if (!res.ok) throw new Error(`Pinecone list failed: ${res.status}`)
        const data = await res.json()
        const pageIds: string[] = (data.vectors || []).map((v: { id: string }) => v.id)
        ids.push(...pageIds)
        paginationToken = data.pagination?.next
      } while (paginationToken)

      for (let i = 0; i < ids.length; i += 1000) {
        const batch = ids.slice(i, i + 1000)
        const res = await fetch(`${pineconeHost}/vectors/delete`, {
          method: 'POST',
          headers: { 'Api-Key': pineconeKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: batch }),
        })
        if (!res.ok) {
          const body = await res.text()
          throw new Error(`Pinecone delete failed: ${res.status} ${body}`)
        }
        vectorsDeleted += batch.length
      }
    } catch (err) {
      return NextResponse.json(
        {
          error: `Pinecone delete failed — kb_sources row NOT removed. ${err instanceof Error ? err.message : 'unknown'}`,
        },
        { status: 500 },
      )
    }
  }

  const { error: delErr } = await supabase.from('kb_sources').delete().eq('id', id)
  if (delErr) {
    return NextResponse.json(
      { error: `Deleted ${vectorsDeleted} vectors from Pinecone but failed to remove kb_sources row.` },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    vectorsDeleted,
    title: source.source_title,
  })
}
