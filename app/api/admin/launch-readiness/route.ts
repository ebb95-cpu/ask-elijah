import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabase } from '@/lib/supabase-server'
import { fetchSentryIssues, isSentryConfigured } from '@/lib/sentry'

export const dynamic = 'force-dynamic'

type Check = {
  label: string
  status: 'ready' | 'watch' | 'blocker'
  detail: string
}

function envCheck(label: string, keys: string[]): Check {
  const missing = keys.filter((key) => !process.env[key])
  return {
    label,
    status: missing.length === 0 ? 'ready' : 'blocker',
    detail: missing.length === 0 ? 'Configured' : `Missing ${missing.join(', ')}`,
  }
}

export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const supabase = getSupabase()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    pendingRes,
    approvedRes,
    bugRes,
    crashRes,
    feedbackRes,
    sourceRes,
    waitlistRes,
    sentryIssues,
  ] = await Promise.all([
    supabase.from('questions').select('id', { count: 'exact', head: true }).eq('status', 'pending').is('deleted_at', null),
    supabase.from('questions').select('id', { count: 'exact', head: true }).eq('status', 'approved').is('deleted_at', null),
    supabase.from('bug_reports').select('id', { count: 'exact', head: true }).is('resolved_at', null),
    supabase.from('error_log').select('id', { count: 'exact', head: true }).eq('source', 'client-crash').gte('created_at', since24h),
    supabase.from('answer_feedback').select('id', { count: 'exact', head: true }),
    supabase.from('kb_sources').select('id', { count: 'exact', head: true }),
    supabase.from('waitlist').select('id', { count: 'exact', head: true }).eq('approved', true),
    fetchSentryIssues(10),
  ])

  const pending = pendingRes.count || 0
  const approved = approvedRes.count || 0
  const openBugs = bugRes.count || 0
  const recentCrashes = crashRes.count || 0
  const totalFeedback = feedbackRes.count || 0
  const kbSources = sourceRes.count || 0
  const approvedAccess = waitlistRes.count || 0
  const sentryCount = sentryIssues.length

  const checks: Check[] = [
    envCheck('Core secrets', ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ANTHROPIC_API_KEY', 'CRON_SECRET']),
    envCheck('Email sending', ['RESEND_API_KEY']),
    envCheck('Knowledge base', ['PINECONE_HOST', 'PINECONE_API_KEY', 'VOYAGE_API_KEY']),
    {
      label: 'Sentry',
      status: !isSentryConfigured() ? 'watch' : sentryCount > 0 ? 'watch' : 'ready',
      detail: !isSentryConfigured() ? 'Not configured' : `${sentryCount} unresolved issue${sentryCount === 1 ? '' : 's'}`,
    },
    {
      label: 'Known bugs',
      status: openBugs > 0 ? 'watch' : 'ready',
      detail: `${openBugs} open bug report${openBugs === 1 ? '' : 's'}`,
    },
    {
      label: 'Recent crashes',
      status: recentCrashes > 0 ? 'watch' : 'ready',
      detail: `${recentCrashes} client crash${recentCrashes === 1 ? '' : 'es'} in 24h`,
    },
    {
      label: 'Question queue',
      status: pending > 25 ? 'watch' : 'ready',
      detail: `${pending} pending · ${approved} approved`,
    },
    {
      label: 'Knowledge inventory',
      status: kbSources > 0 ? 'ready' : 'watch',
      detail: `${kbSources} source${kbSources === 1 ? '' : 's'} indexed`,
    },
    {
      label: 'Launch gate',
      status: approvedAccess > 0 ? 'ready' : 'watch',
      detail: `${approvedAccess} approved player${approvedAccess === 1 ? '' : 's'}`,
    },
    {
      label: 'Learning loop',
      status: totalFeedback > 0 ? 'ready' : 'watch',
      detail: `${totalFeedback} answer rating${totalFeedback === 1 ? '' : 's'} collected`,
    },
  ]

  const blockers = checks.filter((c) => c.status === 'blocker').length
  const watch = checks.filter((c) => c.status === 'watch').length
  const status = blockers > 0 ? 'blocker' : watch > 0 ? 'watch' : 'ready'

  return NextResponse.json({
    status,
    summary: { blockers, watch, ready: checks.length - blockers - watch },
    checks,
  })
}
