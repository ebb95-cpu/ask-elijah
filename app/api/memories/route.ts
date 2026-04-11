import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ memories: [] })

  const supabase = getSupabase()
  const now = new Date().toISOString()

  const { data } = await supabase
    .from('player_memories')
    .select('id, fact_type, fact_text, created_at, expires_at')
    .eq('email', email.toLowerCase())
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ memories: data || [] })
}

export async function POST(req: NextRequest) {
  const { email, memories, source_question_id } = await req.json()
  if (!email || !memories?.length) return NextResponse.json({ ok: true })

  const supabase = getSupabase()
  const clean = email.toLowerCase()

  const rows = memories.map((m: { fact_type: string; fact_text: string; expires_days?: number | null }) => ({
    email: clean,
    fact_type: m.fact_type,
    fact_text: m.fact_text,
    source_question_id: source_question_id || null,
    expires_at: m.expires_days
      ? new Date(Date.now() + m.expires_days * 24 * 60 * 60 * 1000).toISOString()
      : null,
  }))

  await supabase.from('player_memories').insert(rows)
  return NextResponse.json({ ok: true, saved: rows.length })
}
