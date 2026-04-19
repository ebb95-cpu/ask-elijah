import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email?.trim()) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const cleanEmail = email.trim().toLowerCase()
  const supabase = getSupabase()

  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) {
    return NextResponse.json({ exists: false }, { status: 200 })
  }

  const exists = data.users.some(u => u.email?.toLowerCase() === cleanEmail)
  return NextResponse.json({ exists })
}
