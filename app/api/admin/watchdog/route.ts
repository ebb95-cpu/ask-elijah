import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { runWatchdog } from '@/lib/watchdog'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const result = await runWatchdog({
    origin: req.headers.get('origin'),
    notify: false,
  })

  return NextResponse.json(result)
}
