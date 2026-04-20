import { NextRequest, NextResponse } from 'next/server'
import { runDailyResearch } from '@/lib/daily-research'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(_req: NextRequest) {
  const unauthorized = await requireAdmin()

  if (unauthorized) return unauthorized

  // Call the research logic directly in-process. Previously this proxied
  // through an HTTPS request to the cron endpoint, which meant a double
  // timeout (browser + outer function) and a hard dependency on the site
  // URL being resolvable from inside the function — the main cause of the
  // "Network failure" the admin kept seeing.
  const result = await runDailyResearch()

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    pending: result.pending,
    autoAnswered: result.autoAnswered,
    duplicates: result.duplicates,
    message: result.message,
  })
}
