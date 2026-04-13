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

  // Use direct REST fetch to avoid supabase-js quirks
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const restRes = await fetch(
    `${sbUrl}/rest/v1/questions?status=eq.approved&select=id,question,answer&order=created_at.desc&limit=50`,
    { headers: { apikey: sbKey!, Authorization: `Bearer ${sbKey}`, 'Content-Type': 'application/json' }, cache: 'no-store' }
  )
  const questions: { id: string; question: string; answer: string }[] | null = restRes.ok ? await restRes.json() : null

  if (!restRes.ok) console.error('Browse REST error:', restRes.status, await restRes.text().catch(() => ''))
  console.log('Browse REST returned:', questions?.length, 'questions')

  if (!questions?.length) return NextResponse.json({ questions: [], subscribed, _debug: { status: restRes.status, count: 0, url: sbUrl?.slice(0, 40) } })

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
