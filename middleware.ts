import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Middleware-level gate for the admin surface.
 *
 * Runs BEFORE any layout or page, so it can cleanly allow /admin/login
 * through while redirecting every other /admin/* URL to the login page
 * when the admin_token cookie is missing or wrong.
 *
 * Why this instead of a layout-level redirect? Putting the gate in the
 * layout meant /admin/login was gated by the same layout that would
 * redirect to /admin/login — a loop risk. Middleware sidesteps that
 * by matching on pathname directly.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  // Only guard the admin surface. Everything else passes through.
  if (!pathname.startsWith('/admin')) return NextResponse.next()

  // The login page and the direct-login endpoint are both public. /admin/direct
  // is a GET endpoint that sets the admin cookie and redirects; it must not
  // be gated by this middleware or the cookie never gets a chance to land.
  if (
    pathname === '/admin/login' ||
    pathname.startsWith('/admin/login/') ||
    pathname === '/admin/direct' ||
    pathname.startsWith('/admin/direct/')
  ) {
    const res = NextResponse.next()
    // Aggressive no-cache so mobile Safari can't serve a stale copy of the
    // login form (which was the root cause of the admin not being able to
    // sign in on phone — cached JS kept calling an older endpoint that had
    // since been fixed).
    res.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate')
    res.headers.set('Pragma', 'no-cache')
    res.headers.set('Expires', '0')
    return res
  }

  const token = req.cookies.get('admin_token')?.value
  const expected = process.env.ADMIN_PASSWORD

  if (!expected || token !== expected) {
    const next = pathname + (search || '')
    const loginUrl = new URL('/admin/login', req.url)
    loginUrl.searchParams.set('next', next)
    return NextResponse.redirect(loginUrl)
  }

  // ALL admin pages get aggressive no-cache. Mobile Safari was caching the
  // HTML response and serving old JS chunk URLs after a redeploy — the old
  // chunks 404 on the new deploy, which causes "Application error: a
  // client-side exception has occurred" (scripts fail to load, React never
  // mounts). This forces the browser to always fetch fresh HTML.
  const res = NextResponse.next()
  res.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate')
  res.headers.set('Pragma', 'no-cache')
  res.headers.set('Expires', '0')
  return res
}

export const config = {
  // Match every /admin path. /admin/login is handled inside the function.
  matcher: ['/admin/:path*'],
}
