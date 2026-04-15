import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * One-URL admin login. Lets the admin bookmark a single URL that, when
 * opened, sets the admin cookie and redirects into the queue — with zero
 * form, zero JS, zero caching to fight. Works on any browser in any state.
 *
 * Usage: https://elijahbryant.pro/admin/direct?token=<ADMIN_PASSWORD>
 *
 * After a successful set, we redirect to /admin/questions on the same
 * origin WITHOUT the token in the URL (so it won't end up in screenshot/
 * share history). The cookie is HttpOnly + 30 days, same as the form
 * login sets.
 *
 * Security note: the token is ADMIN_PASSWORD. It appears in:
 *   - Vercel access logs
 *   - Browser history (until overwritten by the redirect — same-tab
 *     redirect does replace the entry, but some browsers keep both)
 * If either of those matters, set ADMIN_LOGIN_TOKEN to a separate random
 * string and we'll accept that too. Rotating the token invalidates the
 * link but not existing sessions (cookie already set).
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || ''
  const expected = process.env.ADMIN_LOGIN_TOKEN || process.env.ADMIN_PASSWORD || ''

  if (!expected) {
    // The server has no ADMIN_PASSWORD / ADMIN_LOGIN_TOKEN set — give a
    // clear error instead of silently rejecting.
    return new NextResponse(
      'Server is not configured: set ADMIN_PASSWORD (or ADMIN_LOGIN_TOKEN) on Vercel.',
      { status: 500, headers: { 'Content-Type': 'text/plain' } }
    )
  }

  if (token !== expected) {
    return new NextResponse('Invalid token.', {
      status: 401,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  // Where to land the admin after login. Accept ?next=/admin/... (defaults
  // to the queue). Reject external redirects for safety.
  const rawNext = req.nextUrl.searchParams.get('next') || '/admin/questions'
  const next = rawNext.startsWith('/admin') ? rawNext : '/admin/questions'

  const redirectUrl = new URL(next, req.url)
  const res = NextResponse.redirect(redirectUrl)
  res.cookies.set('admin_token', process.env.ADMIN_PASSWORD || expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
