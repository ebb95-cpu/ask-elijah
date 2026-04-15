import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const status = req.nextUrl.searchParams.get('status') || 'pending'
  const supabase = getSupabase()

  const ppStatus = status === 'answered' ? ['answered'] : [status]
  const pqStatus = status === 'answered' ? ['approved', 'answered'] : [status]

  const [ppRes, pqRes] = await Promise.all([
    supabase.from('pain_points').select('*').in('status', ppStatus).order('created_at', { ascending: false }).limit(50),
    supabase.from('questions').select('*').in('status', pqStatus).order('created_at', { ascending: false }).limit(50),
  ])

  return NextResponse.json({
    painPoints: ppRes.data || [],
    questions: pqRes.data || [],
  })
}
