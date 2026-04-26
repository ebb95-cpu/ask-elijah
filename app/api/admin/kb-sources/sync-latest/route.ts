import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET is not set' }, { status: 500 })
  }

  const url = new URL('/api/cron/ingest-knowledge', req.url)
  url.searchParams.set('skipPdfs', '1')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({ error: 'Latest sync returned invalid JSON' }))

  return NextResponse.json(json, { status: res.status })
}
