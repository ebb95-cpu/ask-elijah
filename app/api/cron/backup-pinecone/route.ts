import { NextRequest, NextResponse } from 'next/server'
import { verifyBearer } from '@/lib/admin-auth'
import { logError } from '@/lib/log-error'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Nightly full-index backup of Pinecone vectors to Supabase Storage.
 * Replaces the old behavior of running on every answer approval.
 *
 * Trigger via Vercel Cron (see vercel.json) with the CRON_SECRET bearer token.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!verifyBearer(auth, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pineconeHost = process.env.PINECONE_HOST!
  const pineconeKey = process.env.PINECONE_API_KEY!
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  try {
    // List all vector IDs with pagination
    const allIds: string[] = []
    let paginationToken: string | undefined

    do {
      const url = new URL(`${pineconeHost}/vectors/list`)
      if (paginationToken) url.searchParams.set('paginationToken', paginationToken)

      const res = await fetch(url.toString(), {
        headers: { 'Api-Key': pineconeKey },
      })
      if (!res.ok) throw new Error(`Pinecone list failed: ${res.status}`)
      const data = await res.json()

      const ids: string[] = (data.vectors || []).map((v: { id: string }) => v.id)
      allIds.push(...ids)
      paginationToken = data.pagination?.next
    } while (paginationToken)

    // Fetch vectors in batches of 100
    const allVectors: unknown[] = []
    for (let i = 0; i < allIds.length; i += 100) {
      const batch = allIds.slice(i, i + 100)
      const params = batch.map((id) => `ids=${encodeURIComponent(id)}`).join('&')
      const res = await fetch(`${pineconeHost}/vectors/fetch?${params}`, {
        headers: { 'Api-Key': pineconeKey },
      })
      if (!res.ok) throw new Error(`Pinecone fetch failed: ${res.status}`)
      const data = await res.json()
      allVectors.push(...Object.values(data.vectors || {}))
    }

    // Upload to Supabase Storage as latest.json
    const body = JSON.stringify({
      backedUpAt: new Date().toISOString(),
      vectorCount: allVectors.length,
      vectors: allVectors,
    })
    const uploadRes = await fetch(
      `${supabaseUrl}/storage/v1/object/pinecone-backups/latest.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'x-upsert': 'true',
        },
        body,
      }
    )
    if (!uploadRes.ok) {
      const text = await uploadRes.text()
      throw new Error(`Supabase upload failed: ${uploadRes.status} ${text}`)
    }

    // Also write a dated copy so we have history
    const dated = `pinecone-backups/backup-${new Date().toISOString().slice(0, 10)}.json`
    await fetch(`${supabaseUrl}/storage/v1/object/${dated}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'x-upsert': 'true',
      },
      body,
    })

    return NextResponse.json({ success: true, vectorCount: allVectors.length })
  } catch (err) {
    await logError('cron:backup-pinecone', err)
    return NextResponse.json({ error: 'Backup failed' }, { status: 500 })
  }
}
