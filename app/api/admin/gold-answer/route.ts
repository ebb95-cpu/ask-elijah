import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabase } from '@/lib/supabase-server'
import { logError } from '@/lib/log-error'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const { questionId, isGold = true, reason } = await req.json()
  if (!questionId) {
    return NextResponse.json({ error: 'questionId required' }, { status: 400 })
  }

  try {
    const { error } = await getSupabase()
      .from('questions')
      .update({
        is_gold_answer: Boolean(isGold),
        gold_reason: isGold ? (reason || 'Marked gold by admin') : null,
      })
      .eq('id', questionId)

    if (error) {
      await logError('admin:gold-answer', error, { questionId })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    await logError('admin:gold-answer:exception', err, { questionId })
    return NextResponse.json({ error: 'Failed to update gold answer' }, { status: 500 })
  }
}
