import { NextRequest, NextResponse } from 'next/server'
import { verifyBearer } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Lightweight daily ingest for fresh public content.
 *
 * The full ingest also scans Google Drive PDFs, which is expensive and doesn't
 * need to run every day. This route keeps newsletters + YouTube current while
 * leaving the heavier drive sync on the weekly full job.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!verifyBearer(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL('/api/cron/ingest-knowledge', req.url)
  url.searchParams.set('skipPdfs', '1')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({ error: 'Latest ingest returned invalid JSON' }))
  return NextResponse.json(json, { status: res.status })
}
