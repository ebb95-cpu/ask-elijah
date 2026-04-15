import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * Safe-to-expose diagnostic for admin login. Reveals whether env vars are
 * set and whether the caller has an admin cookie. Never reveals the
 * actual password or any cookie value.
 *
 * The admin can hit /api/admin/_debug directly in a browser tab to see
 * what's wrong without reading Vercel logs.
 */
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const cookieStore = cookies()
  const tokenCookie = cookieStore.get('admin_token')

  const adminPasswordSet = typeof process.env.ADMIN_PASSWORD === 'string' && process.env.ADMIN_PASSWORD.length > 0
  const adminEmailSet = typeof process.env.ADMIN_EMAIL === 'string' && process.env.ADMIN_EMAIL.length > 0

  const cookiePresent = !!tokenCookie
  const cookieMatchesEnv = cookiePresent && adminPasswordSet && tokenCookie.value === process.env.ADMIN_PASSWORD

  return NextResponse.json({
    // Env status — booleans only, never the values
    env: {
      ADMIN_PASSWORD_set: adminPasswordSet,
      ADMIN_PASSWORD_length: adminPasswordSet ? process.env.ADMIN_PASSWORD!.length : 0,
      ADMIN_EMAIL_set: adminEmailSet,
      NODE_ENV: process.env.NODE_ENV || 'unknown',
    },
    // Cookie status — presence only, never value
    cookie: {
      present: cookiePresent,
      matchesEnv: cookieMatchesEnv,
    },
    // Deployment marker — tells you which build answered this request
    deployment: {
      vercelEnv: process.env.VERCEL_ENV || 'unknown',
      vercelUrl: process.env.VERCEL_URL || 'unknown',
      commitSha: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'unknown',
      buildTime: new Date().toISOString(),
    },
    // What to check for each outcome
    hints: {
      'ADMIN_PASSWORD_set=false': 'Env var is not set on this deployment. Go to Vercel → Settings → Environment Variables → add ADMIN_PASSWORD for Production → redeploy.',
      'cookie.present=false after login': 'Cookie is not being saved by the browser. If on Safari, check Settings → Safari → Block All Cookies is OFF.',
      'cookie.matchesEnv=false': 'Cookie exists but does not match ADMIN_PASSWORD. The env var was changed after you logged in — clear the cookie and log in again.',
      'commitSha does not match latest push': 'Deploy has not finished or failed. Check Vercel → Deployments.',
    },
  })
}
