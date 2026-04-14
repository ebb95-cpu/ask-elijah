import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const TEASER_CHARS = 160

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
  const supabase = getSupabase()

  // Check if user is subscribed
  let subscribed = false
  if (email) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscribed')
      .eq('email', email.toLowerCase())
      .single()
    subscribed = profile?.subscribed === true
  }

  // Fetch approved questions via direct REST (supabase-js has a known issue with this query)
  const questions: { id: string; question: string; answer: string }[] | null = await sbFetch(
    '/rest/v1/questions?status=eq.approved&select=id,question,answer&order=created_at.desc&limit=50'
  )

  if (!questions?.length) return NextResponse.json({ questions: [], subscribed })

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
  const seenQuestions = new Map<string, { id: string; question: string; answer: string }>()
  for (const q of questions) {
    const key = q.question.toLowerCase().trim()
    const existing = seenQuestions.get(key)
    if (!existing || (countMap[q.id] || 0) > (countMap[existing.id] || 0)) {
      seenQuestions.set(key, q)
    }
  }
  const deduped = Array.from(seenQuestions.values())

  const result = deduped.map(q => ({
    id: q.id,
    question: q.question,
    answer: subscribed ? q.answer : (q.answer || '').slice(0, TEASER_CHARS),
    truncated: !subscribed && (q.answer || '').length > TEASER_CHARS,
    upvote_count: countMap[q.id] || 0,
    user_upvoted: userSet.has(q.id),
  })).sort((a, b) => b.upvote_count - a.upvote_count)

  return NextResponse.json({ questions: result, subscribed })
}
