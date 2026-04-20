import { NextRequest, NextResponse } from 'next/server'
import { logError } from '@/lib/log-error'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/**
 * Receives client-side error reports from ErrorCatcher.tsx. Writes them
 * to the error_log table so we can see what crashed on the user's phone
 * without having access to their browser console.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    await logError('client-crash', body.message || 'Unknown', {
      extra: body.extra,
      url: body.url,
      userAgent: body.userAgent,
      timestamp: body.timestamp,
    })
  } catch {
    // Best effort — don't fail
  }
  return NextResponse.json({ ok: true })
}

/**
 * GET: read recent client errors (admin-only, for quick triage).
 */
export async function GET(req: NextRequest) {
  const { cookies } = await import('next/headers')
  const unauthorized = await requireAdmin()

  if (unauthorized) return unauthorized

  const { getSupabase } = await import('@/lib/supabase-server')
  const supabase = getSupabase()
  const { data } = await supabase
    .from('error_log')
    .select('*')
    .eq('source', 'client-crash')
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ errors: data || [] })
}
