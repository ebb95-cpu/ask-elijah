import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

/**
 * GET  — latest pain-research run + a trailing history list for the
 *        /admin/pain-research dashboard. Returns the synthesis JSON
 *        directly, plus run timestamps and counts.
 *
 * POST — admin-initiated manual run. Internally calls the cron endpoint
 *        with the CRON_SECRET so the admin can trigger research without
 *        waiting for the nightly schedule. Useful when you want fresh
 *        data before a content-planning session.
 */

function getSiteUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000'
}

export async function GET() {
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const { data: runs, error } = await supabase
    .from('pain_research_runs')
    .select('id, started_at, finished_at, status, error, raw_count, pain_count, question_count, synthesis')
    .order('started_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
  const cookieStore = cookies()
  const adminToken = cookieStore.get('admin_token')?.value
  if (!adminToken || adminToken !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  // Fire-and-forget: the cron endpoint can take minutes, but the admin
  // UI polls /api/admin/pain-research for the latest run so they don't
  // need to wait here.
  const siteUrl = getSiteUrl()
  fetch(`${siteUrl}/api/cron/pain-research`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  }).catch(() => { /* swallow — admin sees failure state via polling */ })

  return NextResponse.json({ ok: true, started: true })
}
