import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { runDataBackup } from '@/lib/data-backup'
import { logError } from '@/lib/log-error'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  try {
    const result = await runDataBackup()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    await logError('admin:backup-data', err)
    return NextResponse.json({ error: 'Data backup failed' }, { status: 500 })
  }
}
