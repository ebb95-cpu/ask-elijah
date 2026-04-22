import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { Resend } from 'resend'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code = searchParams.get('code')
  // Default destination after auth is the player's court. Callers can
  // override with ?next=... (e.g. old sign-up flow used /ask).
  const next = searchParams.get('next') ?? '/track'

  if (code) {
    const res = NextResponse.redirect(`${origin}${next}`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              res.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Check if this is a brand new user (created within last 5 minutes)
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email && user.created_at) {
        const createdAt = new Date(user.created_at).getTime()
        const now = Date.now()
        const isNewUser = now - createdAt < 5 * 60 * 1000 // 5 minutes

        if (isNewUser) {
          // Provision a profiles row for OAuth signups. The email/password
          // path does this in /api/sign-up; OAuth users land here without
          // going through that route, so we insert here. Uses the provider's
          // display name (from user_metadata) as first_name when available.
          // Fire-and-forget — if the insert fails we'd rather not block the
          // redirect, and /track has a fallback "finish your profile" nudge.
          const meta = (user.user_metadata || {}) as Record<string, unknown>
          const rawName = (meta.full_name as string)
            || (meta.name as string)
            || (meta.given_name as string)
            || ''
          const firstName = typeof rawName === 'string' && rawName.trim()
            ? rawName.trim().split(/\s+/)[0]
            : null
          try {
            await supabase.from('profiles').upsert(
              {
                id: user.id,
                email: user.email,
                ...(firstName ? { first_name: firstName } : {}),
              },
              { onConflict: 'email' },
            )
          } catch {
            /* non-fatal, /track handles incomplete profiles */
          }

          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elijahbryant.pro'
          const resend = new Resend(process.env.RESEND_API_KEY)

          resend.emails.send({
            from: 'Elijah Bryant <elijah@elijahbryant.pro>',
            to: user.email,
            subject: 'You just did something most players never do.',
            html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background-color:#000000;" bgcolor="#000000">
  <table width="100%" cellpadding="0" cellspacing="0" bgcolor="#000000" style="background-color:#000000;">
    <tr><td align="center" bgcolor="#000000" style="background-color:#000000;">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td bgcolor="#000000" style="padding:48px 32px 32px;background-color:#000000;">

          <p style="text-align:center;margin:0 0 48px;line-height:0;"><img src="https://elijahbryant.pro/logo-email.png" width="52" height="8" alt="" style="display:inline-block;border:0;width:52px;height:8px;" /></p>

          <!-- Big two-tone headline -->
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 4px;color:#ffffff !important;font-family:-apple-system,sans-serif;">Welcome.</p>
          <p style="font-size:40px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 48px;color:#555555;font-family:-apple-system,sans-serif;">I'm already in your corner.</p>

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 28px;font-family:-apple-system,sans-serif;">
            Most players never ask for help. You did.
          </p>

          <div style="border-left:3px solid #ffffff;padding-left:20px;margin-bottom:32px;">
            <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0;font-family:-apple-system,sans-serif;">
              Every question goes straight to me. I read it. I write back. Not a template. Your situation.
            </p>
          </div>

          <p style="font-size:15px;color:#ffffff !important;line-height:1.7;margin:0 0 40px;font-family:-apple-system,sans-serif;">
            Before I answer, tell me who you are. I want to know what you're working with.
          </p>

          <p style="font-size:13px;margin:0 0 56px;font-family:-apple-system,sans-serif;"><a href="${siteUrl}/profile" style="color:#555555;text-decoration:none;">Tell me who you are →</a></p>

          <p style="font-size:14px;color:#ffffff !important;margin:0 0 16px;font-family:-apple-system,sans-serif;">Elijah</p>
          <p style="font-size:11px;color:#444444;margin:0;letter-spacing:0.08em;text-transform:uppercase;font-family:-apple-system,sans-serif;">Your body is trained. Your mind isn't.</p>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
            `,
          }).catch(console.error) // fire-and-forget, don't block redirect
        }
      }

      return res
    }
  }

  // Auth failed — redirect to sign-in with error
  return NextResponse.redirect(`${origin}/sign-in?error=link_expired`)
}
