import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { approveAnswer } from '@/lib/approve-answer'
import { logError } from '@/lib/log-error'

export const dynamic = 'force-dynamic'
export const maxDuration = 120
export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()

  if (unauthorized) return unauthorized

  const { questionIds, finalAnswer, sources, adminNotes } = await req.json()
  if (!questionIds?.length || !finalAnswer) {
    return NextResponse.json({ error: 'questionIds and finalAnswer required' }, { status: 400 })
  }

  // Approve each question through the shared in-process pipeline. This avoids
  // admin -> HTTP -> token-gated approve hops and lets the UI see the real
  // failure reason instead of a vague 500.
  const results = await Promise.all(
    questionIds.map(async (questionId: string) => {
      const result = await approveAnswer({ questionId, finalAnswer, actionSteps: '', sources, adminNotes })
      if (!result.ok) {
        await logError('admin:bulk-approve:item', new Error(result.error), { questionId, status: result.status })
      }
      return { questionId, ...result }
    })
  )

  const succeeded = results.filter((r) => r.ok).length
  const failures = results.filter((r) => !r.ok)
  const failed = failures.length

  if (succeeded === 0) {
    const first = failures[0]
    return NextResponse.json(
      { error: first?.error || 'No questions were approved', succeeded, failed },
      { status: first?.status || 500 }
    )
  }

  return NextResponse.json({
    succeeded,
    failed,
    failures: failures.map((f) => ({ questionId: f.questionId, error: f.error })),
  })
}
