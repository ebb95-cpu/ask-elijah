import { NextRequest, NextResponse } from 'next/server'
import { verifyBearer } from '@/lib/admin-auth'
import { runDataBackup } from '@/lib/data-backup'
import { logError } from '@/lib/log-error'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  if (!verifyBearer(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runDataBackup()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    await logError('cron:backup-data', err)
    return NextResponse.json({ error: 'Data backup failed' }, { status: 500 })
  }
}
