import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { logError } from '@/lib/log-error'
import { approveAnswer } from '@/lib/approve-answer'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()

  if (unauthorized) return unauthorized

  const body = await req.json()
  const { questionId, finalAnswer, scorecard, scorecardOverall, adminNotes, makeGold, revisionNote, opinionChanged, notifyPlayer } = body as {
    questionId?: string
    finalAnswer?: string
    sources?: { title: string; url: string; type?: string }[] | null
    adminNotes?: string | null
    makeGold?: boolean
    revisionNote?: string | null
    opinionChanged?: boolean
    notifyPlayer?: boolean
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
  const result = await approveAnswer({
    questionId,
    finalAnswer,
    actionSteps: '',
    sources: body.sources,
    adminNotes,
    makeGold,
    revisionNote,
    opinionChanged,
    notifyPlayer,
  })

  if (!result.ok) {
    await logError('admin:approve:pipeline', new Error(result.error), { questionId })
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true })
}
