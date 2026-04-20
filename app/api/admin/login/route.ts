import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE, issueAdminSession } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

function passwordsMatch(got: string, expected: string): boolean {
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  if (a.length !== b.length || a.length === 0) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Admin login. Accepts either:
 *   - JSON: { password } → returns { ok: true } with Set-Cookie (used by
 *     the React login page fetch).
 *   - HTML form (application/x-www-form-urlencoded): password=... →
 *     returns a 303 redirect to `next` (or /admin/questions) with
 *     Set-Cookie. This is the no-JS fallback that works even if mobile
 *     Safari is serving a stale JS bundle — the browser submits the
 *     form natively and follows the server redirect.
 *
 * Either path produces the same httpOnly cookie with a 30-day lifetime.
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || ''
  const isForm = contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')

  let password = ''
  let next = '/admin/questions'

  if (isForm) {
    const form = await req.formData()
    password = String(form.get('password') || '')
    const rawNext = String(form.get('next') || '')
    if (rawNext.startsWith('/admin')) next = rawNext
  } else {
    try {
      const body = await req.json()
      password = body?.password || ''
      if (typeof body?.next === 'string' && body.next.startsWith('/admin')) next = body.next
    } catch {
      /* ignore — handled below */
    }
  }

  if (!process.env.ADMIN_PASSWORD) {
    const message = 'Server is not configured: ADMIN_PASSWORD is not set on Vercel. Go to Project → Settings → Environment Variables.'
    return isForm
      ? new NextResponse(message, { status: 500, headers: { 'Content-Type': 'text/plain' } })
      : NextResponse.json({ error: message }, { status: 500 })
  }

  const expected = process.env.ADMIN_PASSWORD || ''
  if (!password || !passwordsMatch(password, expected)) {
    if (isForm) {
      // Send them back to login with an error flag so the page can surface it
      const redirectUrl = new URL('/admin/login', req.url)
      redirectUrl.searchParams.set('error', 'wrong_password')
      if (next !== '/admin/questions') redirectUrl.searchParams.set('next', next)
      return NextResponse.redirect(redirectUrl, 303)
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // On form POST, return a 303 redirect (browser follows, cookie lands on the
  // redirect target's request). On JSON POST, return JSON and let the client
  // navigate.
  const redirectTarget = new URL(next, req.url)
  const res = isForm ? NextResponse.redirect(redirectTarget, 303) : NextResponse.json({ ok: true })
  // Stateless HMAC-signed session token — the cookie is NOT the password.
  // Rotating ADMIN_PASSWORD on Vercel invalidates all existing sessions.
  res.cookies.set(ADMIN_COOKIE, await issueAdminSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ADMIN_COOKIE_MAX_AGE,
    path: '/',
  })
  // Belt-and-braces: tell browsers + CDNs to never cache this response
  res.headers.set('Cache-Control', 'no-store')
  return res
}
