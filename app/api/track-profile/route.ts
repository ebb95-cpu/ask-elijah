import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { readTrackEmail } from '@/lib/track-cookie'

const ALLOWED_WRITE_FIELDS = ['position', 'level', 'country', 'challenge', 'first_name', 'name', 'age', 'language', 'timeline', 'system', 'weaknesses', 'strengths']

export async function POST(req: NextRequest) {
  try {
    const email = await readTrackEmail()
    if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await req.json()
    const safeUpdate: Record<string, unknown> = {
      email,
      updated_at: new Date().toISOString(),
    }

    for (const field of ALLOWED_WRITE_FIELDS) {
      if (body[field] !== undefined) safeUpdate[field] = body[field]
    }

    await getSupabase().from('profiles').upsert(safeUpdate, { onConflict: 'email' })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
