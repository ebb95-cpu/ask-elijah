import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { runDailyResearch } from '../../cron/daily-research/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(_req: NextRequest) {
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
