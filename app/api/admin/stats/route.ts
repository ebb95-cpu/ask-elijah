import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [allQ, weekQ, answeredQ, ppAll] = await Promise.all([
    supabase.from('questions').select('email, status, created_at, answered_at'),
    supabase.from('questions').select('id').gte('created_at', weekAgo),
    supabase.from('questions').select('created_at, answered_at').eq('status', 'approved').not('answered_at', 'is', null),
    supabase.from('pain_points').select('status'),
  ])

  const all = allQ.data || []
  const ppRows = ppAll.data || []

  const uniqueEmails = new Set(all.map((r: { email: string }) => r.email?.toLowerCase()).filter(Boolean))
  const totalPlayers = uniqueEmails.size
  const questionsThisWeek = (weekQ.data || []).length
  const totalAnswered = all.filter((r: { status: string }) => r.status === 'approved' || r.status === 'answered').length
  const answerRate = all.length > 0 ? Math.round((totalAnswered / all.length) * 100) : 0

  const answeredRows = answeredQ.data || []
  let avgResponseHours: number | null = null
  if (answeredRows.length > 0) {
    const diffs = answeredRows
      .filter((r: { created_at: string; answered_at: string }) => r.created_at && r.answered_at)
      .map((r: { created_at: string; answered_at: string }) =>
        (new Date(r.answered_at).getTime() - new Date(r.created_at).getTime()) / (1000 * 60 * 60)
      )
      .filter((h: number) => h > 0)
    if (diffs.length > 0) {
      avgResponseHours = Math.round(diffs.reduce((a: number, b: number) => a + b, 0) / diffs.length)
    }
  }

  // Counts across both tables
  const allRows = [...all, ...ppRows]
  const pending = allRows.filter((r) => r.status === 'pending').length
  const answered = allRows.filter((r) => r.status === 'answered' || r.status === 'approved').length
  const skipped = allRows.filter((r) => r.status === 'skipped').length

  return NextResponse.json({
    counts: { pending, answered, skipped },
    dash: { totalPlayers, questionsThisWeek, answerRate, avgResponseHours },
  })
}
