export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabase } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  try {
    // Get the logged-in user from their session cookie
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
    if (!user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Fetch their questions by email, newest first. Exclude soft-deleted.
    const supabase = getSupabase()
    let { data, error }: { data: any[] | null; error: any } = await supabase
      .from('questions')
      .select('id, question, answer, sources, created_at, status, topic, approved_at, mode, rep_text, rep_status, rep_reflection, rep_reflected_at')
      .eq('email', user.email)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error && /rep_text|rep_status|rep_reflection|rep_reflected_at/.test(error.message || '')) {
      const fallback = await supabase
        .from('questions')
        .select('id, question, answer, sources, created_at, status, topic, approved_at, mode')
        .eq('email', user.email)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50)
      data = fallback.data
      error = fallback.error
    }

    if (error) throw error

    return NextResponse.json({ questions: data || [] })
  } catch (err) {
    console.error('History fetch error:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
