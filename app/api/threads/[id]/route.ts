import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

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

// GET /api/threads/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const email = await getAuthEmail(req)
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('questions')
    .select('id, question, answer, action_steps, solved, solved_at, created_at, conversation, status')
    .eq('id', params.id)
    .eq('email', email)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  return NextResponse.json({ thread: data })
}

// PATCH /api/threads/[id] — update conversation, solved status, action steps
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const email = await getAuthEmail(req)
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const supabase = getSupabase()

  // Verify ownership
  const { data: existing } = await supabase
    .from('questions')
    .select('id, email')
    .eq('id', params.id)
    .eq('email', email)
    .single()

  if (!existing) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })

  const update: Record<string, unknown> = {}
  if (body.conversation !== undefined) update.conversation = body.conversation
  if (body.action_steps !== undefined) update.action_steps = body.action_steps
  if (body.answer !== undefined) update.answer = body.answer
  if (body.solved !== undefined) {
    update.solved = body.solved === true
    update.solved_at = body.solved ? new Date().toISOString() : null
  }

  const { data, error } = await supabase
    .from('questions')
    .update(update)
    .eq('id', params.id)
    .select('id, question, answer, action_steps, solved, solved_at, created_at, conversation, status')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ thread: data })
}
