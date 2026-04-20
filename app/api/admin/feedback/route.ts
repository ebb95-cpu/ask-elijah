import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase-server'
import { fetchSentryIssues, isSentryConfigured, sentryDashboardUrl } from '@/lib/sentry'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/feedback
 *
 * Dashboard data for /admin/feedback. Returns:
 *   - aggregate thumbs stats
 *   - recent thumbs-down entries (with comments prioritised)
 *   - open + recently-resolved bug reports
 */
export async function GET() {
  const unauthorized = await requireAdmin()

  if (unauthorized) return unauthorized

  const supabase = getSupabase()

  const [feedbackRes, bugsRes, crashesRes, sentryIssues] = await Promise.all([
    supabase
      .from('answer_feedback')
      .select('id, question_id, email, rating, comment, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('bug_reports')
      .select('id, email, page_url, user_agent, message, resolved_at, created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    // Client-side crashes auto-captured by ErrorCatcher. Surface them in
    // the same dashboard so the admin has one place to triage every kind
    // of "thing went wrong" signal.
    supabase
      .from('error_log')
      .select('id, message, context, created_at')
      .eq('source', 'client-crash')
      .order('created_at', { ascending: false })
      .limit(50),
    // Pull unresolved issues from Sentry if the integration is configured.
    // Fails soft — returns [] on any error so the rest of the dashboard
    // still loads when Sentry is down or creds are missing.
    fetchSentryIssues(20),
  ])

  const feedback = feedbackRes.data || []
  const bugs = bugsRes.data || []
  const crashes = crashesRes.data || []

  // Join question text onto feedback rows so the dashboard can show context.
  const qIds = Array.from(new Set(feedback.map((f) => f.question_id)))
  const questionMap: Record<string, string> = {}
  if (qIds.length > 0) {
    const { data: qs } = await supabase
      .from('questions')
      .select('id, question')
      .in('id', qIds)
    for (const q of qs || []) questionMap[q.id] = q.question
  }

  const ups = feedback.filter((f) => f.rating === 'up').length
  const downs = feedback.filter((f) => f.rating === 'down').length
  const ratio = ups + downs > 0 ? ups / (ups + downs) : null

  return NextResponse.json({
    summary: {
      total_feedback: feedback.length,
      thumbs_up: ups,
      thumbs_down: downs,
      up_ratio: ratio,
      open_bugs: bugs.filter((b) => !b.resolved_at).length,
      total_bugs: bugs.length,
      recent_crashes: crashes.length,
      sentry_issues: sentryIssues.length,
      sentry_configured: isSentryConfigured(),
      sentry_dashboard_url: sentryDashboardUrl(),
    },
    feedback: feedback.map((f) => ({
      ...f,
      question: questionMap[f.question_id] || null,
    })),
    bugs,
    crashes,
    sentry_issues: sentryIssues,
  })
}

/**
 * POST /api/admin/feedback/resolve
 *
 * Mark a bug report as resolved. Body: { id: string }
 */
export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()

  if (unauthorized) return unauthorized

  const { id, action } = (await req.json()) as { id?: string; action?: 'resolve' | 'reopen' }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = getSupabase()
  const { error } = await supabase
    .from('bug_reports')
    .update({ resolved_at: action === 'reopen' ? null : new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
