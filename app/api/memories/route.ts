import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { requireAuthorizedEmail } from '@/lib/session-email'
import { savePlayerMemories } from '@/lib/player-memory'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authorized = await requireAuthorizedEmail(req)
  if (authorized instanceof NextResponse) return authorized
  const requested = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
  if (requested && requested !== authorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = getSupabase()
  const now = new Date().toISOString()

  const { data } = await supabase
    .from('player_memories')
    .select('id, fact_type, fact_text, created_at, expires_at')
    .eq('email', authorized)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ memories: data || [] })
}

export async function POST(req: NextRequest) {
  const authorized = await requireAuthorizedEmail(req)
  if (authorized instanceof NextResponse) return authorized

  const { email, memories, source_question_id } = await req.json()
  if (!email || !memories?.length) return NextResponse.json({ ok: true })
  if (email.trim().toLowerCase() !== authorized) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await savePlayerMemories(authorized, memories, source_question_id || null)
  return NextResponse.json({ ok: true, saved: result.saved })
}
