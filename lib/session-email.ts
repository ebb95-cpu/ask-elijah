import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { readTrackEmail } from './track-cookie'

export async function getAuthorizedEmail(req: NextRequest): Promise<string | null> {
  const res = NextResponse.next()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (user?.email) return user.email.toLowerCase()

  return readTrackEmail()
}

export async function requireAuthorizedEmail(req: NextRequest): Promise<string | NextResponse> {
  const email = await getAuthorizedEmail(req)
  if (!email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  return email
}

