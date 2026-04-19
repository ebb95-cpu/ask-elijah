import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

// Only allow reading/writing non-sensitive profile fields
const ALLOWED_WRITE_FIELDS = ['position', 'level', 'country', 'challenge', 'first_name', 'name', 'age', 'language', 'timeline', 'system']

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })
  const supabase = getSupabase()
  // Pull both the canonical first_name column AND the legacy `name` column —
  // older onboarding flows wrote to the latter, so we coalesce to whichever
  // is populated and expose a single first_name field to every caller.
  const { data } = await supabase
    .from('profiles')
    .select('email, position, level, country, challenge, first_name, name, timeline, system')
    .eq('email', email.toLowerCase())
    .single()
  if (!data) return NextResponse.json({})
  const { name, ...rest } = data as { name?: string | null } & Record<string, unknown>
  const merged = { ...rest, first_name: data.first_name || name || null }
  return NextResponse.json(merged)
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
