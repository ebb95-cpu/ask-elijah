import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

// Only allow reading/writing non-sensitive profile fields
const ALLOWED_WRITE_FIELDS = ['position', 'level', 'country', 'challenge', 'first_name', 'name', 'age', 'language']

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
  const supabase = getSupabase()
  // Only return non-sensitive fields — never subscription_status or stripe data
  const { data } = await supabase
    .from('profiles')
    .select('email, position, level, country, challenge, first_name')
    .eq('email', email.toLowerCase())
    .single()
  return NextResponse.json(data || {})
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    // Strip any fields that shouldn't be user-writable
    const safeUpdate: Record<string, unknown> = { email: email.trim().toLowerCase(), updated_at: new Date().toISOString() }
    for (const field of ALLOWED_WRITE_FIELDS) {
      if (body[field] !== undefined) safeUpdate[field] = body[field]
    }

    const supabase = getSupabase()
    await supabase.from('profiles').upsert(safeUpdate, { onConflict: 'email' })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
