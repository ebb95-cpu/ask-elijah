import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET  — latest question-discovery run + a trailing history list for the
 *        admin dashboard. Returns the synthesis JSON
 *        directly, plus run timestamps and counts.
 *
 * POST — admin-initiated manual run. Calls the cron endpoint with the
 *        CRON_SECRET so the admin can trigger discovery without waiting
 *        for the nightly schedule. Useful when you want fresh
 *        data before a content-planning session.
 */

function getSiteUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000'
}

export async function GET() {
  const unauthorized = await requireAdmin()

  if (unauthorized) return unauthorized

  const supabase = getSupabase()
  const { data: runs, error } = await supabase
    .from('pain_research_runs')
    .select('id, started_at, finished_at, status, error, raw_count, pain_count, question_count, synthesis')
    .order('started_at', { ascending: false })
    .limit(10)

  if (error) {
    const missingTable = error.code === '42P01' || /pain_research_runs/i.test(error.message)
    return NextResponse.json(
      {
        error: missingTable
          ? 'Question Discovery storage is missing. Apply supabase/migrations/add-pain-research.sql in Supabase.'
          : error.message,
        code: error.code,
      },
      { status: 500 }
    )
  }

  const runsList = runs || []
  const latest = runsList.find((r) => r.status === 'completed') || runsList[0] || null

  return NextResponse.json({
    latest,
    history: runsList.map((r) => ({
      id: r.id,
      started_at: r.started_at,
      finished_at: r.finished_at,
      status: r.status,
      raw_count: r.raw_count,
      pain_count: r.pain_count,
      question_count: r.question_count,
      error: r.error,
    })),
  })
}

export async function POST() {
  const unauthorized = await requireAdmin()

  if (unauthorized) return unauthorized
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  // Wait for the run to start/finish so the admin sees real failures instead
  // of a vague 500. This route has the same 5-minute budget as the cron job.
  const siteUrl = getSiteUrl()
  const res = await fetch(`${siteUrl}/api/cron/pain-research`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return NextResponse.json(
      { error: data.error || `Question discovery failed with ${res.status}`, runId: data.runId },
      { status: res.status }
    )
  }

  return NextResponse.json({ ok: true, ...data })
}
