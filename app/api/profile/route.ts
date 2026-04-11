import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
  const supabase = getSupabase()
  const { data } = await supabase.from('profiles').select('*').eq('email', email.toLowerCase()).single()
  return NextResponse.json(data || {})
}

export async function POST(req: NextRequest) {
  try {
    const { email, position, level, country, challenge } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
    const supabase = getSupabase()
    await supabase.from('profiles').upsert({
      email: email.trim().toLowerCase(),
      position, level, country, challenge,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
