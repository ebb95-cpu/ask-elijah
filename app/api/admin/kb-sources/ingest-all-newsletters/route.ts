import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const PINECONE_HOST = process.env.PINECONE_HOST!
const PINECONE_API_KEY = process.env.PINECONE_API_KEY!
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY!
const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY!
const BEEHIIV_PUB_ID =
  process.env.BEEHIIV_PUBLICATION_ID || 'pub_9471ed24-57d1-43c6-be5b-ee779941c348'

interface BeehiivPost {
  id: string
  title?: string
  web_url?: string
  publish_date?: number | string
  thumbnail_url?: string | null
  free_web_content?: string
  content?: { free?: { web?: string } }
}

/**
 * Full-history Beehiiv ingest. The daily cron only pulls the 15 most recent
 * posts; this endpoint paginates through every confirmed post, skips any
 * already in Pinecone (by checking for `nl_<id>_0`), and embeds the rest.
 *
 * Resumable via ?page=N so the admin can chain calls if the 5-minute Vercel
 * timeout hits mid-sync. Response reports which page to call next.
 */
export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startPage = Number(req.nextUrl.searchParams.get('page') || '1')
  const startedAt = Date.now()
  const BUDGET_MS = 270000 // leave 30s headroom before Vercel kills the fn

  let page = startPage
  let totalSeen = 0
  let ingested = 0
  let skipped = 0
  let errors = 0
  let hasNextPage = true

  const supabase = getSupabase()

  while (hasNextPage) {
    if (Date.now() - startedAt > BUDGET_MS) {
      return NextResponse.json({
        ok: true,
        partial: true,
        nextPage: page,
        totalSeen,
        ingested,
        skipped,
        errors,
        message: `Hit time budget mid-sync. Call again with ?page=${page}`,
      })
    }

    const url = `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/posts?status=confirmed&expand[]=free_web_content&limit=50&page=${page}&order_by=publish_date&direction=desc`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${BEEHIIV_API_KEY}` } })
    if (!res.ok) {
      return NextResponse.json(
        { error: `Beehiiv list failed at page ${page}: ${res.status}` },
        { status: 500 },
      )
    }
    const data = (await res.json()) as {
      data?: BeehiivPost[]
      total_results?: number
      page?: number
      total_pages?: number
    }
    const allPosts = data.data || []
    // status=confirmed in the Beehiiv query includes scheduled posts whose
    // publish_date is still in the future. Filter those out — only ingest
    // posts that have actually gone live.
    const nowSeconds = Math.floor(Date.now() / 1000)
    const posts = allPosts.filter((p) => {
      if (!p.publish_date) return false
      const ts =
        typeof p.publish_date === 'number'
          ? p.publish_date
          : Math.floor(new Date(p.publish_date).getTime() / 1000)
      return Number.isFinite(ts) && ts <= nowSeconds
    })
    totalSeen += posts.length

    for (const post of posts) {
      if (Date.now() - startedAt > BUDGET_MS) {
        return NextResponse.json({
          ok: true,
          partial: true,
          nextPage: page,
          totalSeen,
          ingested,
          skipped,
          errors,
          message: `Hit time budget mid-sync. Call again with ?page=${page}`,
        })
      }

      const rawHtml = post.free_web_content || post.content?.free?.web || ''
      const text = stripHtml(rawHtml)
      if (text.length < 200) {
        skipped++
        continue
      }

      const publishedAtIso = toIso(post.publish_date)

      const firstVectorId = `nl_${post.id}_0`
      if (await pineconeHas(firstVectorId)) {
        skipped++
        // Still make sure the kb_sources row exists + has a thumbnail/publish_date cached.
        await recordKbSource({
          supabase,
          source_title: post.title || 'Newsletter',
          source_type: 'newsletter',
          source_url: post.web_url || null,
          chunk_count: 0, // unchanged unless we backfill; leave 0 as "unknown" trigger
          id_prefix: `nl_${post.id}_`,
          thumbnail_url: post.thumbnail_url || null,
          published_at: publishedAtIso,
        })
        continue
      }

      try {
        const chunks = chunkText(text)
        const vectors: {
          id: string
          values: number[]
          metadata: Record<string, string | number>
        }[] = []
        for (let j = 0; j < chunks.length; j++) {
          const values = await embed(chunks[j])
          vectors.push({
            id: `nl_${post.id}_${j}`,
            values,
            metadata: {
              text: chunks[j],
              source_type: 'newsletter',
              source_title: post.title || 'Newsletter',
              source_url: post.web_url || '',
              chunk_index: j,
            },
          })
          await sleep(80)
        }
        if (vectors.length > 0) {
          for (let k = 0; k < vectors.length; k += 50) {
            await upsertVectors(vectors.slice(k, k + 50))
          }
          await recordKbSource({
            supabase,
            source_title: post.title || 'Newsletter',
            source_type: 'newsletter',
            source_url: post.web_url || null,
            chunk_count: vectors.length,
            id_prefix: `nl_${post.id}_`,
            thumbnail_url: post.thumbnail_url || null,
            published_at: publishedAtIso,
          })
          ingested++
        }
      } catch (e) {
        console.error('newsletter ingest failed', post.id, e)
        errors++
      }
    }

    // Use the unfiltered count for pagination — we don't want the publish-date
    // filter to shortcircuit page traversal and miss later pages.
    hasNextPage = data.total_pages ? page < data.total_pages : allPosts.length === 50
    page++
  }

  return NextResponse.json({
    ok: true,
    partial: false,
    totalSeen,
    ingested,
    skipped,
    errors,
  })
}

async function recordKbSource(row: {
  supabase: ReturnType<typeof getSupabase>
  source_title: string
  source_type: string
  source_url: string | null
  chunk_count: number
  id_prefix: string
  thumbnail_url: string | null
  published_at: string | null
}) {
  const { supabase, ...data } = row
  try {
    const { data: existing } = await supabase
      .from('kb_sources')
      .select('id, chunk_count')
      .eq('id_prefix', data.id_prefix)
      .maybeSingle()
    if (existing) {
      const next: Record<string, unknown> = {
        source_title: data.source_title,
        source_url: data.source_url,
      }
      // Only overwrite chunk_count if the caller actually knows it (>0).
      if (data.chunk_count > 0) next.chunk_count = data.chunk_count
      if (data.thumbnail_url) next.thumbnail_url = data.thumbnail_url
      if (data.published_at) next.published_at = data.published_at
      await supabase.from('kb_sources').update(next).eq('id', existing.id)
    } else {
      await supabase.from('kb_sources').insert({
        source_title: data.source_title,
        source_type: data.source_type,
        source_url: data.source_url,
        chunk_count: data.chunk_count,
        id_prefix: data.id_prefix,
        thumbnail_url: data.thumbnail_url,
        published_at: data.published_at,
      })
    }
  } catch (e) {
    console.error('recordKbSource failed:', e)
  }
}

function toIso(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    // Beehiiv returns unix seconds
    const ms = value > 1e12 ? value : value * 1000
    return new Date(ms).toISOString()
  }
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

async function pineconeHas(vectorId: string): Promise<boolean> {
  try {
    const res = await fetch(`${PINECONE_HOST}/vectors/fetch?ids=${encodeURIComponent(vectorId)}`, {
      headers: { 'Api-Key': PINECONE_API_KEY },
    })
    if (!res.ok) return false
    const d = await res.json()
    return Object.keys(d.vectors || {}).length > 0
  } catch {
    return false
  }
}

async function embed(text: string): Promise<number[]> {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${VOYAGE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: [text], model: 'voyage-3-lite' }),
  })
  if (!res.ok) throw new Error(`Voyage ${res.status}`)
  const d = await res.json()
  return d.data[0].embedding
}

async function upsertVectors(
  vectors: { id: string; values: number[]; metadata: Record<string, string | number> }[],
) {
  const res = await fetch(`${PINECONE_HOST}/vectors/upsert`, {
    method: 'POST',
    headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ vectors }),
  })
  if (!res.ok) throw new Error(`Pinecone ${res.status}`)
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function chunkText(text: string, size = 500, overlap = 80): string[] {
  const words = text.split(/\s+/)
  const chunks: string[] = []
  let i = 0
  while (i < words.length) {
    const chunk = words.slice(i, i + size).join(' ')
    if (chunk.length > 100) chunks.push(chunk)
    i += size - overlap
  }
  return chunks
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
