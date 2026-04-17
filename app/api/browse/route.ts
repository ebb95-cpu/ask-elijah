import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SB_URL = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY!

async function sbFetch(path: string) {
  const res = await fetch(`${SB_URL()}${path}`, {
    headers: {
      apikey: SB_KEY(),
      Authorization: `Bearer ${SB_KEY()}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return res.json()
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email') || ''

  // Fetch approved questions via direct REST
  const questions: { id: string; question: string; answer: string; topic: string | null; created_at: string; reviewed_by_elijah: boolean | null }[] | null = await sbFetch(
    '/rest/v1/questions?status=eq.approved&deleted_at=is.null&select=id,question,answer,topic,created_at,reviewed_by_elijah&order=created_at.desc&limit=100'
  )

  if (!questions?.length) return NextResponse.json({ questions: [] })

  // Get upvote counts via direct REST
  const ids = questions.map(q => q.id)
  const upvoteFilter = ids.map(id => `question_id.eq.${id}`).join(',')
  const upvotes: { question_id: string; email: string }[] | null = await sbFetch(
    `/rest/v1/upvotes?select=question_id,email&or=(${upvoteFilter})`
  )

  const countMap: Record<string, number> = {}
  const userSet = new Set<string>()
  for (const uv of upvotes || []) {
    countMap[uv.question_id] = (countMap[uv.question_id] || 0) + 1
    if (email && uv.email === email.toLowerCase()) userSet.add(uv.question_id)
  }

  // Deduplicate by question text — keep the one with more upvotes
  const seenQuestions = new Map<string, typeof questions[number]>()
  for (const q of questions) {
    const key = q.question.toLowerCase().trim()
    const existing = seenQuestions.get(key)
    if (!existing || (countMap[q.id] || 0) > (countMap[existing.id] || 0)) {
      seenQuestions.set(key, q)
    }
  }
  const deduped = Array.from(seenQuestions.values())

  // Everything is free — no truncation. Full answers for all.
  const result = deduped.map(q => ({
    id: q.id,
    question: q.question,
    answer: q.answer,
    topic: q.topic,
    created_at: q.created_at,
    upvote_count: countMap[q.id] || 0,
    user_upvoted: userSet.has(q.id),
    reviewed_by_elijah: q.reviewed_by_elijah === true,
  })).sort((a, b) => b.upvote_count - a.upvote_count)

  return NextResponse.json({ questions: result })
}
