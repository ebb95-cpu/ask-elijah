import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const FALLBACK = "I want to make sure I give you something real on this one. Try asking me again with a bit more detail about your situation and I'll find the right angle."

type QRow = {
  id: string
  created_at: string
  status: string | null
  topic: string | null
  mode: string | null
  level_snapshot: string | null
  asker_type: string | null
  edit_count: number | null
  topic_confidence: number | null
  answer: string | null
  question: string
  corrections: unknown
}

function bucketBy<T>(rows: T[], key: (r: T) => string | null | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    const k = key(r) || '—'
    out[k] = (out[k] || 0) + 1
  }
  return out
}

function sorted(o: Record<string, number>): { key: string; count: number }[] {
  return Object.entries(o)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
}

export async function GET(_req: NextRequest) {
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const now = Date.now()
  const d7 = new Date(now - 7 * 86400_000).toISOString()
  const d30 = new Date(now - 30 * 86400_000).toISOString()
  const d14 = new Date(now - 14 * 86400_000).toISOString()

  const { data: rows30, error } = await supabase
    .from('questions')
    .select('id, created_at, status, topic, mode, level_snapshot, asker_type, edit_count, topic_confidence, answer, question, corrections')
    .gte('created_at', d30)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (error) return NextResponse.json({ error: 'Failed to load' }, { status: 500 })

  const all: QRow[] = (rows30 || []) as QRow[]
  const last7 = all.filter((r) => r.created_at >= d7)
  const prev7 = all.filter((r) => r.created_at < d7 && r.created_at >= d14)

  // Trend: week-over-week deltas per topic and mode
  const topic7 = bucketBy(last7, (r) => r.topic)
  const topicPrev = bucketBy(prev7, (r) => r.topic)
  const trendingTopics = sorted(topic7).map((t) => ({
    ...t,
    prev: topicPrev[t.key] || 0,
    delta: t.count - (topicPrev[t.key] || 0),
  }))

  const mode7 = sorted(bucketBy(last7, (r) => r.mode))
  const level7 = sorted(bucketBy(last7, (r) => r.level_snapshot))
  const askerType7 = sorted(bucketBy(last7, (r) => r.asker_type))

  // Content-gap signals (live, not just the weekly cron)
  const gaps = last7.filter(
    (r) =>
      !r.topic ||
      (r.topic_confidence !== null && r.topic_confidence < 0.6) ||
      r.answer === FALLBACK
  )

  // Quality: average edit_count per topic (lower = AI got voice right)
  const editByTopic: Record<string, { sum: number; n: number }> = {}
  for (const r of all.filter((x) => x.status === 'approved')) {
    const k = r.topic || '—'
    editByTopic[k] = editByTopic[k] || { sum: 0, n: 0 }
    editByTopic[k].sum += r.edit_count || 0
    editByTopic[k].n += 1
  }
  const editQuality = Object.entries(editByTopic)
    .filter(([, v]) => v.n >= 2)
    .map(([key, v]) => ({ key, avgEdits: v.sum / v.n, n: v.n }))
    .sort((a, b) => b.avgEdits - a.avgEdits)

  // Corrections: approved answers that had verify flags Elijah had to review
  const withCorrections = all.filter((r) => {
    if (!r.corrections) return false
    if (typeof r.corrections !== 'object') return false
    return Array.isArray((r.corrections as { flagged?: unknown[] }).flagged)
  }).length

  return NextResponse.json({
    windows: { last7: last7.length, prev7: prev7.length, last30: all.length },
    trendingTopics,
    mode7,
    level7,
    askerType7,
    gaps: {
      count: gaps.length,
      sample: gaps.slice(0, 10).map((g) => ({
        id: g.id,
        question: g.question,
        topic: g.topic,
        topic_confidence: g.topic_confidence,
        mode: g.mode,
      })),
    },
    editQuality,
    corrections: { count: withCorrections },
  })
}
