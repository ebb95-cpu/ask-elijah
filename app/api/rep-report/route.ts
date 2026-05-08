/**
 * POST /api/rep-report
 *
 * Player submits their report-back on an answered question.
 * Marks the question solved and stores their reflection.
 *
 * Body: { questionId: string, reflection: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { readTrackEmail } from '@/lib/track-cookie'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const email = await readTrackEmail()
  if (!email) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const { questionId, reflection } = await req.json().catch(() => ({})) as {
    questionId?: string
    reflection?: string
  }

  if (!questionId) {
    return NextResponse.json({ error: 'questionId required.' }, { status: 400 })
  }

  const clean = reflection?.trim() || ''
  if (clean.length < 10) {
    return NextResponse.json({ error: 'Tell me what actually happened. At least a sentence.' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Verify this question belongs to this player
  const { data: question, error: fetchError } = await supabase
    .from('questions')
    .select('id, status')
    .eq('id', questionId)
    .eq('email', email)
    .eq('status', 'approved')
    .maybeSingle()

  if (fetchError || !question) {
    return NextResponse.json({ error: 'Question not found.' }, { status: 404 })
  }

  const { error } = await supabase
    .from('questions')
    .update({
      rep_status: 'yes',
      rep_reflection: clean,
      rep_reflected_at: new Date().toISOString(),
    })
    .eq('id', questionId)
    .eq('email', email)

  if (error) {
    return NextResponse.json({ error: 'Could not save your report.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
