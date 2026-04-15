import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase-server'
import { logError } from '@/lib/log-error'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'https://ask-the-pro.vercel.app'
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value

  if (!adminToken || adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { questionId, finalAnswer, scorecard, scorecardOverall } = body as {
    questionId?: string
    finalAnswer?: string
    scorecard?: { key: string; label: string; score: number; reason: string }[] | null
    scorecardOverall?: number | null
  }

  if (!questionId || !finalAnswer) {
    return NextResponse.json({ error: 'Missing questionId or finalAnswer' }, { status: 400 })
  }

  // Persist scorecard directly on the question row BEFORE calling /api/approve.
  // We want the scorecard on the record even if the downstream approve call
  // has any hiccups — it's independent of the email/Pinecone path.
  if (scorecard && Array.isArray(scorecard) && scorecard.length > 0) {
    try {
      await getSupabase()
        .from('questions')
        .update({
          scorecard,
          scorecard_overall: scorecardOverall ?? null,
        })
        .eq('id', questionId)
    } catch (e) {
      await logError('admin:approve:scorecard', e, { questionId })
    }
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
