import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ entries: [] })

  const supabase = getSupabase()

  // Fetch approved questions for this user
  const { data: questions } = await supabase
    .from('questions')
    .select('id, question, answer, action_steps, created_at, updated_at')
    .eq('email', email.toLowerCase())
    .eq('status', 'approved')
    .order('updated_at', { ascending: false })
    .limit(20)

  if (!questions?.length) return NextResponse.json({ entries: [] })

  // Fetch reflections for these questions
  const ids = questions.map(q => q.id)
  const { data: reflections } = await supabase
    .from('reflections')
    .select('question_id, text, created_at')
    .in('question_id', ids)

  const reflectionMap: Record<string, { text: string; created_at: string }> = {}
  for (const r of reflections || []) {
    reflectionMap[r.question_id] = { text: r.text, created_at: r.created_at }
  }

  const entries = questions.map(q => ({
    id: q.id,
    question: q.question,
    answer: q.answer,
    action_steps: q.action_steps,
    answered_at: q.updated_at,
    reflection: reflectionMap[q.id] || null,
  }))

  return NextResponse.json({ entries })
}
