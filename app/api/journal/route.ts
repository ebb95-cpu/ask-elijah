import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { requireAuthorizedEmail } from '@/lib/session-email'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authorized = await requireAuthorizedEmail(req)
  if (authorized instanceof NextResponse) return authorized
  const requested = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
  if (requested && requested !== authorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getSupabase()

  // Fetch approved questions for this user
  const { data: questions } = await supabase
    .from('questions')
    .select('id, question, answer, action_steps, created_at, updated_at')
    .eq('email', authorized)
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
