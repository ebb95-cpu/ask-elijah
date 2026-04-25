import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { checkLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'
  const limit = await checkLimit('rl:check-user', ip, 20, '1 h')
  if (!limit.success) return NextResponse.json({ exists: false }, { status: 429 })

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
