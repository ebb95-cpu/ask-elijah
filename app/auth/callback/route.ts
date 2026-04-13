import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { Resend } from 'resend'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/ask'

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
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://elijahbryant.pro'
          const resend = new Resend(process.env.RESEND_API_KEY)

          resend.emails.send({
            from: 'Elijah Bryant <elijah@elijahbryant.pro>',
            to: user.email,
            subject: 'You just did something most players never do.',
            html: `
              <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; background: #000;">
                <div style="padding: 48px 32px;">

                  <div style="text-align: center; margin-bottom: 48px;">
                    <div style="display: inline-flex; gap: 6px; align-items: center;">
                      <div style="width: 8px; height: 8px; background: #fff; border-radius: 50%;"></div>
                      <div style="width: 24px; height: 1.5px; background: #fff;"></div>
                      <div style="width: 8px; height: 8px; background: #fff; border-radius: 50%;"></div>
                      <div style="width: 24px; height: 1.5px; background: #fff;"></div>
                      <div style="width: 8px; height: 8px; background: #fff; border-radius: 50%;"></div>
                    </div>
                  </div>

                  <p style="font-size: 26px; font-weight: 800; line-height: 1.2; margin: 0 0 24px; color: #fff;">
                    Welcome. I'm already in your corner.
                  </p>

                  <p style="font-size: 15px; color: #aaa; line-height: 1.7; margin: 0 0 16px;">
                    Most players carry their questions alone. The doubt, the slumps, the stuff they can't talk to their coach about. They just push through and hope it gets better.
                  </p>

                  <p style="font-size: 15px; color: #aaa; line-height: 1.7; margin: 0 0 28px;">
                    You just did something different. You asked.
                  </p>

                  <div style="border-left: 3px solid #fff; padding-left: 20px; margin-bottom: 32px;">
                    <p style="font-size: 15px; color: #ccc; line-height: 1.7; margin: 0;">
                      Every question you send comes directly to me. I read it. I write back. Not a template. Your situation, specifically.
                    </p>
                  </div>

                  <p style="font-size: 15px; color: #aaa; line-height: 1.7; margin: 0 0 40px;">
                    While you wait, take 2 minutes and tell me who you are. The more I know about your game, the sharper my answer.
                  </p>

                  <a href="${siteUrl}/profile" style="display: inline-block; background: #fff; color: #000; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: 700; margin-bottom: 48px;">
                    Tell me who you are →
                  </a>

                  <p style="font-size: 13px; color: #555; line-height: 1.6; margin: 0;">
                    Elijah
                  </p>

                </div>
              </div>
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
