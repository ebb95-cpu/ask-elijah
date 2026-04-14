import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

function getSiteUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'https://elijahbryant.pro'
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value

  if (!adminToken || adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { questionId, finalAnswer } = await req.json()
  if (!questionId || !finalAnswer) {
    return NextResponse.json({ error: 'Missing questionId or finalAnswer' }, { status: 400 })
  }

  const siteUrl = getSiteUrl()

  const res = await fetch(`${siteUrl}/api/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-token': process.env.CRON_SECRET!,
    },
    body: JSON.stringify({ questionId, finalAnswer, actionSteps: '' }),
  })

  const data = await res.json()

  if (!res.ok) {
    return NextResponse.json({ error: data.error || 'Approval failed' }, { status: res.status })
  }

  return NextResponse.json(data)
}
