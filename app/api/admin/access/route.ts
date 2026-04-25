import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabase } from '@/lib/supabase-server'

function cleanEmail(input: unknown): string {
  return typeof input === 'string' ? input.trim().toLowerCase() : ''
}

export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const { data, error } = await getSupabase()
    .from('waitlist')
    .select('id, email, name, challenge, confirmed, approved, notified, created_at')
    .order('created_at', { ascending: false })
    .limit(250)

  if (error) {
    return NextResponse.json({ error: 'Failed to load access list' }, { status: 500 })
  }

  return NextResponse.json({ entries: data || [] })
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json()
  const email = cleanEmail(body.email)

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const challenge = typeof body.challenge === 'string' ? body.challenge.trim() : ''

  const { data, error } = await getSupabase()
    .from('waitlist')
    .upsert(
      {
        email,
        name: name || null,
        challenge: challenge || null,
        confirmed: true,
        approved: true,
      },
      { onConflict: 'email' }
    )
    .select('id, email, name, challenge, confirmed, approved, notified, created_at')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to approve email' }, { status: 500 })
  }

  return NextResponse.json({ entry: data })
}

export async function PATCH(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json()
  const id = typeof body.id === 'string' ? body.id : ''
  const approved = body.approved === true

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data, error } = await getSupabase()
    .from('waitlist')
    .update({ approved })
    .eq('id', id)
    .select('id, email, name, challenge, confirmed, approved, notified, created_at')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update access' }, { status: 500 })
  }

  return NextResponse.json({ entry: data })
}
