import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function getSiteUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'https://elijahbryant.pro'
}

export async function POST(_req: NextRequest) {
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value

  if (!adminToken || adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const siteUrl = getSiteUrl()

  const res = await fetch(`${siteUrl}/api/cron/daily-research`, {
    method: 'GET',
    headers: {
      'x-cron-secret': process.env.CRON_SECRET!,
    },
  })

  const data = await res.json()

  if (!res.ok) {
    return NextResponse.json({ error: data.error || 'Research failed' }, { status: res.status })
  }

  return NextResponse.json(data)
}
