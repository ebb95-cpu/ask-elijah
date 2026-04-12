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
              <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 48px 24px; color: #111; background: #fff;">

                <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 40px;">
                  <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
                  <div style="width: 24px; height: 1.5px; background: #000;"></div>
                  <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
                  <div style="width: 24px; height: 1.5px; background: #000;"></div>
                  <div style="width: 8px; height: 8px; background: #000; border-radius: 50%;"></div>
                </div>

                <p style="font-size: 26px; font-weight: 800; line-height: 1.2; margin: 0 0 24px; color: #000;">
                  Welcome. Elijah's already in your corner.
                </p>

                <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0 0 16px;">
                  Most players carry their questions alone. The doubt, the slumps, the stuff they can't talk to their coach about. They just push through and hope it gets better.
                </p>

                <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0 0 28px;">
                  You just did something different. You asked.
                </p>

                <div style="background: #f7f7f7; border-left: 3px solid #000; padding: 16px 20px; margin-bottom: 28px;">
                  <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0;">
                    Every question you send goes directly to Elijah. He reads it. He writes back. Not a template. Your situation, specifically.
                  </p>
                </div>

                <p style="font-size: 15px; color: #333; line-height: 1.7; margin: 0 0 32px;">
                  While you wait for your first answer, take 2 minutes and fill out your profile. The more Elijah knows about you, the sharper his answer.
                </p>

                <a href="${siteUrl}/profile" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: 700; margin-bottom: 40px;">
                  Complete your profile →
                </a>

                <hr style="border: none; border-top: 1px solid #eee; margin-bottom: 24px;" />

                <p style="font-size: 12px; color: #bbb; line-height: 1.6; margin: 0;">
                  You'll hear from Elijah when your answer is ready. That's it.
                </p>

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
