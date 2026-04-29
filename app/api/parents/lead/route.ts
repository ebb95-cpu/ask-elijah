import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { email?: string; magnet?: string } | null
  const email = body?.email?.trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 })
  }

  const supabase = getSupabase()
  const { error } = await supabase
    .from('parent_leads')
    .upsert({
      email,
      magnet: body?.magnet || '1-for-9',
      source: 'parents',
    }, { onConflict: 'email,magnet' })

  if (error) return NextResponse.json({ error: 'Could not save this email yet.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
