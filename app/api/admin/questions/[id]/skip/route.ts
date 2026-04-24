import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-auth'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const unauthorized = await requireAdmin()
    if (unauthorized) return unauthorized

    const supabase = getSupabase()

    await supabase
      .from('pain_points')
      .update({ status: 'skipped' })
      .eq('id', id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Skip route error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
