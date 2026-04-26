import { emailAdmin, esc } from './email-admin'
import { logError } from './log-error'
import { getSupabase } from './supabase-server'

export type WatchdogStatus = 'ok' | 'warning' | 'fail'

export type WatchdogCheck = {
  name: string
  status: WatchdogStatus
  detail: string
  ms?: number
}

export type WatchdogResult = {
  status: WatchdogStatus
  checked_at: string
  checks: WatchdogCheck[]
}

type RunOptions = {
  origin?: string | null
  notify?: boolean
}

function siteUrl(origin?: string | null): string {
  if (origin) return origin.replace(/\/$/, '')
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

function worstStatus(checks: WatchdogCheck[]): WatchdogStatus {
  if (checks.some((c) => c.status === 'fail')) return 'fail'
  if (checks.some((c) => c.status === 'warning')) return 'warning'
  return 'ok'
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value?: T; ms: number; error?: unknown }> {
  const start = Date.now()
  try {
    return { value: await fn(), ms: Date.now() - start }
  } catch (error) {
    return { error, ms: Date.now() - start }
  }
}

async function checkFetch(name: string, url: string, assert?: (body: unknown) => string | null): Promise<WatchdogCheck> {
  const result = await timed(async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await fetch(url, { cache: 'no-store', signal: controller.signal })
      const contentType = res.headers.get('content-type') || ''
      const body = contentType.includes('application/json') ? await res.json() : await res.text()
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const assertion = assert?.(body)
      if (assertion) throw new Error(assertion)
    } finally {
      clearTimeout(timeout)
    }
  })

  if (result.error) {
    return {
      name,
      status: 'fail',
      detail: result.error instanceof Error ? result.error.message : 'Request failed',
      ms: result.ms,
    }
  }

  return {
    name,
    status: result.ms > 5000 ? 'warning' : 'ok',
    detail: result.ms > 5000 ? 'Responded, but slowly' : 'Healthy',
    ms: result.ms,
  }
}

async function checkDatabase(): Promise<WatchdogCheck> {
  const result = await timed(async () => {
    const supabase = getSupabase()
    const { error } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .limit(1)
    if (error) throw error
  })

  if (result.error) {
    return {
      name: 'Supabase database',
      status: 'fail',
      detail: result.error instanceof Error ? result.error.message : 'Database check failed',
      ms: result.ms,
    }
  }

  return { name: 'Supabase database', status: 'ok', detail: 'Questions table reachable', ms: result.ms }
}

async function checkErrorSignals(): Promise<WatchdogCheck> {
  const result = await timed(async () => {
    const supabase = getSupabase()
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const [{ count: crashCount, error: crashError }, { count: bugCount, error: bugError }] = await Promise.all([
      supabase
        .from('error_log')
        .select('id', { count: 'exact', head: true })
        .eq('source', 'client-crash')
        .gte('created_at', since),
      supabase
        .from('bug_reports')
        .select('id', { count: 'exact', head: true })
        .is('resolved_at', null),
    ])

    if (crashError) throw crashError
    if (bugError) throw bugError

    return {
      recentCrashes: crashCount || 0,
      openBugs: bugCount || 0,
    }
  })

  if (result.error) {
    return {
      name: 'Bug/crash signals',
      status: 'warning',
      detail: result.error instanceof Error ? result.error.message : 'Could not read feedback signals',
      ms: result.ms,
    }
  }

  const recentCrashes = result.value?.recentCrashes || 0
  const openBugs = result.value?.openBugs || 0
  const status: WatchdogStatus = recentCrashes > 0 || openBugs > 0 ? 'warning' : 'ok'
  const detail = `${recentCrashes} crashes in the last hour · ${openBugs} open bugs`

  return { name: 'Bug/crash signals', status, detail, ms: result.ms }
}

export async function runWatchdog(options: RunOptions = {}): Promise<WatchdogResult> {
  const base = siteUrl(options.origin)
  const checks = await Promise.all([
    checkFetch('Homepage', `${base}/`, (body) =>
      typeof body === 'string' && body.length > 100 ? null : 'Homepage returned an empty response'
    ),
    checkFetch('Browse API', `${base}/api/browse`, (body) => {
      if (!body || typeof body !== 'object' || !Array.isArray((body as { questions?: unknown }).questions)) {
        return 'Browse API did not return questions[]'
      }
      return null
    }),
    checkFetch('Beta status API', `${base}/api/beta-status`, (body) => {
      if (!body || typeof body !== 'object' || typeof (body as { isCapped?: unknown }).isCapped !== 'boolean') {
        return 'Beta status API did not return isCapped'
      }
      return null
    }),
    checkDatabase(),
    checkErrorSignals(),
  ])

  const result: WatchdogResult = {
    status: worstStatus(checks),
    checked_at: new Date().toISOString(),
    checks,
  }

  if (result.status === 'fail') {
    await logError('watchdog', 'Health check failed', result)

    if (options.notify !== false) {
      const rows = checks
        .map((check) => `<li><strong>${esc(check.name)}</strong>: ${esc(check.status)} — ${esc(check.detail)}</li>`)
        .join('')
      await emailAdmin(
        'Ask Elijah watchdog found a problem',
        `<p>The watchdog found a launch-blocking issue.</p><ul>${rows}</ul><p>Checked at ${esc(result.checked_at)}</p>`
      )
    }
  }

  return result
}
