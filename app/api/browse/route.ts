import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const TEASER_CHARS = 160

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

  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('id, question, answer')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(50)

  if (qErr) console.error('Browse query error:', qErr)
  console.log('Browse query returned:', questions?.length, 'questions')

  if (!questions?.length) return NextResponse.json({ questions: [], subscribed, _debug: { error: qErr, count: 0, url: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) } })

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
    answer: subscribed ? q.answer : q.answer.slice(0, TEASER_CHARS),
    truncated: !subscribed && q.answer.length > TEASER_CHARS,
    upvote_count: countMap[q.id] || 0,
    user_upvoted: userSet.has(q.id),
  })).sort((a, b) => b.upvote_count - a.upvote_count)

  return NextResponse.json({ questions: result, subscribed, _debug: { count: questions.length, url: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 40), keyHint: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-6) } })
}
