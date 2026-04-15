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

  const { questionIds, finalAnswer } = await req.json()
  if (!questionIds?.length || !finalAnswer) {
    return NextResponse.json({ error: 'questionIds and finalAnswer required' }, { status: 400 })
  }

  const siteUrl = getSiteUrl()

  // Approve each question — fire in parallel, fail-soft per item
  const results = await Promise.allSettled(
    questionIds.map((questionId: string) =>
      fetch(`${siteUrl}/api/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-token': process.env.CRON_SECRET!,
        },
        body: JSON.stringify({ questionId, finalAnswer, actionSteps: '' }),
      })
    )
  )

  const succeeded = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  return NextResponse.json({ succeeded, failed })
}
