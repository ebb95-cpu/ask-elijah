import { NextRequest, NextResponse } from 'next/server'
import { approveAnswer } from '@/lib/approve-answer'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Token-gated approve endpoint (used by email links + any external caller).
 * Logic lives in lib/approve-answer.ts so the admin UI can call it in-process
 * without the HTTP-proxy double-timeout problem.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get('x-token')
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { questionId, finalAnswer, actionSteps } = await req.json()
  const result = await approveAnswer({ questionId, finalAnswer, actionSteps })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ success: true })
}
