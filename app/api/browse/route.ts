import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email') || ''
  const supabase = getSupabase()

  const { data: questions } = await supabase
    .from('questions')
    .select('id, question, answer')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(50)

  if (!questions?.length) return NextResponse.json({ questions: [] })

  // Get upvote counts
  const ids = questions.map(q => q.id)
  const { data: upvotes } = await supabase
    .from('upvotes')
    .select('question_id, email')
    .in('question_id', ids)

  const countMap: Record<string, number> = {}
  const userSet = new Set<string>()
  for (const uv of upvotes || []) {
    countMap[uv.question_id] = (countMap[uv.question_id] || 0) + 1
    if (email && uv.email === email.toLowerCase()) userSet.add(uv.question_id)
  }

  const result = questions.map(q => ({
    id: q.id,
    question: q.question,
    answer: q.answer,
    upvote_count: countMap[q.id] || 0,
    user_upvoted: userSet.has(q.id),
  })).sort((a, b) => b.upvote_count - a.upvote_count)

  return NextResponse.json({ questions: result })
}
