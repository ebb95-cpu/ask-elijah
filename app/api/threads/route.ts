import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { profileHasEntitlement } from '@/lib/access-gate'

export const dynamic = 'force-dynamic'

const FREE_QUESTION_LIMIT = 3

async function getAuthEmail(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data } = await supabase.auth.getUser(token)
    return data.user?.email?.toLowerCase() || null
  } catch {
    return null
  }
}

// GET /api/threads — list user's threads (root questions only, no follow-ups)
export async function GET(req: NextRequest) {
  const email = await getAuthEmail(req)
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('questions')
    .select('id, question, answer, action_steps, solved, solved_at, created_at, conversation, status')
    .eq('email', email)
    .is('thread_id', null)
    .is('deleted_at', null)
    .order('solved', { ascending: true })        // unsolved first
    .order('created_at', { ascending: false })   // newest first within each group
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ threads: data || [] })
}

// POST /api/threads — create a new thread (question)
export async function POST(req: NextRequest) {
  const email = await getAuthEmail(req)
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const question = typeof body.question === 'string' ? body.question.trim() : ''
  if (!question) return NextResponse.json({ error: 'Question required' }, { status: 400 })
  if (question.length > 2000) return NextResponse.json({ error: 'Too long' }, { status: 400 })

  const supabase = getSupabase()

  // Check free tier limit — Pro users are unlimited, free users get 3 saved questions
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_founding_member, subscription_status, trial_ends_at, payment_grace_ends_at')
    .eq('email', email)
    .maybeSingle()

  const isPro = profileHasEntitlement(profile)

  if (!isPro) {
    const { count } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .eq('status', 'chat')
      .is('thread_id', null)
      .is('deleted_at', null)

    if ((count ?? 0) >= FREE_QUESTION_LIMIT) {
      return NextResponse.json(
        { error: 'Free accounts get 3 saved questions. Upgrade to Pro for unlimited.', code: 'upgrade_required' },
        { status: 403 },
      )
    }
  }

  const { data, error } = await supabase
    .from('questions')
    .insert({
      email,
      question,
      status: 'chat',
      conversation: [],
      solved: false,
    })
    .select('id, question, answer, action_steps, solved, solved_at, created_at, conversation, status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ thread: data })
}
