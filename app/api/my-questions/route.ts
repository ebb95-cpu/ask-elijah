import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

async function getSessionEmail(req: NextRequest): Promise<string | null> {
  const res = NextResponse.next()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        },
      },
    }
  )
  const { data: { user } } = await supabaseAuth.auth.getUser()
  return user?.email?.toLowerCase() ?? null
}

/**
 * Returning-user dashboard data: a unified list of the asker's questions
 * across statuses so /ask can show "Your questions" with status badges
 * (waiting / answered / reflected) without juggling multiple endpoints.
 *
 * Why a new endpoint instead of extending /api/journal? /api/journal hard-
 * filters status='approved' and is used by /history with that contract.
 * Changing it would risk regressing the journal page; a separate endpoint
 * is the safer move.
 */
export async function GET(req: NextRequest) {
  const email = await getSessionEmail(req)
  if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const supabase = getSupabase()

  const { data: rows } = await supabase
    .from('questions')
    .select('id, question, answer, status, action_steps, created_at, approved_at, reviewed_by_elijah')
    .eq('email', email)
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: false })
    .limit(20)

  if (!rows?.length) return NextResponse.json({ questions: [] })

  // Pull reflections for any of these questions in one shot.
  const ids = rows.map((r) => r.id)
  const { data: reflections } = await supabase
    .from('reflections')
    .select('question_id')
    .in('question_id', ids)

  const reflectedSet = new Set((reflections || []).map((r) => r.question_id))

  const questions = rows.map((r) => ({
    id: r.id,
    question: r.question,
    answer: r.answer || null,
    status: r.status as 'pending' | 'approved',
    action_steps: r.action_steps || null,
    asked_at: r.created_at,
    answered_at: r.approved_at || null,
    reviewed_by_elijah: r.reviewed_by_elijah === true,
    has_reflection: reflectedSet.has(r.id),
  }))

  return NextResponse.json({ questions })
}
