import { NextRequest, NextResponse } from 'next/server'

/**
 * Called by the pre-login /sign-in flow to decide whether to show a password
 * prompt (admin) or send a magic link (regular user).
 *
 * IMPORTANT: This endpoint MUST be public — it runs before the user is
 * authenticated. Previously it required the admin_token cookie, which meant
 * it always returned 401 to anyone not already logged in, which caused the
 * sign-in page to fall through to the magic-link branch for every email
 * (including the real admin email), and then the magic-link step would
 * error out. That's why admin login appeared broken on /sign-in.
 *
 * The only information leaked is "does this email match ADMIN_EMAIL?" —
 * which an attacker could already infer by observing different UI paths.
 */
export async function POST(req: NextRequest) {
  const { email } = await req.json()
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? ''
  const incoming = email?.trim().toLowerCase() ?? ''
  const isAdmin = incoming !== '' && incoming === adminEmail
  return NextResponse.json({ isAdmin })
}
