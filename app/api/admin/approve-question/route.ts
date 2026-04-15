import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase-server'
import { logError } from '@/lib/log-error'
import { approveAnswer } from '@/lib/approve-answer'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { questionId, finalAnswer, scorecard, scorecardOverall } = body as {
    questionId?: string
    finalAnswer?: string
    scorecard?: { key: string; label: string; score: number; reason: string }[] | null
    scorecardOverall?: number | null
  }

  if (!questionId || !finalAnswer) {
    return NextResponse.json({ error: 'Missing questionId or finalAnswer' }, { status: 400 })
  }

  // Persist scorecard on the row first so it's saved even if the approve
  // flow has a hiccup downstream.
  if (scorecard && Array.isArray(scorecard) && scorecard.length > 0) {
    try {
      await getSupabase()
        .from('questions')
        .update({ scorecard, scorecard_overall: scorecardOverall ?? null })
        .eq('id', questionId)
    } catch (e) {
      await logError('admin:approve:scorecard', e, { questionId })
    }
  }

  // Call the shared approve pipeline directly in-process. No more HTTP
  // proxy — that pattern was the source of the double-timeout and the
  // trailing-newline-in-env-var URL bugs.
  const result = await approveAnswer({ questionId, finalAnswer, actionSteps: '' })

  if (!result.ok) {
    await logError('admin:approve:pipeline', new Error(result.error), { questionId })
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true })
}
