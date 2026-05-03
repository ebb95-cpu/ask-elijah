import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabase } from '@/lib/supabase-server'
import { ADMIN_COOKIE, verifyAdminSession } from '@/lib/admin-auth'

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
  const cookieStore = await cookies()
  const tokenCookie = cookieStore.get(ADMIN_COOKIE)

  const adminPasswordSet = typeof process.env.ADMIN_PASSWORD === 'string' && process.env.ADMIN_PASSWORD.length > 0
  const adminEmailSet = typeof process.env.ADMIN_EMAIL === 'string' && process.env.ADMIN_EMAIL.length > 0

  const cookiePresent = !!tokenCookie
  const cookieValid = await verifyAdminSession(tokenCookie?.value)

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
      valid: cookieValid,
    },
    // Deployment marker — tells you which build answered this request
    deployment: {
      vercelEnv: process.env.VERCEL_ENV || 'unknown',
      vercelUrl: process.env.VERCEL_URL || 'unknown',
      commitSha: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'unknown',
      buildTime: new Date().toISOString(),
    },
    // Live Supabase connectivity test
    supabase: await (async () => {
      try {
        const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
        const keyLen = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim().length
        const supabase = getSupabase()
        const { count, error } = await supabase.from('questions').select('id', { count: 'exact', head: true })
        return {
          url_length: url.length,
          url_ends_with: url.slice(-5),
          key_length: keyLen,
          query_ok: !error,
          query_error: error?.message || null,
          row_count: count,
        }
      } catch (e) {
        return { error: e instanceof Error ? e.message : String(e) }
      }
    })(),
  })
}
