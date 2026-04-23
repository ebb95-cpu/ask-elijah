import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabase } from '@/lib/supabase-server'

// Only allow reading/writing non-sensitive profile fields.
// `weaknesses` and `strengths` are captured during the post-verify Endel-style
// onboarding flow. Make sure the corresponding columns exist in the Supabase
// `profiles` table — see scripts/add-profile-columns.sql for the migration.
const ALLOWED_WRITE_FIELDS = ['position', 'level', 'country', 'challenge', 'first_name', 'name', 'age', 'language', 'timeline', 'system', 'weaknesses', 'strengths']

async function getSessionEmail(req: NextRequest): Promise<string | null> {
  const res = NextResponse.next()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        },
      },
    }
  )
  const { data: { user } } = await supabaseAuth.auth.getUser()
  return user?.email?.toLowerCase() ?? null
}

export async function GET(req: NextRequest) {
  const email = await getSessionEmail(req)
  if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const supabase = getSupabase()
  // Pull both the canonical first_name column AND the legacy `name` column —
  // older onboarding flows wrote to the latter, so we coalesce to whichever
  // is populated and expose a single first_name field to every caller.
  const { data } = await supabase
    .from('profiles')
    .select('email, position, level, country, challenge, first_name, name, timeline, system')
    .eq('email', email)
    .single()
  if (!data) return NextResponse.json({})
  const { name, ...rest } = data as { name?: string | null } & Record<string, unknown>
  const merged = { ...rest, first_name: data.first_name || name || null }
  return NextResponse.json(merged)
}

export async function POST(req: NextRequest) {
  try {
    const sessionEmail = await getSessionEmail(req)
    if (!sessionEmail) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await req.json()

    // Strip any fields that shouldn't be user-writable
    const safeUpdate: Record<string, unknown> = { email: sessionEmail, updated_at: new Date().toISOString() }
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
