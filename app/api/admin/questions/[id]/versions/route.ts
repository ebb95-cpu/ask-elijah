import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const { data, error } = await getSupabase()
    .from('answer_versions')
    .select('id, version_number, answer, sources, change_note, opinion_changed, created_at')
    .eq('question_id', params.id)
    .order('version_number', { ascending: false })

  if (error) {
    // Backward compatible until the answer_versions migration is run.
    if (/answer_versions|relation/i.test(error.message)) {
      return NextResponse.json({ versions: [] })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ versions: data || [] })
}
