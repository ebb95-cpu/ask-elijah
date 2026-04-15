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
    return NextResponse.next()
  }

  const token = req.cookies.get('admin_token')?.value
  const expected = process.env.ADMIN_PASSWORD

  if (!expected || token !== expected) {
    // Preserve where the admin was trying to go so we can bounce them back
    // after successful login.
    const next = pathname + (search || '')
    const loginUrl = new URL('/admin/login', req.url)
    loginUrl.searchParams.set('next', next)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // Match every /admin path. /admin/login is handled inside the function.
  matcher: ['/admin/:path*'],
}
