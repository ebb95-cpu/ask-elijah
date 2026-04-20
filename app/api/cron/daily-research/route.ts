import { NextRequest, NextResponse } from 'next/server'
import { verifyBearer } from '@/lib/admin-auth'
import { runDailyResearch } from '@/lib/daily-research'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Scheduled Reddit research cron. Logic lives in lib/daily-research.ts so
 * the admin "Run Research Now" button can call it in-process too. Next.js
 * App Router does not allow non-HTTP-method exports from route.ts, so any
 * shared function must live outside this file.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || !verifyBearer(`Bearer ${secret}`, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runDailyResearch()
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  const { ok: _ok, ...payload } = result
  return NextResponse.json(payload)
}
