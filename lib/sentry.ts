/**
 * Sentry REST API client.
 *
 * Admin dashboard pulls the most recent unresolved issues from the
 * askelijah.sentry.io project so Elijah sees crashes + bugs + feedback
 * in one admin surface.
 *
 * Requires:
 *   SENTRY_AUTH_TOKEN   — https://sentry.io/settings/account/api/auth-tokens/
 *                         needs `project:read` + `event:read` scopes
 *   SENTRY_ORG_SLUG     — e.g. "askelijah"
 *   SENTRY_PROJECT_SLUG — e.g. "javascript-nextjs" (whatever was created)
 *
 * Silent no-op if any of these is missing — the dashboard just hides the
 * Sentry tab when the integration isn't configured.
 */

export type SentryIssue = {
  id: string
  title: string
  culprit: string | null
  permalink: string
  count: string
  user_count: number
  last_seen: string | null
  first_seen: string | null
  level: string | null
  status: string
}

const SENTRY_API = 'https://sentry.io/api/0'

export function isSentryConfigured(): boolean {
  return Boolean(
    process.env.SENTRY_AUTH_TOKEN &&
      process.env.SENTRY_ORG_SLUG &&
      process.env.SENTRY_PROJECT_SLUG
  )
}

export async function fetchSentryIssues(limit = 20): Promise<SentryIssue[]> {
  const token = process.env.SENTRY_AUTH_TOKEN
  const org = process.env.SENTRY_ORG_SLUG
  const project = process.env.SENTRY_PROJECT_SLUG
  if (!token || !org || !project) return []

  // Query: unresolved issues, sorted by most-recently-seen. 14-day window
  // is Sentry's free-tier retention on many plans so we don't ask for more.
  const params = new URLSearchParams({
    query: 'is:unresolved',
    statsPeriod: '14d',
    sort: 'date',
    limit: String(limit),
  })

  try {
    const res = await fetch(
      `${SENTRY_API}/projects/${org}/${project}/issues/?${params}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
    )
    if (!res.ok) return []
    const data = (await res.json()) as Array<{
      id: string
      title?: string
      culprit?: string
      permalink?: string
      count?: string
      userCount?: number
      lastSeen?: string
      firstSeen?: string
      level?: string
      status?: string
    }>
    return data.map((issue) => ({
      id: issue.id,
      title: issue.title || '(untitled)',
      culprit: issue.culprit || null,
      permalink: issue.permalink || `https://sentry.io/organizations/${org}/issues/${issue.id}/`,
      count: issue.count || '0',
      user_count: issue.userCount || 0,
      last_seen: issue.lastSeen || null,
      first_seen: issue.firstSeen || null,
      level: issue.level || null,
      status: issue.status || 'unresolved',
    }))
  } catch {
    return []
  }
}

export function sentryDashboardUrl(): string | null {
  const org = process.env.SENTRY_ORG_SLUG
  if (!org) return 'https://askelijah.sentry.io/issues/'
  return `https://${org}.sentry.io/issues/`
}
