import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-auth'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const unauthorized = await requireAdmin()
    if (unauthorized) return unauthorized

    const supabase = getSupabase()
    const body = await req.json().catch(() => ({}))
    const table = body.itemType === 'pain_point' ? 'pain_points' : 'questions'

    const { error } = await supabase
      .from(table)
      .update({ status: 'skipped' })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Skip route error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
