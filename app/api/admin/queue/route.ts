import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { logError } from '@/lib/log-error'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// Semantic clustering threshold — cosine similarity. Matches /find-similar.
// 0.82 is tight enough to catch "How do I stop freezing up?" vs "What
// happens when I freeze up in a game?" without collapsing unrelated items.
const DUPE_THRESHOLD = 0.82

type Question = Record<string, unknown> & {
  id: string
  question: string
  email: string | null
  created_at: string
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

async function embedBatch(texts: string[]): Promise<number[][] | null> {
  if (!process.env.VOYAGE_API_KEY) return null
  try {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: texts, model: 'voyage-3-lite' }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.data.map((d: { embedding: number[] }) => d.embedding)
  } catch {
    return null
  }
}

/**
 * Greedy single-link clustering: walk the list oldest-first, place each
 * question into the first existing cluster it's >= threshold similar to,
 * else start a new cluster. Oldest question becomes the representative —
 * matches the FIFO-triage ordering already used for the pending tab.
 *
 * Returns an array of representative rows, each augmented with a `dupes`
 * array of the lighter-weight shape the grid card + detail view need.
 */
function clusterQuestions(items: Question[], embeddings: number[][]): Question[] {
  type Cluster = { rep: Question; repVec: number[]; dupes: Question[] }
  const clusters: Cluster[] = []

  for (let i = 0; i < items.length; i++) {
    const q = items[i]
    const vec = embeddings[i]
    let matched: Cluster | null = null
    for (const c of clusters) {
      if (cosine(vec, c.repVec) >= DUPE_THRESHOLD) { matched = c; break }
    }
    if (matched) {
      matched.dupes.push(q)
    } else {
      clusters.push({ rep: q, repVec: vec, dupes: [] })
    }
  }

  return clusters.map((c) => ({
    ...c.rep,
    dupes: c.dupes.map((d) => ({
      id: d.id,
      question: d.question,
      email: d.email,
      created_at: d.created_at,
    })),
  }))
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin()

  if (unauthorized) return unauthorized

  const status = req.nextUrl.searchParams.get('status') || 'pending'
  const supabase = getSupabase()

  const ppStatus = status === 'answered' ? ['answered'] : [status]
  const pqStatus = status === 'answered' ? ['approved', 'answered'] : [status]
  const orderAsc = status === 'pending'

  const [ppRes, pqRes] = await Promise.all([
    supabase.from('pain_points').select('*').in('status', ppStatus).order('created_at', { ascending: orderAsc }).limit(100),
    supabase.from('questions').select('*').in('status', pqStatus).order(status === 'answered' ? 'approved_at' : 'created_at', { ascending: false }).limit(100),
  ])

  let questions = (pqRes.data || []) as Question[]

  // Dedupe pending questions by semantic similarity. Only pending — answered
  // and skipped stay flat because they're historical records, not triage
  // queues. Fail-soft: on any embedding error, return the flat list so the
  // admin queue never goes down because an embed call hiccupped.
  if (status === 'pending' && questions.length > 1) {
    try {
      const embeddings = await embedBatch(questions.map((q) => q.question))
      if (embeddings && embeddings.length === questions.length) {
        questions = clusterQuestions(questions, embeddings)
      }
    } catch (e) {
      await logError('admin:queue:cluster', e, { count: questions.length })
    }
  }

  return NextResponse.json({
    painPoints: ppRes.data || [],
    questions,
  })
}
